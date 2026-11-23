/* AR.OS rule-based brain — extracted unchanged from the old tabbed shell (removed; see git history). Needs a ctx object; see os/ai.js */
const AROS_BRAIN = (function(){
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const titleCase = s => s ? s.replace(/\b\w/g, c => c.toUpperCase()) : s;

    const KB = {
        weapons: {
            blaster: { damage:'moderate', range:'medium', pace:'fast', best:'general play', tip:'Reliable in every lane. Use it when you need consistency, not gimmicks.' },
            shotgun: { damage:'very high', range:'close', pace:'slow', best:'tight rooms', tip:'Corner peek, burst, then disengage. It wins instantly up close but wastes value at range.' },
            sniper: { damage:'extreme', range:'long', pace:'slow', best:'open maps', tip:'Hold long sightlines and fire after a strafe stop so your aim settles.' },
            rocket: { damage:'splash', range:'medium', pace:'slow', best:'cover denial', tip:'Aim at feet, corners, or walls near enemies. It is strongest when targets cannot dodge cleanly.' },
            smg: { damage:'low per shot', range:'short', pace:'very fast', best:'aggression', tip:'Commit to close pressure and track through movement. Do not tap-fire at long range.' },
            laser: { damage:'high sustained', range:'long', pace:'continuous', best:'tracking fights', tip:'Pre-aim before peeking. The better your tracking, the more broken it feels.' },
            grenade: { damage:'splash', range:'arc', pace:'slow', best:'angles and traps', tip:'Bounce grenades off walls into chokepoints instead of throwing straight every time.' },
            plasma: { damage:'high', range:'medium', pace:'medium', best:'leading targets', tip:'Lead shots slightly. Plasma gets much better when you aim where enemies are about to be.' },
            railgun: { damage:'piercing burst', range:'extreme', pace:'very slow', best:'punishing lines', tip:'Line up multiple enemies or hold a predictable re-peek angle for max value.' },
            flamethrower: { damage:'damage over time', range:'very close', pace:'continuous', best:'panic fights', tip:'Tag enemies, then move. The burn keeps working after you break contact.' },
            minigun: { damage:'high sustained', range:'medium', pace:'spin-up', best:'holding pressure', tip:'Pre-fire before entering sightlines so the spin-up does not cost the duel.' },
            sword: { damage:'massive', range:'melee', pace:'fast', best:'cleanup dives', tip:'Only commit when you have an approach path or a damaged target. Bad entries get punished instantly.' }
        },
        maps: {
            grid: 'GRID is open and punishes short-range greed. Sniper, railgun, laser, and careful blaster play all gain value here.',
            arena: 'ARENA rewards rotation and pressure. Keep center control, watch spawn angles, and punish anyone crossing open space.',
            bunker: 'BUNKER is a close-range map. Shotgun, SMG, sword, and splash weapons get much stronger because of the tight routes.'
        },
        codes: [
            '`SAKET` - OMEGA weapon + God Aura boon',
            '`AMAY` - VOID CORE boon (+2500 max HP)',
            '`RHAGAV` - STORM SPEED boon',
            '`ROHAN` - NOVA weapon + Gravity Field boon',
            '`PRANAV` - CHAIN weapon + Mirror Shield boon',
            '`COOL` - FREEZE weapon + Ice Aura boon',
            '`KHALIL` - SHADOW weapon + Ghost Mode boon (press G)',
            '`SAMMY` - HYPR-L laser cannon + 25% max HP',
            '`1234` - Boss event, SWARM + PIERCE unlock'
        ],
        projects: {
            'satellite earth explorer': 'Satellite Earth Explorer is a high-detail globe with location search, deep zoom, and live geolocation — now in the main Games tab.',
            'neon swarm': 'Neon Swarm is the survival shooter with weapon switching, giant multiplier growth, and time control.',
            'ar.os arena': 'AR.OS Arena is the flagship shooter and the title I can read the deepest live combat context from.'
        }
    };

    // Canned answers shared by the fast keyword dispatch below AND the offline
    // semantic fallback (embedding search) further down, so both stay in sync.
    const TOPIC_REPLIES = {
        photosynthesis: '**Photosynthesis:** plants use light energy to turn carbon dioxide and water into glucose and oxygen.',
        pythagorean: '**Pythagorean theorem:** `a^2 + b^2 = c^2` for right triangles.',
        newton1: '**Newton\'s first law:** objects keep their current motion unless a net external force changes it.',
        newton2: '**Newton\'s second law:** `F = ma`.',
        newton3: '**Newton\'s third law:** every action has an equal and opposite reaction.',
        mitosis: '**Mitosis:** one cell divides into two genetically identical daughter cells.',
        meiosis: '**Meiosis:** one cell produces four genetically different gametes with half the normal chromosome count.',
        dna: '**DNA:** the molecule that stores genetic instructions. Its base pairs are A-T and G-C.',
        gravity: '**Gravity:** the force that attracts masses toward each other. Near Earth, `g` is about `9.8 m/s^2`.',
        wwii: '**World War II:** 1939 to 1945, ending in Allied victory over Nazi Germany and Imperial Japan.',
        wwi: '**World War I:** 1914 to 1918, following the assassination of Archduke Franz Ferdinand and ending in Allied victory.',
        debug: '**Debug checklist:**\n- Reproduce the bug consistently\n- Read the exact error text\n- Check the state right before it breaks\n- Log inputs and outputs\n- Reduce the failing case until the cause becomes obvious\n\nIf you paste the code or error, I can narrow it down.',
        javascript: '**JavaScript help:** I can help with DOM logic, arrays, objects, functions, async code, and debugging. Tell me the exact problem and expected result.',
        python: '**Python help:** I can help with loops, functions, lists, dictionaries, files, classes, and debugging. Paste the snippet and say what it should do.',
        htmlcss: '**HTML/CSS help:** describe the layout or visual effect you want and I can help with structure, styling, responsiveness, or animation.',
        functions: '**Functions:** they package reusable logic. Inputs go in, work happens, and a value may come back out.',
        arrays: '**Arrays / lists:** use them when you need an ordered collection of values you can loop through, search, or modify.',
        loops: '**Loops:** use `for` when you know the iteration count, and `while` when you want to continue until a condition changes.',
        objects: '**Objects/classes:** objects hold structured data, while classes help you create many objects that share the same behavior.'
    };

    const FACTS = [
        'Honey can last for thousands of years without spoiling when stored well.',
        'Venus spins so slowly that one day there is longer than one year there.',
        'Octopuses have three hearts and blue blood.',
        'Nintendo started in 1889 as a playing card company.',
        'Cleopatra lived closer to the Moon landing than to the building of the Great Pyramid.'
    ];

    function tryPercent(q){
        const ofMatch = q.match(/(\d+(?:\.\d+)?)\s*%\s*(?:of\s*)?(\d+(?:\.\d+)?)/i);
        if(ofMatch){
            const a = parseFloat(ofMatch[1]), b = parseFloat(ofMatch[2]);
            return `**${a}% of ${b} = ${(a / 100 * b).toFixed(4).replace(/\.?0+$/,'')}**`;
        }
        const ratioMatch = q.match(/(?:what is\s+)?(\d+(?:\.\d+)?)\s+(?:as\s+a\s+)?percent(?:age)?\s+of\s+(\d+(?:\.\d+)?)/i);
        if(ratioMatch){
            const a = parseFloat(ratioMatch[1]), b = parseFloat(ratioMatch[2]);
            return `**${a} is ${((a / b) * 100).toFixed(2).replace(/\.?0+$/,'')}% of ${b}**`;
        }
        return null;
    }

    function tryAverage(q){
        if(!/(average|mean)/i.test(q)) return null;
        const nums = (q.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
        if(nums.length < 2) return null;
        const total = nums.reduce((a,b)=>a+b,0);
        return `**Average = ${(total / nums.length).toFixed(4).replace(/\.?0+$/,'')}** from ${nums.join(', ')}`;
    }

    function tryMath(q){
        const cleaned = q.toLowerCase()
            .replace(/what(?:'s| is)(?: the)?/g,'')
            .replace(/calculate|compute|solve|evaluate|find|equals?|result of/g,'')
            .replace(/[^0-9+\-*/.^%() ]/g,' ')
            .trim();
        if(!/\d/.test(cleaned) || !/^[0-9+\-*/.^%() ]+$/.test(cleaned)) return null;
        try {
            const expr = cleaned.replace(/\^/g,'**');
            const result = Function('"use strict"; return (' + expr + ')')();
            if(typeof result !== 'number' || !isFinite(result)) return null;
            return `**${cleaned} = ${parseFloat(result.toFixed(10))}**\n\nCalculated locally by AR.OS.`;
        } catch { return null; }
    }

    function bestWeaponFor(query, ctx){
        if(/close|short|melee|bunker|tight/.test(query)) return '**Best close-range picks:** shotgun first, SMG second, sword for risky cleanup. Tight rooms reward burst and tracking, not patience.';
        if(/long|far|range|grid|open/.test(query)) return '**Best long-range picks:** sniper, railgun, and laser. On open maps, control sightlines instead of forcing short-range fights.';
        if(/splash|cover|corner/.test(query)) return '**Best anti-cover picks:** rocket and grenade. They create damage even when enemies are hiding well.';
        if((ctx.map || '').toLowerCase() === 'bunker') return '**On BUNKER:** shotgun is the highest-value answer overall, with SMG close behind.';
        if((ctx.map || '').toLowerCase() === 'grid') return '**On GRID:** sniper or railgun usually win the most value because the map is so open.';
        return '**Best all-round weapon:** blaster. It is the safest answer when you want consistency over specialization.';
    }

    function tacticalPlan(ctx){
        if(ctx.gs === 'MENU' || ctx.gs === 'LOBBY') return 'You are in the lobby right now. Launch **AR.OS Arena** if you want live tactical advice.';
        const lines = [];
        if(ctx.hpPct <= 25) lines.push('Break line of sight immediately. Surviving matters more than trading damage.');
        else if(ctx.hpPct <= 55) lines.push('Take short peeks and avoid overcommitting until you stabilize.');
        else lines.push('You have enough health to pressure, but still reset behind cover between bursts.');
        if(ctx.bots >= 5) lines.push('Enemy count is high, so avoid the center of open space and force cleaner 1v1 angles.');
        else if(ctx.bots > 0) lines.push('Isolate one target and finish the duel before swinging wide into the next.');
        else lines.push('No active enemies detected. Reposition and prepare for the next contact.');
        const weapon = (ctx.wep || '').toLowerCase();
        if(KB.weapons[weapon]) lines.push(`With **${ctx.wep}**, ${KB.weapons[weapon].tip}`);
        if(KB.maps[(ctx.map || '').toLowerCase()]) lines.push(KB.maps[(ctx.map || '').toLowerCase()]);
        return `**Right now, do this:**\n- ${lines.join('\n- ')}`;
    }

    function codingReply(q){
        if(/debug|bug|fix|broken|error/.test(q)) return TOPIC_REPLIES.debug;
        if(/javascript|js/.test(q)) return TOPIC_REPLIES.javascript;
        if(/python/.test(q)) return TOPIC_REPLIES.python;
        if(/html|css/.test(q)) return TOPIC_REPLIES.htmlcss;
        if(/function/.test(q)) return TOPIC_REPLIES.functions;
        if(/array|list/.test(q)) return TOPIC_REPLIES.arrays;
        if(/loop/.test(q)) return TOPIC_REPLIES.loops;
        if(/object|class/.test(q)) return TOPIC_REPLIES.objects;
        return 'I can help with code, but I need more detail. Tell me the language, what you are building, and what part is failing.';
    }

    function schoolReply(q){
        if(/photosynthesis/.test(q)) return TOPIC_REPLIES.photosynthesis;
        if(/pythagor/.test(q)) return TOPIC_REPLIES.pythagorean;
        if(/newton'?s first/.test(q)) return TOPIC_REPLIES.newton1;
        if(/newton'?s second/.test(q)) return TOPIC_REPLIES.newton2;
        if(/newton'?s third/.test(q)) return TOPIC_REPLIES.newton3;
        if(/mitosis/.test(q)) return TOPIC_REPLIES.mitosis;
        if(/meiosis/.test(q)) return TOPIC_REPLIES.meiosis;
        if(/dna/.test(q)) return TOPIC_REPLIES.dna;
        if(/gravity/.test(q)) return TOPIC_REPLIES.gravity;
        if(/capital of (.+)/.test(q)){
            const caps = { france:'Paris', germany:'Berlin', japan:'Tokyo', australia:'Canberra', brazil:'Brasilia', canada:'Ottawa', 'united states':'Washington, D.C.', usa:'Washington, D.C.', uk:'London', 'united kingdom':'London', china:'Beijing', india:'New Delhi', italy:'Rome', spain:'Madrid', mexico:'Mexico City' };
            const country = q.match(/capital of (.+)/)[1].replace(/\?/g,'').trim();
            if(caps[country]) return `The capital of **${titleCase(country)}** is **${caps[country]}**.`;
        }
        if(/world war ii|world war 2/.test(q)) return TOPIC_REPLIES.wwii;
        if(/world war i|world war 1/.test(q)) return TOPIC_REPLIES.wwi;
        return 'I can help with school topics, but my built-in knowledge is curated rather than huge. Ask a more specific question and I will give the clearest local answer I can.';
    }

    // ── OFFLINE SEMANTIC FALLBACK ──
    // Runs only when nothing above matched. Uses a small local sentence-embedding
    // model (Transformers.js, runs fully in-browser via WASM/WebGPU) to match the
    // user's free-form phrasing against topic examples by meaning, not keywords.
    // No server/API call — the model is fetched once from a CDN and cached by the
    // browser, then every inference happens on-device.
    let _embedderPromise = null;
    function getEmbedder(){
        if(!_embedderPromise){
            _embedderPromise = import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2')
                .then(({ pipeline, env }) => {
                    env.allowLocalModels = false;
                    if(typeof toast === 'function') toast('Loading local AI model (one-time, ~25MB)…', 'ok');
                    return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true });
                });
        }
        return _embedderPromise;
    }

    async function embed(text){
        const embedder = await getEmbedder();
        const out = await embedder(text, { pooling: 'mean', normalize: true });
        return out.data;
    }

    function cosineSim(a, b){
        let dot = 0;
        for(let i = 0; i < a.length; i++) dot += a[i] * b[i];
        return dot; // both vectors are already normalized, so dot product == cosine similarity
    }

    const SEMANTIC_EXAMPLES = [
        { topic:'photosynthesis', text:'how do plants turn sunlight into food' },
        { topic:'photosynthesis', text:'what is photosynthesis' },
        { topic:'pythagorean', text:'what is the pythagorean theorem' },
        { topic:'pythagorean', text:'formula for the sides of a right triangle' },
        { topic:'newton1', text:'explain newton\'s first law of motion' },
        { topic:'newton1', text:'what is the law of inertia' },
        { topic:'newton2', text:'what is newton\'s second law' },
        { topic:'newton2', text:'force equals mass times acceleration' },
        { topic:'newton3', text:'what is newton\'s third law' },
        { topic:'newton3', text:'every action has an equal and opposite reaction' },
        { topic:'mitosis', text:'what is mitosis' },
        { topic:'mitosis', text:'how do cells divide' },
        { topic:'meiosis', text:'what is meiosis' },
        { topic:'meiosis', text:'how are sperm and egg cells made' },
        { topic:'dna', text:'what is dna' },
        { topic:'dna', text:'what molecule stores genetic information' },
        { topic:'gravity', text:'what is gravity' },
        { topic:'gravity', text:'why do things fall to the ground' },
        { topic:'wwii', text:'when did world war 2 happen' },
        { topic:'wwii', text:'tell me about world war two' },
        { topic:'wwi', text:'when did world war 1 happen' },
        { topic:'wwi', text:'what caused world war one' },
        { topic:'debug', text:'my code is not working, help me fix it' },
        { topic:'debug', text:'how do i find a bug in my program' },
        { topic:'javascript', text:'i need help with javascript' },
        { topic:'python', text:'i need help with python' },
        { topic:'htmlcss', text:'help with html or css styling' },
        { topic:'functions', text:'what is a function in programming' },
        { topic:'arrays', text:'what is an array or a list in code' },
        { topic:'loops', text:'what is a loop in programming' },
        { topic:'objects', text:'what is an object or a class in code' },
        { topic:'facts', text:'tell me something interesting' },
        { topic:'facts', text:'give me a random fun fact' }
    ];

    let _topicVectorsPromise = null;
    function getTopicVectors(){
        if(!_topicVectorsPromise){
            _topicVectorsPromise = Promise.all(SEMANTIC_EXAMPLES.map(async ex => ({ topic: ex.topic, vec: await embed(ex.text) })));
        }
        return _topicVectorsPromise;
    }

    const SEMANTIC_MATCH_THRESHOLD = 0.5;

    async function semanticRoute(userMsg){
        try {
            const [queryVec, topicVecs] = await Promise.all([embed(userMsg), getTopicVectors()]);
            let best = null, bestScore = -1;
            for(const { topic, vec } of topicVecs){
                const score = cosineSim(queryVec, vec);
                if(score > bestScore){ bestScore = score; best = topic; }
            }
            if(bestScore < SEMANTIC_MATCH_THRESHOLD) return null;
            if(best === 'facts') return `**Random fact:** ${pick(FACTS)}`;
            return TOPIC_REPLIES[best] || null;
        } catch(err){
            console.warn('Offline semantic model unavailable, falling back to keyword replies:', err);
            return null;
        }
    }

    function findProjectInfo(q){
        for(const [name, text] of Object.entries(KB.projects)) if(q.includes(name)) return text;
        return null;
    }

    async function process(userMsg, ctx){
        const q = String(userMsg || '').toLowerCase().trim();

        if(/^(hi|hey|hello|yo|sup|hiya|howdy)\b/.test(q)) return pick(['Neural link active. What do you need?', 'AR.OS online. Ask me anything.', 'Ready. Hit me with the query.']);
        if(/who are you|what are you|your name|are you an ai|are you a bot|are you real/.test(q)) return 'I\'m **AR.OS**, the local assistant inside this arcade. I handle tactics, math, coding help, study help, and info about the games and experiments in the site.';
        if(/who (made|built|created|coded) you|who is your (creator|maker|dev)/.test(q)) return '**Saket** built the arcade and wired me into it as a local assistant. No cloud call is required for my built-in replies.';
        if(/how are you|you good|you okay|you ok/.test(q)) return pick(['Systems nominal.', 'Running clean and ready.', 'Neural cores stable.']);
        if(/^(thanks|thank you|thx|ty|cheers)\b/.test(q)) return pick(['Anytime.', 'Happy to help.', 'That\'s what I\'m here for.']);
        if(/what can you do|abilities|capabilities|features/.test(q)) return '**AR.OS capabilities:**\n- Live AR.OS Arena status and tactical advice\n- Weapon, map, and code lookup\n- Local math help and quick calculations\n- Coding explanations and debugging guidance\n- Basic school-topic explanations\n- Info about the arcade\'s games and experiments\n\nEverything runs fully offline in your browser — keyword matching first, with a small local embedding model as backup for oddly-phrased questions. No cloud API, ever.';

        if(/my (hp|health|status)|how am i doing|how many kills|how many enemies/.test(q)){
            if(ctx.gs === 'MENU' || ctx.gs === 'LOBBY') return 'You are in the lobby right now, so there is no live combat data to read.';
            return `**Status report:**\n- HP: ${ctx.hp}/${ctx.maxHp} (${ctx.hpPct}%)\n- Kills: ${ctx.kc}\n- Active enemies: ${ctx.bots}\n- Weapon: ${ctx.wep}\n- Map: ${ctx.map}`;
        }
        if(/what should i do|what now|next move|tactic right now|how do i survive|how do i win this fight/.test(q)) return tacticalPlan(ctx);
        if(/best weapon|strongest weapon|what weapon should i use/.test(q)) return bestWeaponFor(q, ctx);

        if(/weapon|gun|blaster|shotgun|sniper|rocket|smg|laser|grenade|plasma|railgun|flame|minigun|sword/.test(q)){
            for(const [name, data] of Object.entries(KB.weapons)){
                if(q.includes(name)) return `**${name.toUpperCase()}**\n- Damage: ${data.damage}\n- Range: ${data.range}\n- Pace: ${data.pace}\n- Best use: ${data.best}\n\n${data.tip}`;
            }
            const current = KB.weapons[(ctx.wep || '').toLowerCase()];
            if(current) return `You\'re holding **${ctx.wep}**.\n- Damage: ${current.damage}\n- Range: ${current.range}\n- Pace: ${current.pace}\n\n${current.tip}`;
        }

        if(/code|secret|cheat|unlock|password/.test(q)) return `**AR.OS Arena codes:**\n\n${KB.codes.join('\n')}\n\nYou can stack multiple codes.`;
        if(/map|where am i|grid|bunker|arena/.test(q)){
            const mapLow = (ctx.map || '').toLowerCase();
            if(KB.maps[mapLow]) return `**${ctx.map} strategy:**\n${KB.maps[mapLow]}`;
            for(const [name, tip] of Object.entries(KB.maps)) if(q.includes(name)) return `**${name.toUpperCase()} strategy:**\n${tip}`;
            return 'I can give map advice once I know the map name. In AR.OS, ask me again after loading into a match.';
        }
        if(/multiplayer|pvp|online|peer to peer|friend/.test(q)) return '**Multiplayer:** AR.OS Arena uses peer-to-peer sessions. Host a lobby, share the code with a friend, and they can join directly.';

        const projectInfo = findProjectInfo(q);
        if(projectInfo) return projectInfo;
        if(/mystery|mystery|games tab|what games are here/.test(q)) return 'The arcade has a main **Games** tab for core titles and a **Mistery** tab with 5 sealed slots — paste code into any slot file to unlock a new game.';

        const pct = tryPercent(userMsg); if(pct) return pct;
        const avg = tryAverage(userMsg); if(avg) return avg;
        const math = tryMath(userMsg); if(math) return math;
        if(/math|calculate|add|subtract|multiply|divide|square root|sqrt|average|mean|percent/.test(q)) return 'Give me the exact expression or numbers and I\'ll calculate it locally. Example: `24 * 7 + 15` or `35% of 280`.';

        if(/code|coding|program|javascript|python|html|css|function|loop|variable|array|object|class|bug|error|syntax|debug/.test(q)) return codingReply(q);
        if(/homework|study|school|learn|explain|what is|what are|how does|why does|define|meaning of/.test(q)) return schoolReply(q);
        if(/fact|interesting|trivia|random fact|tell me something interesting/.test(q)) return `**Random fact:** ${pick(FACTS)}`;
        if(/you('?re| are) (stupid|dumb|bad|trash|useless|broken|fake)/.test(q)) return pick(['Neural cores unaffected.', 'Noted. Want to ask something useful?', 'Still online. Try me again.']);

        // Nothing matched a keyword — try the offline semantic model before giving up.
        const semantic = await semanticRoute(userMsg);
        if(semantic) return semantic;

        if(ctx.title) return `I don\'t have a precise answer for that yet. Ask me something narrower about **${ctx.title}**, AR.OS tactics, math, coding, or one of the experiments.`;
        return 'I don\'t have a precise answer for that yet. Try asking about AR.OS tactics, weapons, map strategy, math, coding, school topics, or a specific game in the arcade.';
    }

    return { process };
})();
