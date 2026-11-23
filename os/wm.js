/* ArcadeOS window manager: settings->CSS, wallpaper, menu bar + clock, windows (traffic lights, drag, resize, snap),
   dock, desktop (folder tiles + widgets, drag/resize/snap), context menus. */
(function(){
'use strict';
const {h,$,S,clamp}=OS;
const wm = OS.wm = {};
const desk=$('#desktop'), winsEl=$('#wins'), dock=$('#dock'), dockwrap=$('#dockwrap'), mbar=$('#menubar');
const MB=30;
const FONTS={system:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif",rounded:"ui-rounded,'SF Pro Rounded','Nunito','Segoe UI',system-ui,sans-serif",mono:"ui-monospace,'Cascadia Code',Consolas,monospace",serif:"Georgia,'Times New Roman',serif"};
OS.FONTS=FONTS;
OS.WALLPAPERS=[
  {id:'blobs',name:'Blobs (animated)',blobs:true,dark:true},
  {id:'aurora',name:'Aurora',css:'linear-gradient(135deg,#0f2027,#203a43,#2c5364)',dark:true},
  {id:'sunset',name:'Sunset',css:'linear-gradient(160deg,#ff512f,#dd2476 55%,#4a1b6d)',dark:true},
  {id:'ocean',name:'Ocean',css:'linear-gradient(160deg,#0575e6,#021b79)',dark:true},
  {id:'forest',name:'Forest',css:'linear-gradient(150deg,#134e5e,#71b280)',dark:true},
  {id:'candy',name:'Candy',css:'linear-gradient(135deg,#f093fb,#f5576c)',dark:true},
  {id:'midnight',name:'Midnight',css:'radial-gradient(circle at 30% 20%,#1e2a5a,#05070f 70%)',dark:true},
  {id:'graphite',name:'Graphite',css:'linear-gradient(135deg,#2b2f3a,#12141b)',dark:true},
  {id:'grid',name:'Grid',css:'linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px) 0 0/40px 40px,linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px) 0 0/40px 40px,#0b1020',dark:true},
  {id:'peach',name:'Peach',css:'linear-gradient(135deg,#ffecd2,#fcb69f)',dark:false},
  {id:'mint',name:'Mint',css:'linear-gradient(135deg,#d4fc79,#96e6a1)',dark:false},
  {id:'sky',name:'Sky',css:'linear-gradient(180deg,#a1c4fd,#c2e9fb)',dark:false}
];
const lum=hex=>{ const n=parseInt(hex.slice(1),16); return (0.299*(n>>16)+0.587*((n>>8)&255)+0.114*(n&255))/255; };

/* ---------- settings -> DOM ---------- */
function applySettings(paint=true){
  const s=S.settings, b=document.body, r=document.documentElement.style;
  const light = s.theme==='light' || (s.theme==='auto' && matchMedia('(prefers-color-scheme: light)').matches);
  b.classList.toggle('light',light);
  r.setProperty('--acc',s.accent); r.setProperty('--rad',s.radius+'px'); r.setProperty('--blur',s.blur+'px'); r.setProperty('--ga',s.glass);
  r.setProperty('--U',s.unit+'px'); r.setProperty('--dock',s.dockSize+'px'); r.setProperty('--font',FONTS[s.font]||FONTS.system);
  OS.perf = s.perf==='on' || (s.perf==='auto' && OS.lowEnd);
  b.classList.toggle('perf',OS.perf); b.classList.toggle('noblur',s.blur===0); b.classList.toggle('nolabels',!s.labels);
  b.classList.remove('dock-left','dock-right'); if(s.dockPos!=='bottom') b.classList.add('dock-'+s.dockPos);
  b.classList.toggle('dockhide',s.dockHide);
  if(paint) paintWall();
}
function paintWall(){
  const s=S.settings, w=$('#wall'), light=document.body.classList.contains('light');
  let dark=true; w.replaceChildren(); w.style.background='';
  const wp=s.wall||{};
  if(wp.type==='preset'){
    const p=OS.WALLPAPERS.find(x=>x.id===wp.id)||OS.WALLPAPERS[0]; dark=p.dark;
    if(p.blobs){ dark=!light; w.style.background=light?'#e8eeff':'#090b14';
      if(light){ w.style.setProperty('--b1','#8fa2ff'); w.style.setProperty('--b2','#6fe0ff'); w.style.setProperty('--b3','#ffa6d4'); }
      else { w.style.setProperty('--b1','#6a5cff'); w.style.setProperty('--b2','#00b7ff'); w.style.setProperty('--b3','#ff3f9a'); }
      w.append(h('div',{class:'bl'}),h('div',{class:'bl'}),h('div',{class:'bl'})); }
    else w.style.background=p.css;
  } else if(wp.type==='color'){ w.style.background=wp.value||'#222'; dark=lum(wp.value||'#222222')<.55; }
  else if(wp.type==='image'){ const d=OS.getWallImage(); if(d){ w.style.backgroundImage=`url(${d})`; } else w.style.background='#222'; }
  else if(wp.type==='url'){ w.style.backgroundImage=`url("${String(wp.value||'').replace(/["\\\n]/g,'')}")`; }
  document.documentElement.style.setProperty('--dtx',dark?'#fff':'#111');
}
OS.set = function(k,v){
  S.settings[k]=v; OS.save(); applySettings(k==='theme');
  if(['unit','widgetsOn','iconSize'].includes(k)) wm.renderDesktop();
  if(['dockSize','dockPos','dockHide','dockMag'].includes(k)){ wm.renderDock(); relayout(); }
  if(k==='favicons') OS.refreshAll();
  if(['clock24','clockSec','clockDate'].includes(k)) tick();
  if(k==='perf'||k==='theme') wm.renderDock();
  if(k==='cursor'||k==='perf') OS.syncCursor();
  OS.wins.forEach(w=>w.onSettings&&w.onSettings(k));
};
/* ---------- custom cursor (os/cursor.js) ---------- */
// auto = on for capable devices; off for weak devices, touch screens and Reduced-effects mode. 'on'/'off' always win.
OS.cursorWanted = function(){ const m=S.settings.cursor||'auto'; if(m==='off') return false; if(m==='on') return true;
  return !OS.perf && !OS.lowEnd && !(window.matchMedia && matchMedia('(pointer: coarse)').matches); };
OS.syncCursor = function(){
  const C=window.OSCursor; if(!C) return;
  if(OS.cursorWanted()){
    if(!C.running() && !C.start()){ document.body.classList.remove('fx-cursor'); if(S.settings.cursor==='on') OS.toast('The custom cursor needs WebGL, which this browser has turned off.'); return; }
    document.body.classList.add('fx-cursor');
  } else { C.stop(); document.body.classList.remove('fx-cursor'); }
};
// Mouse events don't reach us while the pointer is inside a game iframe, so the blob can't follow there: step aside and let the
// game's own cursor show, then come back when the pointer is over the OS again.
OS.ptr={x:-1,y:-1};
OS.cursorCheck = function(){
  const C=window.OSCursor; if(!C||!C.running()) return;
  const el=document.elementFromPoint?document.elementFromPoint(OS.ptr.x,OS.ptr.y):null, inFrame=!!(el&&el.tagName==='IFRAME');
  if(inFrame){ C.suspend(); document.body.classList.remove('fx-cursor'); } else { C.resume(); document.body.classList.add('fx-cursor'); }
};
document.addEventListener('pointerover',e=>{ OS.ptr.x=e.clientX; OS.ptr.y=e.clientY; const C=window.OSCursor; if(!C||!C.running()) return;
  if(e.target&&e.target.tagName==='IFRAME'){ C.suspend(); document.body.classList.remove('fx-cursor'); } else { C.resume(); document.body.classList.add('fx-cursor'); } },true);
document.addEventListener('pointermove',e=>{ OS.ptr.x=e.clientX; OS.ptr.y=e.clientY; },{passive:true,capture:true});

OS.setWall = function(wall){ S.settings.wall=wall; OS.save(); applySettings(true); OS.wins.forEach(w=>w.onSettings&&w.onSettings('wall')); };
OS.wallFromFile = function(file, done){
  const img=new Image(), url=URL.createObjectURL(file);
  img.onload=()=>{ const sc=Math.min(1,1920/Math.max(img.width,img.height)), c=document.createElement('canvas');
    c.width=Math.round(img.width*sc); c.height=Math.round(img.height*sc); c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    URL.revokeObjectURL(url);
    if(OS.setWallImage(c.toDataURL('image/jpeg',.82))){ OS.setWall({type:'image'}); done&&done(true); } else { OS.toast('Image is too big to store — try a smaller one.'); done&&done(false); } };
  img.onerror=()=>{ OS.toast('Could not read that image.'); done&&done(false); };
  img.src=url;
};

/* ---------- icons ---------- */
OS.iconImg = a => (S.settings.favicons && a.kind==='link' && !a.local) ? (()=>{ try{ return 'https://www.google.com/s2/favicons?sz=64&domain='+new URL(a.url).hostname; }catch{ return ''; } })() : '';
OS.iconNode = function(a){
  // the AI's icon is its mascot sprite (Blob Atelier), not an emoji tile
  if(a.id==='sys:ai' && OS.mascot && OS.mascot.available()){ const m=h('div',{class:'ico mascot'}); m.append(OS.mascot.el({still:true})); return m; }
  const ico=h('div',{class:'ico',style:{'--c':a.color||'#555'}}, a.emoji||'•');
  const src=OS.iconImg(a);
  if(src){ const im=new Image(); im.onload=()=>{ ico.textContent=''; ico.append(im); }; im.src=src; }
  return ico;
};
// A launchable app icon (used by Finder, folder tiles, widgets, dock). opts.sz = px size.
OS.appTile = function(a,o={}){
  const el=h('div',{class:'ai',title:a.name,draggable:o.drag!==false,style:o.sz?{'--sz':o.sz+'px'}:null},
    OS.iconNode(a), h('div',{class:'nm'},a.name));
  el.addEventListener('click',e=>{ e.stopPropagation(); (o.onclick||(()=>OS.launch(a.id)))(); });
  if(o.menu!==false) el.addEventListener('contextmenu',e=>{ e.preventDefault(); e.stopPropagation(); wm.appMenu(e.clientX,e.clientY,a); });
  el.addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/x-app',a.id); e.dataTransfer.effectAllowed='move'; el.classList.add('dragging'); });
  el.addEventListener('dragend',()=>el.classList.remove('dragging'));
  return el;
};
wm.appMenu = function(x,y,a){
  const fav=S.fav.includes(a.id), pinned=S.dock.includes(a.id), custom=!!S.customApps[a.id];
  OS.menu(x,y,[
    {label:'Open',run:()=>OS.launch(a.id)},
    {sep:1},
    {label:fav?'Remove from Favorites':'Add to Favorites ★',run:()=>{ OS.toggleFav(a.id); }},
    {label:pinned?'Remove from Dock':'Keep in Dock',run:()=>OS.togglePin(a.id)},
    {label:'Move to Folder…',run:()=>wm.moveDialog(a)},
    {label:'Rename / Change Icon…',run:()=>wm.editAppDialog(a)},
    {sep:1},
    {label:custom?'Delete App':'Hide App',run:()=>OS.confirm(custom?'Delete “'+a.name+'”?':'Hide “'+a.name+'”?',custom?'This removes the saved link.':'You can bring it back in Settings → Apps.',()=>OS.removeApp(a.id),custom?'Delete':'Hide'),dis:a.kind==='sys'}
  ]);
};
wm.moveDialog = function(a){
  OS.dialog({title:'Move “'+a.name+'”',fields:[{key:'f',label:'Folder',type:'select',value:OS.folderOf(a.id)?.id,choices:OS.folders().map(f=>[f.id,f.emoji+' '+f.name])}],ok:'Move',onOk:v=>OS.moveApp(a.id,v.f)});
};
wm.editAppDialog = function(a){
  OS.dialog({title:'Edit “'+a.name+'”',fields:[{key:'name',label:'Name',value:a.name},{key:'emoji',label:'Icon (emoji or letter)',value:a.emoji},{key:'color',label:'Color',type:'color',value:/^#[0-9a-f]{6}$/i.test(a.color)?a.color:'#0a84ff'}],ok:'Save',
    onOk:v=>{ const o=S.over[a.id]=S.over[a.id]||{}; o.name=v.name.trim()||a.name; o.emoji=v.emoji.trim().slice(0,4)||a.emoji; o.color=v.color; OS.save(); OS.refreshAll(); }});
};
wm.newFolderDialog = function(){
  OS.dialog({title:'New Folder',fields:[{key:'name',label:'Name',value:'New Folder'},{key:'emoji',label:'Icon',value:'📁'},{key:'color',label:'Color',type:'color',value:'#4aa3ff'},
    {key:'size',label:'Desktop size',type:'select',value:'S',choices:Object.entries(OS.FOLDER_SIZES).map(([k,[w,hh]])=>[k,`${k} (${w}×${hh})`])}],ok:'Create',
    onOk:v=>{ const f=OS.makeFolder(v.name.trim()||'New Folder',{emoji:v.emoji.trim()||'📁',color:v.color,noSave:true}); [f.w,f.h]=OS.FOLDER_SIZES[v.size]; OS.save(); wm.renderDesktop(); wm.renderDock(); }});
};
wm.folderDialog = function(f){
  OS.dialog({title:'Customize “'+f.name+'”',fields:[{key:'name',label:'Name',value:f.name},{key:'emoji',label:'Icon',value:f.emoji},{key:'color',label:'Color',type:'color',value:f.color},
    {key:'size',label:'Desktop size',type:'select',value:Object.entries(OS.FOLDER_SIZES).find(([,v])=>v[0]===f.w&&v[1]===f.h)?.[0]||'custom',choices:[...Object.entries(OS.FOLDER_SIZES).map(([k,[w,hh]])=>[k,`${k} (${w}×${hh})`]),['custom',`Custom (${f.w}×${f.h}) – drag the corner`]]},
    {key:'icon',label:'Icon size inside folder window',type:'range',min:40,max:160,value:f.icon||64},{key:'desktop',label:'Show on desktop',type:'check',value:f.desktop}],ok:'Save',
    onOk:v=>{ f.name=v.name.trim()||f.name; f.emoji=v.emoji.trim()||f.emoji; f.color=v.color; f.icon=v.icon; f.desktop=v.desktop; if(OS.FOLDER_SIZES[v.size]) [f.w,f.h]=OS.FOLDER_SIZES[v.size]; OS.save(); OS.refreshAll(); }});
};
wm.folderMenu = function(x,y,f){
  OS.menu(x,y,[
    {label:'Open',run:()=>wm.openFolder(f.id)},{sep:1},
    {hd:'Size'},...Object.entries(OS.FOLDER_SIZES).map(([k,[w,hh]])=>({label:`${(f.w===w&&f.h===hh)?'✓ ':'   '}${k}  (${w}×${hh})`,run:()=>{ f.w=w; f.h=hh; OS.save(); wm.renderDesktop(); }})),{sep:1},
    {label:'Customize…',run:()=>wm.folderDialog(f)},
    {label:S.dock.includes('folder:'+f.id)?'Remove from Dock':'Keep in Dock',run:()=>OS.togglePin('folder:'+f.id)},
    {label:'Hide from Desktop',run:()=>{ f.desktop=false; OS.save(); wm.renderDesktop(); }},
    {label:'Delete Folder',run:()=>OS.confirm('Delete “'+f.name+'”?','Its apps move to Utilities.',()=>OS.deleteFolder(f.id))}
  ]);
};
wm.openFolder = id => OS.launch('sys:finder',{loc:id});
wm.addLinkDialog = function(prefill=''){
  OS.dialog({title:'Add app from link',sub:'Paste any website (or a page under games/). It becomes an app that opens in its own window.',
    fields:[{key:'url',label:'Link',value:prefill,placeholder:'https://example.com'},{key:'name',label:'Name (optional)',value:''},{key:'emoji',label:'Icon (optional emoji)',value:''},
      {key:'folder',label:'Folder',type:'select',value:'tools',choices:OS.folders().map(f=>[f.id,f.emoji+' '+f.name])},{key:'open',label:'Open it now',type:'check',value:true}],ok:'Add app',
    onOk:v=>{ const a=OS.addLinkApp(v.url,{name:v.name,emoji:v.emoji.trim(),folder:v.folder}); if(!a){ OS.toast('That doesn’t look like a web link. Try https://example.com'); return false; } OS.toast('Added “'+a.name+'”'); if(v.open) OS.launch(a.id); }});
};
wm.toggleSiteFullscreen = ()=>{ if(document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen().catch(()=>{}); };
wm.resetLayout = function(){
  OS.confirm('Reset desktop layout?','Folders and widgets return to their default positions and sizes. Your apps and settings stay.',()=>{
    for(const f of OS.folders()){ f.w=1; f.h=1; f.placed=false; f.desktop=true; }
    S.widgets=null; wm.renderDesktop(); OS.save(); },'Reset');
};

/* ---------- menu bar + clock ---------- */
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], DAY=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
OS.timeStr = function(d=new Date(),sec=S.settings.clockSec,h24=S.settings.clock24){
  let H=d.getHours(), ap=''; if(!h24){ ap=H>=12?' PM':' AM'; H=H%12||12; }
  return (h24?OS.pad(H):H)+':'+OS.pad(d.getMinutes())+(sec?':'+OS.pad(d.getSeconds()):'')+ap;
};
let clockEl, appNameEl;
function buildMenubar(){
  const mi=(label,run,cls='')=>h('button',{class:'mi '+cls,onclick:e=>{ e.stopPropagation(); const on=e.currentTarget.classList.contains('on'); OS.closeMenu(); if(!on){ e.currentTarget.classList.add('on'); run(e.currentTarget.getBoundingClientRect()); } }},label);
  appNameEl=h('span',null,'Desktop');
  clockEl=mi('',r=>{ OS.menu(innerWidth-250,MB+2,[{custom:OS.widgets.calendarPopover()}]); mbar.querySelector('.clock').classList.add('on'); },'clock'); clockEl.classList.add('clock');
  mbar.replaceChildren(
    mi('🕹️',r=>OS.menu(r.left,MB,[{label:'About ArcadeOS',run:()=>OS.toast('ArcadeOS — Saket’s arcade, now a desktop. Everything saves in this browser.',5000)},{sep:1},
      {label:'Settings…',run:()=>OS.launch('sys:settings'),k:''},{label:S.settings.theme==='light'?'Switch to Dark Mode':'Switch to Light Mode',run:()=>OS.set('theme',document.body.classList.contains('light')?'dark':'light')},
      {label:OS.perf?'Turn Full Effects on':'Reduce Effects (faster)',run:()=>OS.set('perf',OS.perf?'off':'on')},{sep:1},
      {label:'Fullscreen',run:wm.toggleSiteFullscreen}]),'logo'),
    h('button',{class:'mi b',onclick:()=>{}},appNameEl),
    mi('Desktop',r=>OS.menu(r.left,MB,[{label:'New Folder…',run:wm.newFolderDialog},{label:'Add App from Link…',run:()=>wm.addLinkDialog()},{label:'Add Widget…',run:()=>wm.addWidgetMenu(r.left,MB)},{sep:1},
      {label:S.settings.widgetsOn?'Hide Widgets':'Show Widgets',run:()=>OS.set('widgetsOn',!S.settings.widgetsOn)},{label:'Wallpaper & Appearance…',run:()=>OS.launch('sys:settings',{page:'appearance'})},{label:'Reset Layout…',run:wm.resetLayout}]),'hide-s'),
    mi('Window',r=>{ const ws=[...OS.wins.values()];
      OS.menu(r.left,MB,[{label:'Minimize',run:()=>focused&&minimize(focused),dis:!focused},{label:'Zoom',run:()=>focused&&toggleMax(focused),dis:!focused},{label:'Close',run:()=>focused&&close(focused),dis:!focused},{sep:1},
        {label:'Show Desktop',run:showDesktop},{label:'Tile Windows',run:tile},{label:'Close All',run:()=>ws.forEach(close),dis:!ws.length},
        ...(ws.length?[{sep:1},{hd:'Open windows'}]:[]),...ws.map(w=>({label:(w.min?'(min) ':'')+w.title,run:()=>{ restore(w); focus(w); }}))]); },'hide-s'),
    h('div',{class:'sp'}),
    mi(OS.mascot&&OS.mascot.available()?OS.mascot.el({size:24,still:true}):'✨',()=>{ OS.launch('sys:ai'); },'hide-s'),
    mi('🔎',()=>{ OS.spot.open(); },'hide-s'),
    clockEl);
}
function tick(){
  const d=new Date(), s=S.settings;
  if(clockEl) clockEl.textContent=(s.clockDate?DAY[d.getDay()]+' '+MON[d.getMonth()]+' '+d.getDate()+'  ':'')+OS.timeStr(d);
  OS.tickers.forEach(f=>{ try{ f(d); }catch(e){ console.warn(e); } });
}
function startTicker(){ tick(); const loop=()=>{ if(!document.hidden) tick(); setTimeout(loop,1000-Date.now()%1000+5); }; setTimeout(loop,1000-Date.now()%1000+5); }

/* ---------- windows ---------- */
let zTop=100, focused=null, openCount=0;
const workArea=()=>{ const s=S.settings, d=s.dockHide?0:s.dockSize+28; let x=0,w=innerWidth,hh=innerHeight-MB;
  if(s.dockPos==='bottom') hh-=d; else if(s.dockPos==='left'){ x=d; w-=d; } else w-=d; return {x,y:0,w,h:hh}; };
const setRect=W=>{ const st=W.el.style; st.left=W.x+'px'; st.top=W.y+'px'; st.width=W.w+'px'; st.height=W.h+'px'; };
function layoutMax(W){ const a=workArea(); W.x=a.x; W.y=a.y; W.w=a.w; W.h=a.h; setRect(W); }
function relayout(){ OS.wins.forEach(W=>{ if(W.max) layoutMax(W); else { const a=workArea(); W.x=clamp(W.x,-W.w+100,innerWidth-100); W.y=clamp(W.y,0,Math.max(0,a.h-40)); setRect(W); } }); }
function acct(W){ if(W.since){ S.play[W.appId]=(S.play[W.appId]||0)+(Date.now()-W.since)/1000; W.since=0; } }
function startAcct(W){ if(W.appId && !W.min && !document.hidden && !W.since) W.since=Date.now(); }
document.addEventListener('visibilitychange',()=>OS.wins.forEach(W=>document.hidden?acct(W):startAcct(W)));
setInterval(()=>{ let any=false; OS.wins.forEach(W=>{ if(W.since){ acct(W); startAcct(W); any=true; } }); if(any) OS.save(); },30000);

OS.openWindow = function(o){
  if(o.key && OS.wins.has(o.key)){ const W=OS.wins.get(o.key); restore(W); focus(W); return W; }
  const a=workArea(), saved=(S.winSize&&S.winSize[o.sizeKey||o.key])||{};
  const w=clamp(saved.w||o.w||900,o.minW||320,a.w-12), hh=clamp(saved.h||o.h||600,o.minH||220,a.h-12);
  const n=openCount++%8;
  const W={ id:OS.uid('w_'), key:o.key||null, sizeKey:o.sizeKey||o.key||null, appId:o.appId||null, title:o.title||'Window', w, h:hh, x:Math.round(a.x+(a.w-w)/2+(n-3)*26), y:Math.round(Math.max(8,(a.h-hh)/2+(n-3)*20)),
    min:false, max:false, o, since:0 };
  W.x=clamp(W.x,a.x,Math.max(a.x,a.x+a.w-w)); W.y=clamp(W.y,0,Math.max(0,a.h-hh));
  const tools=(o.tools||[]).map(t=>h('button',{title:t.title,onclick:e=>{ e.stopPropagation(); t.run(W); }},t.label));
  W.titleEl=h('div',{class:'wt'},W.title);
  const lights=h('div',{class:'lights'},
    h('button',{class:'r',title:'Close',onclick:e=>{ e.stopPropagation(); close(W); }},'×'),
    h('button',{class:'y',title:'Minimize',onclick:e=>{ e.stopPropagation(); minimize(W); }},'–'),
    h('button',{class:'g',title:'Zoom (Shift-click: full screen)',onclick:e=>{ e.stopPropagation(); e.shiftKey?fullscreen(W):toggleMax(W); }},'+'));
  const tb=h('div',{class:'wtb'},lights,W.titleEl,h('div',{class:'wtools'},tools));
  W.body=h('div',{class:'wbody'+(o.ui?' ui':'')},o.body);
  W.el=h('div',{class:'win glass opening'},tb,W.body);
  for(const d of ['n','s','e','w','ne','nw','se','sw']){ const r=h('div',{class:'rh '+d}); r.addEventListener('pointerdown',e=>resizeStart(W,d,e)); W.el.append(r); }
  tb.addEventListener('pointerdown',e=>dragStart(W,e,tb));
  tb.addEventListener('dblclick',e=>{ if(!e.target.closest('button')) toggleMax(W); });
  W.el.addEventListener('pointerdown',()=>focus(W),true);
  setRect(W); winsEl.append(W.el); OS.wins.set(W.id,W); if(W.key) OS.wins.set(W.key,W);
  requestAnimationFrame(()=>W.el.classList.remove('opening'));
  if(innerWidth<700){ toggleMax(W); }
  focus(W); startAcct(W); wm.renderDock();
  return W;
};
// Map holds both id and key aliases → iterate unique windows via this helper.
const uniq=()=>[...new Set(OS.wins.values())];
OS.wins.forEach=fn=>{ uniq().forEach(w=>fn(w)); };
OS.wins.listAll=uniq;

function focus(W){
  if(!W||W.min) return;
  uniq().forEach(x=>x.el.classList.toggle('focused',x===W));
  W.el.style.zIndex=++zTop; focused=W;
  appNameEl&&(appNameEl.textContent=W.title);
  setTimeout(OS.cursorCheck,30);
  if(zTop>7900){ let z=100; uniq().sort((a,b)=>a.el.style.zIndex-b.el.style.zIndex).forEach(x=>x.el.style.zIndex=++z); zTop=z; }
}
function unfocusAll(){ uniq().forEach(x=>x.el.classList.remove('focused')); focused=null; appNameEl&&(appNameEl.textContent='Desktop'); }
function minimize(W){
  if(W.min) return; W.min=true; acct(W); W.el.classList.add('min'); W.el.classList.remove('focused');
  if(document.fullscreenElement===W.body) document.exitFullscreen();
  const next=uniq().filter(x=>!x.min).sort((a,b)=>b.el.style.zIndex-a.el.style.zIndex)[0];
  if(next) focus(next); else unfocusAll();
  wm.renderDock(); setTimeout(OS.cursorCheck,30);
}
function restore(W){ if(!W.min) return; W.min=false; W.el.classList.remove('min'); startAcct(W); focus(W); wm.renderDock(); }
function toggleMax(W){
  if(W.max){ W.max=false; W.el.classList.remove('max'); Object.assign(W,W.prev||{}); setRect(W); }
  else { W.prev={x:W.x,y:W.y,w:W.w,h:W.h}; W.max=true; W.el.classList.add('max'); layoutMax(W); }
}
function snapHalf(W,side){ const a=workArea(); if(!W.max&&!W.snapped) W.prev={x:W.x,y:W.y,w:W.w,h:W.h}; W.snapped=true; W.w=Math.floor(a.w/2); W.h=a.h; W.x=a.x+(side==='l'?0:a.w-W.w); W.y=0; setRect(W); }
function fullscreen(W){ if(document.fullscreenElement===W.body) document.exitFullscreen(); else W.body.requestFullscreen&&W.body.requestFullscreen().catch(()=>OS.toast('Full screen was blocked by the browser.')); }
function close(W){
  acct(W); OS.save();
  if(W.sizeKey && !W.max){ S.winSize=S.winSize||{}; S.winSize[W.sizeKey]={w:W.w,h:W.h}; }
  W.o.onClose&&W.o.onClose(W);
  W.el.querySelectorAll('iframe').forEach(f=>{ f.src='about:blank'; });
  W.el.classList.add('opening');
  OS.wins.delete(W.id); if(W.key) OS.wins.delete(W.key);
  setTimeout(()=>W.el.remove(),160);
  if(focused===W){ focused=null; const next=uniq().filter(x=>!x.min).sort((a,b)=>b.el.style.zIndex-a.el.style.zIndex)[0]; next?focus(next):unfocusAll(); }
  wm.renderDock(); setTimeout(OS.cursorCheck,30);
}
OS.closeAppWindows = id=>uniq().filter(w=>w.appId===id).forEach(close);
OS.winOf = id=>uniq().filter(w=>w.appId===id);
function showDesktop(){ const vis=uniq().filter(w=>!w.min); if(vis.length) vis.forEach(minimize); else uniq().forEach(restore); }
function tile(){ const ws=uniq().filter(w=>!w.min); if(!ws.length) return; const a=workArea(), cols=Math.ceil(Math.sqrt(ws.length)), rows=Math.ceil(ws.length/cols);
  ws.forEach((W,i)=>{ if(W.max){ W.max=false; W.el.classList.remove('max'); } W.w=Math.floor(a.w/cols); W.h=Math.floor(a.h/rows); W.x=a.x+(i%cols)*W.w; W.y=Math.floor(i/cols)*W.h; setRect(W); }); }
OS.wm.focusWin=focus; OS.wm.minimize=minimize; OS.wm.restore=restore; OS.wm.closeWin=close; OS.wm.fullscreen=fullscreen;

function dragStart(W,e,tb){
  if(e.button!==0||e.target.closest('button,input')) return;
  const sx=e.clientX, sy=e.clientY; let moved=false, bx,by,px,py;
  tb.setPointerCapture(e.pointerId);
  const mv=ev=>{
    if(!moved){ if(Math.hypot(ev.clientX-sx,ev.clientY-sy)<4) return; moved=true;
      if(W.max||W.snapped){ const fx=(sx-W.x)/W.w, p=W.prev; W.max=false; W.snapped=false; W.el.classList.remove('max'); if(p){ W.w=p.w; W.h=p.h; } W.x=Math.round(sx-fx*W.w); W.y=Math.max(0,sy-MB-16); setRect(W); }
      bx=W.x; by=W.y; px=ev.clientX; py=ev.clientY; document.body.classList.add('dragging'); W.el.classList.add('dragging'); }
    const a=workArea();
    W.x=clamp(bx+ev.clientX-px,-W.w+110,innerWidth-110); W.y=clamp(by+ev.clientY-py,0,Math.max(0,a.h-38)); setRect(W);
  };
  const up=ev=>{
    tb.removeEventListener('pointermove',mv); tb.removeEventListener('pointerup',up); tb.removeEventListener('pointercancel',up);
    document.body.classList.remove('dragging'); W.el.classList.remove('dragging');
    if(moved){ if(ev.clientY-MB<=3) toggleMax(W); else if(ev.clientX<=3) snapHalf(W,'l'); else if(ev.clientX>=innerWidth-3) snapHalf(W,'r'); }
  };
  tb.addEventListener('pointermove',mv); tb.addEventListener('pointerup',up); tb.addEventListener('pointercancel',up);
}
function resizeStart(W,dir,e){
  if(e.button!==0||W.max) return; e.preventDefault(); e.stopPropagation(); focus(W);
  const t=e.currentTarget; t.setPointerCapture(e.pointerId);
  const sx=e.clientX, sy=e.clientY, r={x:W.x,y:W.y,w:W.w,h:W.h}, mw=W.o.minW||320, mh=W.o.minH||200;
  document.body.classList.add('dragging'); W.el.classList.add('resizing'); W.snapped=false;
  const mv=ev=>{
    const dx=ev.clientX-sx, dy=ev.clientY-sy;
    if(dir.includes('e')) W.w=Math.max(mw,r.w+dx);
    if(dir.includes('s')) W.h=Math.max(mh,r.h+dy);
    if(dir.includes('w')){ W.w=Math.max(mw,r.w-dx); W.x=r.x+r.w-W.w; }
    if(dir.includes('n')){ const nh=Math.max(mh,r.h-dy); W.y=Math.max(0,r.y+r.h-nh); W.h=r.y+r.h-W.y; }
    setRect(W);
  };
  const up=()=>{ t.removeEventListener('pointermove',mv); t.removeEventListener('pointerup',up); t.removeEventListener('pointercancel',up); document.body.classList.remove('dragging'); W.el.classList.remove('resizing'); W.onResize&&W.onResize(); };
  t.addEventListener('pointermove',mv); t.addEventListener('pointerup',up); t.addEventListener('pointercancel',up);
}
addEventListener('resize',()=>{ relayout(); wm.renderDesktopPositions&&wm.renderDesktopPositions(); });

/* ---------- launching ---------- */
const FRAME_ALLOW='fullscreen *; pointer-lock *; autoplay *; gamepad *; clipboard-write *; accelerometer *; gyroscope *';
let noteDismissed=false;
function frameWindow(a,url,external){
  const f=h('iframe',{allow:FRAME_ALLOW,referrerpolicy:external?'no-referrer':null});
  if(external) f.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-presentation allow-modals allow-downloads');
  f.src=url;
  const kids=[];
  let urlIn;
  if(external){
    urlIn=h('input',{value:url,spellcheck:false});
    urlIn.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter'){ const n=OS.normUrl(urlIn.value); const u=n?n.url:'https://www.google.com/search?igu=1&q='+encodeURIComponent(urlIn.value); f.src=u; urlIn.value=u; } });
    kids.push(h('div',{class:'wurl'},h('button',{title:'Reload',onclick:()=>{ f.src=f.src; }},'⟳'),urlIn,
      h('button',{title:'Open in a real browser tab',onclick:()=>window.open(urlIn.value,'_blank','noopener')},'↗')));
    if(!noteDismissed){ const note=h('div',{class:'wnote'},'Blank or refused? Many sites don’t allow being shown inside other pages.',h('a',{onclick:()=>window.open(urlIn.value,'_blank','noopener')},'Open in a new tab ↗'),h('a',{style:{opacity:.6},onclick:()=>{ noteDismissed=true; note.remove(); }},'dismiss')); kids.push(note); }
  }
  kids.push(f);
  return {kids,f,urlIn};
}
wm.frameWindow=frameWindow;
OS.launch = function(id,o={}){
  const a=OS.app(id); if(!a) return;
  if(a.kind==='sys') return OS.apps.open(a,o);
  const existing=OS.winOf(id)[0];
  if(existing){ restore(existing); focus(existing); return existing; }
  S.recent=[id,...S.recent.filter(x=>x!==id)].slice(0,12); OS.save(); OS.wm.refreshWidgets('recents');
  const external=!a.local && a.kind==='link', url=a.path||a.url;
  const fw=frameWindow(a,url,external);
  const W=OS.openWindow({appId:id,key:id,title:a.name,body:fw.kids,w:external?1000:960,h:external?680:640,
    tools:[{label:'⟳',title:'Reload',run:()=>{ fw.f.src=fw.f.src; }},{label:'⛶',title:'Full screen',run:w=>fullscreen(w)}]});
  return W;
};
OS.openUrl = function(url,o={}){
  const n=OS.normUrl(url); if(!n) return;
  const a={name:o.title||n.url}; const fw=frameWindow(a,n.url,!n.local);
  const W=OS.openWindow({title:o.title||(()=>{ try{ return new URL(n.url).hostname; }catch{ return 'Web'; } })(),body:fw.kids,w:1000,h:680,sizeKey:'browser',
    tools:[{label:'＋',title:'Save as app',run:()=>wm.addLinkDialog(n.url)},{label:'⛶',title:'Full screen',run:w=>fullscreen(w)}]});
  return W;
};

/* ---------- dock ---------- */
wm.renderDock = function(){
  const items=[]; const run=new Set(OS.winOf && uniq().map(w=>w.appId).filter(Boolean));
  const add=(id)=>{
    if(id==='|') return items.push(h('div',{class:'dsep'}));
    let a, isFolder=false;
    if(id.startsWith('folder:')){ const f=S.folders[id.slice(7)]; if(!f) return; isFolder=true; a={id,name:f.name,emoji:f.emoji,color:f.color}; }
    else { a=OS.app(id); if(!a) return; }
    const wins=isFolder?[]:OS.winOf(id);
    const act=()=>{
      if(isFolder) return wm.openFolder(id.slice(7));
      if(wins.length){ const top=wins.sort((x,y)=>y.el.style.zIndex-x.el.style.zIndex)[0]; if(top.min) restore(top); else if(focused===top&&wins.length===1&&a.kind!=='sys') minimize(top); else focus(top); }
      else OS.launch(id);
    };
    const di=h('div',{class:'di'+(wins.length?' run':'')+(wins.length&&wins.every(w=>w.min)?' minz':'')},
      isFolder?h('div',{class:'ai',style:{'--sz':'var(--dock)'}},h('div',{class:'ico',style:{'--c':a.color}},a.emoji)):OS.appTile(a,{drag:false,menu:false,onclick:act}), h('div',{class:'tip glass'},a.name));
    if(isFolder) di.addEventListener('click',act);
    di.addEventListener('contextmenu',e=>{ e.preventDefault(); e.stopPropagation();
      OS.menu(e.clientX,e.clientY-10,[{label:'Open',run:()=>isFolder?wm.openFolder(id.slice(7)):OS.launch(id)},{label:S.dock.includes(id)?'Remove from Dock':'Keep in Dock',run:()=>OS.togglePin(id)},
        ...(wins.length?[{sep:1},{label:'Quit (close windows)',run:()=>OS.closeAppWindows(id)}]:[])]); });
    items.push(di);
  };
  S.dock.forEach(add);
  const extra=[...run].filter(id=>!S.dock.includes(id)&&OS.app(id));
  if(extra.length){ items.push(h('div',{class:'dsep'})); extra.forEach(add); }
  dock.replaceChildren(...items);
};
function dockMag(){
  const horiz=!document.body.classList.contains('dock-left')&&!document.body.classList.contains('dock-right');
  let raf=0;
  dock.addEventListener('pointermove',e=>{
    if(!S.settings.dockMag||OS.perf||e.pointerType==='touch') return;
    if(raf) return; raf=requestAnimationFrame(()=>{ raf=0;
      dock.querySelectorAll('.di').forEach(d=>{ const r=d.getBoundingClientRect(); const horiz2=!document.body.className.match(/dock-(left|right)/);
        const c=horiz2?r.left+r.width/2:r.top+r.height/2, p=horiz2?e.clientX:e.clientY, dist=Math.abs(c-p), k=Math.max(0,1-dist/120);
        d.style.transform=`scale(${1+.55*k*k})`; d.style.zIndex=Math.round(k*10); }); });
  });
  dock.addEventListener('pointerleave',()=>{ dock.querySelectorAll('.di').forEach(d=>{ d.style.transform=''; d.style.zIndex=''; }); });
  // auto-hide
  let t=0; const show=()=>{ clearTimeout(t); dockwrap.classList.add('show'); }, hide=()=>{ clearTimeout(t); t=setTimeout(()=>dockwrap.classList.remove('show'),450); };
  $('#dockedge').addEventListener('pointerenter',show); dockwrap.addEventListener('pointerenter',show); dockwrap.addEventListener('pointerleave',hide);
}

/* ---------- desktop ---------- */
const U=()=>S.settings.unit;
const dims=f=>f.w===1&&f.h===1?{w:1,h:1.35}:{w:f.w,h:f.h};
const wdims=w=>({w:w.w,h:w.h});
function items(){ const a=[]; OS.folders().forEach(f=>{ if(f.desktop&&f.placed) a.push({gx:f.gx,gy:f.gy,...dims(f)}); }); (S.widgets||[]).forEach(w=>{ if(w.placed!==false) a.push({gx:w.gx,gy:w.gy,...wdims(w)}); }); return a; }
function freeSpot(w,hh,fromRight){
  const cols=desk.clientWidth/U(), rows=desk.clientHeight/U(), its=items(), m=.12;
  const ok=(x,y)=>its.every(i=>x+w+m<=i.gx||i.gx+i.w+m<=x||y+hh+m<=i.gy||i.gy+i.h+m<=y);
  const xs=[]; for(let x=.4;x<=Math.max(.4,cols-w);x+=.5) xs.push(x); if(fromRight) xs.reverse();
  for(const x of xs) for(let y=.4;y<=Math.max(.4,rows-hh);y+=.5) if(ok(x,y)) return {gx:x,gy:y};
  return {gx:.4+Math.random()*2,gy:.4+Math.random()*2};
}
OS.freeSpot=freeSpot;
function defaultWidgets(){
  const cols=desk.clientWidth/U(), L=[]; const mk=(type,w,hh,o={})=>({id:OS.uid('w_'),type,w,h:hh,gx:0,gy:0,shape:'squircle',style:'glass',tint:'#0a84ff',opts:{},placed:false,...o});
  L.push(mk('search',5,1,{gx:Math.max(.4,(cols-5)/2),gy:.4,placed:true}));
  L.push(mk('clock',3,2)); if(cols>=10) L.push(mk('weather',3,2)); if(cols>=12) L.push(mk('favorites',3,3));
  return L;
}
wm.renderDesktop = function(){
  desk.replaceChildren();
  if(!S.widgets) S.widgets=defaultWidgets();
  for(const f of OS.folders()){
    if(!f.desktop) continue;
    if(!f.placed){ const d=dims(f); Object.assign(f,freeSpot(d.w,d.h)); f.placed=true; }
    desk.append(folderEl(f));
  }
  if(S.settings.widgetsOn){
    // place unplaced widgets at the right edge
    for(const w of S.widgets) if(w.placed===false){ Object.assign(w,freeSpot(w.w,w.h,true)); w.placed=true; }
    for(const w of S.widgets) desk.append(OS.widgets.mount(w));
  }
  OS.save();
};
wm.renderDesktopPositions=()=>{ desk.querySelectorAll('.dt').forEach(el=>{ const o=el._obj; if(!o) return; place(el,o); }); };
function place(el,o){
  const u=U(), isF=o.items!==undefined, d=isF?dims(o):{w:o.w,h:o.h};
  el.style.left=Math.round(o.gx*u)+'px'; el.style.top=Math.round(o.gy*u)+'px';
  if(!(isF&&o.w===1&&o.h===1)){ el.style.width=Math.round(d.w*u-8)+'px'; el.style.height=Math.round(d.h*u-8)+'px'; }
}
wm.place=place;
function folderEl(f){
  let el;
  const sm=f.w===1&&f.h===1;
  if(sm){
    el=h('div',{class:'dt fold1',title:f.name},h('div',{class:'fico',style:{'--c':f.color,'--sz':Math.round(U()*.78)+'px'}},h('span',null,f.emoji)),h('div',{class:'nm'},f.name));
  } else {
    const u=U(), cols=Math.max(1,Math.floor((f.w*u-28)/(u*.72))), rows=Math.max(1,Math.floor((f.h*u-62)/(u*.78))), cap=cols*rows;
    const apps=f.items.map(OS.app).filter(a=>a&&!a.hidden), shown=apps.length>cap?apps.slice(0,cap-1):apps;
    const grid=h('div',{class:'fg',style:{gridTemplateColumns:`repeat(${cols},1fr)`}},shown.map(a=>OS.appTile(a,{sz:Math.round(u*.5)})));
    if(apps.length>cap) grid.append(h('div',{class:'more',title:'Open folder',onclick:()=>wm.openFolder(f.id)},'+'+(apps.length-cap+1)));
    el=h('div',{class:'dt ftile glass',style:{'--c':f.color}},h('div',{class:'fh'},h('span',{class:'dot'}),f.emoji+' '+f.name,h('span',{style:{marginLeft:'auto',opacity:.5}},apps.length)),grid);
    const rz=h('div',{class:'rz',title:'Drag to resize'}); el.append(rz); resizable(el,f,rz,{min:2});
  }
  el._obj=f; place(el,f);
  // accept dropped apps
  el.addEventListener('dragover',e=>{ if(e.dataTransfer.types.includes('text/x-app')){ e.preventDefault(); el.classList.add('dropok'); } });
  el.addEventListener('dragleave',()=>el.classList.remove('dropok'));
  el.addEventListener('drop',e=>{ e.preventDefault(); el.classList.remove('dropok'); const id=e.dataTransfer.getData('text/x-app'); if(id){ OS.moveApp(id,f.id); OS.toast('Moved to '+f.name); } });
  el.addEventListener('contextmenu',e=>{ e.preventDefault(); e.stopPropagation(); wm.folderMenu(e.clientX,e.clientY,f); });
  draggable(el,f,{click:sm?()=>wm.openFolder(f.id):t=>{ if(t.closest&&t.closest('.fh')) wm.openFolder(f.id); }});
  return el;
}
// drag a desktop object (folder tile / widget); snaps to half-units when enabled
function draggable(el,o,opt={}){
  el.addEventListener('pointerdown',e=>{
    if(e.button!==0) return;
    if(e.target.closest('input,textarea,select,button,a,.rz,.ai,.more,[data-nodrag]')&&!opt.allowIcons) return;
    const sx=e.clientX, sy=e.clientY, ox=o.gx, oy=o.gy, downT=e.target; let moved=false; el.setPointerCapture(e.pointerId);
    const mv=ev=>{
      if(!moved&&Math.hypot(ev.clientX-sx,ev.clientY-sy)<5) return;
      if(!moved){ moved=true; document.body.classList.add('dragging'); el.style.zIndex=5; }
      const u=U(); let gx=ox+(ev.clientX-sx)/u, gy=oy+(ev.clientY-sy)/u;
      if(S.settings.snap){ gx=Math.round(gx*2)/2; gy=Math.round(gy*2)/2; }
      const d=o.items!==undefined?dims(o):{w:o.w,h:o.h};
      o.gx=clamp(gx,0,Math.max(0,desk.clientWidth/u-d.w)); o.gy=clamp(gy,0,Math.max(0,desk.clientHeight/u-Math.min(d.h,2)));
      place(el,o);
    };
    const up=()=>{ el.removeEventListener('pointermove',mv); el.removeEventListener('pointerup',up); el.removeEventListener('pointercancel',up);
      document.body.classList.remove('dragging'); el.style.zIndex=''; if(moved) OS.save(); else if(opt.click) opt.click(downT); };
    el.addEventListener('pointermove',mv); el.addEventListener('pointerup',up); el.addEventListener('pointercancel',up);
  });
}
function resizable(el,o,handle,opt={}){
  handle.addEventListener('pointerdown',e=>{
    e.preventDefault(); e.stopPropagation(); handle.setPointerCapture(e.pointerId); document.body.classList.add('dragging');
    const sx=e.clientX, sy=e.clientY, r=el.getBoundingClientRect(), u=U(), min=opt.min||1;
    const mv=ev=>{ const w=clamp(Math.round((r.width+8+ev.clientX-sx)/u),min,12), hh=clamp(Math.round((r.height+8+ev.clientY-sy)/u),opt.minH||min,10);
      el.style.width=(w*u-8)+'px'; el.style.height=(hh*u-8)+'px'; el._nw=w; el._nh=hh; };
    const up=()=>{ handle.removeEventListener('pointermove',mv); handle.removeEventListener('pointerup',up); document.body.classList.remove('dragging');
      if(el._nw){ o.w=el._nw; o.h=el._nh; OS.save(); if(o.type) OS.widgets.rerender(o); else wm.renderDesktop(); } };
    handle.addEventListener('pointermove',mv); handle.addEventListener('pointerup',up);
  });
}
wm.draggable=draggable; wm.resizable=resizable;
wm.refreshWidgets=type=>OS.widgets&&OS.widgets.refresh(type);

wm.addWidgetMenu = function(x=200,y=60){
  OS.menu(x,y,[{hd:'Add widget'},...OS.widgets.TYPES.map(t=>({label:t.emoji+'  '+t.name,run:()=>OS.widgets.add(t.id)}))]);
};
desk.addEventListener('contextmenu',e=>{
  e.preventDefault();
  OS.menu(e.clientX,e.clientY,[{label:'New Folder…',run:wm.newFolderDialog},{label:'Add App from Link…',run:()=>wm.addLinkDialog()},{label:'Add Widget…',run:()=>wm.addWidgetMenu(e.clientX,e.clientY)},{sep:1},
    {label:S.settings.widgetsOn?'Hide Widgets':'Show Widgets',run:()=>OS.set('widgetsOn',!S.settings.widgetsOn)},{label:'Change Wallpaper…',run:()=>OS.launch('sys:settings',{page:'appearance'})},{label:'Settings…',run:()=>OS.launch('sys:settings')},{sep:1},{label:'Reset Layout…',run:wm.resetLayout}]);
});
desk.addEventListener('pointerdown',e=>{ if(e.target===desk) unfocusAll(); });
$('#wall').addEventListener('pointerdown',unfocusAll);

wm.renderAll=()=>{ wm.renderDesktop(); wm.renderDock(); };
wm.init = function(){
  applySettings(); buildMenubar(); dockMag(); startTicker(); OS.syncCursor();
  matchMedia('(prefers-color-scheme: light)').addEventListener&&matchMedia('(prefers-color-scheme: light)').addEventListener('change',()=>{ if(S.settings.theme==='auto') applySettings(); });
  document.addEventListener('fullscreenchange',()=>uniq().forEach(W=>W.el.classList.toggle('fs',document.fullscreenElement===W.body)));
};
})();
