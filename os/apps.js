/* ArcadeOS system apps: Finder (folders), Browser, Search, Settings. (AI lives in ai.js) */
(function(){
'use strict';
const {h,$,S,clamp}=OS;
const A=OS.apps={ builders:{}, keys:{ finder:o=>'finder:'+(o.loc||'all'), browser:()=>null } };

A.open=function(a,o={}){
  const name=a.id.slice(4), b=A.builders[name]; if(!b) return;
  const key=A.keys[name]?A.keys[name](o):a.id;
  if(key && OS.wins.has(key)){ const ex=OS.wins.get(key); OS.wm.restore(ex); OS.wm.focusWin(ex); ex.api&&ex.api.again&&ex.api.again(o); return ex; }
  const spec=b(a,o); if(!spec) return;
  const W=OS.openWindow(Object.assign({appId:a.id,key,ui:true},spec));
  W.api=spec.api||null; W.refresh=spec.refresh; W.onSettings=spec.onSettings; spec.after&&spec.after(W);
  return W;
};

/* ===================== FINDER ===================== */
A.builders.finder=function(a,o){
  let loc=o.loc||'all', q='', Wn=null;
  const side=h('div',{class:'side'}), grid=h('div',{class:'fgrid'}), bar=h('div',{class:'fbar'}), main=h('div',{class:'main'},bar,grid);
  const fo=()=>OS.folder(loc);
  const title=()=>loc==='all'?'All Apps':loc==='fav'?'Favorites':loc==='recent'?'Recent':(fo()?fo().name:'Folder');
  const apps=()=>{
    let ids=loc==='all'?OS.allApps().map(x=>x.id):loc==='fav'?S.fav:loc==='recent'?S.recent:(fo()?fo().items:[]);
    let L=ids.map(OS.app).filter(x=>x&&!x.hidden);
    if(loc==='all') L.sort((x,y)=>x.name.localeCompare(y.name));
    if(q) L=L.filter(x=>x.name.toLowerCase().includes(q.toLowerCase())||OS.scoreApp(x,q)>=60);
    return L;
  };
  const navTo=l=>{ loc=l; q=''; draw(); };
  const drawSide=()=>{
    const si=(l,emoji,label,extra={})=>{ const e=h('div',{class:'si'+(loc===l?' on':'')},emoji+' ',h('span',{style:{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},label)); e.addEventListener('click',()=>navTo(l));
      if(extra.folder){ const f=extra.folder; e.addEventListener('contextmenu',ev=>{ ev.preventDefault(); OS.wm.folderMenu(ev.clientX,ev.clientY,f); });
        e.addEventListener('dragover',ev=>{ if(ev.dataTransfer.types.includes('text/x-app')){ ev.preventDefault(); e.classList.add('dropok'); } }); e.addEventListener('dragleave',()=>e.classList.remove('dropok'));
        e.addEventListener('drop',ev=>{ ev.preventDefault(); e.classList.remove('dropok'); const id=ev.dataTransfer.getData('text/x-app'); if(id){ OS.moveApp(id,f.id); OS.toast('Moved to '+f.name); } }); }
      return e; };
    side.replaceChildren(h('div',{class:'sh'},'Library'),si('all','🗂️','All Apps'),si('fav','⭐','Favorites'),si('recent','🕒','Recent'),h('div',{class:'sh'},'Folders'),
      ...OS.folders().map(f=>si(f.id,f.emoji,f.name,{folder:f})),
      h('div',{class:'si',onclick:()=>OS.wm.newFolderDialog()},'➕ ',h('span',null,'New Folder')));
  };
  const draw=()=>{
    drawSide(); const f=fo(), sz=f?f.icon||64:S.settings.iconSize, list=f&&f.view==='list';
    if(Wn){ Wn.titleEl.textContent=Wn.title=title(); }
    grid.className='fgrid'+(list?' list':''); grid.style.setProperty('--sz',sz+'px');
    const L=apps();
    grid.replaceChildren(...(L.length?L.map(x=>OS.appTile(x,{sz})):[h('div',{class:'empty',style:{gridColumn:'1/-1',padding:'40px'}},q?'No matches.':loc==='fav'?'No favorites yet — right-click an app → Add to Favorites.':loc==='recent'?'Nothing opened yet.':'This folder is empty. Drag apps here, or right-click an app → Move to Folder…')]));
    const search=h('input',{placeholder:'Filter…',value:q,style:{width:'130px',background:'rgba(127,127,127,.18)',border:'1px solid var(--line)',borderRadius:'8px',padding:'4px 8px',outline:'none'}});
    search.addEventListener('input',()=>{ q=search.value; const p=search.selectionStart; draw(); const n=bar.querySelector('input'); n.focus(); n.setSelectionRange(p,p); });
    search.addEventListener('keydown',e=>e.stopPropagation());
    const slider=h('input',{type:'range',min:40,max:160,value:sz,title:'Icon size',oninput:e=>{ const v=+e.target.value; if(f) f.icon=v; else OS.set('iconSize',v); grid.style.setProperty('--sz',v+'px'); OS.save(); }});
    bar.replaceChildren(h('b',{style:{fontSize:'14px'}},(f?f.emoji+' ':'')+title()),h('span',{style:{opacity:.5}},L.length+' items'),h('div',{class:'sp'}),search,
      ...(f?[h('button',{title:'Toggle list / grid',onclick:()=>{ f.view=list?'grid':'list'; OS.save(); draw(); }},list?'⊞ Grid':'☰ List'),h('button',{title:'Customize this folder',onclick:()=>OS.wm.folderDialog(f)},'⚙ Customize')]:[]),
      h('span',{style:{opacity:.6}},'Size'),slider,h('button',{onclick:()=>OS.wm.addLinkDialog()},'🔗 Add link'));
  };
  draw();
  grid.addEventListener('contextmenu',e=>{ e.preventDefault(); OS.menu(e.clientX,e.clientY,[{label:'New Folder…',run:OS.wm.newFolderDialog},{label:'Add App from Link…',run:()=>OS.wm.addLinkDialog()},...(fo()?[{sep:1},{label:'Customize Folder…',run:()=>OS.wm.folderDialog(fo())},{label:'Show on Desktop',run:()=>{ fo().desktop=true; OS.save(); OS.wm.renderDesktop(); }}]:[])]); });
  return { title:title(), body:h('div',{class:'split'},side,main), w:820, h:520, minW:420, minH:300, sizeKey:'finder:'+loc, refresh:()=>{ if(loc!=='all'&&loc!=='fav'&&loc!=='recent'&&!fo()) loc='all'; draw(); },
    api:{ again:o2=>{ if(o2.loc) navTo(o2.loc); } }, after:W=>{ Wn=W; } };
};

/* ===================== BROWSER ===================== */
A.builders.browser=function(a,o){
  if(o.url){ OS.openUrl(o.url); return null; }
  const fw=OS.wm.frameWindow({name:'Browser'},'about:blank',true);
  fw.urlIn.value=''; fw.urlIn.placeholder='Type a link or search, then press Enter';
  const f=fw.kids.pop(), go=()=>start.remove();
  const quick=[['Wikipedia','https://en.wikipedia.org','📚'],['Google','https://www.google.com/search?igu=1','🔎'],['Internet Archive','https://archive.org','🏛️']];
  const start=h('div',{style:{position:'absolute',inset:0,background:'rgb(var(--g-rgb))',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'14px',padding:'20px',textAlign:'center'}},
    h('div',{style:{fontSize:'44px'}},'🌐'),h('div',{style:{fontSize:'18px',fontWeight:700}},'Browser'),
    h('div',{style:{color:'var(--fg2)',maxWidth:'420px',fontSize:'13px'}},'Type a link above to view it inside ArcadeOS. Sites that block framing will show blank — use ↗ to open them in a real tab, or ＋ in a window to save a link as an app.'),
    h('div',{style:{display:'flex',gap:'8px',flexWrap:'wrap',justifyContent:'center'}},quick.map(([n,u,e])=>h('button',{class:'sbtn',onclick:()=>{ f.src=u; fw.urlIn.value=u; go(); }},e+' '+n))));
  fw.urlIn.addEventListener('keydown',e=>{ if(e.key==='Enter'&&fw.urlIn.value.trim()) go(); });
  f.style.flex='1';
  return { title:'Browser', body:[...fw.kids,h('div',{style:{flex:1,position:'relative',display:'flex',minHeight:0}},f,start)], w:1000, h:660, sizeKey:'browser', tools:[{label:'⛶',title:'Full screen',run:w=>OS.wm.fullscreen(w)}], ui:false, key:undefined };
};

/* ===================== SEARCH ===================== */
A.builders.search=function(a,o){
  let eng=o.engine||S.settings.engine||'google', q=o.q||'';
  const inp=h('input',{placeholder:'Search…',value:q,style:{flex:1,background:'rgba(127,127,127,.16)',border:'1px solid var(--line)',borderRadius:'999px',padding:'8px 16px',outline:'none'}});
  const segEl=h('div',{class:'seg'}), results=h('div',{style:{flex:1,minHeight:0,display:'flex',flexDirection:'column',overflow:'auto'}});
  const E=OS.ENGINES;
  const drawSeg=()=>segEl.replaceChildren(...Object.entries(E).map(([k,v])=>h('button',{class:eng===k?'on':'',onclick:()=>{ eng=k; S.settings.engine=k; OS.save(); drawSeg(); run(); }},k==='wiki'?'Instant':v[0])));
  const hint=h('div',{class:'wnote'});
  const run=()=>{
    q=inp.value.trim(); hint.replaceChildren(); hint.style.display='none';
    if(!q){ results.replaceChildren(h('div',{class:'empty',style:{margin:'auto'}},h('div',{style:{fontSize:'44px'}},'🔎'),'Search the web right here. “Instant” gives built-in Wikipedia results that always work; Google / Bing / DuckDuckGo load in a frame.')); return; }
    if(eng==='wiki'){
      results.replaceChildren(h('div',{class:'empty'},'Searching Wikipedia…'));
      fetch('https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=10&srsearch='+encodeURIComponent(q)).then(r=>r.json()).then(j=>{
        const L=(j.query&&j.query.search)||[]; if(!L.length) return results.replaceChildren(h('div',{class:'empty'},'No results. Try another search.'));
        results.replaceChildren(...L.map(x=>{ const p=h('p'); p.textContent=new DOMParser().parseFromString(x.snippet,'text/html').body.textContent; return h('div',{class:'sres',onclick:()=>OS.openUrl('https://en.wikipedia.org/wiki/'+encodeURIComponent(x.title.replace(/ /g,'_')),{title:x.title})},h('b',null,x.title),p); }));
      }).catch(()=>results.replaceChildren(h('div',{class:'empty'},'Can’t reach Wikipedia (offline?).')));
      return;
    }
    const url=E[eng][1]+encodeURIComponent(q);
    const f=h('iframe',{style:{flex:1,border:0,width:'100%',background:'#fff',minHeight:0},referrerpolicy:'no-referrer',allow:'fullscreen *'});
    f.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-modals');
    f.src=url; results.replaceChildren(f);
    hint.style.display='flex'; hint.append(E[eng][0]+' may refuse to load inside a frame (blank page / “refused to connect”).',h('a',{onclick:()=>window.open(url,'_blank','noopener')},'Open in a new tab ↗'),h('a',{onclick:()=>{ eng='wiki'; drawSeg(); run(); }},'Use Instant results'));
  };
  inp.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter') run(); });
  drawSeg(); setTimeout(run,0);
  return { title:'Search', body:[h('div',{class:'wurl'},inp,segEl),hint,results], w:900, h:640, ui:false, api:{ again:o2=>{ if(o2.engine){ eng=o2.engine; drawSeg(); } if(o2.q!=null){ inp.value=o2.q; run(); } } } };
};

/* ===================== SETTINGS ===================== */
const PAGES=[['appearance','🎨','Appearance'],['desktop','🖥️','Desktop & Dock'],['clock','🕐','Clock'],['widgets','🧩','Widgets'],['folders','📁','Folders'],['apps','📱','Apps'],['ai','✨','AI'],['data','💾','Data & Sync'],['about','ℹ️','About']];
const ACCENTS=['#0a84ff','#34c759','#ff9f0a','#ff453a','#bf5af2','#30b0c7','#ff375f','#5e5ce6','#ffd60a','#ac8e68'];
const R=(label,ctrl,sub)=>h('label',{class:'fld row'},h('span',null,label,sub?h('div',{style:{fontSize:'11px',opacity:.7,marginTop:'2px'}},sub):null),ctrl);
const chk=(key)=>h('input',{type:'checkbox',checked:!!S.settings[key],onchange:e=>OS.set(key,e.target.checked)});
const rng=(key,min,max,step=1,w='180px')=>h('input',{type:'range',min,max,step,value:S.settings[key],style:{width:w},oninput:e=>OS.set(key,+e.target.value)});
const seg=(choices,cur,pick)=>h('div',{class:'seg'},choices.map(([v,l])=>h('button',{class:String(cur)===String(v)?'on':'',onclick:()=>pick(v)},l)));
const card=(...k)=>h('div',{class:'card'},k);

A.builders.settings=function(a,o){
  let page=o.page||'appearance', Wn=null;
  const side=h('div',{class:'side'}), pane=h('div',{class:'spage'}), redraw=()=>draw();
  const pages={
    appearance(){
      const wp=S.settings.wall||{}, fileIn=h('input',{type:'file',accept:'image/*',style:{display:'none'},onchange:e=>{ const f=e.target.files[0]; if(f) OS.wallFromFile(f,()=>redraw()); }});
      const urlIn=h('input',{placeholder:'https://…/image.jpg',value:wp.type==='url'?wp.value:'',style:{flex:1,background:'rgba(127,127,127,.16)',border:'1px solid var(--line)',borderRadius:'8px',padding:'6px 10px',outline:'none'}});
      urlIn.addEventListener('keydown',e=>e.stopPropagation());
      return [h('h2',null,'Appearance'),
        h('h5',null,'Theme'),card(R('Mode',seg([['dark','Dark'],['light','Light'],['auto','Auto']],S.settings.theme,v=>{ OS.set('theme',v); redraw(); })),
          h('div',{class:'fld'},'Accent color',h('div',{class:'swatches'},ACCENTS.map(c=>h('div',{class:'sw dot'+(S.settings.accent===c?' on':''),style:{background:c},onclick:()=>{ OS.set('accent',c); redraw(); }})),h('input',{type:'color',value:S.settings.accent,oninput:e=>OS.set('accent',e.target.value),style:{width:'40px',height:'28px',padding:0,border:0,background:'none'}})))),
        h('h5',null,'Wallpaper'),card(h('div',{class:'fld'},h('div',{class:'swatches'},OS.WALLPAPERS.map(p=>h('div',{class:'sw'+(wp.type==='preset'&&wp.id===p.id?' on':''),title:p.name,style:{background:p.blobs?'linear-gradient(135deg,#6a5cff,#00b7ff,#ff3f9a)':p.css},onclick:()=>{ OS.setWall({type:'preset',id:p.id}); redraw(); }})))),
          R('Solid color',h('input',{type:'color',value:wp.type==='color'?wp.value:'#1c1f2b',oninput:e=>OS.setWall({type:'color',value:e.target.value})})),
          R('Your own image',h('div',null,h('button',{class:'sbtn',onclick:()=>fileIn.click()},'Choose file…'),fileIn),'Stored in this browser (resized to fit)'),
          h('div',{class:'fld'},'Image from a link',h('div',{style:{display:'flex',gap:'6px'}},urlIn,h('button',{class:'sbtn pri',onclick:()=>{ const n=OS.normUrl(urlIn.value); if(n&&!n.local){ OS.setWall({type:'url',value:n.url}); redraw(); } else OS.toast('Enter an https image link.'); }},'Set')))),
        h('h5',null,'Glass & shape'),card(R('Blur strength',rng('blur',0,40),'0 turns blur off'),R('Glass opacity',rng('glass',.2,.95,.01)),R('Corner roundness',rng('radius',0,28)),
          R('Font',seg([['system','System'],['rounded','Rounded'],['mono','Mono'],['serif','Serif']],S.settings.font,v=>{ OS.set('font',v); redraw(); }))),
        h('h5',null,'Performance'),card(R('Custom cursor',seg([['auto','Auto'],['on','On'],['off','Off']],S.settings.cursor||'auto',v=>{ OS.set('cursor',v); redraw(); }),'The liquid-blob cursor draws a full-screen WebGL effect. Auto = on for capable devices, off on weaker ones and in Reduced effects. Off restores your normal cursor. It steps aside inside game windows.'),R('Visual effects',seg([['auto','Auto'],['on','Reduced'],['off','Full']],S.settings.perf,v=>{ OS.set('perf',v); redraw(); }),'Reduced = no blur, no animations (best for Chromebooks / school laptops). Auto picks Reduced on weaker devices'+(OS.lowEnd?' — this one looks low-end.':'.')))];
    },
    desktop(){ return [h('h2',null,'Desktop & Dock'),
      h('h5',null,'Desktop'),card(R('Grid size',rng('unit',64,120),'Scales folder tiles & widgets'),R('Snap to grid',chk('snap')),R('Show widgets',chk('widgetsOn')),R('Show icon labels',chk('labels')),
        R('Layout',h('button',{class:'sbtn',onclick:OS.wm.resetLayout},'Reset…'))),
      h('h5',null,'Dock'),card(R('Icon size',rng('dockSize',36,88)),R('Magnify on hover',chk('dockMag')),R('Auto-hide',chk('dockHide')),R('Position',seg([['bottom','Bottom'],['left','Left'],['right','Right']],S.settings.dockPos,v=>{ OS.set('dockPos',v); redraw(); })),
        R('Dock apps',h('button',{class:'sbtn',onclick:()=>{ S.dock=['sys:finder','sys:browser','sys:search','sys:ai','sys:settings','|','aros','minecraft','crazy-cars']; OS.save(); OS.wm.renderDock(); }},'Reset dock'),'Right-click any app → Keep in Dock'))]; },
    clock(){ return [h('h2',null,'Clock'),card(R('Format',seg([[false,'12-hour'],[true,'24-hour']],S.settings.clock24,v=>{ OS.set('clock24',v); redraw(); })),R('Show seconds',chk('clockSec')),R('Show date in menu bar',chk('clockDate'))),
      h('div',{class:'sub',style:{color:'var(--fg2)',marginTop:'10px'}},'Clock widgets have their own face, time zone and label — right-click one → Customize.')]; },
    widgets(){
      const list=S.widgets||[];
      return [h('h2',null,'Widgets'),h('h5',null,'Add'),h('div',{style:{display:'flex',flexWrap:'wrap',gap:'8px'}},OS.widgets.TYPES.map(t=>h('button',{class:'sbtn',onclick:()=>{ OS.widgets.add(t.id); OS.toast(t.name+' added'); redraw(); }},t.emoji+' '+t.name))),
        h('h5',null,'On your desktop'),card(...(list.length?list.map(w=>{ const t=OS.widgets.TYPES.find(x=>x.id===w.type); return h('div',{class:'lrow'},h('span',null,t.emoji),h('span',{class:'nm'},t.name+'  ·  '+w.w+'×'+w.h+' · '+w.shape),h('button',{class:'sbtn',onclick:()=>OS.widgets.customize(w)},'Customize'),h('button',{class:'sbtn dng',onclick:()=>{ OS.widgets.remove(w); redraw(); }},'Remove')); }):[h('div',{class:'empty'},'No widgets.')])),
        h('div',{style:{color:'var(--fg2)',fontSize:'12px',marginTop:'10px'}},'Tip: drag widgets anywhere, drag the bottom-right corner to resize, right-click for shapes, styles and colors.')]; },
    folders(){ return [h('h2',null,'Folders'),h('button',{class:'sbtn pri',onclick:OS.wm.newFolderDialog},'➕ New folder'),' ',h('button',{class:'sbtn',onclick:()=>{ S.deletedFolders=[]; OS.reconcile(); OS.save(); OS.wm.renderDesktop(); redraw(); }},'Restore default folders'),
      h('h5',null,'Your folders'),card(...OS.folders().map(f=>h('div',{class:'lrow'},h('span',{class:'ico',style:{'--c':f.color}},f.emoji),h('span',{class:'nm'},f.name+'  ·  '+f.items.length+' apps  ·  '+f.w+'×'+f.h),
        h('button',{class:'sbtn',onclick:()=>OS.wm.folderDialog(f)},'Customize'),h('button',{class:'sbtn',onclick:()=>OS.wm.openFolder(f.id)},'Open'),h('button',{class:'sbtn dng',onclick:()=>OS.confirm('Delete “'+f.name+'”?','Its apps move to Utilities.',()=>{ OS.deleteFolder(f.id); redraw(); })},'Delete'))))]; },
    apps(){
      const custom=Object.values(S.customApps), hidden=Object.entries(S.over).filter(([id,v])=>v.hidden&&OS.appBase(id));
      return [h('h2',null,'Apps'),h('button',{class:'sbtn pri',onclick:()=>OS.wm.addLinkDialog()},'🔗 Add app from link'),
        h('h5',null,'Your link apps'),card(...(custom.length?custom.map(c=>{ const x=OS.app(c.id); return h('div',{class:'lrow'},h('span',{class:'ico',style:{'--c':x.color}},x.emoji),h('span',{class:'nm'},x.name+'  ·  '+x.url),h('button',{class:'sbtn',onclick:()=>OS.wm.editAppDialog(x)},'Edit'),h('button',{class:'sbtn dng',onclick:()=>OS.confirm('Delete “'+x.name+'”?','',()=>{ OS.removeApp(x.id); redraw(); })},'Delete')); }):[h('div',{class:'empty'},'None yet — paste a link in Spotlight (Ctrl+K), the Link → App widget, or the button above.')])),
        h('h5',null,'Hidden apps'),card(...(hidden.length?hidden.map(([id])=>{ const x=OS.appBase(id); return h('div',{class:'lrow'},h('span',{class:'ico',style:{'--c':x.color}},x.emoji),h('span',{class:'nm'},x.name),h('button',{class:'sbtn',onclick:()=>{ delete S.over[id].hidden; OS.save(); OS.refreshAll(); redraw(); }},'Restore')); }):[h('div',{class:'empty'},'Nothing hidden.')])),
        h('h5',null,'Icons'),card(R('Fetch website icons for link apps',chk('favicons'),'Asks Google’s favicon service for each site’s icon (shares the site name). Off = letter icons only.'))]; },
    ai(){ const m=S.ai.mem||{}; return [h('h2',null,'AR.OS AI'),...mascotCard(),h('h5',null,'Behavior'),card(R('Allow online look-ups',chk('aiOnline'),'Wikipedia, dictionary & weather. Off = the AI answers only from what’s built in.'),
        R('Chat history',h('button',{class:'sbtn',onclick:()=>{ S.ai.history=[]; OS.save(); OS.toast('Chat cleared'); }},'Clear')),
        R('What it remembers',h('button',{class:'sbtn',onclick:()=>{ S.ai.mem={}; OS.save(); OS.toast('Memory cleared'); redraw(); }},'Forget'),Object.keys(m).length?Object.entries(m).map(([k,v])=>k+': '+(typeof v==='string'?v:JSON.stringify(v))).join(' · ').slice(0,200):'Nothing yet — tell it “my name is …”')),
      h('div',{style:{color:'var(--fg2)',fontSize:'12px',marginTop:'10px'}},'It isn’t a cloud LLM: it’s a built-in rule engine plus a small on-device model for fuzzy questions, so it works without any account or server.')]; },
    data(){
      const size=(()=>{ try{ return Math.round(((localStorage.getItem(OS.KEY)||'').length+(OS.getWallImage()||'').length)/1024); }catch{ return 0; } })();
      const imp=h('input',{type:'file',accept:'.json,application/json',style:{display:'none'},onchange:e=>{ const f=e.target.files[0]; if(!f) return; f.text().then(t=>doImport(t)).catch(()=>OS.toast('Could not read file.')); }});
      return [h('h2',null,'Data & Sync'),
        h('div',{class:'card',style:{padding:'12px 14px',marginBottom:'6px'}},'💾 Everything is saved automatically in ',h('b',null,'this browser on this computer'),' ('+size+' KB). There is no server, so it can’t be tied to your IP address — but you can move it to another computer with a backup file or a settings code.'),
        h('h5',null,'Backup file'),card(R('Download a backup',h('button',{class:'sbtn pri',onclick:exportFile},'Export')),R('Restore from a backup',h('div',null,h('button',{class:'sbtn',onclick:()=>imp.click()},'Import…'),imp))),
        h('h5',null,'Settings code (no wallpaper image)'),card(R('Copy a code to paste on another computer',h('button',{class:'sbtn',onclick:copyCode},'Copy code')),R('Paste a code',h('button',{class:'sbtn',onclick:pasteCode},'Paste…'))),
        h('h5',null,'Danger zone'),card(R('Erase everything and start over',h('button',{class:'sbtn dng',onclick:()=>OS.confirm('Erase all ArcadeOS data?','Folders, widgets, notes, settings, play time and AI memory in this browser will be deleted.',()=>{ OS.noFlush=true; localStorage.removeItem(OS.KEY); localStorage.removeItem('arcadeos.wall'); location.reload(); },'Erase')},'Reset…')))]; },
    about(){ return [h('h2',null,'About ArcadeOS'),card(h('div',{style:{padding:'12px 0',lineHeight:1.7}},'Saket’s arcade, as a desktop.',h('br'),'Windows: drag the title bar, resize from any edge, 🔴 close · 🟡 minimize · 🟢 zoom (Shift-click = full screen).',h('br'),'Drop a window on the top edge to maximize, or the left/right edge to snap.')),
      h('h5',null,'Shortcuts'),card(h('div',{style:{padding:'10px 0',lineHeight:1.9}},h('code',null,'Ctrl/⌘ + K'),'  Spotlight — apps, links, commands',h('br'),h('code',null,'Ctrl/⌘ + /'),'  AR.OS AI',h('br'),'Right-click the desktop, folders, apps, widgets and the dock for options.'))]; }
  };
  function mascotCard(){
    const M=OS.mascot, AM=window.AgentMascot;
    if(!M||!M.available()) return [card(h('div',{class:'empty'},'The mascot component didn’t load.'))];
    const c=M.cfg(), ser=AM.seriesOf(c.shape), animals=ser==='animals', set=p=>{ M.set(p); redraw(); };
    const names=list=>h('div',{class:'swatches'},list.map(n=>h('button',{class:'sbtn'+(c.shape===n?' pri':''),onclick:()=>set({shape:n})},n)));
    return [h('h5',null,'Mascot'),card(
      h('div',{style:{display:'flex',alignItems:'center',gap:'16px',padding:'8px 0'}},h('div',{style:{width:'120px',height:'120px',flex:'none'}},M.el({size:120})),
        h('div',{style:{color:'var(--fg2)',fontSize:'12px',lineHeight:1.5}},'This is the AI’s sprite. It shows in the chat, the dock, the menu bar and the AI Buddy widget, and reacts while you type and while it thinks.',h('div',{style:{marginTop:'8px'}},h('button',{class:'sbtn pri',onclick:()=>{ M.randomize(); redraw(); }},'🎲 Randomize')))),
      h('div',{class:'fld'},'Shape — blobs',names(AM.SHAPES)),
      h('div',{class:'fld'},'Shape — animals',names(AM.ANIMALS),h('div',{style:{fontSize:'11px',opacity:.7}},OS.perf||OS.lowEnd?'Animals are 3D; on this device (or in Reduced effects) they show as flat sprites.':'Animals are drawn in 3D (needs WebGL2 and loads a small 3D library from a CDN the first time).')),
      h('div',{class:'fld'},'Color',h('div',{class:'swatches'},Object.entries(AM.PALETTE).map(([n,hex])=>h('div',{class:'sw dot'+(c.color===n?' on':''),title:n,style:{background:hex},onclick:()=>set({color:n})})))),
      R('Material',seg(AM.SERIES[ser].materials.map(x=>[x,x]),c.material,v=>set({material:v}))),
      R('Eyes',seg([['dot','Dots'],['capsule','Capsules']],c.eyes,v=>set({eyes:v}))),
      R('Cheeks',h('input',{type:'checkbox',checked:!!c.cheeks,onchange:e=>{ M.set({cheeks:e.target.checked}); }})),
      ...(animals?[R('Accessory',seg(AM.ACCESSORIES.map(x=>[x,x]),c.accessory,v=>set({accessory:v})))]:[]))];
  }
  function snapshot(withWall){ OS.flush(); return { app:'arcadeos', v:1, data:JSON.parse(JSON.stringify(S)), wall:withWall?OS.getWallImage():'' }; }
  function exportFile(){ const blob=new Blob([JSON.stringify(snapshot(true))],{type:'application/json'}), u=URL.createObjectURL(blob), l=h('a',{href:u,download:'arcadeos-backup.json'}); document.body.append(l); l.click(); l.remove(); setTimeout(()=>URL.revokeObjectURL(u),2000); }
  function apply(snap){
    if(!snap||snap.app!=='arcadeos'||!snap.data||typeof snap.data.settings!=='object') throw new Error('bad');
    const merged=OS.merge(OS.DEFAULTS(),snap.data); OS.noFlush=true; localStorage.setItem(OS.KEY,JSON.stringify(merged));
    if(snap.wall&&typeof snap.wall==='string'&&snap.wall.startsWith('data:image/')) OS.setWallImage(snap.wall);
    OS.toast('Imported! Reloading…'); setTimeout(()=>location.reload(),500);
  }
  function doImport(t){ try{ OS.confirm('Replace your current setup?','Importing overwrites folders, widgets and settings in this browser.',()=>apply(JSON.parse(t)),'Import'); }catch{ OS.toast('That file isn’t a valid backup.'); } }
  const b64=s=>btoa(unescape(encodeURIComponent(s))), unb64=s=>decodeURIComponent(escape(atob(s)));
  function copyCode(){ const code='AOS1.'+b64(JSON.stringify(snapshot(false))); (navigator.clipboard?navigator.clipboard.writeText(code):Promise.reject()).then(()=>OS.toast('Code copied ✔'),()=>OS.dialog({title:'Your settings code',fields:[{key:'c',label:'Copy this',type:'textarea',value:code}],ok:'Done',cancel:'Close'})); }
  function pasteCode(){ OS.dialog({title:'Paste settings code',fields:[{key:'c',label:'Code',type:'textarea',value:'',placeholder:'AOS1.…'}],ok:'Import',onOk:v=>{ try{ const c=v.c.trim(); if(!c.startsWith('AOS1.')) throw 0; const snap=JSON.parse(unb64(c.slice(5))); apply(snap); }catch{ OS.toast('That code isn’t valid.'); return false; } }}); }
  function draw(){
    side.replaceChildren(h('div',{class:'sh'},'Settings'),...PAGES.map(([id,e,l])=>h('div',{class:'si'+(page===id?' on':''),onclick:()=>{ page=id; draw(); }},e+' '+l)));
    pane.replaceChildren(...pages[page]()); pane.scrollTop=0;
    if(Wn) Wn.titleEl.textContent=Wn.title='Settings — '+PAGES.find(p=>p[0]===page)[2];
  }
  draw();
  return { title:'Settings', body:h('div',{class:'split'},side,pane), w:760, h:560, minW:480, minH:320, api:{ again:o2=>{ if(o2.page&&pages[o2.page]){ page=o2.page; draw(); } } }, after:W=>{ Wn=W; } };
};
})();
