/* ArcadeOS widgets ("blobs"): freely resizable (grid units), choosable shape / style / tint, per-type options.
   Weather uses Open-Meteo (free, no key, CORS-enabled) — the only network calls here besides what the user opens. */
(function(){
'use strict';
const {h,$,S,clamp}=OS;
const els=new Map();
const W=OS.widgets={ TYPES:[], els };

/* ---------- weather service (also used by the AI) ---------- */
const WMO=c=>c===0?['☀️','Clear']:c===1?['🌤️','Mostly clear']:c===2?['⛅','Partly cloudy']:c===3?['☁️','Overcast']:[45,48].includes(c)?['🌫️','Fog']:c>=51&&c<=57?['🌦️','Drizzle']:c>=61&&c<=67?['🌧️','Rain']:c>=71&&c<=77?['🌨️','Snow']:c>=80&&c<=82?['🌧️','Showers']:[85,86].includes(c)?['🌨️','Snow showers']:c>=95?['⛈️','Thunderstorm']:['🌡️','—'];
const wxCache={};
OS.weather={
  WMO,
  async geocode(q){
    const r=await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name='+encodeURIComponent(q)); const j=await r.json();
    const g=j.results&&j.results[0]; if(!g) return null; return {lat:g.latitude,lon:g.longitude,name:[g.name,g.admin1,g.country_code].filter(Boolean).join(', '),short:g.name};
  },
  async get(lat,lon,unit){
    const k=lat.toFixed(2)+','+lon.toFixed(2)+unit, c=wxCache[k]; if(c&&Date.now()-c.t<9e5) return c.d;
    const C=unit==='C';
    const r=await fetch('https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=auto&temperature_unit='+(C?'celsius':'fahrenheit')+'&wind_speed_unit='+(C?'kmh':'mph'));
    if(!r.ok) throw new Error('weather'); const d=await r.json(); wxCache[k]={t:Date.now(),d}; return d;
  }
};

/* ---------- safe calculator (no eval) ---------- */
OS.calcEval=function(src){
  const t=String(src).match(/\d+\.?\d*|\.\d+|[()+\-*/%]/g)||[]; let i=0; const peek=()=>t[i], nxt=()=>t[i++];
  const expr=()=>{ let v=term(); while(peek()==='+'||peek()==='-'){ const o=nxt(), r=term(); v=o==='+'?v+r:v-r; } return v; };
  const term=()=>{ let v=unary(); while(['*','/','%'].includes(peek())){ const o=nxt(), r=unary(); v=o==='*'?v*r:o==='/'?v/r:v%r; } return v; };
  const unary=()=>{ if(peek()==='-'){ nxt(); return -unary(); } if(peek()==='+'){ nxt(); return unary(); } return prim(); };
  const prim=()=>{ const x=nxt(); if(x==='('){ const v=expr(); if(nxt()!==')') throw 0; return v; } const n=parseFloat(x); if(isNaN(n)) throw 0; return n; };
  const v=expr(); if(i<t.length||!isFinite(v)) throw 0; return v;
};

/* ---------- helpers ---------- */
const DAYN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MONN=['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHAPES={squircle:'calc(var(--rad)*1.8)',rect:'var(--rad)',circle:'50%',pill:'999px',blob:'42% 58% 63% 37% / 44% 39% 61% 56%',blob2:'61% 39% 45% 55% / 52% 62% 38% 48%',leaf:'4% 60% 4% 60%'};
const STYLES={glass:'Glass',solid:'Solid',clear:'Clear (no background)',grad:'Gradient'};
const PRESETS={Mini:[1,1],S:[2,2],M:[3,2],L:[3,3],XL:[4,3],XXL:[4,4],Wide:[5,2],Strip:[5,1],Tall:[2,4]};
const tzParts=(d,tz)=>{ try{ const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:tz||undefined,hour:'numeric',minute:'numeric',second:'numeric',hour12:false,weekday:'short',month:'short',day:'numeric'}).formatToParts(d).map(x=>[x.type,x.value])); return {H:+p.hour%24,M:+p.minute,S:+p.second,date:p.weekday+', '+p.month+' '+p.day}; }catch{ return {H:d.getHours(),M:d.getMinutes(),S:d.getSeconds(),date:DAYN[d.getDay()]+', '+MONN[d.getMonth()].slice(0,3)+' '+d.getDate()}; } };
const fmtT=(H,M,Sx,sec)=>{ let ap=''; if(!S.settings.clock24){ ap=H>=12?'PM':'AM'; H=H%12||12; } return [ (S.settings.clock24?OS.pad(H):H)+':'+OS.pad(M)+(sec?':'+OS.pad(Sx):''), ap ]; };
const monthGrid=(y,m,today)=>{
  const first=new Date(y,m,1).getDay(), dim=new Date(y,m+1,0).getDate(), prev=new Date(y,m,0).getDate(), cells=DAYN.map(d=>h('b',null,d[0]));
  for(let i=0;i<42;i++){ const n=i-first+1; let v=n,cls=''; if(n<1){ v=prev+n; cls='dim'; } else if(n>dim){ v=n-dim; cls='dim'; } else if(today&&n===today.getDate()&&m===today.getMonth()&&y===today.getFullYear()) cls='today'; if(i>=35&&n>dim) break; cells.push(h('i',{class:cls},v)); }
  return cells;
};
const DAILY=['Honey never spoils — edible honey was found in 3,000-year-old Egyptian tombs.','Octopuses have three hearts and blue blood.','A day on Venus is longer than its year.','The first computer “bug” was a real moth stuck in a relay in 1947.','Bananas are berries; strawberries are not.','Sharks are older than trees.','There are more possible chess games than atoms in the observable universe.','Wombat poop is cube-shaped.','The shortest war in history lasted about 38 minutes.','Your brain uses roughly 20% of your body’s energy.','Lightning is about five times hotter than the surface of the Sun.','A group of flamingos is called a flamboyance.','The first video game, “Tennis for Two”, was made in 1958 on an oscilloscope.','Water can boil and freeze at the same time (the “triple point”).','Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.','Sound travels about 4× faster in water than in air.','Tetris was created in 1984 by Alexey Pajitnov.','Mario was originally named “Jumpman”.','A cloud can weigh more than a million pounds.','Koalas have fingerprints almost identical to humans’.','Saturn would float in a big enough bathtub — it’s less dense than water.','The Great Wall of China is not visible from space with the naked eye.','Minecraft is the best-selling video game of all time.','“Set a timer, then do the hard thing first.” — every productive person ever'];
const dayIdx=()=>Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5);

