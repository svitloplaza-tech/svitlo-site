// @ts-nocheck
import { createOrb3D, webglOK } from './orb3d';
// Анімація сцен головної: сфери SP-P1228, крапкова сітка, температура, паралакс (перенесено з прототипу).
// Сфери малює WebGL (orb3d.js, 3D-модель); 2D-малювання нижче — запасний варіант без WebGL.
export function initHome(root, Lenis){

  document.documentElement.classList.add('js');
  const $=s=>root.querySelector(s);
  let alive=true; const offs=[];
  const on=(t,ev,fn,o)=>{t.addEventListener(ev,fn,o);offs.push(()=>t.removeEventListener(ev,fn,o))};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
  const ss=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
  const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const mixA=(A,B,t)=>A.map((v,i)=>v+(B[i]-v)*t);
  const rgb=(c,a=1)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
  const mixHex=(a,b,t)=>'#'+mixA(hex(a),hex(b),t).map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');

  let lenis=null;
  if(!reduce && Lenis){ try{ lenis=new Lenis({lerp:.09}); const raf=t=>{if(!alive)return;lenis.raf(t);requestAnimationFrame(raf)};requestAnimationFrame(raf);}catch(e){} }

  /* ---------- Сфери: геометрія ---------- */
  let seed=7; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  function buildOrb(nArcs){
    const arcs=[],leds=[];
    for(let i=0;i<nArcs;i++){
      const z=rnd()*2-1, a=rnd()*Math.PI*2, r=Math.sqrt(1-z*z);
      const n=[r*Math.cos(a),r*Math.sin(a),z];
      let u=Math.abs(n[0])<.9?[1,0,0]:[0,1,0];
      const d=u[0]*n[0]+u[1]*n[1]+u[2]*n[2]; u=[u[0]-d*n[0],u[1]-d*n[1],u[2]-d*n[2]];
      const ul=Math.hypot(...u); u=u.map(v=>v/ul);
      const v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]];
      const rad=.9+rnd()*.1, start=rnd()*Math.PI*2, len=Math.PI*(1.1+rnd()*.9);
      const pts=[]; const N=40;
      for(let k=0;k<=N;k++){const t=start+len*k/N;pts.push([rad*(Math.cos(t)*u[0]+Math.sin(t)*v[0]),rad*(Math.cos(t)*u[1]+Math.sin(t)*v[1]),rad*(Math.cos(t)*u[2]+Math.sin(t)*v[2]),t])}
      arcs.push({pts,ph:rnd()*6.28});
      const nl=3+Math.floor(rnd()*3);
      for(let k=0;k<nl;k++){const idx=2+Math.floor(rnd()*(N-4));leds.push({p:pts[idx],q:pts[idx+1],tw:rnd()*6.28})}
    }
    return {arcs,leds};
  }
  // далека (менша, вище, тьмяніша) малюється першою; ближня — більша, нижче
  const ORBS=[
    {g:buildOrb(14),x:.66,y:.27,mx:.70,my:.24,s:.55,depth:.5,spin:-.8,off:1.7,delay:.1,drift:.03,blur:1.2},
    {g:buildOrb(18),x:.40,y:.42,mx:.40,my:.40,s:1,depth:1,spin:1,off:0,delay:0,drift:.09,blur:0}
  ];
  const FIN={
    CH:{dark:hex('#2a2a2c'),mid:hex('#8d8f94'),hi:hex('#ffffff'),litTint:hex('#FFF2E2')},
    GD:{dark:hex('#3a2a0e'),mid:hex('#B08A3A'),hi:hex('#FFE7A8'),litTint:hex('#FFE0B0')}
  };
  let finish='CH';
  const LIGHT=hex('#FFF4E8');

  /* ---------- Полотна ---------- */
  const orb=$('#orb'), bg=$('#bg'), bctx=bg.getContext('2d');
  const use3d=webglOK(); let gl3=null, fade=0; // gl3 — рендер 3D-моделі, коли завантажиться
  const octx=use3d?null:orb.getContext('2d');
  if(use3d) orb.classList.add('gl');
  const mask=document.createElement('canvas'), mctx=mask.getContext('2d');
  let W=0,H=0,DPR=1,R0=0,dotTile=null,mobile=false;
  function layout(){
    ORBS.forEach(o=>{
      o.R=R0*o.s;
      o.cx=W*(mobile?o.mx:o.x);
      o.cy0=Math.max(o.R+80,H*(mobile?o.my:o.y));
    });
  }
  function size(){
    const r=orb.getBoundingClientRect(); W=r.width;H=r.height; mobile=W<720;
    // Продуктивність: сфери — до 1.5x (на телефоні 1x), крапки й маска — завжди 1x
    DPR=mobile?1:Math.min(1.5,devicePixelRatio||1);
    if(octx){orb.width=W*DPR;orb.height=H*DPR;octx.setTransform(DPR,0,0,DPR,0,0)}
    if(gl3) gl3.resize(W,H,DPR);
    [bg,mask].forEach(c=>{c.width=W;c.height=H});
    bctx.setTransform(1,0,0,1,0,0); mctx.setTransform(1,0,0,1,0,0);
    R0=mobile?Math.min(W*.36,H*.2):Math.min(W*.26,H*.27);
    layout();
    dotTile=document.createElement('canvas'); dotTile.width=W; dotTile.height=H;
    const t=dotTile.getContext('2d'); t.fillStyle='#fff';
    t.beginPath(); for(let y=7;y<H;y+=14)for(let x=7;x<W;x+=14){t.moveTo(x+1.25,y);t.arc(x,y,1.25,0,6.283)} t.fill();
    lastKey='';
  }
  const glow=document.createElement('canvas'); glow.width=glow.height=128;
  (()=>{const g=glow.getContext('2d');const gr=g.createRadialGradient(64,64,0,64,64,64);
    gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.12,'rgba(255,240,220,.85)');gr.addColorStop(.4,'rgba(255,170,110,.18)');gr.addColorStop(1,'rgba(255,120,60,0)');
    g.fillStyle=gr;g.fillRect(0,0,128,128)})();

  /* Крапки: сяйво від кожної сфери, яскравість і радіус ростуть зі світлом */
  let lastKey='';
  function drawDots(){
    // перемальовуємо крапки лише при помітній зміні (крок 0.03 яскравості і 6 px)
    const key=ORBS.map(o=>Math.round(o.lit*33)+'|'+Math.round(o.cy/6)).join();
    if(key===lastKey) return; lastKey=key;
    mctx.globalCompositeOperation='source-over'; mctx.clearRect(0,0,W,H);
    mctx.globalCompositeOperation='lighter';
    for(const o of ORBS){
      const reach=Math.max(W,H)*(.2+o.lit*.42)*(.55+o.s*.45);
      const a0=(.06+o.lit*.55)*Math.sqrt(o.depth);
      const g=mctx.createRadialGradient(o.cx,o.cy,o.R*.2,o.cx,o.cy,reach);
      g.addColorStop(0,`rgba(0,0,0,${a0})`);g.addColorStop(.35,`rgba(0,0,0,${a0*.45})`);
      g.addColorStop(.7,`rgba(0,0,0,${a0*.12})`);g.addColorStop(1,'rgba(0,0,0,0)');
      mctx.fillStyle=g; mctx.fillRect(0,0,W,H);
    }
    bctx.globalCompositeOperation='source-over'; bctx.clearRect(0,0,W,H);
    bctx.drawImage(dotTile,0,0,W,H);
    bctx.globalCompositeOperation='destination-in'; bctx.drawImage(mask,0,0,W,H);
    bctx.globalCompositeOperation='source-atop';
    const n=ORBS[1], L=n.lit, reach=Math.max(W,H)*.7;
    const tg=bctx.createRadialGradient(n.cx,n.cy,0,n.cx,n.cy,reach);
    tg.addColorStop(0,rgb(mixA([200,200,200],[255,214,170],L)));
    tg.addColorStop(1,rgb(mixA([150,150,150],[255,170,110],L*.6)));
    bctx.fillStyle=tg; bctx.fillRect(0,0,W,H);
    bctx.globalCompositeOperation='source-over';
  }

  /* Малювання однієї сфери */
  let yaw=0, pitch=-.25, lit=0, time=0;
  function project(p,o){
    const yw=yaw*o.spin+o.off;
    const c=Math.cos(yw),s=Math.sin(yw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    const x=p[0]*c+p[2]*s, z=-p[0]*s+p[2]*c, y=p[1];
    const y2=y*cp-z*sp, z2=y*sp+z*cp, f=3.2/(3.2-z2);
    return [o.cx+x*o.R*f, o.cy+y2*o.R*f, z2];
  }
  // Далеку сферу малюємо в пів-роздільності й розтягуємо — природне розмиття без дорогого canvas filter
  const farC=document.createElement('canvas'), fctx=farC.getContext('2d');
  function drawOrb(o,c){
    const F=FIN[finish], K=o.depth, L=o.lit;
    c.strokeStyle=rgb(mixA([60,60,60],F.mid,.4),.9*K); c.lineWidth=1.5*o.s;
    c.beginPath();c.moveTo(o.cx,0);c.lineTo(o.cx,o.cy-o.R*.9);c.stroke();
    c.fillStyle=rgb(F.dark,K); c.fillRect(o.cx-22*o.s,0,44*o.s,6);
    if(L>0){
      c.globalCompositeOperation='lighter';
      const s=o.R*(2.2+L*1.6);
      c.globalAlpha=L*.55*K; c.drawImage(glow,o.cx-s,o.cy-s,s*2,s*2);
      c.globalAlpha=1; c.globalCompositeOperation='source-over';
    }
    // сегменти дуг групуємо за відтінком (≈24 групи) — один stroke на групу замість тисячі
    const buckets=new Map();
    for(const a of o.g.arcs){
      let prev=project(a.pts[0],o);
      for(let k=1;k<a.pts.length;k++){
        const cur=project(a.pts[k],o);
        const front=((prev[2]+cur[2])/2+1)/2;
        const spec=Math.pow(Math.max(0,Math.sin((a.pts[k][3]+a.ph)*2+yaw*3*o.spin)),6);
        const key=Math.round(front*5)*10+Math.round(spec*3);
        let bk=buckets.get(key); if(!bk){bk=[];buckets.set(key,bk)}
        bk.push(prev[0],prev[1],cur[0],cur[1]); prev=cur;
      }
    }
    const amb=.28+L*.72;
    c.lineCap='round';
    [...buckets.keys()].sort((x,y)=>x-y).forEach(key=>{
      const front=Math.floor(key/10)/5, spec=(key%10)/3, pts=buckets.get(key);
      let col=mixA(F.dark,F.mid,front*amb);
      col=mixA(col,F.hi,spec*(.25+L*.65)*front);
      if(L>0) col=mixA(col,F.litTint,L*.25*front);
      c.strokeStyle=rgb(col,(.35+front*.65)*K);
      c.lineWidth=(o.R/150)*(1.1+front*1.6);
      c.beginPath();
      for(let i=0;i<pts.length;i+=4){c.moveTo(pts[i],pts[i+1]);c.lineTo(pts[i+2],pts[i+3])}
      c.stroke();
    });
    for(const l of o.g.leds){
      const p=project(l.p,o), q=project(l.q,o), front=(p[2]+1)/2;
      const tw=.85+.15*Math.sin(time*2+l.tw);
      const a=L*(.25+front*.75)*tw*K;
      c.globalCompositeOperation='lighter';
      if(a>0.01){
        const s=o.R*(.10+.10*front)*(.6+L*.6);
        c.globalAlpha=a; c.drawImage(glow,p[0]-s,p[1]-s,s*2,s*2);
        if(front>.55&&L>.5&&o.depth>.8){c.globalAlpha=a*.5;c.strokeStyle=rgb(LIGHT);c.lineWidth=1;
          const k=s*1.4;c.beginPath();c.moveTo(p[0]-k,p[1]);c.lineTo(p[0]+k,p[1]);c.moveTo(p[0],p[1]-k);c.lineTo(p[0],p[1]+k);c.stroke()}
      }
      c.globalAlpha=1; c.globalCompositeOperation=a>.2?'lighter':'source-over';
      c.strokeStyle=a>.2?rgb(LIGHT,Math.min(1,a+.2)):rgb(F.mid,(.3+front*.5)*K);
      c.lineWidth=(o.R/150)*(2+front*2);
      const mx=(q[0]-p[0])*.35,my=(q[1]-p[1])*.35;
      c.beginPath();c.moveTo(p[0]-mx,p[1]-my);c.lineTo(p[0]+mx,p[1]+my);c.stroke();
    }
    c.globalAlpha=1; c.globalCompositeOperation='source-over';
  }
  // легке обертання мишкою (ПК): нахил і доворот, згладжені
  const tilt={x:0,z:0}, mouse={x:0,y:0}; let yawM=0;
  function drawScene(){
    if(use3d){
      if(!gl3) return;
      tilt.x+=(mouse.y*.18-tilt.x)*.06; tilt.z+=(-mouse.x*.06-tilt.z)*.06; yawM+=(mouse.x*.5-yawM)*.06;
      if(!reduce) fade=Math.min(1,fade+.04); else fade=1;
      gl3.render(ORBS,yaw+yawM,tilt,fade); return;
    }
    octx.clearRect(0,0,W,H);
    for(const o of ORBS){
      if(o.blur){
        const s=.5;
        if(farC.width!==Math.round(W*s)){farC.width=Math.round(W*s);farC.height=Math.round(H*s)}
        fctx.setTransform(s,0,0,s,0,0); fctx.clearRect(0,0,W,H);
        drawOrb(o,fctx); octx.drawImage(farC,0,0,W,H);
      } else drawOrb(o,octx);
    }
  }

  /* ---------- Сцени ---------- */
  const hero=$('.hero'), temp=$('.temp'), cat=$('.cat'), hint=$('#hint'), shopEl=$('.shop'), sideEl=$('.side-kinds');
  const rK=$('#rK'), rW=$('#rW'), rP=$('#rP'), kv=$('#kv'), stages=[...root.querySelectorAll('#stages li')];
  const sp=$('#spectrum'); const cols=['#E168FF','#FFA068','#687FFF'];
  for(let i=0;i<34;i++){const e=document.createElement('i');e.style.height=(25+Math.abs(Math.sin(i*1.7))*75)+'%';e.style.background=cols[i%3];sp.appendChild(e)}
  const seriesLinks=[...root.querySelectorAll('.rows a')];
  const prog=el=>{const r=el.getBoundingClientRect();return clamp(-r.top/(r.height-innerHeight||1))};

  let heroP=0, heroVisible=true;
  function heroState(p){
    for(const o of ORBS){
      let l=ss(.04+o.delay,.42+o.delay*.4,p);
      const f0=.04+o.delay, f1=.15+o.delay;
      if(p>f0&&p<f1&&!reduce){ l = Math.random()<.5 ? l*.15 : Math.max(l,.35*Math.random()); }
      o.lit=reduce?1:l;
      o.cy=o.cy0-(reduce?0:p)*H*o.drift;
    }
    lit=ORBS[1].lit;
    hero.style.setProperty('--lit',lit.toFixed(3)); hero.style.setProperty('--p',p.toFixed(4));
    const s=reduce?1:ss(.04,.45,p);
    rK.textContent=Math.round(s*4000); rW.textContent=Math.round(s*19); rP.textContent=Math.round(s*100);
    hint.style.opacity=reduce?0:clamp(1-p*6)*.9;
    const sh=reduce?1:ss(.16,.5,p); hero.style.setProperty('--shop',sh.toFixed(3)); if(shopEl) shopEl.classList.toggle('on',sh>.5); if(sideEl) sideEl.classList.toggle('on',sh>.5);
  }
  function tempFrame(p){
    temp.style.setProperty('--p',p.toFixed(4));
    let k,c;
    if(p<.4){const t=ss(.06,.34,p);k=2700+t*1300;c=mixHex('#FFA068','#F6F2EC',t)}
    else{const t=ss(.4,.68,p);k=4000+t*2500;c=mixHex('#F6F2EC','#687FFF',t)}
    temp.style.setProperty('--tc',c);
    kv.textContent=Math.round(k/10)*10;
    const idx=k<3350?0:k<5250?1:2; stages.forEach((li,i)=>li.classList.toggle('on',i===idx));
  }
  // напис першого екрана: розбиваємо на літери, щоб він розсіювався, коли наїжджає блок температури
  const copy=$('.hero-copy');
  (()=>{const h1=copy&&copy.querySelector('h1'); if(!h1) return; let sd=3; const r=()=>(sd=(sd*16807)%2147483647)/2147483647;
    const walk=el=>[...el.childNodes].forEach(n=>{
      if(n.nodeType===1){walk(n);return}
      if(n.nodeType!==3||!n.textContent.trim()) return;
      const frag=document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(w=>{ if(!w) return; if(/^\s+$/.test(w)){frag.appendChild(document.createTextNode(w));return}
        const ws=document.createElement('span'); ws.className='w';
        for(const c of w){const e=document.createElement('span'); e.className='ch'; e.textContent=c; e.setAttribute('aria-hidden','true');
          e.style.cssText=`--rx:${((r()-.5)*14).toFixed(2)}vw;--ry:${(-2-r()*12).toFixed(2)}vh;--rs:${(r()*.9-.35).toFixed(2)};--dl:${(r()*.55).toFixed(3)}`; ws.appendChild(e)}
        frag.appendChild(ws)});
      n.replaceWith(frag)});
    h1.setAttribute('aria-label',h1.textContent.replace(/\s+/g,' ').trim()); walk(h1)})();
  function onScroll(){
    heroP=prog(hero); heroState(heroP);
    if(shopEl&&mobile&&!reduce){
      // нижній край вікна без зсуву (у координатах екрана) і межа блоку температури
      const sh=reduce?1:ss(.16,.5,heroP), st=shopEl.parentElement.getBoundingClientRect().top;
      const bottom=st+shopEl.offsetTop+shopEl.offsetHeight+innerHeight*(heroP*.02-(1-sh)*.12); // як у CSS-transform
      const tt=temp.getBoundingClientRect().top, edge=tt-10; // кнопки завжди над межею блоку
      const lift=Math.max(0,bottom-edge), rec=clamp((innerHeight*.78-tt)/(innerHeight*.32)); // вікно біля кулі → у глибину
      shopEl.style.setProperty('--lift',lift.toFixed(1)+'px'); shopEl.style.setProperty('--rec',rec.toFixed(3));
      shopEl.classList.toggle('gone',rec>.4);
    } else if(shopEl){shopEl.style.removeProperty('--lift');shopEl.style.removeProperty('--rec')}
    if(copy&&!reduce){const tt=temp.getBoundingClientRect().top; copy.style.setProperty('--dis',clamp((innerHeight-tt)/(innerHeight*.6)).toFixed(4))}
    tempFrame(reduce?0:prog(temp));
    const r=cat.getBoundingClientRect(); cat.style.setProperty('--q',clamp((innerHeight-r.top)/(innerHeight+r.height)).toFixed(4));
    // підсвітка назви серії в центрі екрана (лише поки блок видно)
    if(r.top<innerHeight&&r.bottom>0){ const cx=innerWidth/2, w=innerWidth*.22;
      for(const el of seriesLinks){ const b=el.getBoundingClientRect(); const d=Math.abs((b.left+b.right)/2-cx);
        el.style.setProperty('--hl',clamp(1-d/w).toFixed(3)); } }
  }
  let last=performance.now();
  function loop(t){
    const dt=Math.min(50,t-last); last=t; time+=dt/1000;
    if(heroVisible){
      // самоперевірка: якщо розмір полотна змінився без події resize (розгортання вікна, масштаб, смуга прокрутки) — перебудовуємо, інакше куля розтягується
      if(Math.abs(orb.clientWidth-W)>1||Math.abs(orb.clientHeight-H)>1||(!mobile&&Math.min(1.5,devicePixelRatio||1)!==DPR)){size();onScroll()}
      if(!reduce) yaw = time*.12 + heroP*2.2;
      drawScene(); drawDots();
    }
    if(alive)requestAnimationFrame(loop);
  }
  const hio=new IntersectionObserver(e=>{heroVisible=e[0].isIntersecting;window.__spHero=heroVisible},{rootMargin:'100px'});hio.observe(hero);offs.push(()=>hio.disconnect());

  // перемикач оздоблення


  size(); onScroll();
  if(use3d){
    createOrb3D(orb,{mobile,reduce}).then(r=>{ if(!alive){r.dispose();return} gl3=r; gl3.resize(W,H,DPR); if(reduce) drawScene(); })
      .catch(e=>console.warn('3D',e));
    if(!reduce) on(window,'pointermove',e=>{if(e.pointerType!=='mouse')return;mouse.x=e.clientX/innerWidth*2-1;mouse.y=e.clientY/innerHeight*2-1},{passive:true});
  }
  // на телефонах resize спрацьовує від панелі адреси під час прокрутки — перебудовуємо лише при зміні ширини
  let lastW=innerWidth;
  on(window,'resize',()=>{if(Math.abs(innerWidth-lastW)<2&&mobile)return;lastW=innerWidth;size();onScroll();if(reduce){drawScene();drawDots()}});
  on(window,'scroll',onScroll,{passive:true}); if(lenis) lenis.on('scroll',onScroll);
  if(reduce){drawScene();drawDots()} else requestAnimationFrame(loop);

  // появи + лічильники
  const counted=new WeakSet();
  const io=new IntersectionObserver(es=>es.forEach(e=>{ if(!e.isIntersecting) return; e.target.classList.add('in');
    const n=e.target.querySelector('[data-count]');
    if(n&&!counted.has(n)&&!reduce){counted.add(n);const to=+n.dataset.count,t0=performance.now();
      const step=t=>{const k=clamp((t-t0)/1400);n.textContent=Math.round(to*(1-Math.pow(1-k,3))).toLocaleString('uk-UA');if(k<1)requestAnimationFrame(step)};requestAnimationFrame(step)}
    io.unobserve(e.target)}),{threshold:.2});offs.push(()=>io.disconnect());
  root.querySelectorAll('.rv').forEach(el=>io.observe(el));

  root.querySelectorAll('.t').forEach(t=>t.addEventListener('pointermove',e=>{const r=t.getBoundingClientRect();t.style.setProperty('--mx',(e.clientX-r.left)+'px');t.style.setProperty('--my',(e.clientY-r.top)+'px')}));
  root.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const el=document.querySelector(a.getAttribute('href'));if(el&&lenis){e.preventDefault();lenis.scrollTo(el)}}));

  return ()=>{alive=false;if(gl3)gl3.dispose();window.__spHero=false;offs.forEach(f=>f());if(lenis)lenis.destroy();document.documentElement.classList.remove('js');};
}
