
const $=id=>document.getElementById(id),D=Math.PI/180;
const show=id=>document.querySelectorAll('.s').forEach(e=>e.classList.toggle('on',e.id===id));
let R=null,stream,frames=[],targets=[],vw=0,vh=0,tU=0,tV=0,fpx=0,running=false,lastD=null,lastT=0,speed=99,stableT=0,busy=false,viewer=null,outBlob=null,outUrl='',outCv=null;
const N=window.N,native=!!(N&&N.Capacitor.isNativePlatform()),FA=native?N.FirebaseAuthentication:null;
let me=null,st=null,devId='',pendingShow=false,gyOn=false;
const cur=()=>document.querySelector('.s.on').id;
const errTxt=e=>{const c=(e&&e.code||'')+' '+(e&&e.message||e||'');
 if(/invalid-credential|wrong-password|user-not-found/.test(c))return'Неверная почта или пароль';
 if(/email-already-in-use/.test(c))return'Эта почта уже зарегистрирована';
 if(/weak-password/.test(c))return'Пароль слишком простой (минимум 6 символов)';
 if(/invalid-email/.test(c))return'Неверный адрес почты';
 if(/network/.test(c))return'Нет связи с интернетом';
 return(e&&e.message)||String(e)};
const cancelled=e=>/cancel|12501|canceled/i.test((e&&e.code||'')+' '+(e&&e.message||''));
async function api(path,body){
 if(/YOUR_PROJECT_ID/.test(API_BASE))throw new Error('Сервер не настроен (config.js)');
 const t=await FA.getIdToken();
 const r=await fetch(API_BASE+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t.token},body:JSON.stringify(Object.assign({deviceId:devId},body||{}))});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Ошибка сервера ('+r.status+')');return j}
function renderAcc(){
 if(!st){$('accTxt').textContent=(me&&me.email||'Аккаунт')+' · нет данных';return}
 let t;if(st.admin)t='Безлимит';else if(st.sub)t='Подписка до '+new Date(st.subUntil).toLocaleDateString('ru-RU');
 else t='Бесплатно осталось: '+st.freeLeft+(st.credits?' · по коду: '+st.credits:'');
 $('accTxt').innerHTML='<b></b><br>'+t;$('accTxt').firstChild.textContent=(me&&(me.email||me.displayName))||'Аккаунт';
 $('payInfo').textContent='Доступ на '+st.subDays+' дн. за '+st.price+' '+st.currency}
async function refresh(){try{st=await api('/status');$('err').textContent=''}catch(e){st=null;$('err').textContent='Ошибка: '+errTxt(e)}renderAcc();return st}
function route(){
 if(!me){if(cur()!=='capt'&&cur()!=='proc')show('auth');return}
 if(cur()==='boot'||cur()==='auth'){show('intro');refresh()}}
async function boot(){
 if(!native){show('web');return}
 try{devId=(await N.Device.getId()).identifier;
  FA.addListener('authStateChange',e=>{me=e.user||null;route()});
  me=(await FA.getCurrentUser()).user||null;route()}
 catch(e){show('auth');$('aerr').textContent='Ошибка запуска: '+errTxt(e)}}
const authDo=fn=>async()=>{$('aerr').textContent='';try{await fn();me=(await FA.getCurrentUser()).user||null;route()}catch(e){if(!cancelled(e))$('aerr').textContent=errTxt(e)}};
const cred=()=>({email:$('em').value.trim(),password:$('pw').value});
$('login').onclick=authDo(()=>FA.signInWithEmailAndPassword(cred()));
$('reg').onclick=authDo(async()=>{await FA.createUserWithEmailAndPassword(cred());try{await FA.sendEmailVerification()}catch(e){}});
$('gg').onclick=authDo(()=>FA.signInWithGoogle());
$('ap').onclick=authDo(()=>FA.signInWithApple());
$('forgot').onclick=async()=>{const e=$('em').value.trim();if(!e){$('aerr').textContent='Введи почту выше';return}
 try{await FA.sendPasswordResetEmail({email:e});$('aerr').className='er ok';$('aerr').textContent='Письмо для сброса пароля отправлено'}catch(x){$('aerr').className='er';$('aerr').textContent=errTxt(x)}};