/* ---------- widget types ---------- */
const T=(id,name,emoji,w,hh,opts,render)=>W.TYPES.push({id,name,emoji,w,h:hh,opts:opts||[],render});

T('clock','Clock','🕐',3,2,[{key:'face',label:'Face',type:'select',choices:[['digital','Digital'],['analog','Analog']],def:'digital'},{key:'sec',label:'Show seconds',type:'check',def:false},{key:'date',label:'Show date',type:'check',def:true},{key:'tz',label:'Time zone (e.g. Europe/London — blank = yours)',type:'text',def:''},{key:'label',label:'Label',type:'text',def:''}],
 (box,w)=>{
  const o=w.opts, analog=o.face==='analog';
  if(analog){
    const ticks=[...Array(12)].map((_,i)=>`<line x1="50" y1="6" x2="50" y2="${i%3?9:12}" stroke="currentColor" stroke-width="${i%3?1.2:2.2}" transform="rotate(${i*30} 50 50)" opacity=".8"/>`).join('');
    box.classList.add('w-clock'); box.style.padding='4%';
    box.innerHTML=`<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="1.5"/>${ticks}<line id="hh" x1="50" y1="50" x2="50" y2="28" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><line id="mm" x1="50" y1="50" x2="50" y2="16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><line id="ss" x1="50" y1="56" x2="50" y2="12" stroke="var(--acc)" stroke-width="1.2" stroke-linecap="round" ${o.sec?'':'display="none"'}/><circle cx="50" cy="50" r="2.6" fill="var(--acc)"/></svg>`;
    const hh=box.querySelector('#hh'),mm=box.querySelector('#mm'),ss=box.querySelector('#ss');
    const upd=d=>{ const p=tzParts(d,o.tz); hh.setAttribute('transform',`rotate(${(p.H%12)*30+p.M*.5} 50 50)`); mm.setAttribute('transform',`rotate(${p.M*6+p.S*.1} 50 50)`); ss.setAttribute('transform',`rotate(${p.S*6} 50 50)`); };
    upd(new Date()); return {tick:upd};
  }
  box.classList.add('w-clock'); const t=h('div',{class:'t'}), d=h('div',{class:'d'}), l=h('div',{class:'d',style:{marginTop:0,fontWeight:700}},o.label||'');
  box.append(...(o.label?[l]:[]),t,...(o.date!==false?[d]:[]));
  const upd=dt=>{ const p=tzParts(dt,o.tz), [s,ap]=fmtT(p.H,p.M,p.S,o.sec); t.replaceChildren(s,ap?h('small',null,ap):''); d.textContent=p.date; };
  upd(new Date()); return {tick:upd};
 });

