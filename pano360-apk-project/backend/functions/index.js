const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

const REGION = "europe-west1";
const num = (v, d) => (Number.isFinite(+v) && v !== "" && v != null ? +v : d);
const FREE = () => num(process.env.FREE_PHOTOS, 5);
const SUB_DAYS = () => num(process.env.SUB_DAYS, 30);
const PRICE = () => (process.env.PRICE || "4.99");
const CURRENCY = () => (process.env.CURRENCY || "EUR");
const ADMINS = () => (process.env.ADMIN_EMAILS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
const PAYPAL = () => (process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");

// Коды активации хранятся только как SHA-256 хэши. Значение = сколько фото даёт код.
// Чтобы добавить новые: node -e 'console.log(require("crypto").createHash("sha256").update("ABCDEFGH1234").digest("hex"))'
// (код без дефисов, заглавными) и вставить хэш сюда.
const CODES = {
  "6e8f8f857db872cd042392de9dbcab56ddaac85460da727d0d404ba37019a265": 100,
  "c7a96417b56967fd909298c71a80be1b311300321f90ef1dc3305514ea8827f3": 100,
  "657ea4b5a606fb5775bf1d80665414209518b18c80841fa2f9e7232cd4059bb8": 100,
};

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const normCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

async function authUser(req) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer (.+)$/);
  if (!m) throw Object.assign(new Error("Нужно войти в аккаунт"), { code: 401 });
  try {
    return await admin.auth().verifyIdToken(m[1]);
  } catch (e) {
    throw Object.assign(new Error("Сессия устарела, войди заново"), { code: 401 });
  }
}

const isAdmin = (tok) => !!tok.email && tok.email_verified === true && ADMINS().includes(tok.email.toLowerCase());

function devKey(deviceId) {
  const d = String(deviceId || "");
  if (d.length < 8 || d.length > 200) throw Object.assign(new Error("Не удалось определить устройство"), { code: 400 });
  return sha("dev:" + d);
}

function view(user, dev, admin_) {
  const now = Date.now();
  const subUntil = user.subUntil || 0;
  const freeLeft = Math.max(0, FREE() - (dev.used || 0));
  const credits = user.credits || 0;
  const sub = subUntil > now;
  return {
    admin: admin_, sub, subUntil, credits, freeLeft,
    allowed: admin_ || sub || credits > 0 || freeLeft > 0,
    price: PRICE(), currency: CURRENCY(), subDays: SUB_DAYS(),
  };
}

async function getState(uid, dk, admin_) {
  const [u, d] = await Promise.all([db.doc("users/" + uid).get(), db.doc("devices/" + dk).get()]);
  return view(u.exists ? u.data() : {}, d.exists ? d.data() : {}, admin_);
}

// Списать одну панораму. Порядок: безлимит -> активная подписка -> бесплатные (на устройство) -> кредиты кодов.
async function consume(uid, dk, admin_) {
  const uRef = db.doc("users/" + uid), dRef = db.doc("devices/" + dk);
  return db.runTransaction(async (t) => {
    const [u, d] = await Promise.all([t.get(uRef), t.get(dRef)]);
    const user = u.exists ? u.data() : {}, dev = d.exists ? d.data() : {};
    const now = Date.now();
    let ok = false;
    if (admin_ || (user.subUntil || 0) > now) {
      ok = true;
    } else if ((dev.used || 0) < FREE()) {
      dev.used = (dev.used || 0) + 1;
      t.set(dRef, { used: dev.used, updated: now }, { merge: true });
      ok = true;
    } else if ((user.credits || 0) > 0) {
      user.credits -= 1;
      t.set(uRef, { credits: user.credits }, { merge: true });
      ok = true;
    }
    return { ok, state: view(user, dev, admin_) };
  });
}

async function redeem(uid, code) {
  const h = sha(normCode(code));
  const credits = CODES[h];
  if (!credits) throw Object.assign(new Error("Неверный код"), { code: 400 });
  const cRef = db.doc("codes/" + h), uRef = db.doc("users/" + uid);
  await db.runTransaction(async (t) => {
    const c = await t.get(cRef);
    if (c.exists) throw Object.assign(new Error("Этот код уже использован"), { code: 400 });
    const u = await t.get(uRef);
    const cur = u.exists ? u.data().credits || 0 : 0;
    t.set(cRef, { uid, at: Date.now(), credits });
    t.set(uRef, { credits: cur + credits }, { merge: true });
  });
  return credits;
}

