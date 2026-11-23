/* ArcadeOS UI primitives: context menu, form dialog, toasts, beep, Spotlight. */
(function(){
'use strict';
const {h,$,S}=Object.assign({}, OS, {S:OS.S});

/* ---------- toast / sound ---------- */
OS.toast = function(msg, ms=3200){
  const t=h('div',{class:'toast glass'},msg); $('#toasts').append(t);
  setTimeout(()=>{ t.style.transition='opacity .3s'; t.style.opacity=0; setTimeout(()=>t.remove(),300); }, ms);
};
let actx;
OS.beep = function(n=3){
  try{ actx = actx || new (window.AudioContext||window.webkitAudioContext)();
    for(let i=0;i<n;i++){ const o=actx.createOscillator(),g=actx.createGain(); o.frequency.value=880; o.connect(g); g.connect(actx.destination);
      const t=actx.currentTime+i*.28; g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.25,t+.02); g.gain.exponentialRampToValueAtTime(.0001,t+.2); o.start(t); o.stop(t+.22); }
  }catch{}
};

/* ---------- context menu ---------- */
let menuEl=null;
OS.closeMenu = function(){ if(menuEl){ menuEl.remove(); menuEl=null; } document.querySelectorAll('#menubar .mi.on').forEach(e=>e.classList.remove('on')); };
OS.menu = function(x,y,items){
  OS.closeMenu();
  const m = menuEl = h('div',{class:'menu glass'});
  for(const it of items){
    if(!it) continue;
    if(it.sep){ m.append(h('div',{class:'sep'})); continue; }
    if(it.hd){ m.append(h('div',{class:'hd'},it.hd)); continue; }
    if(it.custom){ m.append(it.custom); continue; }
    m.append(h('div',{class:'it'+(it.dis?' dis':''), onclick:e=>{ e.stopPropagation(); if(it.dis) return; OS.closeMenu(); it.run&&it.run(); }}, it.label, it.k?h('span',{class:'k'},it.k):null));
  }
  document.body.append(m);
  const r=m.getBoundingClientRect();
  m.style.left=Math.max(4,Math.min(x,innerWidth-r.width-6))+'px';
  m.style.top=Math.max(4,Math.min(y,innerHeight-r.height-6))+'px';
  return m;
};
addEventListener('pointerdown', e=>{ if(menuEl && !menuEl.contains(e.target)) OS.closeMenu(); }, true);
addEventListener('blur', ()=>OS.closeMenu());
addEventListener('keydown', e=>{ if(e.key==='Escape'){ OS.closeMenu(); if(OS.spot.isOpen()) OS.spot.close(); else if($('#veil').classList.contains('on')) OS.closeDialog(); } });

/* ---------- form dialog ---------- */
OS.closeDialog = function(){ const v=$('#veil'); v.classList.remove('on'); v.replaceChildren(); };
OS.dialog = function(o){
  const v=$('#veil'); v.replaceChildren();
  const vals={}, inputs={};
  const form=h('div',{class:'dlg glass'}, h('h3',null,o.title||''), o.sub?h('div',{class:'sub'},o.sub):null);
  for(const f of (o.fields||[])){
    let inp, wrap;
    if(f.type==='select') inp=h('select',null,f.choices.map(([val,lab])=>h('option',{value:val,selected:String(val)===String(f.value)},lab)));
    else if(f.type==='textarea') inp=h('textarea',{rows:f.rows||4,value:f.value||'',placeholder:f.placeholder||''});
    else if(f.type==='check'){ inp=h('input',{type:'checkbox',checked:!!f.value}); }
    else if(f.type==='range') inp=h('input',{type:'range',min:f.min,max:f.max,step:f.step||1,value:f.value});
    else if(f.type==='color') inp=h('input',{type:'color',value:f.value||'#0a84ff'});
    else inp=h('input',{type:f.type||'text',value:f.value??'',placeholder:f.placeholder||'',autocomplete:'off',spellcheck:false});
    wrap=h('label',{class:'fld'+(f.type==='check'?' row':'')}, f.label, inp);
    if(f.type==='range'&&f.onInput) inp.addEventListener('input',()=>f.onInput(+inp.value));
    inputs[f.key]=inp; form.append(wrap);
  }
  const read=()=>{ for(const f of (o.fields||[])){ const i=inputs[f.key]; vals[f.key]=f.type==='check'?i.checked:f.type==='range'?+i.value:i.value; } return vals; };
  const done=()=>{ if(o.onOk && o.onOk(read())===false) return; OS.closeDialog(); };
  const btns=h('div',{class:'btns'});
  for(const b of (o.buttons||[])) btns.append(h('button',{class:b.cls||'',onclick:()=>{ if(b.run(read())!==false) OS.closeDialog(); }},b.label));
  btns.append(h('button',{onclick:()=>{ o.onCancel&&o.onCancel(); OS.closeDialog(); }},o.cancel||'Cancel'), h('button',{class:o.danger?'dng':'pri',onclick:done},o.ok||'OK'));
  form.append(btns);
  form.addEventListener('keydown',e=>{ if(e.key==='Enter' && e.target.tagName!=='TEXTAREA') done(); e.stopPropagation(); });
  v.append(form); v.classList.add('on');
  const first=Object.values(inputs)[0]; if(first) setTimeout(()=>{ first.focus(); first.select&&first.select(); },30);
};
OS.confirm = (title,sub,onOk,ok='Delete')=>OS.dialog({title,sub,ok,danger:true,onOk:()=>{onOk();}});

/* ---------- Spotlight ---------- */
const spotEl=$('#spot'), inp=$('#spot-in'), res=$('#spot-res');
let rows=[], sel=0;
function commands(){
  const set=(k,v)=>()=>OS.set(k,v);
  return [
    {label:'Dark mode',emoji:'🌙',run:set('theme','dark')},{label:'Light mode',emoji:'☀️',run:set('theme','light')},
    {label:'Reduce effects (performance mode)',emoji:'🚀',run:set('perf','on')},{label:'Full effects',emoji:'💫',run:set('perf','off')},
    {label:'New folder',emoji:'📁',run:()=>OS.wm.newFolderDialog()},{label:'Add app from link',emoji:'🔗',run:()=>OS.wm.addLinkDialog()},
    {label:'Add widget',emoji:'🧩',run:()=>OS.wm.addWidgetMenu()},{label:'Change wallpaper',emoji:'🖼️',run:()=>OS.launch('sys:settings',{page:'appearance'})},
    {label:'Toggle custom cursor',emoji:'🫧',run:()=>OS.set('cursor',window.OSCursor&&OSCursor.running()?'off':'on')},{label:'Add custom text widget',emoji:'🗒️',run:()=>OS.widgets.add('custom')},
    {label:'Reset desktop layout',emoji:'♻️',run:()=>OS.wm.resetLayout()},{label:'Toggle fullscreen site',emoji:'⛶',run:()=>OS.wm.toggleSiteFullscreen()}
  ];
}
function build(q){
  q=q.trim(); rows=[];
  const appRow=a=>({emoji:a.emoji,color:a.color,img:OS.iconImg&&OS.iconImg(a),label:a.name,sub:a.tag||'',run:()=>OS.launch(a.id)});
  if(!q){
    OS.S.recent.slice(0,5).map(OS.app).filter(Boolean).forEach(a=>rows.push(Object.assign(appRow(a),{sub:'Recent'})));
    OS.folders().slice(0,6).forEach(f=>rows.push({emoji:f.emoji,color:f.color,label:f.name,sub:'Folder',run:()=>OS.wm.openFolder(f.id)}));
  } else {
    const link=OS.normUrl(q);
    if(link){
      rows.push({emoji:'🌐',color:'#0a84ff',label:'Open '+q,sub:'In a window',run:()=>OS.openUrl(link.url,{title:q})});
      rows.push({emoji:'➕',color:'#34c759',label:'Save '+q+' as an app',sub:'Adds it to Utilities',run:()=>OS.wm.addLinkDialog(q)});
    }
    OS.findApps(q,6).forEach(a=>rows.push(appRow(a)));
    OS.findFolders(q).forEach(f=>rows.push({emoji:f.emoji,color:f.color,label:f.name,sub:'Folder',run:()=>OS.wm.openFolder(f.id)}));
    const ql=q.toLowerCase();
    commands().filter(c=>c.label.toLowerCase().includes(ql)).slice(0,3).forEach(c=>rows.push(Object.assign({color:'#64748b',sub:'Command'},c)));
    if(!link){
      rows.push({emoji:'🔎',color:'#ff9f0a',label:'Search the web for “'+q+'”',sub:'Google in a window',run:()=>OS.launch('sys:search',{q})});
      rows.push({emoji:'✨',color:'#8e5cf7',label:'Ask AR.OS AI: “'+q+'”',sub:'Assistant',run:()=>OS.launch('sys:ai',{ask:q})});
    }
  }
  sel=0; paint();
}
function paint(){
  res.replaceChildren(...rows.map((r,i)=>h('div',{class:'r'+(i===sel?' sel':''),onclick:()=>choose(i),onmousemove:()=>{ if(sel!==i){ sel=i; res.querySelectorAll('.r').forEach((e,j)=>e.classList.toggle('sel',j===i)); } }},
    h('div',{class:'ai'},h('div',{class:'ico',style:{'--c':r.color||'#555'}},r.emoji)), h('span',null,r.label), r.sub?h('small',null,r.sub):null)));
}
function choose(i){ const r=rows[i]; if(!r) return; OS.spot.close(); setTimeout(r.run,0); }
OS.spot = {
  isOpen:()=>spotEl.classList.contains('on'),
  open(q=''){ spotEl.classList.add('on'); inp.value=q; build(q); setTimeout(()=>inp.focus(),20); },
  close(){ spotEl.classList.remove('on'); inp.blur(); }
};
inp.addEventListener('input',()=>build(inp.value));
inp.addEventListener('keydown',e=>{
  e.stopPropagation();
  if(e.key==='ArrowDown'){ sel=(sel+1)%Math.max(1,rows.length); paint(); e.preventDefault(); }
  else if(e.key==='ArrowUp'){ sel=(sel-1+rows.length)%Math.max(1,rows.length); paint(); e.preventDefault(); }
  else if(e.key==='Enter'){ choose(sel); }
  else if(e.key==='Escape'){ OS.spot.close(); }
});
spotEl.addEventListener('pointerdown',e=>{ if(e.target===spotEl) OS.spot.close(); });
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&k==='k'){ e.preventDefault(); OS.spot.isOpen()?OS.spot.close():OS.spot.open(); }
  else if((e.ctrlKey||e.metaKey)&&k==='/'){ e.preventDefault(); OS.launch('sys:ai'); }
});
})();