T('weather','Weather','🌤️',3,2,[{key:'city',label:'City',type:'text',def:''},{key:'unit',label:'Units',type:'select',choices:[['F','°F / mph'],['C','°C / km/h']],def:'F'},{key:'auto',label:'Tint by weather',type:'check',def:true}],
 (box,w)=>{
  box.classList.add('w-wx'); const o=w.opts; let dead=false;
  const prompt=(msg)=>{
    const inp=h('input',{placeholder:'City, e.g. Boston',value:o.city||'','data-nodrag':1}), st=h('div',{class:'sub'},msg||'');
    const go=async(geo)=>{ try{ st.textContent='Looking up…'; const g=geo||await OS.weather.geocode(inp.value.trim()); if(!g){ st.textContent='City not found.'; return; } Object.assign(o,{city:g.short,lat:g.lat,lon:g.lon,place:g.name}); OS.save(); W.rerender(w); }catch{ st.textContent='Can’t reach the weather service (offline?).'; } };
    inp.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter') go(); });
    box.replaceChildren(h('h4',null,'Weather'),h('div',{class:'ic',style:{fontSize:'32px',textAlign:'center'}},'🌤️'),inp,h('div',{style:{display:'flex',gap:'6px',marginTop:'6px'}},h('button',{class:'pill',onclick:()=>go()},'Find'),h('button',{class:'ghost',onclick:()=>{ if(!navigator.geolocation){ st.textContent='Location not available.'; return; } st.textContent='Asking for your location…'; navigator.geolocation.getCurrentPosition(p=>go({lat:p.coords.latitude,lon:p.coords.longitude,short:'My location',name:'My location'}),()=>{ st.textContent='Location was blocked — type a city instead.'; }); }},'📍 Use mine')),st);
  };
  if(o.lat==null){ prompt(); return; }
  box.replaceChildren(h('div',{class:'empty'},'Loading weather…'));
  OS.weather.get(o.lat,o.lon,o.unit||'F').then(d=>{
    if(dead) return; const c=d.current, [ic,txt]=OS.weather.WMO(c.weather_code), U=(o.unit||'F'), day=c.is_day;
    if(c.weather_code===0&&!day) { /* night */ }
    const icon=(c.weather_code<=1&&!day)?'🌙':ic;
    if(o.auto!==false){ const col=c.weather_code>=95?'#5b4b8a':c.weather_code>=51?'#3a6ea5':c.weather_code>=71?'#8fb4d9':c.weather_code>=45?'#7d8a99':c.weather_code>=2?'#5a8fc0':(day?'#f5a623':'#27356b'); box.parentElement.style.setProperty('--tint',col); }
    box.replaceChildren(
      h('div',{class:'big'},h('div',{class:'ic'},icon),h('div',null,h('div',{class:'tp'},Math.round(c.temperature_2m)+'°'),h('div',{class:'city'},o.city||'Weather'))),
      h('div',{class:'sub sub2'},txt+' · feels '+Math.round(c.apparent_temperature)+'° · 💧'+c.relative_humidity_2m+'% · 💨'+Math.round(c.wind_speed_10m)+(U==='C'?' km/h':' mph')),
      h('div',{class:'fc'},d.daily.time.map((t,i)=>h('div',null,DAYN[new Date(t+'T12:00').getDay()],h('span',{style:{display:'block',fontSize:'16px'}},OS.weather.WMO(d.daily.weather_code[i])[0]),h('b',null,Math.round(d.daily.temperature_2m_max[i])+'°'),Math.round(d.daily.temperature_2m_min[i])+'°'))));
  }).catch(()=>{ if(!dead) { box.replaceChildren(h('div',{class:'empty'},'Weather unavailable (offline?)',h('br'),h('button',{class:'ghost',onclick:()=>W.rerender(w)},'Retry'),' ',h('button',{class:'ghost',onclick:()=>{ delete o.lat; W.rerender(w); }},'Change city'))); } });
  return {destroy(){ dead=true; }};
 });