$('out').onclick=async()=>{try{await FA.signOut()}catch(e){}me=null;st=null;route()};
$('toPay').onclick=()=>{pendingShow=false;$('payMsg').textContent='Купить доступ или ввести код активации.';$('perr').textContent='';renderAcc();show('pay')};
$('payBack').onclick=()=>{if(pendingShow&&!confirm('Готовая панорама не сохранится. Выйти?'))return;pendingShow=false;show('intro');refresh()};
$('buy').onclick=async()=>{$('perr').textContent='';try{const j=await api('/paypal/create');await N.Browser.open({url:j.url})}catch(e){$('perr').textContent=errTxt(e)}};
$('red').onclick=async()=>{$('perr').textContent='';$('perr').className='er';try{const j=await api('/redeem',{code:$('code').value});st=j.state;$('code').value='';$('perr').className='er ok';$('perr').textContent='Код принят: +'+j.added+' фото';renderAcc();if(pendingShow)finish()}catch(e){$('perr').textContent=errTxt(e)}};
$('chk').onclick=async()=>{$('perr').className='er';$('perr').textContent='';await refresh();if(st&&st.allowed){if(pendingShow)finish();else show('intro')}else $('perr').textContent=st?'Оплата пока не найдена':'Не удалось проверить'};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cur()==='pay')$('chk').click()});
async function finish(){
 try{const j=await api('/consume');st=j.state;renderAcc();
  if(!j.ok){pendingShow=true;$('payMsg').textContent='Бесплатные снимки закончились. Панорама готова, осталось открыть доступ.';$('perr').textContent='';show('pay');return}
 }catch(e){pendingShow=true;$('payMsg').textContent='Не удалось связаться с сервером. Проверь интернет и нажми «Проверить оплату».';$('perr').textContent=errTxt(e);show('pay');return}
 pendingShow=false;showResult()}
function makeSphere(cv,src,lon0){
 const gl=cv.getContext('webgl')||cv.getContext('experimental-webgl');if(!gl)throw new Error('WebGL недоступен');
 const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error('shader');return o};
 const pr=gl.createProgram();
 gl.attachShader(pr,sh(gl.VERTEX_SHADER,'attribute vec2 p;varying vec2 v;void main(){v=p;gl_Position=vec4(p,0.,1.);}'));
 gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,'#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nvarying vec2 v;uniform sampler2D t;uniform vec2 a;uniform vec2 s;void main(){float x=v.x*s.x,y=v.y*s.y;float cp=cos(a.y),sp=sin(a.y);float y2=y*cp+sp,z2=y*sp-cp;float cl=cos(a.x),sl=sin(a.x);float x3=x*cl-z2*sl,z3=x*sl+z2*cl;float lon=atan(x3,-z3),lat=atan(y2,length(vec2(x3,z3)));gl_FragColor=texture2D(t,vec2(lon/6.2831853+.5,lat/3.1415927+.5));}'));
 gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error('link');gl.useProgram(pr);
 const bf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,bf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 const lp=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(lp);gl.vertexAttribPointer(lp,2,gl.FLOAT,false,0,0);
 let img=src;const mx=gl.getParameter(gl.MAX_TEXTURE_SIZE);
 if(src.width>mx){img=document.createElement('canvas');img.width=mx;img.height=mx/2;img.getContext('2d').drawImage(src,0,0,img.width,img.height)}
 const tx=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tx);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
 [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]].forEach(q=>gl.texParameteri(gl.TEXTURE_2D,q[0],q[1]));
 const ua=gl.getUniformLocation(pr,'a'),us=gl.getUniformLocation(pr,'s'),cl=(v,a,b)=>Math.max(a,Math.min(b,v));
 let lon=lon0||0,lat=0,fov=1.4,gy=false,raf=0,dead=false;
 const draw=()=>{raf=0;if(dead)return;const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.max(2,Math.round(cv.clientWidth*dpr)),h=Math.max(2,Math.round(cv.clientHeight*dpr));
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
  if(gy&&R){const d=dirOf(R);lon=Math.atan2(d[0],d[1]);lat=Math.asin(cl(d[2],-1,1))}
  gl.viewport(0,0,w,h);const th=Math.tan(fov/2);gl.uniform2f(ua,lon,lat);gl.uniform2f(us,th*w/h,th);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  if(gy)req()};
 const req=()=>{if(!raf&&!dead)raf=requestAnimationFrame(draw)};
 const pts=new Map();let pd=0;const dist=()=>{const v=[...pts.values()];return Math.hypot(v[0][0]-v[1][0],v[0][1]-v[1][1])};
 cv.onpointerdown=e=>{try{cv.setPointerCapture(e.pointerId)}catch(x){}pts.set(e.pointerId,[e.clientX,e.clientY]);pd=pts.size===2?dist():0};
 cv.onpointermove=e=>{const o=pts.get(e.pointerId);if(!o)return;
  if(pts.size===1&&!gy){const k=fov/cv.clientHeight;lon-=(e.clientX-o[0])*k;lat=cl(lat+(e.clientY-o[1])*k,-1.48,1.48)}
  pts.set(e.pointerId,[e.clientX,e.clientY]);
  if(pts.size===2){const d=dist();if(pd)fov=cl(fov*pd/d,.45,1.9);pd=d}
  req()};
 cv.onpointerup=cv.onpointercancel=e=>{pts.delete(e.pointerId);pd=0};
 addEventListener('resize',req);req();
 return{setGyro(on){gy=on;req()},destroy(){dead=true;cancelAnimationFrame(raf);removeEventListener('resize',req);const x=gl.getExtension('WEBGL_lose_context');x&&x.loseContext()}}}
