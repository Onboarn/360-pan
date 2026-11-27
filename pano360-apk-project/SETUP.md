# Настройка аккаунтов, лимита и оплаты

## 1. Firebase (аккаунты + база + сервер)
1. https://console.firebase.google.com → Создать проект.
2. Build → Authentication → Sign-in method: включи **Email/Password** и **Google**.
   (Apple: нужен платный Apple Developer ($99/год), Services ID и ключ. Без этого кнопка Apple покажет ошибку. Можно не включать.)
3. Build → Firestore Database → Create database (production mode, регион eur3 или europe-west).
4. Внизу слева смени тариф на **Blaze** (нужна карта; на малом объёме обычно 0 €). Без Blaze сервер не развернуть.
5. Project settings → Add app → Android:
   - package name: `com.pano360.app`
   - SHA-1: `D6:F4:D1:24:93:91:DF:0E:EC:10:FA:AC:E8:CA:7E:6C:DD:93:2C:F4`
   - скачай `google-services.json` (ПОСЛЕ включения Google входа) и положи в `android/app/google-services.json` в репозитории.

## 2. PayPal
1. https://developer.paypal.com → Apps & Credentials → Create App (сначала Sandbox).
2. Скопируй Client ID и Secret.
3. Для настоящих платежей: вкладка Live, свои Client ID и Secret, и в `backend/functions/.env` поставь `PAYPAL_ENV=live`.

## 3. Деплой сервера (на твоём компьютере)
Нужен Node.js 22+.
```
npm i -g firebase-tools
firebase login
cd backend
firebase use --add            # выбери свой проект
```
Открой `backend/functions/.env` и впиши свой email в `ADMIN_EMAILS` (тот, которым входишь; почта должна быть подтверждена, Google вход подходит). Там же цена и срок.
```
firebase functions:secrets:set PAYPAL_CLIENT_ID
firebase functions:secrets:set PAYPAL_SECRET
cd functions && npm install && cd ..
firebase deploy --only functions,firestore
```

## 4. Адрес сервера в приложении
В `www/config.js` замени `YOUR_PROJECT_ID` на ID проекта Firebase и загрузи файл в репозиторий. GitHub Actions соберёт новый APK.

## Коды активации
Каждый даёт 100 фото и работает один раз. Использованные видны в Firestore, коллекция `codes`.
Новый код: придумай 12 символов (A-Z, 2-9), посчитай хэш и добавь в список `CODES` в `backend/functions/index.js`, затем снова `firebase deploy --only functions`:
```
node -e 'console.log(require("crypto").createHash("sha256").update("ABCDEFGH2345").digest("hex"))'
```