const ENGINES={google:['Google','https://www.google.com/search?igu=1&q='],bing:['Bing','https://www.bing.com/search?q='],ddg:['DuckDuckGo','https://duckduckgo.com/?q='],wiki:['Wikipedia (instant results)','']};
OS.ENGINES=ENGINES;
T('search','Search','🔎',5,1,[{key:'engine',label:'Search engine',type:'select',choices:Object.entries(ENGINES).map(([k,v])=>[k,v[0]]),def:''}],
 (box,w)=>{
  const inp=h('input',{placeholder:'Search the web, or type a link…','data-nodrag':1,style:{fontSize:'15px'}});
  inp.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter'&&inp.value.trim()){ const q=inp.value.trim(), n=OS.normUrl(q); inp.value=''; if(n) OS.openUrl(n.url); else OS.launch('sys:search',{q,engine:w.opts.engine||S.settings.engine}); } });
  box.style.justifyContent='center'; box.append(h('div',{style:{display:'flex',gap:'8px',alignItems:'center'}},h('span',{style:{fontSize:'18px'}},'🔎'),inp));
 });

T('favorites','Favorites','⭐',3,3,[],(box)=>{
  box.append(h('h4',null,'⭐ Favorites'));
  const apps=S.fav.map(OS.app).filter(Boolean);
  if(!apps.length) box.append(h('div',{class:'empty'},'Right-click any app → “Add to Favorites”.'));
  else box.append(h('div',{class:'fav-grid'},apps.map(a=>OS.appTile(a))));
});
T('recents','Continue Playing','🕹️',3,2,[],(box)=>{
  box.append(h('h4',null,'🕹️ Continue playing'));
  const apps=S.recent.map(OS.app).filter(Boolean).slice(0,8);
  if(!apps.length) box.append(h('div',{class:'empty'},'Games you open show up here.'));
  else box.append(h('div',{class:'fav-grid'},apps.map(a=>OS.appTile(a))));
});

T('notes','Notes','📝',3,3,[],(box)=>{
  const ta=h('textarea',{placeholder:'Jot something down…',value:S.notes||'','data-nodrag':1,style:{flex:1,resize:'none',minHeight:0}}); let t=0;
  ta.addEventListener('input',()=>{ S.notes=ta.value; clearTimeout(t); t=setTimeout(OS.save,400); });
  ta.addEventListener('keydown',e=>e.stopPropagation());
  box.append(h('h4',null,'📝 Notes'),ta);
});
T('todo','To-Do','✅',3,3,[],(box,w)=>{
  box.append(h('h4',null,'✅ To-do'));
  const list=h('div',{class:'scroll'}), inp=h('input',{placeholder:'Add a task…','data-nodrag':1});
  const draw=()=>{ list.replaceChildren(...(S.todos.length?S.todos.map((t,i)=>h('div',{class:'todo-i'+(t.done?' done':'')},h('input',{type:'checkbox',checked:t.done,style:{width:'auto'},onchange:e=>{ t.done=e.target.checked; OS.save(); draw(); }}),h('span',null,t.text),h('button',{title:'Delete',onclick:()=>{ S.todos.splice(i,1); OS.save(); draw(); }},'×'))):[h('div',{class:'empty'},'Nothing to do 🎉')])); };
  inp.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter'&&inp.value.trim()){ S.todos.push({text:inp.value.trim().slice(0,200),done:false}); inp.value=''; OS.save(); draw(); } });
  draw(); box.append(list,inp);
});