function showResult(){
 $('flat').src=outUrl;$('flat').style.display='none';$('pano').style.display='block';$('tog').textContent='Плоское фото';$('gy').textContent='Гиро: выкл';
 show('res');
 try{const d0=dirOf(frames[0].R);viewer=makeSphere($('pano'),outCv,Math.atan2(d0[0],d0[1]))}
 catch(e){viewer=null;$('pano').style.display='none';$('flat').style.display='block';$('rh').textContent='Не удалось открыть 360°, показано плоское фото'}}
const vid=$('vid'),ov=$('ov'),ctx=ov.getContext('2d');
const mat=(a,b,g)=>{a*=D;b*=D;g*=D;const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),cg=Math.cos(g),sg=Math.sin(g);
return[ca*cg-sa*sb*sg,-cb*sa,cg*sa*sb+ca*sg,cg*sa+ca*sb*sg,ca*cb,sa*sg-ca*cg*sb,-cb*sg,sb,cb*cg]};
const dirOf=m=>[-m[2],-m[5],-m[8]];
const toCam=(m,w)=>[m[0]*w[0]+m[3]*w[1]+m[6]*w[2],m[1]*w[0]+m[4]*w[1]+m[7]*w[2],m[2]*w[0]+m[5]*w[1]+m[8]*w[2]];
addEventListener('deviceorientation',e=>{if(e.beta!=null)R=mat(e.alpha||0,e.beta,e.gamma)});

$('go').onclick=async()=>{
 $('err').textContent='';
 if(!(await refresh()))return;
 if(!st.allowed){pendingShow=false;$('payMsg').textContent='Бесплатные снимки закончились. Купи доступ или введи код.';$('perr').textContent='';show('pay');return}
 try{
  if(typeof DeviceOrientationEvent!=='undefined'&&DeviceOrientationEvent.requestPermission){
   if(await DeviceOrientationEvent.requestPermission()!=='granted')throw new Error('Нет доступа к датчикам движения');}
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1440},height:{ideal:1920}},audio:false});
  vid.srcObject=stream;await vid.play();
  await new Promise(r=>{if(vid.videoWidth)r();else vid.onloadedmetadata=r});
  vw=vid.videoWidth;vh=vid.videoHeight;
  const tl=Math.tan((+$('fov').value||65)*D/2);
  tU=tl*Math.min(1,vw/vh);tV=tl*Math.min(1,vh/vw);fpx=(vh/2)/tV;
  let t0=0;while(!R&&t0++<30)await new Promise(r=>setTimeout(r,100));
  if(!R)throw new Error('Датчики движения не отвечают');
  const d=dirOf(R),yaw0=Math.atan2(d[0],d[1]);
  targets=[];frames=[];
  [[0,11],[35,9],[-35,9],[68,5],[-68,5]].forEach(([p,n],ri)=>{
   for(let k=0;k<n;k++){const lon=yaw0+(k+(ri%2&&ri<3?.5:0))*2*Math.PI/n,la=p*D;
    targets.push({w:[Math.cos(la)*Math.sin(lon),Math.cos(la)*Math.cos(lon),Math.sin(la)],done:false});}});
  show('capt');running=true;upd();requestAnimationFrame(loop);
 }catch(e){$('err').textContent='Ошибка: '+(e.message||e)}
};
$('cancel').onclick=()=>{running=false;stream&&stream.getTracks().forEach(t=>t.stop());show('intro')};
$('done').onclick=()=>stitch();
const upd=()=>{const left=targets.length-frames.length;$('cnt').textContent=left>0?'Осталось кружков: '+left+' из '+targets.length:'Все кружки сняты!';$('cbar').style.width=(targets.length?frames.length/targets.length*100:0)+'%';$('done').disabled=frames.length<10};

