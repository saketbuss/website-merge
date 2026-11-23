/* ArcadeOS core: DOM helper, catalog (games/system apps), persisted state, folder/app model. */
(function(){
'use strict';
const OS = window.OS = { wins:new Map(), tickers:new Set() };

/* ---------- helpers ---------- */
// h(tag, attrs, ...children): builds DOM without innerHTML so user text (app names, notes) can never inject markup.
OS.h = function h(tag, attrs, ...kids){
  const e = document.createElement(tag);
  if(attrs) for(const k in attrs){
    const v = attrs[k]; if(v==null||v===false) continue;
    if(k==='class') e.className = v;
    else if(k==='style' && typeof v==='object') Object.assign(e.style, v);
    else if(k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if(k==='html') e.innerHTML = v;            // only ever called with static strings
    else if(k in e && k!=='list' && k!=='type') try{ e[k]=v }catch{ e.setAttribute(k,v) }
    else e.setAttribute(k, v===true?'':v);
  }
  for(const c of kids.flat(9)){ if(c==null||c===false) continue; e.append(c.nodeType?c:document.createTextNode(c)); }
  return e;
};
OS.$ = (s,r=document)=>r.querySelector(s);
OS.uid = (p='x')=>p+Math.random().toString(36).slice(2,8);
OS.clamp = (v,a,b)=>Math.min(b,Math.max(a,v));
OS.esc = s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
OS.pick = a=>a[Math.floor(Math.random()*a.length)];
OS.pad = n=>String(n).padStart(2,'0');
OS.fmtDur = s=>{ s=Math.round(s); if(s<60) return s+'s'; const m=Math.floor(s/60); if(m<60) return m+'m'; return Math.floor(m/60)+'h '+(m%60)+'m'; };

/* ---------- catalog ----------
   Built-in games are NOT auto-discovered: add a row here (id, name, emoji, color, tag, path, default folder). */
const G = (id,name,emoji,color,tag,path,folder)=>({id,name,emoji,color,tag,path,folder,kind:'game'});
OS.BUILTIN = [
  G('aros','AR.OS Arena','🎯','#34C759','Shooter','games/aros.html','shooters'),
  G('vanguard','Neon Vanguard','🛡️','#00b8d9','Shooter','games/vanguard.html','shooters'),
  G('neonswarm','Neon Swarm','🐝','#00bfa5','Shooter','games/neonswarm.html','shooters'),
  G('timeshooter','Time Shooter 3','🔫','#00a0e0','Shooter','games/exports/timeshooter.html','shooters'),
  G('2048','Apple Glass 2048','🔢','#007AFF','Puzzle','games/2048.html','puzzle'),
  G('vitric','Vitric Flow','💎','#00a8e8','Puzzle','games/vitric.html','puzzle'),
  G('nebula','Nebula Drift','🌌','#7c5cff','Tactical','games/nebula.html','puzzle'),
  G('crazy-cars','Crazy Cars','🏎️','#ff9f0a','Racing','games/exports/crazy-cars.html','racing'),
  G('escaperoad','Escape Road','🚗','#ff3b30','Racing','games/exports/escaperoad.html','racing'),
  G('khalil',"Khalil's Neon Dodger",'🌀','#00c2d6','Dodge','games/khalil.html','action'),
  G('glass','Glass OS 26','🪟','#2bb7d6','Platformer','games/glass.html','action'),
  G('tank','Hilltop Tank Commander','🪖','#ff5252','Action','games/tank.html','action'),
  G('hollow-knight','Hollow Knight','🗡️','#9b30ff','Metroidvania','games/exports/hollow-knight.html','action'),
  G('escape','Escape The Nest','🥚','#b00020','Horror','games/escape.html','action'),
  G('minecraft','Minecraft','⛏️','#5cb85c','Sandbox','games/exports/minecraft.html','sandbox'),
  G('solar-smash','Solar Smash','💥','#ff5e00','Simulation','games/exports/solar-smash.html','sandbox'),
  G('satelliteearth','Satellite Earth Explorer','🛰️','#00c9a7','Explorer','games/satelliteearth.html','sandbox'),
  G('banana','Ultra-Cluck Banana Tycoon','🍌','#e5b800','Chaos','games/banana.html','sandbox'),
  G('marco',"Marco's Stealth Arcade",'🕹️','#3b82f6','20 games','games/marco.html','arcade'),
  ...[1,2,3,4,5].map(n=>G('mystery'+n,'Mystery '+n,'❓','#6b7280','Sealed','games/mystery'+n+'.html','vault'))
];
const SYSAPP = (id,name,emoji,color,tag)=>({id,name,emoji,color,tag,kind:'sys',folder:'tools'});
OS.SYSTEM = [
  SYSAPP('sys:finder','Finder','🗂️','#3a8dff','All apps'),
  SYSAPP('sys:browser','Browser','🌐','#0a84ff','Web'),
  SYSAPP('sys:search','Search','🔎','#ff9f0a','Google & more'),
  SYSAPP('sys:ai','AR.OS AI','✨','#8e5cf7','Assistant'),
  SYSAPP('sys:settings','Settings','⚙️','#8e8e93','System')
];
OS.FOLDER_DEFS = [
  {id:'shooters',name:'Shooters',emoji:'🎯',color:'#34C759'},
  {id:'puzzle',name:'Puzzle & Strategy',emoji:'🧩',color:'#5e5ce6'},
  {id:'racing',name:'Racing',emoji:'🏁',color:'#ff9f0a'},
  {id:'action',name:'Action & Adventure',emoji:'⚔️',color:'#ff453a'},
  {id:'sandbox',name:'Sandbox & Sim',emoji:'🌍',color:'#30b0c7'},
  {id:'arcade',name:'Arcade',emoji:'🕹️',color:'#0a84ff'},
  {id:'vault',name:'Mystery Vault',emoji:'🔒',color:'#8e8e93'},
  {id:'tools',name:'Utilities',emoji:'🧰',color:'#64748b'}
];
OS.FOLDER_SIZES = { S:[1,1], M:[2,2], L:[3,2], XL:[3,3], XXL:[4,4], Wide:[5,2], Tall:[2,4] };

/* ---------- state (localStorage = "saved on this computer/browser") ---------- */
const KEY='arcadeos.v1', WKEY='arcadeos.wall';
const lowEnd = (navigator.hardwareConcurrency||8)<=4 || (navigator.deviceMemory||8)<=4;
OS.lowEnd = lowEnd;
const DEFAULTS = ()=>({
  v:1,
  settings:{ theme:'dark', accent:'#0a84ff', wall:{type:'preset',id:'blobs'}, radius:14, blur:18, glass:.55, font:'system',
    perf:'auto', unit:84, snap:true, dockSize:52, dockMag:true, dockPos:'bottom', dockHide:false, labels:true, iconSize:64,
    clock24:false, clockSec:false, clockDate:true, favicons:false, widgetsOn:true, aiOnline:true, engine:'google', cursor:'auto' },
  folders:{}, folderOrder:[], customApps:{}, over:{},
  dock:['sys:finder','sys:browser','sys:search','sys:ai','sys:settings','|','aros','minecraft','crazy-cars'],
  widgets:null, fav:[], recent:[], play:{}, notes:'', todos:[], ai:{history:[],mem:{},mascot:{}}, timers:[]
});
function merge(base, over){
  if(!over || typeof over!=='object') return base;
  for(const k of Object.keys(over)){
    if(k==='__proto__'||k==='constructor'||k==='prototype') continue;   // imported backups are untrusted
    if(over[k] && typeof over[k]==='object' && !Array.isArray(over[k]) && base[k] && typeof base[k]==='object' && !Array.isArray(base[k])) merge(base[k], over[k]);
    else base[k] = over[k];
  }
  return base;
}
let saved=null; try{ saved = JSON.parse(localStorage.getItem(KEY)||'null'); }catch{}
const S = OS.S = merge(DEFAULTS(), saved);
let saveT=0;
OS.save = function(){ clearTimeout(saveT); saveT=setTimeout(OS.flush,250); };
OS.flush = function(){
  clearTimeout(saveT); if(OS.noFlush) return;   // set right before an import/erase reload so the old state isn't written back
  try{ localStorage.setItem(KEY, JSON.stringify(S)); }
  catch(e){ OS.toast && OS.toast('Could not save — browser storage is full or blocked.'); }
};
addEventListener('beforeunload', OS.flush);
document.addEventListener('visibilitychange', ()=>{ if(document.hidden) OS.flush(); });
OS.KEY=KEY; OS.merge=merge; OS.DEFAULTS=DEFAULTS;
OS.getWallImage = ()=>{ try{ return localStorage.getItem(WKEY)||''; }catch{ return ''; } };
OS.setWallImage = d=>{ try{ localStorage.setItem(WKEY,d); return true; }catch{ return false; } };

/* ---------- apps & folders ---------- */
OS.appBase = id => OS.BUILTIN.find(a=>a.id===id) || OS.SYSTEM.find(a=>a.id===id) || S.customApps[id] || null;
OS.app = function(id){
  const b = OS.appBase(id); if(!b) return null;
  const o = S.over[id]; return o ? Object.assign({}, b, o) : b;
};
OS.allApps = ()=>[...OS.BUILTIN, ...OS.SYSTEM, ...Object.values(S.customApps)].map(a=>OS.app(a.id)).filter(a=>!a.hidden);
OS.folder = id => S.folders[id];
OS.folders = ()=>S.folderOrder.map(id=>S.folders[id]).filter(Boolean);
OS.folderOf = appId => OS.folders().find(f=>f.items.includes(appId));

// Make sure every known app lives in exactly one folder and folders have sane fields (also adopts newly added built-ins).
OS.reconcile = function(){
  for(const d of OS.FOLDER_DEFS) if(!S.folders[d.id] && !S.deletedFolders?.includes(d.id)){
    S.folders[d.id] = { id:d.id, name:d.name, emoji:d.emoji, color:d.color, items:[], w:1, h:1, gx:0, gy:0, desktop:true, view:'grid', icon:S.settings.iconSize, win:null, placed:false };
    S.folderOrder.push(d.id);
  }
  const seen = new Set();
  for(const f of OS.folders()){
    f.items = f.items.filter(id=>OS.appBase(id) && !seen.has(id) && (seen.add(id),true));
  }
  for(const a of [...OS.BUILTIN,...OS.SYSTEM,...Object.values(S.customApps)]){
    if(seen.has(a.id)) continue;
    const f = S.folders[a.folder] || S.folders.tools || OS.folders()[0] || OS.makeFolder('Other',{noSave:true});
    f.items.push(a.id);
  }
  S.dock = S.dock.filter(id=>id==='|' || OS.appBase(id) || (id.startsWith('folder:') && S.folders[id.slice(7)]));
  S.fav = S.fav.filter(id=>OS.appBase(id)); S.recent = S.recent.filter(id=>OS.appBase(id));
};
OS.makeFolder = function(name, o={}){
  const id = OS.uid('f_');
  const f = S.folders[id] = { id, name:name||'New Folder', emoji:o.emoji||'📁', color:o.color||'#4aa3ff', items:[], w:1, h:1, gx:0, gy:0, desktop:true, view:'grid', icon:S.settings.iconSize, win:null, placed:false };
  S.folderOrder.push(id);
  if(!o.noSave){ OS.save(); OS.wm && OS.wm.renderDesktop(); OS.wm.renderDock(); }
  return f;
};
OS.deleteFolder = function(id){
  const f=S.folders[id]; if(!f) return;
  const dest = S.folders.tools || OS.folders().find(x=>x.id!==id);
  if(dest) dest.items.push(...f.items);
  delete S.folders[id]; S.folderOrder = S.folderOrder.filter(x=>x!==id);
  (S.deletedFolders = S.deletedFolders||[]).push(id);
  S.dock = S.dock.filter(x=>x!=='folder:'+id);
  OS.save(); OS.refreshAll();
};
OS.moveApp = function(appId, folderId){
  const to = S.folders[folderId]; if(!to) return;
  for(const f of OS.folders()) f.items = f.items.filter(x=>x!==appId);
  to.items.push(appId); OS.save(); OS.refreshAll();
};
OS.refreshAll = function(){ OS.wm.renderDesktop(); OS.wm.renderDock(); OS.wins.forEach(w=>w.refresh&&w.refresh()); };

/* ---------- links -> apps ---------- */
// Accepts https URLs, bare domains (example.com), and local pages under games/ (so new game files can be added by path).
OS.normUrl = function(s){
  s = String(s||'').trim(); if(!s || /\s/.test(s)) return null;
  if(/^games\/[\w\/.-]+\.html?$/i.test(s)) return {url:s, local:true};
  if(/^[a-z][a-z0-9+.-]*:/i.test(s)){
    if(!/^https?:\/\//i.test(s)) return null;                 // blocks javascript:, data:, file: etc.
    try{ return {url:new URL(s).href}; }catch{ return null; }
  }
  if(/^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?([\/?#]|$)/i.test(s)) try{ return {url:new URL('https://'+s).href}; }catch{}
  return null;
};
const PALETTE=['#0a84ff','#34c759','#ff9f0a','#ff453a','#bf5af2','#30b0c7','#ff375f','#5e5ce6','#64d2ff','#ac8e68'];
OS.addLinkApp = function(input, o={}){
  const n = OS.normUrl(input); if(!n) return null;
  const existing = Object.values(S.customApps).find(a=>a.url===n.url);
  if(existing && !o.name) return OS.app(existing.id);
  let host = n.url; try{ host = n.local ? n.url.split('/').pop().replace(/\.html?$/,'') : new URL(n.url).hostname.replace(/^www\./,''); }catch{}
  const name = (o.name||'').trim() || host.replace(/^\w/,c=>c.toUpperCase());
  let hash=0; for(const c of host) hash=(hash*31+c.charCodeAt(0))|0;
  const id = OS.uid('u_');
  S.customApps[id] = { id, name, url:n.url, local:!!n.local, emoji:o.emoji||name[0].toUpperCase(), color:o.color||PALETTE[Math.abs(hash)%PALETTE.length], tag:n.local?'Local page':host, kind:'link', folder:o.folder||'tools' };
  let f = S.folders[o.folder]; if(!f) f = S.folders.tools || OS.folders()[0];
  f.items.push(id);
  OS.save(); OS.refreshAll();
  return OS.app(id);
};
OS.removeApp = function(id){
  if(S.customApps[id]){
    OS.closeAppWindows(id);
    delete S.customApps[id]; delete S.over[id];
    for(const f of OS.folders()) f.items = f.items.filter(x=>x!==id);
    S.dock = S.dock.filter(x=>x!==id); S.fav = S.fav.filter(x=>x!==id); S.recent=S.recent.filter(x=>x!==id);
  } else { (S.over[id] = S.over[id]||{}).hidden = true; }   // built-ins are only hidden (restorable in Settings)
  OS.save(); OS.refreshAll();
};
OS.toggleFav = function(id){ const i=S.fav.indexOf(id); if(i<0) S.fav.push(id); else S.fav.splice(i,1); OS.save(); OS.wm.refreshWidgets('favorites'); return i<0; };
OS.togglePin = function(id){ const i=S.dock.indexOf(id); if(i<0) S.dock.push(id); else S.dock.splice(i,1); OS.save(); OS.wm.renderDock(); return i<0; };

/* fuzzy app lookup shared by Spotlight and the AI */
const norm = s=>String(s).toLowerCase().replace(/['’]s\b/g,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
function lev(a,b){ if(a===b) return 0; const m=a.length,n=b.length; if(!m||!n) return Math.max(m,n); let p=Array.from({length:n+1},(_,i)=>i); for(let i=1;i<=m;i++){ let c=[i]; for(let j=1;j<=n;j++) c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1)); p=c; } return p[n]; }
OS.norm = norm;
OS.scoreApp = function(a, q){
  q = norm(q); if(!q) return 0;
  const n = norm(a.name), id = norm(a.id.replace(/[-_:]/g,' ')), tag = norm(a.tag||'');
  if(n===q||id===q) return 100;
  if(n.startsWith(q)) return 90;
  if(n.split(' ').some(w=>w.startsWith(q))) return 80;
  if(n.includes(q)||id.includes(q)) return 70;
  const qt = q.split(' '), nt = n.split(' ');
  let hit=0; for(const t of qt){ if(nt.some(w=>w===t||(t.length>3&&lev(w,t)<=1+(t.length>6?1:0)))) hit++; else if(tag.includes(t)&&t.length>3) hit+=.4; }
  return hit? 40+30*hit/qt.length : 0;
};
OS.findApps = (q,limit=8)=>OS.allApps().map(a=>({a,s:OS.scoreApp(a,q)})).filter(x=>x.s>=45).sort((x,y)=>y.s-x.s).slice(0,limit).map(x=>x.a);
OS.findFolders = q=>{ q=norm(q); return OS.folders().filter(f=>{ const n=norm(f.name); return n===q||n.includes(q)||q.includes(n)&&n.length>3; }); };

/* ---------- boot ---------- */
OS.boot = function(){
  OS.reconcile();
  OS.wm.init();
  OS.wm.renderAll();
  OS.restoreTimers && OS.restoreTimers();
  if(!saved) setTimeout(()=>OS.toast('Welcome to ArcadeOS 👋  Click a folder to open it · right-click the desktop to customize · Ctrl+K to search'),600);
};
})();