T('calendar','Calendar','📅',3,3,[],(box)=>{
  let off=0; const head=h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',fontWeight:700,marginBottom:'4px'}}), grid=h('div',{class:'cal'});
  const draw=()=>{ const n=new Date(), d=new Date(n.getFullYear(),n.getMonth()+off,1);
    head.replaceChildren(h('button',{class:'ghost','data-nodrag':1,onclick:()=>{ off--; draw(); }},'‹'),h('span',{onclick:()=>{ off=0; draw(); },style:{cursor:'pointer'}},MONN[d.getMonth()]+' '+d.getFullYear()),h('button',{class:'ghost','data-nodrag':1,onclick:()=>{ off++; draw(); }},'›'));
    grid.replaceChildren(...monthGrid(d.getFullYear(),d.getMonth(),n)); };
  draw(); box.append(head,grid);
});
W.calendarPopover=()=>{ const n=new Date(); return h('div',{style:{padding:'10px 12px',width:'240px'}},h('div',{style:{fontWeight:700,fontSize:'15px'}},DAYN[n.getDay()]+', '+MONN[n.getMonth()]+' '+n.getDate()),h('div',{style:{color:'var(--fg2)',marginBottom:'8px'}},OS.timeStr(n,true)),h('div',{class:'cal',style:{fontSize:'12px'}},monthGrid(n.getFullYear(),n.getMonth(),n))); };

T('timer','Timer','⏱️',3,2,[{key:'mode',label:'Mode',type:'select',choices:[['timer','Countdown'],['stopwatch','Stopwatch']],def:'timer'}],(box,w)=>{
  const o=w.opts, sw=o.mode==='stopwatch'; o.dur=o.dur||300; o.left=o.left??o.dur; o.t0=o.t0||0; o.acc=o.acc||0;
  const disp=h('div',{class:'tm-big'}), bar=h('div',{style:{display:'flex',gap:'6px',justifyContent:'center',flexWrap:'wrap'}});
  const elapsed=()=>o.acc+(o.t0?(Date.now()-o.t0)/1000:0), remain=()=>Math.max(0,o.dur-elapsed());
  const fmt=s=>{ s=Math.ceil(s); return (s>=3600?Math.floor(s/3600)+':':'')+OS.pad(Math.floor(s/60)%60)+':'+OS.pad(s%60); };
  const show=()=>{ disp.textContent=fmt(sw?elapsed():remain()); };
  const btns=()=>{ bar.replaceChildren(
    h('button',{class:'pill','data-nodrag':1,onclick:()=>{ if(o.t0){ o.acc=elapsed(); o.t0=0; } else { if(!sw&&remain()<=0){ o.acc=0; } o.t0=Date.now(); } OS.save(); btns(); show(); }},o.t0?'Pause':'Start'),
    h('button',{class:'ghost','data-nodrag':1,onclick:()=>{ o.t0=0; o.acc=0; OS.save(); btns(); show(); }},'Reset'),
    ...(sw?[]:[1,5,10,25].map(m=>h('button',{class:'ghost','data-nodrag':1,onclick:()=>{ o.dur=m*60; o.t0=0; o.acc=0; OS.save(); btns(); show(); }},m+'m')))); };
  box.append(h('h4',null,sw?'⏱️ Stopwatch':'⏳ Timer'),disp,bar); btns(); show();
  return {tick(){ if(!sw&&o.t0&&remain()<=0){ o.t0=0; o.acc=o.dur; OS.save(); OS.toast('⏰ Timer finished!',6000); OS.beep(); btns(); } show(); }};
});