function arrow(x,y,ang,sz){ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.beginPath();ctx.moveTo(sz,0);ctx.lineTo(-sz*.6,-sz*.85);ctx.lineTo(-sz*.15,0);ctx.lineTo(-sz*.6,sz*.85);ctx.closePath();
 ctx.lineJoin='round';ctx.lineWidth=5;ctx.strokeStyle='rgba(0,0,0,.85)';ctx.stroke();ctx.fillStyle='#ffd400';ctx.fill();ctx.restore()}
function loop(){
 if(!running)return;requestAnimationFrame(loop);
 const W=ov.clientWidth,H=ov.clientHeight;if(ov.width!==W||ov.height!==H){ov.width=W;ov.height=H}
 ctx.clearRect(0,0,W,H);if(!R)return;
 const now=performance.now(),d=dirOf(R);
 if(lastD){const dt=(now-lastT)/1000,c=Math.min(1,Math.max(-1,d[0]*lastD[0]+d[1]*lastD[1]+d[2]*lastD[2]));
  if(dt>0)speed=.7*speed+.3*(Math.acos(c)/D/dt)}
 lastD=d;lastT=now;
 const s=Math.max(W/vw,H/vh);let best=null,bd=-2;
 for(const t of targets){const dot=t.w[0]*d[0]+t.w[1]*d[1]+t.w[2]*d[2];if(!t.done&&dot>bd){bd=dot;best=t}
  const c=toCam(R,t.w);if(c[2]>-.05)continue;
  const x=W/2+fpx*s*c[0]/-c[2],y=H/2-fpx*s*c[1]/-c[2];
  ctx.beginPath();ctx.arc(x,y,t.done?10:18,0,7);
  if(t.done){ctx.fillStyle='rgba(60,220,120,.75)';ctx.fill()}else{ctx.strokeStyle='rgba(0,0,0,.7)';ctx.lineWidth=7;ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.stroke()}}
 ctx.beginPath();ctx.arc(W/2,H/2,9,0,7);ctx.strokeStyle='#ffd400';ctx.lineWidth=3;ctx.stroke();
 let hint='Следуй за стрелкой к белому кружку';
 if(best&&bd<=Math.cos(6*D)){
  const c=toCam(R,best.w);let ax=c[0],ay=-c[1],l=Math.hypot(ax,ay);if(l<1e-3){ax=1;ay=0;l=1}
  const ang=Math.atan2(ay,ax),r0=Math.min(W,H)*.3,pl=1+.12*Math.sin(now/180),deg=Math.round(Math.acos(Math.min(1,bd))/D);
  const px=W/2+ax/l*r0,py=H/2+ay/l*r0;arrow(px,py,ang,26*pl);
  ctx.font='700 15px sans-serif';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.8)';ctx.fillStyle='#ffd400';
  const tx=W/2+ax/l*(r0+48),ty=H/2+ay/l*(r0+48)+5;ctx.strokeText(deg+'°',tx,ty);ctx.fillText(deg+'°',tx,ty)}
 if(best&&bd>Math.cos(6*D)){
  if(speed>12){hint='Медленнее, держи ровно';stableT=0}
  else{hint='Замри…';if(!stableT)stableT=now;
   ctx.beginPath();ctx.arc(W/2,H/2,16,-Math.PI/2,-Math.PI/2+Math.min(1,(now-stableT)/350)*2*Math.PI);ctx.strokeStyle='#3cdc78';ctx.stroke();
   if(now-stableT>350&&!busy)capture(best)}
 }else stableT=0;
 $('hint').textContent=best?hint:'Готово!';
}