// ---------- PayPal ----------
async function ppToken() {
  const id = process.env.PAYPAL_CLIENT_ID, sec = process.env.PAYPAL_SECRET;
  if (!id || !sec) throw Object.assign(new Error("Оплата ещё не настроена"), { code: 503 });
  const r = await fetch(PAYPAL() + "/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(id + ":" + sec).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const j = await r.json();
  if (!j.access_token) throw Object.assign(new Error("PayPal недоступен"), { code: 502 });
  return j.access_token;
}

async function ppCreate(uid, base) {
  const tok = await ppToken();
  const r = await fetch(PAYPAL() + "/v2/checkout/orders", {
    method: "POST",
    headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        description: "Панорама 360: доступ на " + SUB_DAYS() + " дн.",
        amount: { currency_code: CURRENCY(), value: PRICE() },
      }],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Панорама 360",
            user_action: "PAY_NOW",
            landing_page: "GUEST_CHECKOUT", // можно платить картой без аккаунта PayPal
            shipping_preference: "NO_SHIPPING",
            return_url: base + "/paypal/return",
            cancel_url: base + "/paypal/cancel",
          },
        },
      },
    }),
  });
  const o = await r.json();
  const link = (o.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve");
  if (!o.id || !link) { console.error("PayPal create failed", JSON.stringify(o)); throw Object.assign(new Error("Не удалось создать платёж"), { code: 502 }); }
  await db.doc("orders/" + o.id).set({ uid, status: "created", at: Date.now() });
  return link.href;
}

async function ppCapture(orderId) {
  const oRef = db.doc("orders/" + orderId);
  const o = await oRef.get();
  if (!o.exists) throw Object.assign(new Error("Заказ не найден"), { code: 404 });
  if (o.data().status === "paid") return true;
  const tok = await ppToken();
  const r = await fetch(PAYPAL() + "/v2/checkout/orders/" + encodeURIComponent(orderId) + "/capture", {
    method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: "{}",
  });
  const j = await r.json();
  const cap = j.purchase_units && j.purchase_units[0] && j.purchase_units[0].payments && j.purchase_units[0].payments.captures && j.purchase_units[0].payments.captures[0];
  if (j.status !== "COMPLETED" || !cap || cap.status !== "COMPLETED") { console.error("PayPal capture failed", JSON.stringify(j)); return false; }
  if (cap.amount.currency_code !== CURRENCY() || +cap.amount.value !== +PRICE()) { console.error("Amount mismatch", JSON.stringify(cap.amount)); return false; }
  const uRef = db.doc("users/" + o.data().uid);
  await db.runTransaction(async (t) => {
    const [oo, u] = await Promise.all([t.get(oRef), t.get(uRef)]);
    if (oo.data().status === "paid") return;
    const cur = u.exists ? u.data().subUntil || 0 : 0;
    const until = Math.max(cur, Date.now()) + SUB_DAYS() * 86400000;
    t.set(uRef, { subUntil: until }, { merge: true });
    t.update(oRef, { status: "paid", paidAt: Date.now() });
  });
  return true;
}

const page = (title, text) => "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><body style='font-family:system-ui;text-align:center;padding:48px 20px'><h2>" + title + "</h2><p>" + text + "</p></body>";

exports.api = functions
  .region(REGION)
  .runWith({ secrets: ["PAYPAL_CLIENT_ID", "PAYPAL_SECRET"], memory: "256MB", timeoutSeconds: 60 })
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    if (req.method === "OPTIONS") return res.status(204).send("");
    const path = req.path.replace(/\/+$/, "");
    const project = process.env.GCLOUD_PROJECT || JSON.parse(process.env.FIREBASE_CONFIG || "{}").projectId;
    const base = "https://" + REGION + "-" + project + ".cloudfunctions.net/api";
    try {
      if (req.method === "GET" && path === "/paypal/return") {
        const ok = await ppCapture(String(req.query.token || "")).catch(() => false);
        return res.status(200).send(ok ? page("Оплата прошла ✅", "Вернись в приложение «Панорама 360».") : page("Платёж не подтверждён", "Вернись в приложение и нажми «Проверить оплату»."));
      }
      if (req.method === "GET" && path === "/paypal/cancel") return res.status(200).send(page("Оплата отменена", "Вернись в приложение."));
      if (req.method !== "POST") return res.status(404).json({ error: "not found" });

      const tok = await authUser(req);
      const uid = tok.uid, adm = isAdmin(tok), body = req.body || {};
      if (path === "/status") return res.json(await getState(uid, devKey(body.deviceId), adm));
      if (path === "/consume") {
        const r = await consume(uid, devKey(body.deviceId), adm);
        return res.json({ ok: r.ok, state: r.state });
      }
      if (path === "/redeem") {
        const added = await redeem(uid, body.code);
        return res.json({ added, state: await getState(uid, devKey(body.deviceId), adm) });
      }
      if (path === "/paypal/create") return res.json({ url: await ppCreate(uid, base) });
      return res.status(404).json({ error: "not found" });
    } catch (e) {
      const code = e.code && Number.isInteger(e.code) ? e.code : 500;
      if (code === 500) console.error(e);
      return res.status(code).json({ error: code === 500 ? "Ошибка сервера" : e.message });
    }
  });
