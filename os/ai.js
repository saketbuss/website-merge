/* AR.OS AI v2 — still fully client-side (no API key, no server), but now OS-aware:
   it can open/close apps, change settings, add widgets, make folders/link-apps, set timers, keep notes/todos, check weather,
   convert units, recommend games from your play history, and (optionally) look things up on Wikipedia / a dictionary.
   Anything it doesn't recognise falls through to the original rule engine + on-device semantic model (os/brain.js). */
(function(){
'use strict';
const {h,$,S,pick}=OS;
const AI=OS.ai={};
const mem=()=>(S.ai.mem=S.ai.mem||{});
let pending=null, pend0=null, lastRec=null;

/* ---------- small knowledge tables ---------- */
const TZ={tokyo:'Asia/Tokyo',japan:'Asia/Tokyo',london:'Europe/London',uk:'Europe/London',paris:'Europe/Paris',france:'Europe/Paris',berlin:'Europe/Berlin',germany:'Europe/Berlin',rome:'Europe/Rome',madrid:'Europe/Madrid',moscow:'Europe/Moscow',istanbul:'Europe/Istanbul',cairo:'Africa/Cairo',lagos:'Africa/Lagos',dubai:'Asia/Dubai',delhi:'Asia/Kolkata',mumbai:'Asia/Kolkata',india:'Asia/Kolkata',beijing:'Asia/Shanghai',shanghai:'Asia/Shanghai',china:'Asia/Shanghai','hong kong':'Asia/Hong_Kong',singapore:'Asia/Singapore',seoul:'Asia/Seoul',sydney:'Australia/Sydney',australia:'Australia/Sydney',auckland:'Pacific/Auckland',honolulu:'Pacific/Honolulu',hawaii:'Pacific/Honolulu','new york':'America/New_York',nyc:'America/New_York',boston:'America/New_York',miami:'America/New_York',toronto:'America/Toronto',chicago:'America/Chicago',dallas:'America/Chicago',houston:'America/Chicago',denver:'America/Denver','los angeles':'America/Los_Angeles',la:'America/Los_Angeles','san francisco':'America/Los_Angeles',seattle:'America/Los_Angeles',vancouver:'America/Vancouver','mexico city':'America/Mexico_City','sao paulo':'America/Sao_Paulo','buenos aires':'America/Argentina/Buenos_Aires'};
const UNITS={ // category -> unit -> factor to base
  len:{mm:.001,millimeter:.001,cm:.01,centimeter:.01,m:1,meter:1,metre:1,km:1000,kilometer:1000,in:.0254,inch:.0254,inches:.0254,ft:.3048,foot:.3048,feet:.3048,yd:.9144,yard:.9144,mi:1609.344,mile:1609.344,miles:1609.344},
  mass:{g:1,gram:1,kg:1000,kilogram:1000,oz:28.3495,ounce:28.3495,lb:453.592,lbs:453.592,pound:453.592,pounds:453.592,stone:6350.29},
  vol:{ml:1,l:1000,liter:1000,litre:1000,tsp:4.92892,tbsp:14.7868,cup:236.588,cups:236.588,pint:473.176,quart:946.353,gal:3785.41,gallon:3785.41},
  speed:{mph:.44704,kph:.277778,kmh:.277778,'km/h':.277778,'m/s':1,knot:.514444,knots:.514444},
  time:{s:1,sec:1,second:1,seconds:1,min:60,minute:60,minutes:60,h:3600,hr:3600,hour:3600,hours:3600,day:86400,days:86400,week:604800,weeks:604800},
  data:{b:1,kb:1e3,mb:1e6,gb:1e9,tb:1e12}
};
const ACCENT={red:'#ff453a',orange:'#ff9f0a',yellow:'#ffd60a',green:'#34c759',teal:'#30b0c7',cyan:'#64d2ff',blue:'#0a84ff',indigo:'#5e5ce6',purple:'#bf5af2',pink:'#ff375f',brown:'#ac8e68'};
const JOKES=['Why did the gamer bring a ladder? To reach the next level.','I would tell you a UDP joke, but you might not get it.','Why do programmers prefer dark mode? Because light attracts bugs.','What do you call a sleeping bull at the arcade? A bulldozer… of high scores.','There are 10 kinds of people: those who understand binary and those who don’t.','Why was the JavaScript developer sad? He didn’t Node how to Express himself.','How does a computer get drunk? It takes screenshots… and a few too many bytes.','Why did the Chromebook go to therapy? Too many unresolved tabs.','I told my computer I needed a break. It said “No problem — I’ll go to sleep.”'];
const WIDGET_ALIASES={clock:['clock'],weather:['weather','forecast'],search:['search'],favorites:['favorite','favourite','favs'],recents:['recent','continue'],notes:['note'],todo:['todo','to-do','task','checklist'],calendar:['calendar'],timer:['timer','stopwatch'],stats:['stat'],fact:['fact','quote'],calc:['calc'],linkbar:['link'],askai:['ask'],buddy:['buddy','mascot','companion','pet'],custom:['custom','text','sticky','sign','label']};
const WALLS=['blobs','aurora','sunset','ocean','forest','candy','midnight','graphite','grid','peach','mint','sky'];

/* ---------- helpers ---------- */
const online=()=>S.settings.aiOnline!==false;
const act=(label,run)=>({label,run});
const widgetOf=type=>(S.widgets||[]).find(w=>w.type===type);
const nameP=()=>mem().name?', '+mem().name:'';
const cap=s=>s.replace(/\b\w/g,c=>c.toUpperCase());
function findApp(raw){
  const t=OS.norm(raw.replace(/\b(the|a|an|my|app|game|please|for me|up)\b/g,' ').replace(/\s+/g,' ')); if(!t) return null;
  const sys={settings:'sys:settings',setting:'sys:settings',preferences:'sys:settings',browser:'sys:browser',internet:'sys:browser',web:'sys:browser',search:'sys:search',google:'sys:search',finder:'sys:finder',files:'sys:finder',ai:'sys:ai',assistant:'sys:ai',chat:'sys:ai'};
  if(sys[t]) return OS.app(sys[t]);
  const r=OS.allApps().map(a=>({a,s:OS.scoreApp(a,t)})).sort((x,y)=>y.s-x.s)[0];
  return r&&r.s>=60?r.a:null;
}
function startTimer(sec,label){
  const t={id:OS.uid('t_'),end:Date.now()+sec*1000,label:label||''}; S.timers.push(t); OS.save(); schedule(t); return t;
}
function schedule(t){ const ms=Math.max(0,t.end-Date.now()); setTimeout(()=>{ if(!S.timers.includes(t)) return; S.timers=S.timers.filter(x=>x!==t); OS.save(); OS.toast('⏰ '+(t.label?t.label+' — time’s up!':'Timer finished!'),9000); OS.beep(); },Math.min(ms,2147000000)); }
OS.restoreTimers=()=>{ (S.timers||[]).slice().forEach(schedule); };
const unitSecs=u=>/^h/.test(u)?3600:/^m/.test(u)?60:1;
const fmtDurLong=s=>{ const h2=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60; return [h2&&h2+'h',m&&m+'m',x&&x+'s'].filter(Boolean).join(' ')||'0s'; };

async function wikiSummary(q){
  const r=await fetch('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrlimit=1&prop=extracts|info&inprop=url&exintro=1&explaintext=1&exsentences=3&redirects=1&gsrsearch='+encodeURIComponent(q));
  const j=await r.json(); const p=j.query&&Object.values(j.query.pages)[0]; if(!p||!p.extract) return null; return {title:p.title,text:p.extract.trim(),url:p.fullurl};
}
async function dictionary(w){
  const r=await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(w)); if(!r.ok) return null; const j=await r.json(); const m=j[0]&&j[0].meanings&&j[0].meanings[0]; if(!m) return null;
  const d=m.definitions[0]; return `**${j[0].word}** (${m.partOfSpeech}): ${d.definition}`+(d.example?`\n*“${d.example}”*`:'');
}
const isGeneric=t=>/I don.t have a precise answer|built-in knowledge is curated|Give me the exact/i.test(t||'');
function convert(raw){
  const m=raw.toLowerCase().match(/(-?\d+(?:\.\d+)?)\s*(?:°\s*)?([a-z/°]+(?:\s?[a-z]+)?)\s+(?:to|in|into|as)\s+(?:°\s*)?([a-z/°]+)/); if(!m) return null;
  const n=parseFloat(m[1]); let a=m[2].trim().replace('°',''), b=m[3].trim().replace('°','');
  const T={c:'c',celsius:'c',f:'f',fahrenheit:'f',k:'k',kelvin:'k'};
  if(T[a]&&T[b]){ const c=T[a]==='c'?n:T[a]==='f'?(n-32)*5/9:n-273.15; const out=T[b]==='c'?c:T[b]==='f'?c*9/5+32:c+273.15; return `${n}° ${a.toUpperCase()} = **${+out.toFixed(2)}° ${b.toUpperCase()}**`; }
  for(const cat of Object.values(UNITS)){ if(cat[a]&&cat[b]){ const out=n*cat[a]/cat[b]; return `${n} ${a} = **${+out.toPrecision(6)} ${b}**`; } }
  return null;
}

/* ---------- intent handlers (first match wins) ---------- */
const H=[];
const on=(fn)=>H.push(fn);

on(async(q,l)=>{ if(l==='/help'||/^(help|what can you do|commands|what do you do)\b/.test(l)) return {text:`Here’s what I can do${nameP()}:\n- **Open & close apps** — “open minecraft”, “close all”\n- **Recommend games** — “recommend a racing game”, “I’m bored”\n- **Customize the OS** — “dark mode”, “make it purple”, “wallpaper sunset”, “dock on the left”, “reduce effects”\n- **Widgets & folders** — “add a weather widget”, “create folder Chill”, “move tank to Shooters”\n- **Links** — paste a URL and I’ll turn it into an app\n- **Timers, notes, to-dos** — “timer 10 min”, “note: buy milk”, “add todo homework”\n- **Info** — weather, time in other cities, unit conversion, math, Wikipedia & definitions\n- **Your stats** — “how long have I played?”\n- **AR.OS Arena tactics**, coding & school help (the original brain).`,acts:[act('Recommend a game',()=>AI.send('recommend a game')),act('Weather',()=>AI.send('weather'))]}; });
on(async(q,l)=>{ if(l==='/clear'){ S.ai.history=[]; OS.save(); AI.onClear&&AI.onClear(); return 'Cleared. Fresh start!'; } });
on(async(q,l)=>{ if(/^(hi|hello|hey|yo|sup|hiya|good (morning|afternoon|evening))\b/.test(l)&&l.split(' ').length<5) return pick([`Hey${nameP()}! What are we doing — a game, a widget, or a question?`,`Hi${nameP()} 👋 Try “recommend a game” or “add a weather widget”.`,`Hello${nameP()}! Ask me to open something, change the look, or look something up.`]); });
on(async(q,l)=>{
  let m=l.match(/(?:my name is|call me|i am called|i'?m called)\s+([a-z][a-z' -]{0,20})$/); if(m){ mem().name=cap(m[1].trim()); OS.save(); return `Nice to meet you, **${mem().name}**! I’ll remember that.`; }
  if(/^(who am i|what('?s| is) my name)/.test(l)) return mem().name?`You’re **${mem().name}**.`:'You haven’t told me yet — say “my name is …”.';
  m=q.match(/^remember(?: that)?\s+(.+)/i); if(m){ (mem().facts=mem().facts||[]).push(m[1].slice(0,200)); mem().facts=mem().facts.slice(-20); OS.save(); return 'Got it — I’ll remember: “'+m[1]+'”.'; }
  if(/what do you (remember|know about me)|what have i told you/.test(l)){ const f=mem().facts||[]; return (mem().name?`Your name is **${mem().name}**.\n`:'')+(f.length?'You told me:\n'+f.map(x=>'- '+x).join('\n'):'Nothing else yet. Say “remember that …”.'); }
  if(/^forget (everything|all)/.test(l)){ S.ai.mem={}; OS.save(); return 'Memory wiped.'; }
});
// time / date
on(async(q,l)=>{
  let m=l.match(/(?:what time is it|what'?s the time|time|what'?s the date|date|what day is it)\s*(?:right now|now|today)?\s*(?:in|at)\s+(.+)$/)||l.match(/^(?:what time is it|current time)\s+in\s+(.+)$/);
  if(m){ const k=m[1].replace(/\?/g,'').trim(), tz=TZ[k]; if(!tz) return `I don’t know the time zone for “${k}” yet. Try a major city, like Tokyo or London.`;
    const d=new Date(), t=new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'numeric',minute:'2-digit',weekday:'long',month:'short',day:'numeric'}).format(d); return `In **${cap(k)}** it’s **${t}**.`; }
  if(/^(what('?s| is) )?(the )?(current )?(time|date|day)( is it| today| now| right now)?$|^what time is it|^what day is it|today'?s date|^what('?s| is) today/.test(l)){ const d=new Date(); return `It’s **${OS.timeStr(d,true)}** on **${d.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}**.`; }
});
// timers & reminders
on(async(q,l)=>{
  let m=l.match(/remind me (?:in|after)\s+(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\b\s*(?:to|about|that)?\s*(.*)/);
  if(m){ const sec=Math.round(parseFloat(m[1])*unitSecs(m[2])); if(sec>86400) return 'I can remind you up to 24 hours ahead while this tab stays open.'; startTimer(sec,m[3]||'Reminder'); return `⏰ OK — I’ll remind you${m[3]?' to **'+m[3]+'**':''} in **${fmtDurLong(sec)}**. (Keep this tab open.)`; }
  m=l.match(/(?:set |start |make )?(?:a |an )?(?:timer|countdown)(?: for| of)?\s+(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\b/)||l.match(/(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\s+timer/);
  if(m){ const sec=Math.round(parseFloat(m[1])*unitSecs(m[2])); if(sec<=0||sec>86400) return 'Pick a timer between 1 second and 24 hours.'; startTimer(sec,'Timer'); return `⏳ Timer set for **${fmtDurLong(sec)}**. I’ll beep when it’s done.`; }
  if(/^(set |start )?(a )?(timer|stopwatch)$/.test(l)){ const w=OS.widgets.add('timer'); return 'I added a **Timer** widget to your desktop — or tell me a duration, like “timer 5 min”.'; }
  if(/(list|show|what('?s| are)) (my )?(timers|reminders)/.test(l)){ const t=S.timers||[]; return t.length?t.map(x=>`- ${x.label||'Timer'}: ${fmtDurLong(Math.max(0,Math.round((x.end-Date.now())/1000)))} left`).join('\n'):'No active timers.'; }
  if(/(cancel|stop|clear) (all )?(my )?(timers|reminders)/.test(l)){ S.timers=[]; OS.save(); return 'All timers cancelled.'; }
});
// notes & todos
on(async(q,l)=>{
  let m=q.match(/^(?:note|jot(?: down)?|write down|save note)\s*[:\-]?\s+(.+)/i);
  if(m){ S.notes=(S.notes?S.notes+'\n':'')+'• '+m[1]; OS.save(); OS.wm.refreshWidgets('notes'); return `📝 Saved to your notes: “${m[1]}”.`+(widgetOf('notes')?'':' (Add a Notes widget to see them on your desktop.)'); }
  m=q.match(/^(?:add|new|create)\s+(?:a\s+)?(?:todo|to-do|task)\s*[:\-]?\s+(.+)/i)||q.match(/^add\s+(.+?)\s+to\s+(?:my\s+)?(?:todo|to-do|task)s?(?: list)?$/i)||q.match(/^todo[:\-]?\s+(.+)/i);
  if(m){ S.todos.push({text:m[1].slice(0,200),done:false}); OS.save(); OS.wm.refreshWidgets('todo'); return `✅ Added to your to-do list: “${m[1]}” (${S.todos.filter(t=>!t.done).length} open).`; }
  if(/(show|what('?s| are)|list)\s+(my\s+)?(todos?|to-dos?|tasks)/.test(l)){ return S.todos.length?S.todos.map(t=>(t.done?'☑ ':'☐ ')+t.text).join('\n'):'Your to-do list is empty 🎉'; }
  if(/(clear|delete) (my )?(done|completed|finished) (todos|tasks)/.test(l)){ S.todos=S.todos.filter(t=>!t.done); OS.save(); OS.wm.refreshWidgets('todo'); return 'Cleared completed tasks.'; }
  if(/(show|read|what('?s| are)) (in )?my notes/.test(l)) return S.notes?('**Your notes:**\n'+S.notes):'No notes yet — say “note: …”.';
});
// weather
on(async(q,l)=>{
  const pend=pend0==='weather'&&l.split(' ').length<=4&&!/[?]/.test(q)&&!/\d/.test(q);
  if(l.includes('widget')) return;
  if(!pend&&!/\b(weather|forecast|temperature|how (hot|cold|warm)|is it (raining|snowing|sunny|cold|hot))\b/.test(l)) return;
  const wasPending=pend;
  let city=wasPending?q.replace(/[?.!]/g,'').trim():((l.match(/\b(?:in|for|at|of)\s+([a-z][a-z .'-]*?)(?:\s+(?:today|tomorrow|now|right now|tonight|please))?\s*\??$/)||[])[1]||'');
  const wx=widgetOf('weather'), unit=(wx&&wx.opts.unit)||mem().unit||'F';
  let g=null;
  if(!city){ if(wx&&wx.opts.lat!=null) g={lat:wx.opts.lat,lon:wx.opts.lon,name:wx.opts.place||wx.opts.city,short:wx.opts.city}; else if(mem().city) g=mem().city; else { pending='weather'; return 'Which city? (e.g. “Boston”)'; } }
  if(!online()) return 'Weather needs an online look-up, and online look-ups are turned off (Settings → AI).';
  try{
    if(!g){ g=await OS.weather.geocode(city); if(!g) return wasPending?null:`I couldn’t find a city called “${city}”.`; mem().city=g; OS.save(); }
    const d=await OS.weather.get(g.lat,g.lon,unit), c=d.current, [ic,txt]=OS.weather.WMO(c.weather_code), U=unit==='C'?'°C':'°F';
    const hi=Math.round(d.daily.temperature_2m_max[0]), lo=Math.round(d.daily.temperature_2m_min[0]);
    return {text:`${ic} **${g.name||g.short}** — ${txt}, **${Math.round(c.temperature_2m)}${U}** (feels ${Math.round(c.apparent_temperature)}${U}).\nToday: high ${hi}${U} / low ${lo}${U} · humidity ${c.relative_humidity_2m}% · wind ${Math.round(c.wind_speed_10m)} ${unit==='C'?'km/h':'mph'}.`,acts:widgetOf('weather')?[]:[act('Add weather widget',()=>{ const w=OS.widgets.add('weather'); Object.assign(w.opts,{city:g.short||g.name,lat:g.lat,lon:g.lon,place:g.name,unit}); OS.save(); OS.widgets.rerender(w); })]};
  }catch{ return 'I couldn’t reach the weather service (are you offline?).'; }
});
// custom cursor + the AI's own mascot look (these must run before the generic "color"/"theme" rules below)
on(async(q,l)=>{
  if(/\b(cursor|pointer)\b/.test(l)&&!/\bmascot\b/.test(l)){
    if(/\b(off|remove|disable|hide|stop|get rid of|turn off|no more)\b/.test(l)){ OS.set('cursor','off'); return 'Custom cursor **off**. Bring it back with “turn on the cursor”.'; }
    if(/\b(on|enable|show|bring back|turn on|use)\b/.test(l)){ OS.set('cursor','on'); return window.OSCursor&&OSCursor.running()?'Custom cursor **on** ✨ (it steps aside inside game windows).':'I tried, but this browser has WebGL turned off.'; }
  }
  const M=OS.mascot; if(!M||!M.available()) return;
  const AM=window.AgentMascot, shapes=[...AM.SHAPES,...AM.ANIMALS], has=w=>new RegExp('\\b'+w+'\\b').test(l);
  const m=l.match(/^(?:be|become|turn into|change (?:into|to)|look like)\s+(?:a |an )?(\w+)$/);
  if(m&&shapes.includes(m[1])){ M.set({shape:m[1]}); return `Ta-da — I’m a **${m[1]}** now.`; }
  if(/\b(mascot|avatar|sprite|your (look|shape|face|color|colour|body))\b/.test(l)){
    if(/random|surprise|shuffle/.test(l)){ M.randomize(); return 'Ooh, fresh look! 🎲'; }
    const shape=shapes.find(has), color=Object.keys(AM.PALETTE).find(has), mat=[...AM.MATERIALS,...AM.FABRICS].find(has);
    if(shape||color||mat){ const p={}; if(shape) p.shape=shape; if(color) p.color=color; if(mat) p.material=mat; M.set(p);
      return `Updated my look: ${Object.entries(M.cfg()).filter(([k])=>['shape','color','material'].includes(k)).map(([k,v])=>v).join(' · ')}.`; }
    return {text:'You can change my look in Settings → AI, or say things like “be a bunny”, “mascot color mint”, “randomize mascot”.\nShapes: '+shapes.join(', ')+'.',acts:[act('Open mascot settings',()=>OS.launch('sys:settings',{page:'ai'}))]};
  }
});
// OS: theme, effects, accent, wallpaper, dock, widgets
on(async(q,l)=>{
  let m;
  if((m=l.match(/\b(dark|light)\s*(?:mode|theme)\b|(?:make it|switch to|go|use|turn on)\s+(dark|light)\b/))){ const v=m[1]||m[2]; OS.set('theme',v); return `Switched to **${v} mode**.`; }
  if(/\b(auto|system)\s*(theme|mode)\b/.test(l)){ OS.set('theme','auto'); return 'Theme now follows your device.'; }
  if(/(reduce|less|fewer|no|disable|turn off)\s*(visual\s*)?effects|performance mode|\b(site|os|it|this|everything|desktop|computer)\b.{0,24}\b(lag|laggy|laggin|slow|choppy|stutter\w*)\b/.test(l)){ OS.set('perf','on'); return '🚀 Switched to **reduced effects** — no blur or animations. Undo anytime: “full effects”.'; }
  if(/(full|more|all|turn on|enable)\s*(visual\s*)?effects/.test(l)){ OS.set('perf','off'); return '💫 Full effects on.'; }
  if((m=l.match(/\b(red|orange|yellow|green|teal|cyan|blue|indigo|purple|pink|brown)\b/))&&/(accent|color|colour|theme|make it|highlight)/.test(l)&&!/wallpaper|background/.test(l)){ OS.set('accent',ACCENT[m[1]]); return `Accent color is now **${m[1]}**.`; }
  if(/(wallpaper|background)/.test(l)){
    if(/random|surprise|shuffle|change/.test(l)&&!WALLS.some(w=>l.includes(w))){ const id=pick(WALLS); OS.setWall({type:'preset',id}); return `Wallpaper: **${id}**.`; }
    const id=WALLS.find(w=>l.includes(w)); if(id){ OS.setWall({type:'preset',id}); return `Wallpaper set to **${id}**.`; }
    return {text:'Pick a wallpaper — or upload your own in Settings.',acts:[...WALLS.slice(0,6).map(id=>act(id,()=>OS.setWall({type:'preset',id}))),act('More…',()=>OS.launch('sys:settings',{page:'appearance'}))]};
  }
  if((m=l.match(/\bdock\b.*\b(left|right|bottom)\b|\b(left|right|bottom)\b.*\bdock\b/))){ const p=m[1]||m[2]; OS.set('dockPos',p); return `Dock moved to the **${p}**.`; }
  if(/(hide|auto-?hide) (the )?dock/.test(l)){ OS.set('dockHide',true); return 'Dock will auto-hide. Move your mouse to the screen edge to bring it back.'; }
  if(/(show|always show|unhide) (the )?dock/.test(l)){ OS.set('dockHide',false); return 'Dock is always visible now.'; }
  if(/(bigger|larger|increase).*(dock|icons)/.test(l)){ OS.set('dockSize',Math.min(88,S.settings.dockSize+10)); return 'Dock enlarged.'; }
  if(/(smaller|decrease|shrink).*(dock|icons)/.test(l)){ OS.set('dockSize',Math.max(36,S.settings.dockSize-10)); return 'Dock shrunk.'; }
  if(/(hide|remove) (all )?(the )?widgets/.test(l)&&!/(clock|weather|search|notes?|timer|todo|calendar)/.test(l)){ OS.set('widgetsOn',false); return 'Widgets hidden. Say “show widgets” to bring them back.'; }
  if(/(show|bring back) (all )?(the )?widgets/.test(l)){ OS.set('widgetsOn',true); return 'Widgets are back.'; }
  if(/reset (the )?(desktop|layout)/.test(l)){ OS.wm.resetLayout(); return 'Confirm the reset in the dialog.'; }
  if(/\b(switch|use|make|set|change|show|turn|go)\b.*\b(24[- ]?h(?:ou)?r?s?|military)\b/.test(l)&&!/\bto\s+(min|sec|day|week)/.test(l)){ OS.set('clock24',true); return 'Clock is now 24-hour.'; }
  if(/12\s*-?\s*hour/.test(l)){ OS.set('clock24',false); return 'Clock is now 12-hour.'; }
  if(/(show|display) seconds/.test(l)){ OS.set('clockSec',true); return 'Showing seconds.'; }
  if((m=l.match(/^(?:add|show|put|make|create|new)\s+(?:me\s+)?(?:an?\s+|the\s+)?(.+?)\s+widget$/)||l.match(/^(?:add|put)\s+(?:an?\s+)?widget\s+(?:for\s+)?(.+)$/))){
    const key=m[1], id=Object.keys(WIDGET_ALIASES).find(k=>WIDGET_ALIASES[k].some(a=>key.includes(a)));
    if(id){ const w=OS.widgets.add(id); if(id==='timer'&&/stopwatch/.test(key)) w.opts.mode='stopwatch'; OS.save(); OS.widgets.rerender(w); return `Added a **${OS.widgets.TYPES.find(t=>t.id===id).name}** widget. Drag it, resize from its corner, or right-click to restyle.`; }
    return {text:'Which widget? I have: '+OS.widgets.TYPES.map(t=>t.name).join(', ')+'.',acts:[act('Open widget list',()=>OS.launch('sys:settings',{page:'widgets'}))]};
  }
  if((m=l.match(/^(?:remove|delete|get rid of)\s+(?:the\s+)?(.+?)\s+widget$/))){ const id=Object.keys(WIDGET_ALIASES).find(k=>WIDGET_ALIASES[k].some(a=>m[1].includes(a))), w=id&&widgetOf(id); if(w){ OS.widgets.remove(w); return `Removed the ${m[1]} widget.`; } return 'I couldn’t find that widget.'; }
  if(/^(add|show|list) (the )?widgets?$|what widgets/.test(l)) return {text:'Available widgets: '+OS.widgets.TYPES.map(t=>t.emoji+' '+t.name).join(' · ')+'.\nSay “add a clock widget”, for example.',acts:[act('Add widget…',()=>OS.wm.addWidgetMenu(200,80))]};
});
// folders
on(async(q,l)=>{
  let m=q.match(/^(?:create|make|new|add)\s+(?:a\s+)?(?:new\s+)?folder(?:\s+(?:called|named))?\s+(.+)/i);
  if(m){ const name=m[1].replace(/["“”]/g,'').trim().slice(0,40); const f=OS.makeFolder(name); return {text:`📁 Created folder **${f.name}** on your desktop.`,acts:[act('Open it',()=>OS.wm.openFolder(f.id))]}; }
  m=q.match(/^move\s+(.+?)\s+(?:to|into)\s+(?:the\s+)?(.+?)(?:\s+folder)?$/i);
  if(m){ const a=findApp(m[1]), fs=OS.findFolders(m[2]); if(!a) return `I couldn’t find an app called “${m[1]}”.`; if(!fs.length) return `I couldn’t find a folder called “${m[2]}”. Say “create folder ${m[2]}” first.`; OS.moveApp(a.id,fs[0].id); return `Moved **${a.name}** to **${fs[0].name}**.`; }
  m=l.match(/^(?:delete|remove)\s+(?:the\s+)?folder\s+(.+)/);
  if(m){ const fs=OS.findFolders(m[1]); if(!fs.length) return 'I couldn’t find that folder.'; const f=fs[0]; return {text:`Delete **${f.name}**? Its ${f.items.length} apps move to Utilities.`,acts:[act('Yes, delete',()=>OS.deleteFolder(f.id))]}; }
});
// links -> apps / open url
on(async(q,l)=>{
  let m=q.match(/^(?:add|save|make|create|turn)\s+(?:this\s+|a\s+|an\s+)?(?:link\s+|url\s+|website\s+)?(?:app\s+)?(?:from\s+|for\s+|into an app\s+)?(\S+)(?:\s+(?:as|called|named)\s+(.+))?$/i);
  const direct=OS.normUrl(q.trim());
  const arg=direct?{url:q.trim()}:(m&&OS.normUrl(m[1])?{url:m[1],name:m[2]}:null);
  if(arg){
    if(!direct||/^(add|save|make|create)/i.test(q)){ const a=OS.addLinkApp(arg.url,{name:arg.name}); if(a) return {text:`🔗 Made **${a.name}** an app (in Utilities). Some sites refuse to load inside frames — if it’s blank, use the ↗ button.`,acts:[act('Open '+a.name,()=>OS.launch(a.id)),act('Edit icon…',()=>OS.wm.editAppDialog(a))]}; }
    OS.openUrl(OS.normUrl(arg.url).url); return {text:'Opening the link in a window.',acts:[act('Save as app',()=>OS.wm.addLinkDialog(arg.url))]};
  }
  m=l.match(/^(?:open|go to|visit|browse(?: to)?)\s+(\S+)$/); if(m&&OS.normUrl(m[1])){ OS.openUrl(OS.normUrl(m[1]).url); return 'Opening it in a window.'; }
});
// open / close apps & folders
on(async(q,l)=>{
  let m=l.match(/^(?:close|quit|exit|kill)\s+(?:the\s+)?(.+)$/);
  if(m){ if(/^(all|everything|all windows)$/.test(m[1])){ const n=OS.wins.listAll().length; OS.wins.listAll().forEach(w=>OS.wm.closeWin(w)); return n?`Closed ${n} window${n>1?'s':''}.`:'Nothing is open.'; }
    const a=findApp(m[1]); if(a&&OS.winOf(a.id).length){ OS.closeAppWindows(a.id); return `Closed **${a.name}**.`; } if(a) return `**${a.name}** isn’t open.`; return;
  }
  if(/^(minimi[sz]e all|show desktop|hide all windows)$/.test(l)){ OS.wins.listAll().forEach(w=>OS.wm.minimize(w)); return 'Windows minimized.'; }
  m=l.match(/^(?:open|launch|start|run|play|show|go to|take me to|load)\s+(?:the\s+)?(.+)$/);
  if(m){
    const arg=m[1].replace(/\s+(?:app|game)$/,'');
    if(/^(something|anything|a game|game|games|random|a random game)$/.test(arg)) return null;   // let the recommender handle it
    const fs=/folder|collection|vault/.test(arg)||OS.findFolders(arg.replace(/ folder$/,'')).length&&!findApp(arg)?OS.findFolders(arg.replace(/\s*folder$/,'')):[];
    if(fs.length){ OS.wm.openFolder(fs[0].id); return `Opened **${fs[0].name}**.`; }
    const a=findApp(arg); if(a){ OS.launch(a.id); return {text:`${a.kind==='sys'?'Opening':'Launching'} **${a.name}**${a.tag&&a.kind==='game'?' · '+a.tag:''}.`}; }
    if(/^(my )?(notes|todo|calendar|weather|clock)$/.test(arg)) return {text:'Those live as widgets — add one?',acts:[act('Add '+arg+' widget',()=>AI.send('add a '+arg.replace('my ','')+' widget'))]};
    const sug=OS.findApps(arg,3).concat(OS.allApps().filter(x=>OS.norm(x.name).split(' ').some(w=>w.length>3&&arg.includes(w))).slice(0,3)).filter((x,i,arr)=>arr.indexOf(x)===i).slice(0,4);
    return sug.length?{text:`I couldn’t find “${arg}”. Did you mean:`,acts:sug.map(x=>act(x.emoji+' '+x.name,()=>OS.launch(x.id)))}:`I couldn’t find “${arg}”. Say “list games” to see what’s here, or paste a link to make it an app.`;
  }
});
// recommend
const GENRES=[[/shoot|fps|gun|swat|blast/,['shooters']],[/rac|car|driv|speed|fast/,['racing']],[/puzzle|brain|think|strateg|tactic|2048|logic/,['puzzle']],[/horror|scar|action|advent|platform|fight|dodge|hard/,['action']],[/sandbox|build|explor|chill|relax|calm|sim|space|minecraft/,['sandbox']],[/arcade|retro|classic|many|collection/,['arcade']]];
function recommend(genreText){
  let folders=null; for(const [re,ids] of GENRES) if(re.test(genreText)){ folders=ids; break; }
  let pool=OS.allApps().filter(a=>a.kind==='game'&&!/^mystery/.test(a.id)&&(!folders||folders.includes((OS.folderOf(a.id)||{}).id)));
  if(!pool.length) pool=OS.allApps().filter(a=>a.kind==='game'&&!/^mystery/.test(a.id));
  const sorted=pool.slice().sort((x,y)=>(S.play[x.id]||0)-(S.play[y.id]||0));
  const cand=sorted.slice(0,Math.max(2,Math.ceil(sorted.length/2))).filter(a=>a.id!==lastRec); const a=pick(cand.length?cand:sorted); lastRec=a.id;
  const played=S.play[a.id]||0;
  return {text:`🎮 How about **${a.name}**? ${a.tag?'('+a.tag+') ':''}${played?`You’ve played it for ${OS.fmtDur(played)}.`:'You haven’t tried it yet!'}`,acts:[act('▶ Play '+a.name,()=>OS.launch(a.id)),act('🔀 Another',()=>AI.send('recommend '+(genreText||'a game')))]};
}
on(async(q,l)=>{
  if(/(recommend|suggest|what should i play|something to play|i'?m bored|i am bored|im bored|random game|surprise me|pick a game|play something|play a game|play anything|any good games)/.test(l)) return recommend(l.replace(/.*(recommend|suggest|play)/,''));
});
// stats & library
on(async(q,l)=>{
  if(/(how long|how much time|play ?time|time (have i|i'?ve) (played|spent)|my stats|most played|favou?rite game|what do i play (the )?most)/.test(l)){
    const rows=Object.entries(S.play).map(([id,s])=>[OS.app(id),s]).filter(([a])=>a).sort((a,b)=>b[1]-a[1]), tot=rows.reduce((t,r)=>t+r[1],0);
    if(!rows.length) return 'I haven’t tracked any play time yet — open a game and I’ll start counting (only stored in this browser).';
    return `⏱️ You’ve spent **${OS.fmtDur(tot)}** in apps.\nTop:\n`+rows.slice(0,5).map(([a,s],i)=>`${i+1}. ${a.emoji} **${a.name}** — ${OS.fmtDur(s)}`).join('\n');
  }
  if(/(list|show|what|how many)\s+(of\s+)?(the\s+)?(games|apps)|what('?s| is) (in|here)/.test(l)){
    return OS.folders().filter(f=>f.items.length).map(f=>`${f.emoji} **${f.name}** (${f.items.length}): ${f.items.map(OS.app).filter(Boolean).map(a=>a.name).join(', ')}`).join('\n');
  }
});
// web search
on(async(q,l)=>{
  const m=q.match(/^(?:google|search(?: the web| google| online)?(?: for)?|bing|duckduckgo|look up on google)\s+(.+)/i);
  if(m){ OS.launch('sys:search',{q:m[1],engine:/^bing/i.test(q)?'bing':/^duck/i.test(q)?'ddg':undefined}); return `Searching for “${m[1]}”…`; }
});
// units & math
on(async(q,l)=>{
  const c=convert(q); if(c) return c;
  const expr=l.replace(/^(what('?s| is)|calculate|calc|compute|solve)\s*/,'').replace(/[=?]+$/,'').replace(/×|x(?=\s*\d)/g,'*').replace(/÷/g,'/').replace(/\^/g,'**').trim();
  if(/^[\d\s+\-*/().%]+$/.test(expr)&&/\d/.test(expr)&&/[+\-*/%]/.test(expr)&&!/\*\*/.test(expr)){ try{ const v=OS.calcEval(expr); return `**${expr} = ${+v.toFixed(10)}**`; }catch{} }
});
// fun
on(async(q,l)=>{
  if(/\b(joke|make me laugh|funny)\b/.test(l)) return '😄 '+pick(JOKES);
  if(/(flip|toss)\s+(a\s+)?coin/.test(l)) return '🪙 **'+pick(['Heads','Tails'])+'**!';
  let m=l.match(/roll\s+(?:a\s+|an\s+)?(?:d|die|dice)?\s*(\d+)?/); if(/roll\s+(a\s+)?(d\d+|die|dice)/.test(l)||/^roll$/.test(l)){ const n=parseInt((l.match(/d(\d+)/)||[])[1])||6; return `🎲 **${1+Math.floor(Math.random()*n)}** (d${n})`; }
  m=l.match(/random number(?: between| from)?\s+(-?\d+)\s*(?:and|to|-)\s*(-?\d+)/); if(m){ const a=+m[1], b=+m[2], lo=Math.min(a,b), hi=Math.max(a,b); return `🔢 **${lo+Math.floor(Math.random()*(hi-lo+1))}**`; }
  m=q.match(/^(?:pick|choose|decide)(?: between)?\s+(.+\s+or\s+.+)$/i); if(m){ const o=m[1].split(/\s*(?:,|\bor\b)\s*/i).filter(Boolean); return `I pick **${pick(o)}**.`; }
  if(/^(thanks|thank you|thx|ty)\b/.test(l)) return pick(['Anytime!','You got it.','😎 No problem.']);
  if(/(who (made|built|created) you|what are you)/.test(l)) return 'I’m **AR.OS AI**, the assistant built into this site. I run in your browser — no account, no server — and I can control the OS around me.';
});
// lookups (online)
on(async(q,l)=>{
  let m=q.match(/^(?:define|definition of|meaning of|what does (\w+) mean|what'?s the meaning of)\s*(.*)$/i);
  if(m||/^what does \w+ mean/.test(l)){ const w=((m&&(m[1]||m[2]))||'').replace(/[?.!]/g,'').trim().split(/\s+/)[0]; if(!w) return null;
    if(!online()) return 'Definitions need an online look-up (turned off in Settings → AI).';
    try{ const d=await dictionary(w); if(d) return d; const wk=await wikiSummary(w); if(wk&&OS.norm(wk.title).includes(OS.norm(w))) return `**${wk.title}** — ${wk.text}`; }catch{} return `I couldn’t find “${w}”.`; }
});
async function tryWiki(topic){
  if(!online()) return null;
  try{ const r=await wikiSummary(topic); if(!r) return null;
    const toks=OS.norm(topic).split(' ').filter(t=>t.length>2); if(toks.length&&!toks.some(t=>OS.norm(r.title).includes(t))) return null;
    return {text:`**${r.title}**\n${r.text}\n\n*Source: Wikipedia*`,acts:[act('Read more',()=>OS.openUrl(r.url,{title:r.title}))]}; }catch{ return null; }
}

/* ---------- main entry ---------- */
function ctx(){
  const f=OS.wins.listAll().filter(w=>w.el.classList.contains('focused'))[0];
  return {hp:0,maxHp:250,kc:0,bots:0,gs:'MENU',map:'GRID',wep:'BLASTER',hpPct:0,title:f&&f.appId?f.title:'',activeTab:'games'};
}
AI.respond=async function(raw){
  const q=raw.trim(), l=q.toLowerCase().replace(/[?!.]+$/,'').replace(/\s+/g,' ');
  pend0=pending; pending=null;
  for(const fn of H){ let r; try{ r=await fn(q,l); }catch(e){ console.warn('ai handler',e); } if(r) return typeof r==='string'?{text:r}:r; }
  // knowledge questions: built-in answers first, then Wikipedia
  const knowQ=l.match(/^(?:who|what|where|when|why|how)\b.*|^tell me about\s+(.+)|^explain\s+(.+)/);
  let brain=''; try{ brain=await AROS_BRAIN.process(q,ctx(),S.ai.history.map(m=>({role:m.r==='u'?'user':'assistant',content:m.t}))); }catch{ brain='My brain hiccuped. Try again.'; }
  if(isGeneric(brain)){
    const topic=(l.match(/^(?:who|what)\s+(?:is|are|was|were)\s+(?:an?\s+|the\s+)?(.+)/)||l.match(/^tell me about\s+(.+)/)||l.match(/^explain\s+(.+)/)||[])[1]||(l.split(' ').length<=6?l:'');
    if(topic){ const w=await tryWiki(topic); if(w) return w; }
    if(!online()&&knowQ) return brain+'\n\n(Online look-ups are off — turn them on in Settings → AI for Wikipedia answers.)';
  }
  return {text:brain};
};

/* ---------- mascot (Blob Atelier <agent-mascot>, see os/agent-mascot.js) ---------- */
const MDEF={shape:'kitty',color:'bubblegum',material:'jelly',eyes:'dot',cheeks:true,accessory:'none',accColor:'ink'};
const M=OS.mascot={
  available:()=>!!(window.AgentMascot&&window.customElements&&customElements.get&&customElements.get('agent-mascot')),
  cfg:()=>Object.assign({},MDEF,S.ai.mascot||{}),
  // o: {state, still, size}. Frozen ("still") in Reduced-effects mode so it costs nothing.
  el(o={}){
    if(!M.available()) return h('span',{style:{fontSize:Math.round((o.size||48)*.7)+'px'}},'✨');
    window.AgentMascot.no3D=!!(OS.perf||OS.lowEnd);          // 3D animals need a decent GPU; otherwise they fall back to flat sprites
    const c=M.cfg(), m=document.createElement('agent-mascot');
    m.setAttribute('data-ai','1');
    m.setAttribute('shape',c.shape); m.setAttribute('color',c.color); m.setAttribute('material',c.material); m.setAttribute('eyes',c.eyes);
    m.setAttribute('cheeks',String(!!c.cheeks)); if(c.accessory&&c.accessory!=='none'){ m.setAttribute('accessory',c.accessory); m.setAttribute('acc-color',c.accColor||'ink'); }
    m.setAttribute('state',o.state||'idle');
    if(o.still||OS.perf) m.setAttribute('still','');
    if(o.size){ m.style.width=o.size+'px'; m.style.height=o.size+'px'; }
    return m;
  },
  set(patch){
    const AM=window.AgentMascot, next=Object.assign(M.cfg(),patch), ser=AM.seriesOf(next.shape), mats=AM.SERIES[ser].materials;
    if(!mats.includes(next.material)) next.material=ser==='animals'?'fluffy':'jelly';   // each series has its own materials
    if(ser!=='animals') next.accessory='none';                                      // accessories are 3D-animals only
    S.ai.mascot=next; OS.save(); M.refresh();
  },
  refresh(){
    const c=M.cfg();
    document.querySelectorAll('agent-mascot[data-ai]').forEach(m=>{ if(m.setConfig) m.setConfig({shape:c.shape,color:c.color,material:c.material,eyes:c.eyes,cheeks:c.cheeks,accessory:c.accessory,accColor:c.accColor}); });
  },
  randomize(){
    const AM=window.AgentMascot, pool=(OS.perf||OS.lowEnd)?AM.SHAPES:[...AM.SHAPES,...AM.ANIMALS], shape=pick(pool), ser=AM.seriesOf(shape);
    M.set({shape,color:pick(Object.keys(AM.PALETTE).filter(x=>x!=='ink')),material:pick(AM.SERIES[ser].materials)});
  }
};

/* ---------- UI ---------- */
const mdToHtml=t=>OS.esc(t).replace(/```([\s\S]*?)```/g,'<pre><code>$1</code></pre>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*\n]+)\*/g,'<em>$1</em>').replace(/\n/g,'<br>');
let UI=null;
AI.send=function(text){ if(UI) return UI.send(text); OS.launch('sys:ai',{ask:text}); };
OS.apps.builders.ai=function(a,o){
  const chat=h('div',{class:'chat'}), inp=h('input',{placeholder:'Ask anything, or tell me what to do…',autocomplete:'off',spellcheck:false}), chips=h('div',{class:'chips'});
  let busy=false;
  // mascot header: reacts to what's happening (typing -> listening, working -> thinking, replying -> talking, result -> happy/error)
  const mEl=M.el({size:64}), status=h('small',null,'Ready'); let moodT=0;
  const LABEL={idle:'Ready',listening:'Listening…',thinking:'Thinking…',talking:'Typing…',happy:'Done!',error:'Hmm…',working:'Working…'};
  const mood=(st,ms)=>{ clearTimeout(moodT); if(mEl.setState) mEl.setState(st); status.textContent=LABEL[st]||''; if(ms) moodT=setTimeout(()=>mood('idle'),ms); };
  const hdr=h('div',{class:'ai-hd'},mEl,h('div',null,h('b',null,'AR.OS AI'),status),h('div',{class:'sp'}),h('button',{title:'Change my look',onclick:()=>OS.launch('sys:settings',{page:'ai'})},'🎨'));
  const addMsg=(r,t,acts)=>{ const m=h('div',{class:'msg '+r}); if(r==='u') m.textContent=t; else m.innerHTML=mdToHtml(t); if(acts&&acts.length) m.append(h('div',{class:'acts'},acts.map(x=>h('button',{class:'sbtn pri',onclick:()=>x.run()},x.label)))); chat.append(m); chat.scrollTop=chat.scrollHeight; return m; };
  const reveal=(m,text,acts)=>new Promise(res=>{
    if(OS.perf||text.length<40){ m.innerHTML=mdToHtml(text); finish(); return; }
    let i=0; const step=Math.max(3,Math.ceil(text.length/70)); const t=setInterval(()=>{ i+=step; m.innerHTML=mdToHtml(text.slice(0,i)); chat.scrollTop=chat.scrollHeight; if(i>=text.length){ clearInterval(t); finish(); } },22);
    function finish(){ if(acts&&acts.length) m.append(h('div',{class:'acts'},acts.map(x=>h('button',{class:'sbtn pri',onclick:()=>x.run()},x.label)))); chat.scrollTop=chat.scrollHeight; res(); }
  });
  const save=(r,t)=>{ S.ai.history.push({r,t:t.slice(0,1500)}); S.ai.history=S.ai.history.slice(-60); OS.save(); };
  const send=async text=>{
    text=String(text||'').trim(); if(!text||busy) return; busy=true; inp.value='';
    addMsg('u',text); save('u',text);
    const think=h('div',{class:'msg b typing'},h('i'),h('i'),h('i')); chat.append(think); chat.scrollTop=chat.scrollHeight;
    mood('thinking');
    const t0=Date.now(); let res; try{ res=await AI.respond(text); }catch(e){ res={text:'Something went wrong. Try again.'}; }
    const wait=250-(Date.now()-t0); if(wait>0) await new Promise(r=>setTimeout(r,wait));
    think.remove(); const m=addMsg('b',''); mood('talking');
    await reveal(m,res.text,res.acts); save('b',res.text); busy=false; inp.focus();
    if(/couldn.t|can.t reach|went wrong|don.t have a precise|isn.t valid/i.test(res.text)) mood('error',1800);
    else if(/^(✅|📝|🔗|📁|🎮|⏳|⏰|🚀|💫|🪙|🎲|😄)|(added|created|opened|launching|switched|moved|saved|set to|updated)/i.test(res.text)) mood('happy',2000);
    else mood('idle');
  };
  const SUGGEST=['Recommend a game','What’s the weather?','Timer 5 min','Add a clock widget','Dark mode','Who is Ada Lovelace?','12 miles in km','How long have I played?'];
  chips.append(...SUGGEST.map(s=>h('button',{onclick:()=>send(s)},s)));
  inp.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter') send(inp.value); });
  inp.addEventListener('input',()=>{ if(!busy) mood(inp.value?'listening':'idle',inp.value?4000:0); });
  if(S.ai.history.length) S.ai.history.forEach(m=>addMsg(m.r,m.t)); else addMsg('b',`Hi${nameP()}! I’m **AR.OS AI**. I can open apps, recommend games, change how the OS looks, add widgets, set timers, check the weather, and answer questions. Try one of the suggestions below, or type **help**.`);
  AI.onClear=()=>{ chat.replaceChildren(); addMsg('b','Chat cleared.'); };
  UI={send}; if(o.ask) setTimeout(()=>send(o.ask),150);
  setTimeout(()=>inp.focus(),80);
  return { title:'AR.OS AI', body:[hdr,chat,chips,h('div',{class:'cin'},inp,h('button',{class:'pill',style:{borderRadius:'999px',padding:'0 18px'},onclick:()=>send(inp.value)},'Send'))], w:460, h:620, minW:340, minH:360, sizeKey:'sys:ai',
    tools:[{label:'🗑',title:'Clear chat',run:()=>AI.respond('/clear').then(r=>{ AI.onClear&&AI.onClear(); })}],
    api:{ again:o2=>{ if(o2.ask) send(o2.ask); } }, onClose:()=>{ UI=null; } };
};
})();