async function capture(t){
 busy=true;t.done=true;const m=R.slice(),sc=Math.min(1,1600/Math.max(vw,vh));
 const c=document.createElement('canvas');c.width=Math.round(vw*sc);c.height=Math.round(vh*sc);
 c.getContext('2d').drawImage(vid,0,0,c.width,c.height);
 const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.92));
 frames.push({blob,R:m});upd();
 $('fl').style.opacity=.7;setTimeout(()=>$('fl').style.opacity=0,80);
 stableT=0;busy=false;
 if(frames.length===targets.length)stitch();
}

async function stitch(){
 if(!running)return;running=false;stream.getTracks().forEach(t=>t.stop());show('proc');
 const W=+$('size').value,H=W/2,acc=new Float32Array(W*H*3),wt=new Float32Array(W*H),sL=new Float32Array(W),cL=new Float32Array(W);
 for(let x=0;x<W;x++){const l=((x+.5)/W-.5)*2*Math.PI;sL[x]=Math.sin(l);cL[x]=Math.cos(l)}
 const hd=Math.atan(Math.hypot(tU,tV))+.04;
 for(let i=0;i<frames.length;i++){
  $('pt').textContent='Склейка '+(i+1)+' / '+frames.length;$('bar').style.width=(i/frames.length*100)+'%';
  await new Promise(r=>setTimeout(r,0));
  const f=frames[i],bmp=await createImageBitmap(f.blob),fw=bmp.width,fh=bmp.height;
  const c=document.createElement('canvas');c.width=fw;c.height=fh;const g=c.getContext('2d');g.drawImage(bmp,0,0);
  const px=g.getImageData(0,0,fw,fh).data,m=f.R,d=dirOf(m),pc=Math.asin(Math.max(-1,Math.min(1,d[2]))),lc=Math.atan2(d[0],d[1]);
  const ya=Math.max(0,Math.floor((.5-(pc+hd)/Math.PI)*H)),yb=Math.min(H-1,Math.ceil((.5-(pc-hd)/Math.PI)*H)),xc=(lc/(2*Math.PI)+.5)*W;
  for(let y=ya;y<=yb;y++){
   const lat=(.5-(y+.5)/H)*Math.PI,sl=Math.sin(lat),cl=Math.cos(lat);
   const cm=Math.max(Math.cos(Math.min(1.5707,Math.max(Math.abs(lat),Math.abs(pc)))),.02),dx=Math.min(W/2,hd/cm/(2*Math.PI)*W);
   for(let xx=Math.floor(xc-dx);xx<=Math.ceil(xc+dx);xx++){
    const x=((xx%W)+W)%W,wx=cl*sL[x],wy=cl*cL[x],cz=m[2]*wx+m[5]*wy+m[8]*sl;if(cz>-1e-4)continue;
    const k=-1/cz,u=(m[0]*wx+m[3]*wy+m[6]*sl)*k/tU,v=(m[1]*wx+m[4]*wy+m[7]*sl)*k/tV;
    if(u>1||u<-1||v>1||v<-1)continue;
    const sx=(u+1)/2*(fw-1),sy=(1-v)/2*(fh-1),x0=sx|0,y0=sy|0,x1=Math.min(x0+1,fw-1),y1=Math.min(y0+1,fh-1),ax=sx-x0,ay=sy-y0;
    const a=(y0*fw+x0)*4,b=(y0*fw+x1)*4,cc=(y1*fw+x0)*4,e=(y1*fw+x1)*4,w0=(1-ax)*(1-ay),w1=ax*(1-ay),w2=(1-ax)*ay,w3=ax*ay;
    let w=(1-Math.abs(u))*(1-Math.abs(v));w*=w;const o=y*W+x;
    for(let q=0;q<3;q++)acc[o*3+q]+=w*(px[a+q]*w0+px[b+q]*w1+px[cc+q]*w2+px[e+q]*w3);
    wt[o]+=w;
   }}
  bmp.close&&bmp.close();
 }
 $('pt').textContent='Сохранение…';await new Promise(r=>setTimeout(r,0));
 const out=document.createElement('canvas');out.width=W;out.height=H;const og=out.getContext('2d'),img=og.createImageData(W,H);
 for(let o=0;o<W*H;o++){const w=wt[o],p=o*4;if(w>0){img.data[p]=acc[o*3]/w;img.data[p+1]=acc[o*3+1]/w;img.data[p+2]=acc[o*3+2]/w}else{img.data[p]=img.data[p+1]=img.data[p+2]=40}img.data[p+3]=255}
 og.putImageData(img,0,0);outCv=out;
 outUrl=out.toDataURL('image/jpeg',.92);outBlob=await new Promise(r=>out.toBlob(r,'image/jpeg',.92));
 await finish();
}
$('tog').onclick=()=>{const f=$('flat'),on=f.style.display==='block';f.style.display=on?'none':'block';$('pano').style.display=on?'block':'none';
 $('tog').textContent=on?'Плоское фото':'Вернуться в 360';if(viewer){if(on)viewer.setGyro(gyOn);else{gyOn=false;viewer.setGyro(false);$('gy').textContent='Гиро: выкл'}}};