T('stats','Play Stats','📊',3,3,[],(box)=>{
  const rows=Object.entries(S.play).map(([id,s])=>[OS.app(id),s]).filter(([a])=>a).sort((a,b)=>b[1]-a[1]), total=rows.reduce((t,r)=>t+r[1],0), max=rows[0]?rows[0][1]:1;
  box.append(h('h4',null,'📊 Play stats'),h('div',{style:{fontSize:'22px',fontWeight:300,marginBottom:'6px'}},OS.fmtDur(total)+' played'));
  if(!rows.length) box.append(h('div',{class:'empty'},'Time you spend in apps is tracked here (only in this browser).'));
  else box.append(h('div',{class:'scroll'},rows.slice(0,6).map(([a,s])=>h('div',{style:{marginBottom:'7px',fontSize:'12px'}},h('div',{style:{display:'flex',justifyContent:'space-between'}},h('span',null,a.emoji+' '+a.name),h('span',{style:{color:'var(--fg2)'}},OS.fmtDur(s))),h('div',{class:'bar'},h('i',{style:{width:Math.max(4,s/max*100)+'%'}}))))));
});

T('fact','Fact of the Day','💡',3,2,[],(box)=>{
  let i=dayIdx()%DAILY.length; const p=h('div',{style:{fontSize:'min(7cqh,5cqw)',lineHeight:1.4,margin:'auto 0'}},DAILY[i]);
  box.append(h('h4',null,'💡 Did you know?'),p,h('button',{class:'ghost','data-nodrag':1,style:{alignSelf:'flex-end'},onclick:()=>{ i=(i+1+Math.floor(Math.random()*5))%DAILY.length; p.textContent=DAILY[i]; }},'↻ another'));
});

T('calc','Calculator','🧮',3,4,[],(box)=>{
  let s=''; const disp=h('div',{class:'calc-d'},'0'), pad=h('div',{class:'calc'});
  const press=k=>{ if(k==='C') s=''; else if(k==='⌫') s=s.slice(0,-1); else if(k==='='){ try{ s=String(+OS.calcEval(s.replace(/×/g,'*').replace(/÷/g,'/')).toFixed(10)); }catch{ s='Error'; setTimeout(()=>{ s=''; disp.textContent='0'; },900); } } else { if(s==='Error') s=''; s+=k; } disp.textContent=s||'0'; };
  for(const k of ['C','⌫','%','÷','7','8','9','×','4','5','6','-','1','2','3','+','0','.','(',')','=']) pad.append(h('button',{class:/[÷×\-+=]/.test(k)?'op':'','data-nodrag':1,onclick:()=>press(k)},k));
  box.append(disp,pad);
});

T('linkbar','Link → App','🔗',4,2,[],(box)=>{
  const inp=h('input',{placeholder:'Paste a link to turn it into an app','data-nodrag':1}), row=h('div',{class:'fav-grid',style:{marginTop:'8px'}});
  const apps=Object.values(S.customApps).slice(-8).reverse().map(a=>OS.app(a.id)); row.append(...apps.map(a=>OS.appTile(a)));
  inp.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter'){ const a=OS.addLinkApp(inp.value); if(!a) return OS.toast('That doesn’t look like a link (try example.com).'); inp.value=''; OS.launch(a.id); } });
  box.append(h('h4',null,'🔗 Link → app'),inp,apps.length?row:h('div',{class:'empty'},'Saved links appear here.'));
});
T('askai','Ask AI','✨',4,2,[],(box)=>{
  const inp=h('input',{placeholder:'Ask AR.OS AI anything…','data-nodrag':1}), go=q=>OS.launch('sys:ai',{ask:q});
  inp.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter'&&inp.value.trim()){ go(inp.value.trim()); inp.value=''; } });
  box.append(h('h4',null,'✨ AR.OS AI'),inp,h('div',{style:{display:'flex',gap:'6px',flexWrap:'wrap',marginTop:'8px'}},['Recommend a game','What’s the weather?','Timer 5 min'].map(q=>h('button',{class:'ghost','data-nodrag':1,onclick:()=>go(q)},q))));
});

T('buddy','AI Buddy','🫧',2,3,[{key:'state',label:'Mood',type:'select',choices:[['idle','Calm'],['happy','Happy'],['listening','Curious'],['thinking','Thinking'],['working','Busy']],def:'idle'},{key:'hello',label:'Caption',type:'text',def:'Hi! Ask me anything.'}],
 (box,w)=>{
  box.classList.add('w-buddy');
  const m=OS.mascot&&OS.mascot.available()?OS.mascot.el({state:w.opts.state||'idle'}):h('div',{style:{fontSize:'56px'}},'✨');
  m.setAttribute('data-nodrag','1');                       // so petting the mascot doesn't drag the widget
  m.style.width='min(84cqw,60cqh)'; m.style.height='min(84cqw,60cqh)';
  box.append(m,h('div',{class:'cap'},w.opts.hello||''),h('button',{class:'pill','data-nodrag':1,onclick:()=>OS.launch('sys:ai')},'Chat'));
 });

// Custom widget: type a title and any text you like; pick size, alignment, emoji. Double-click it (or right-click → Customize) to edit.
T('custom','Custom Text','🗒️',3,2,[
  {key:'emoji',label:'Emoji / icon (optional)',type:'text',def:''},
  {key:'title',label:'Title',type:'text',def:'My widget'},
  {key:'text',label:'Text — type anything you want',type:'textarea',def:'Double-click me to edit'},
  {key:'size',label:'Text size',type:'select',choices:[['s','Small'],['m','Medium'],['l','Large'],['xl','Huge']],def:'m'},
  {key:'align',label:'Alignment',type:'select',choices:[['left','Left'],['center','Center'],['right','Right']],def:'left'},
  {key:'bold',label:'Bold body text',type:'check',def:false}],
 (box,w)=>{
  const o=w.opts, k={s:5,m:7,l:10,xl:15}[o.size||'m']||7;
  box.classList.add('w-custom'); box.style.setProperty('--k',k); box.style.textAlign=o.align||'left';
  const kids=[];
  if(o.emoji) kids.push(h('div',{style:{fontSize:'calc(var(--k) * 2.4 * 1cqmin)',lineHeight:1.1,marginBottom:'.15em'}},o.emoji));
  if(o.title) kids.push(h('div',{class:'ct',style:{fontSize:'calc(var(--k) * 1.7 * 1cqmin)'}},o.title));
  if(o.text) kids.push(h('div',{class:'cb',style:{fontSize:'calc(var(--k) * 1cqmin)',fontWeight:o.bold?700:400}},o.text));   // text nodes only: never HTML
  if(!kids.length) kids.push(h('div',{class:'empty'},'Empty widget — double-click to edit'));
  if(!o.text) box.style.justifyContent='center';
  box.append(...kids);
 });