$('gy').onclick=()=>{if(!viewer)return;if($('pano').style.display==='none')$('tog').click();gyOn=!gyOn;viewer.setGyro(gyOn);$('gy').textContent='Гиро: '+(gyOn?'вкл':'выкл')};
function addXmp(u8,w,h){
 // GPano XMP: Google Фото и другие просмотрщики откроют файл как сферу 360°
 const x='<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:GPano="http://ns.google.com/photos/1.0/panorama/" GPano:UsePanoramaViewer="True" GPano:ProjectionType="equirectangular" GPano:FullPanoWidthPixels="'+w+'" GPano:FullPanoHeightPixels="'+h+'" GPano:CroppedAreaImageWidthPixels="'+w+'" GPano:CroppedAreaImageHeightPixels="'+h+'" GPano:CroppedAreaLeftPixels="0" GPano:CroppedAreaTopPixels="0" GPano:PoseHeadingDegrees="0"/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
 const hd='http://ns.adobe.com/xap/1.0/\0',body=new TextEncoder().encode(hd+x),len=body.length+2;
 if(u8[0]!==0xFF||u8[1]!==0xD8||len>65535)return u8;
 let at=2;if(u8[2]===0xFF&&u8[3]===0xE0)at=4+((u8[4]<<8)|u8[5]);
 const out=new Uint8Array(u8.length+body.length+4);
 out.set(u8.subarray(0,at),0);out[at]=0xFF;out[at+1]=0xE1;out[at+2]=len>>8;out[at+3]=len&255;out.set(body,at+4);out.set(u8.subarray(at),at+4+body.length);return out}
const b64=u=>{let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
async function pano64(){return b64(addXmp(new Uint8Array(await outBlob.arrayBuffer()),outCv.width,outCv.height))}
const sv=(t,ok)=>{$('sv').textContent=t;$('sv').style.color=ok?'#2ea043':'#e5484d'};
$('save').onclick=async()=>{sv('Сохраняю…',1);
 try{const M=N.Media,name='Pano360',al=(await M.getAlbumsPath()).path+'/'+name;
  try{await M.createAlbum({name})}catch(e){}
  await M.savePhoto({path:'data:image/jpeg;base64,'+await pano64(),albumIdentifier:al,fileName:'pano360_'+Date.now()});
  sv('Сохранено в галерею, альбом «'+name+'»',1)}
 catch(e){sv('Не удалось сохранить: '+((e&&e.message)||e),0)}};
$('share').onclick=async()=>{sv('',1);
 try{const w=await N.Filesystem.writeFile({path:'pano360_'+Date.now()+'.jpg',data:await pano64(),directory:'CACHE'});
  await N.Share.share({title:'Панорама 360',files:[w.uri]})}
 catch(e){if(!/cancel/i.test((e&&e.message)||''))sv('Не удалось поделиться: '+((e&&e.message)||e),0)}};
$('again').onclick=()=>{$('sv').textContent='';viewer&&viewer.destroy&&viewer.destroy();viewer=null;gyOn=false;outCv=null;frames=[];$('flat').style.display='none';$('pano').style.display='block';$('tog').textContent='Плоское фото';show('intro');refresh()};
boot();