/* ---------- mounting / editing ---------- */
const typeOf=id=>W.TYPES.find(t=>t.id===id);
function fill(el,w){
  el._clean&&el._clean(); el._clean=null;
  const T=typeOf(w.type); if(!T){ el.replaceChildren(); return; }
  const box=h('div',{class:'wg-in'}); let r;
  try{ r=T.render(box,w)||{}; }catch(e){ console.warn(e); box.replaceChildren(h('div',{class:'empty'},'Widget error')); r={}; }
  el.replaceChildren(box,el._rz);
  if(r.tick){ OS.tickers.add(r.tick); }
  el._clean=()=>{ r.tick&&OS.tickers.delete(r.tick); r.destroy&&r.destroy(); };
}
W.mount=function(w){
  const el=h('div',{class:'dt wg glass st-'+(w.style||'glass')+' sh-'+(w.shape||'squircle'),style:{'--tint':w.tint||'#0a84ff','--wr':SHAPES[w.shape]||SHAPES.squircle}});
  el._obj=w; el._rz=h('div',{class:'rz',title:'Drag to resize'}); els.set(w.id,el);
  OS.wm.place(el,w); fill(el,w);
  OS.wm.resizable(el,w,el._rz,{min:1});
  OS.wm.draggable(el,w,{});
  el.addEventListener('contextmenu',e=>{ e.preventDefault(); e.stopPropagation(); menu(e.clientX,e.clientY,w); });
  el.addEventListener('dblclick',e=>{ if(w.type==='custom'&&!e.target.closest('input,textarea,button')) customize(w); });
  return el;
};
W.rerender=function(w){
  const el=els.get(w.id); if(!el||!el.isConnected){ return OS.wm.renderDesktop(); }
  el.className='dt wg glass st-'+(w.style||'glass')+' sh-'+(w.shape||'squircle'); el.style.setProperty('--tint',w.tint||'#0a84ff'); el.style.setProperty('--wr',SHAPES[w.shape]||SHAPES.squircle);
  OS.wm.place(el,w); fill(el,w);
};
W.refresh=function(type){ for(const w of S.widgets||[]) if(!type||w.type===type) W.rerender(w); };
W.add=function(typeId){
  const t=typeOf(typeId); if(!t) return null;
  const w={id:OS.uid('w_'),type:typeId,w:t.w,h:t.h,gx:0,gy:0,shape:'squircle',style:'glass',tint:'#0a84ff',opts:{},placed:false};
  for(const o of t.opts) if(o.def!==undefined&&o.def!=='') w.opts[o.key]=o.def;
  S.widgets=S.widgets||[]; S.widgets.push(w); if(!S.settings.widgetsOn) S.settings.widgetsOn=true;
  OS.wm.renderDesktop();
  if(typeId==='custom') setTimeout(()=>customize(w),60);      // let the user type their text straight away
  return w;
};
W.remove=function(w){ S.widgets=S.widgets.filter(x=>x!==w); OS.save(); OS.wm.renderDesktop(); };
function menu(x,y,w){
  const t=typeOf(w.type);
  OS.menu(x,y,[{hd:t.name},{label:'Customize…',run:()=>customize(w)},{sep:1},{hd:'Size'},
    ...Object.entries(PRESETS).map(([k,[a,b]])=>({label:`${(w.w===a&&w.h===b)?'✓ ':'   '}${k}  (${a}×${b})`,run:()=>{ w.w=a; w.h=b; OS.save(); W.rerender(w); }})),{sep:1},
    {label:'Duplicate',run:()=>{ const c=JSON.parse(JSON.stringify(w)); c.id=OS.uid('w_'); c.placed=false; S.widgets.push(c); OS.wm.renderDesktop(); }},
    {label:'Remove Widget',run:()=>W.remove(w)}]);
}
W.customize=customize;
function customize(w){
  const t=typeOf(w.type), sizeKey=Object.entries(PRESETS).find(([,v])=>v[0]===w.w&&v[1]===w.h)?.[0]||'custom';
  OS.dialog({title:t.emoji+' '+t.name,sub:'Drag the corner of a widget to resize it freely, or pick a preset.',
    fields:[{key:'_size',label:'Size',type:'select',value:sizeKey,choices:[...Object.entries(PRESETS).map(([k,[a,b]])=>[k,`${k} (${a}×${b})`]),['custom',`Custom (${w.w}×${w.h})`]]},
      {key:'_shape',label:'Shape',type:'select',value:w.shape||'squircle',choices:[['squircle','Squircle'],['rect','Rectangle'],['circle','Circle / oval'],['pill','Pill'],['blob','Blob'],['blob2','Blob 2'],['leaf','Leaf']]},
      {key:'_style',label:'Style',type:'select',value:w.style||'glass',choices:Object.entries(STYLES)},{key:'_tint',label:'Tint color',type:'color',value:w.tint||'#0a84ff'},
      ...t.opts.map(o=>({key:o.key,label:o.label,type:o.type,choices:o.choices,value:w.opts[o.key]??o.def}))],ok:'Save',
    onOk:v=>{ if(PRESETS[v._size]) [w.w,w.h]=PRESETS[v._size]; w.shape=v._shape; w.style=v._style; w.tint=v._tint; for(const o of t.opts) w.opts[o.key]=v[o.key];
      if(w.type==='weather'&&w.opts.city&&w.opts.city!==w.opts.place?.split(',')[0]&&w.opts.city!==w.opts._lastCity){ OS.weather.geocode(w.opts.city).then(g=>{ if(g){ Object.assign(w.opts,{lat:g.lat,lon:g.lon,place:g.name,city:g.short,_lastCity:g.short}); OS.save(); W.rerender(w); } }).catch(()=>{}); }
      OS.save(); W.rerender(w); }});
}
})();
