/* The picture-built game recipes (decision 0056): Create's Phase 1 menus as data, and the pure logic that turns a kid's picks into a game
   in the Orlis.play vocabulary - no AI, no free text, no DOM.

     choices                 the menus the screens show (how, what, where, move, rules)
     defaultPicks()          a first pick, so a game runs from the first second
     build(picks)            -> a game description for Orlis.play (always passes games/play/validate.js)
     suggestNames(picks)     -> 3 short names, from fixed word lists
     sentence(picks)         -> the one line under the preview
     voice(picks, phrase)    -> { picks, changed: ['Faster'] } or { picks, changed: [], unknown: true }; a fixed phrase map
     VOICE_PHRASES           what voice() knows, for the screen to show

   picks = { how, what, where, move, speed 0..4, many 0..4, size 0..4, minutes 1|2|3, mode, golden, bomb, name? } */
import { LIMITS } from '../games/play/vocabulary.js';
import { SCENES } from '../games/assets/scenes.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lim = (key, v) => clamp(v, LIMITS[key][0], LIMITS[key][1]);
const round3 = (v) => Math.round(v * 1000) / 1000;

/* ---------- the menus ---------- */
const HOW = [
  { id: 'catch', label: 'Catch', line: 'They fall; catch them', icon: 'catch', verb: 'Catch', word: 'Catch', alsoCalled: ['Rain', 'Shower'] },
  { id: 'pop', label: 'Pop', line: 'They float up; pop them', icon: 'pop', verb: 'Pop', word: 'Pop', alsoCalled: ['Party', 'Burst'] },
  { id: 'dodge', label: 'Dodge', line: 'Watch out!', icon: 'dodge', verb: 'Dodge', word: 'Dodge', alsoCalled: ['Dash', 'Storm'] },
  { id: 'collect', label: 'Collect', line: 'Get them all', icon: 'collect', verb: 'Collect', word: 'Collect', alsoCalled: ['Hunt', 'Treasure'] },
  { id: 'keepup', label: 'Keep it up', line: "Don't let it drop", icon: 'keepup', verb: 'Keep', word: 'Keep Up', alsoCalled: ['Bounce', 'Juggle'], noSpecials: true }
];

/* [id, singular, plural]: pieces that look right falling, floating or bouncing; all from the library, all kid-friendly */
const P = (id, one, many) => ({ id, label: one || id[0].toUpperCase() + id.slice(1), plural: many || (one || id).toLowerCase() + 's' });
const WHAT = [
  { id: 'food', label: 'Food', pieces: [P('apple'), P('pear'), P('strawberry', 'Strawberry', 'strawberries'), P('banana'), P('orange'), P('cherry', 'Cherry', 'cherries'), P('cupcake'), P('cookie'), P('lollipop'), P('icecream', 'Ice cream', 'ice creams')] },
  { id: 'animals', label: 'Animals', pieces: [P('bee'), P('bumblebee', 'Bumblebee'), P('butterfly', 'Butterfly', 'butterflies'), P('bird'), P('ladybug'), P('fish', 'Fish', 'fish'), P('frog'), P('duck'), P('bunny', 'Bunny', 'bunnies')] },
  { id: 'sky', label: 'Sky', pieces: [P('star'), P('glowstar', 'Glow star', 'glow stars'), P('moon'), P('sun'), P('cloud'), P('snowflake'), P('raindrop'), P('feather'), P('kite')] },
  { id: 'toys', label: 'Toys', pieces: [P('balloon'), P('beachball', 'Beach ball', 'beach balls'), P('soccerball', 'Soccer ball', 'soccer balls'), P('basketball', 'Basketball'), P('volleyball', 'Volleyball'), P('teddy', 'Teddy', 'teddies'), P('block'), P('dice', 'Dice', 'dice'), P('gift'), P('heart')] },
  { id: 'nature', label: 'Nature', pieces: [P('mapleleaf', 'Maple leaf', 'maple leaves'), P('leaf', 'Leaf', 'leaves'), P('flower'), P('sunflower'), P('tulip'), P('mushroom'), P('shell'), P('egg'), P('seedling')] }
];
const PIECES = WHAT.flatMap(c => c.pieces.map(p => ({ ...p, category: c.id })));
const piece = (id) => PIECES.find(p => p.id === id);

const WORLD_WORDS = {   /* the sentence's name for the place, and an adjective for names */
  meadow: ['sunny meadow', 'Sunny'], sunset: ['evening sky', 'Evening'], autumn: ['autumn afternoon', 'Autumn'], night: ['starry night', 'Starry'], snow: ['snowy hills', 'Snowy'], beach: ['sunny beach', 'Beachy']
};
const WHERE = ['meadow', 'night', 'beach', 'snow', 'sunset', 'autumn'].map(id => ({ id, label: SCENES[id].name, palette: !SCENES[id].legacy }));

const MOVE_WORDS = { reach: 'reaching up', wave: 'waving', squat: 'squatting', jump: 'jumping' };
const MOVES = [{ id: 'reach', label: 'Reach up', icon: 'reach' }, { id: 'wave', label: 'Wave', icon: 'wave' }, { id: 'squat', label: 'Squat', icon: 'squat' }, { id: 'jump', label: 'Jump', icon: 'jump' }];

const STEPS = 5;
export const choices = {
  how: HOW.map(({ id, label, line, icon, noSpecials }) => ({ id, label, line, icon, specials: !noSpecials })),
  what: WHAT.map(c => ({ id: c.id, label: c.label, pieces: c.pieces.map(p => ({ ...p })) })),
  where: WHERE,
  move: MOVES,
  /* the rules: speed and how many are 5 steps (0 to 4), round length is minutes */
  rules: {
    speed: { steps: STEPS, labels: ['Snail', 'Slow', 'Medium', 'Quick', 'Rocket'], icons: ['snail', 'rocket'] },
    many: { steps: STEPS, labels: ['A few', 'Some', 'Quite a lot', 'Lots', 'Loads'], icons: ['few', 'lots'] },
    size: { steps: STEPS, labels: ['Tiny', 'Small', 'Medium', 'Big', 'Huge'], voiceOnly: true },
    minutes: { options: [1, 2, 3] },
    mode: [{ id: 'together', label: 'Together', icon: 'together' }, { id: 'versus', label: 'Who wins?', icon: 'versus' }],
    specials: [{ id: 'golden', label: 'Golden one', line: 'worth 5', icon: 'golden' }, { id: 'bomb', label: 'A bomb', line: 'to avoid', icon: 'bomb' }]
  }
};

/* ---------- picks ---------- */
export const defaultPicks = () => ({ how: 'catch', what: 'apple', where: 'meadow', move: 'reach', speed: 2, many: 2, size: 2, minutes: 1, mode: 'together', golden: true, bomb: false });
const step = (v, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? clamp(n, 0, STEPS - 1) : d; };
/* any picks (even half empty or wrong) -> whole, valid picks */
export function clean(p = {}){
  const d = defaultPicks();
  return {
    how: HOW.some(h => h.id === p.how) ? p.how : d.how, what: piece(p.what) ? p.what : d.what, where: WHERE.some(w => w.id === p.where) ? p.where : d.where,
    move: MOVES.some(m => m.id === p.move) ? p.move : d.move, speed: step(p.speed, d.speed), many: step(p.many, d.many), size: step(p.size, d.size),
    minutes: [1, 2, 3].includes(p.minutes) ? p.minutes : d.minutes, mode: p.mode === 'versus' ? 'versus' : 'together', golden: p.golden === undefined ? d.golden : !!p.golden, bomb: p.bomb === undefined ? d.bomb : !!p.bomb,
    ...(typeof p.name === 'string' && p.name.trim() ? { name: p.name.trim().slice(0, 24) } : {})
  };
}
const how = (p) => HOW.find(h => h.id === p.how);
const specialsOn = (p) => !how(p).noSpecials;

/* ---------- names and the sentence ---------- */
const title = (s) => s.replace(/\b[a-z]/g, c => c.toUpperCase());
const cut = (s) => { s = s.trim(); if (s.length <= 24) return s; const w = s.split(' '); while (w.length > 1 && w.join(' ').length > 24) w.pop(); return w.join(' ').slice(0, 24); };

export function suggestNames(picks){
  const p = clean(picks), h = how(p), it = piece(p.what), one = title(it.label), many = title(it.plural);
  const lead = p.golden && specialsOn(p) ? 'Golden' : WORLD_WORDS[p.where][1];
  const out = [`${one} ${h.word}`, `${one} ${h.alsoCalled[0]}`, `${lead} ${many}`, `${many} ${h.alsoCalled[1]}`].map(cut);
  return [...new Set(out)].slice(0, 3);
}

export function sentence(picks){
  const p = clean(picks), h = how(p), it = piece(p.what), world = WORLD_WORDS[p.where][0], by = MOVE_WORDS[p.move];
  const lead = p.how === 'keepup' ? `Keep the ${it.label.toLowerCase()} up` : `${h.verb} the ${it.plural}`;
  const g = p.golden && specialsOn(p), b = p.bomb && specialsOn(p);
  const extra = g && b ? ', with a golden one worth 5, and a bomb to avoid' : g ? ', with a golden one worth 5' : b ? ', with a bomb to avoid' : '';
  return `${lead} in the ${world} by ${by}${extra}. ${p.mode === 'together' ? 'Play together.' : 'Who gets the most?'}`;
}

/* ---------- build: picks -> an Orlis.play description ---------- */
/* what each step means for each recipe (all inside the vocabulary's LIMITS) */
const SPEED = { fall: [0.06, 0.085, 0.11, 0.15, 0.2], rise: [0.06, 0.085, 0.11, 0.15, 0.2], drift: [0.06, 0.09, 0.12, 0.17, 0.23] };
const EVERY = { catch: [1.8, 1.3, 0.95, 0.7, 0.5], pop: [1.5, 1.1, 0.8, 0.6, 0.45], dodge: [2.2, 1.6, 1.2, 0.9, 0.65], collect: [1.6, 1.2, 0.9, 0.7, 0.5] };
const MAX = { catch: [4, 6, 8, 11, 14], pop: [4, 6, 9, 12, 16], dodge: [3, 4, 6, 8, 10], collect: [3, 5, 7, 10, 14] };
const SIZE = [0.06, 0.075, 0.095, 0.12, 0.15];
const LIFE = [9, 7, 5.5, 4, 3];            /* collect: how long a thing waits before it goes (speed) */
const BALLS = [1, 1, 2, 2, 3];             /* keep it up: how many balls (how many) */
const BALL_SIZE = [1.25, 1.1, 1, 0.9, 0.8]; /* keep it up: a faster game is a smaller ball (speed) */
const HINT = { catch: 'Catch the', pop: 'Pop the', dodge: 'Dodge the', collect: 'Collect the' };

export function build(picks){
  const p = clean(picks), it = piece(p.what), size = SIZE[p.size];
  const names = suggestNames(p), game = {
    title: p.name || names[0], secs: lim('secs', p.minutes * 60), scene: p.where,
    hint: p.how === 'keepup' ? 'Keep it up!' : `${HINT[p.how]} ${it.plural}!`, hintIcon: it.id, hintFor: 6, card: p.move, cardFor: 8,
    ...(p.mode === 'together' ? { team: true } : {}), things: []
  };
  const gold = p.golden && specialsOn(p), bomb = p.bomb && specialsOn(p);

  if (p.how === 'keepup'){
    const balls = BALLS[p.many], s = lim('size', round3(size * BALL_SIZE[p.speed]));
    game.things.push({
      name: 'ball', piece: it.id, size: s, ...(balls === 1 ? { at: { x: 0.5, y: 0.35 } } : { count: balls }), moves: 'bounce', spins: true,
      rules: [{ when: 'touched', then: ['kickUp', 'score', { sound: 'pop' }] }, { when: 'lands', then: [{ score: -1 }, { sound: 'plop' }] }]
    });
    return game;
  }

  const move = { catch: 'fall', pop: 'rise', dodge: 'drift', collect: 'bob' }[p.how];
  const every = EVERY[p.how][p.many], max = MAX[p.how][p.many];
  const speed = move === 'bob' ? 0 : lim('speed', SPEED[move][p.speed]), life = LIFE[p.speed];
  const base = (extra) => ({
    ...extra, size: lim('size', round3(extra.size ?? size)), moves: move, ...(move === 'bob' ? {} : { speed }), ...(move === 'fall' || move === 'rise' ? { sway: 0.02 } : {}),
  });
  const appears = (e, m, from) => ({ every: lim('every', round3(e)), everyEnd: lim('every', round3(e * 0.7)), max: lim('max', m), ...(from ? { from } : {}) });
  const from = { fall: 'top', rise: 'bottom', drift: undefined, bob: 'anywhere' }[move];
  const leave = move === 'bob' ? (secs) => [{ when: 'age', after: secs, then: ['vanish'] }] : () => [];

  /* the main thing */
  const mainRules = {
    catch: [{ when: 'touched', then: ['pop', 'score', { sound: 'pop' }, 'vanish'] }],
    pop: [{ when: 'touched', then: ['pop', 'score', { sound: 'pop' }, 'vanish'] }],
    /* dodge: a thing you let go by is a point (there is no "time survived" word), one that touches you costs one */
    dodge: [{ when: 'touched', then: ['pop', { score: -1 }, { sound: 'boing' }, 'vanish'] }, { when: 'leftScreen', then: ['score'] }],
    collect: [{ when: 'touched', then: ['sparkle', 'score', { sound: 'twinkle' }, 'vanish'] }, ...leave(life)]
  }[p.how];
  game.things.push(base({ name: 'main', piece: it.id, appears: appears(every, max, from), rules: mainRules }));

  if (gold) game.things.push(base({
    name: 'golden', piece: it.id, color: 'gold', size: size * 1.25, spins: true, appears: appears(every * 4, Math.max(1, Math.round(max / 6)), from),
    rules: [{ when: 'touched', then: ['sparkle', 'pop', { score: 5 }, { sound: 'gold' }, 'vanish'] }, ...leave(life * 0.7)]
  }));
  if (bomb) game.things.push(base({
    name: 'bomb', piece: 'bomb', appears: appears(every * 2.5, Math.max(1, Math.round(max / 3)), from),
    rules: [{ when: 'touched', then: ['pop', { score: -3 }, { sound: 'plop' }, 'vanish'] }, ...leave(life)]
  }));
  return game;
}

/* ---------- voice: a fixed phrase map, no AI ---------- */
const stem = (w) => w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
const has = (toks, ...words) => words.some(w => toks.includes(w));
const NEG = ['no', 'not', 'without', 'remove', 'dont', 'off', 'away', 'delete', 'nothing', 'never', 'rid', 'stop', 'cancel'];
const at = (toks, words) => { const i = toks.findIndex(t => words.includes(t)); return i < 0 ? Infinity : i; };
const nudge = (key, d, label) => (p) => { const v = p[key] + d; return v < 0 || v > STEPS - 1 ? null : { ...p, [key]: v, __label: label }; };
const setKey = (key, val, label) => (p) => ({ ...p, [key]: val, __label: label });

/* each command: the words that trigger it (when), and what it does to one setting. earlier words in the sentence win. */
const COMMANDS = [
  { say: 'faster', keys: ['faster', 'quicker', 'quick', 'fast', 'speed', 'rocket', 'zoom', 'hurry', 'rapid'], label: 'Faster', does: nudge('speed', +1, 'Faster'), when: (t) => !has(t, 'slower', 'slow') },
  { say: 'slower', keys: ['slower', 'slow', 'snail', 'gentle', 'gently', 'calm'], label: 'Slower', does: nudge('speed', -1, 'Slower') },
  { say: 'more', keys: ['more', 'lots', 'many', 'extra', 'plenty', 'loads'], label: 'More', does: nudge('many', +1, 'More'), when: (t) => !has(t, 'golden', 'gold', 'bomb') },
  { say: 'fewer', keys: ['fewer', 'less', 'few', 'lower'], label: 'Fewer', does: nudge('many', -1, 'Fewer'), when: (t) => !has(t, 'golden', 'gold', 'bomb') },
  { say: 'bigger', keys: ['bigger', 'big', 'larger', 'large', 'huge', 'giant', 'grow'], label: 'Bigger', does: nudge('size', +1, 'Bigger') },
  { say: 'smaller', keys: ['smaller', 'small', 'tiny', 'shrink', 'smallest'], label: 'Smaller', does: nudge('size', -1, 'Smaller') },
  { say: 'longer', keys: ['longer', 'long'], label: 'Longer', does: (p) => p.minutes >= 3 ? null : { ...p, minutes: p.minutes + 1, __label: 'Longer' } },
  { say: 'shorter', keys: ['shorter', 'short'], label: 'Shorter', does: (p) => p.minutes <= 1 ? null : { ...p, minutes: p.minutes - 1, __label: 'Shorter' } },
  { say: 'make it night', keys: ['night', 'dark', 'starry', 'bedtime', 'moonlit'], label: 'Night', does: setKey('where', 'night', 'Night') },
  { say: 'make it snowy', keys: ['snowy', 'snow', 'winter', 'cold', 'icy'], label: 'Snowy', does: setKey('where', 'snow', 'Snowy') },
  { say: 'make it a beach', keys: ['beach', 'sea', 'seaside', 'summer', 'sandy', 'seashore'], label: 'Beach', does: setKey('where', 'beach', 'Beach') },
  { say: 'make it evening', keys: ['evening', 'sunset', 'dusk', 'twilight'], label: 'Evening', does: setKey('where', 'sunset', 'Evening') },
  { say: 'make it autumn', keys: ['autumn'], label: 'Autumn', does: setKey('where', 'autumn', 'Autumn') },
  { say: 'make it day', keys: ['day', 'daytime', 'sunny', 'bright', 'morning', 'meadow'], label: 'Day', does: setKey('where', 'meadow', 'Day') },
  { say: 'no golden one', keys: ['golden', 'gold', 'special'], label: 'No golden one', when: (t) => has(t, ...NEG), does: (p) => p.golden ? { ...p, golden: false, __label: 'No golden one' } : null },
  { say: 'add a golden one', keys: ['golden', 'gold', 'special'], label: 'Golden one', when: (t) => !has(t, ...NEG), does: (p) => p.golden ? null : { ...p, golden: true, __label: 'Golden one' } },
  { say: 'no bomb', keys: ['bomb', 'bombs', 'boom'], label: 'No bomb', when: (t) => has(t, ...NEG), does: (p) => p.bomb ? { ...p, bomb: false, __label: 'No bomb' } : null },
  { say: 'add a bomb', keys: ['bomb', 'bombs', 'boom'], label: 'Bomb', when: (t) => !has(t, ...NEG), does: (p) => p.bomb ? null : { ...p, bomb: true, __label: 'Bomb' } },
  { say: 'together', keys: ['together', 'team', 'friends', 'everyone', 'share', 'coop'], label: 'Together', when: (t) => !has(t, ...NEG), does: (p) => p.mode === 'together' ? null : { ...p, mode: 'together', __label: 'Together' } },
  { say: 'race / who wins', keys: ['race', 'versus', 'vs', 'against', 'wins', 'win', 'winner', 'compete', 'who', 'battle'], label: 'Who wins?', when: (t) => !has(t, ...NEG), does: (p) => p.mode === 'versus' ? null : { ...p, mode: 'versus', __label: 'Who wins?' } }
];
/* the recipes and the things, by name: only when no command above was said ("more apples" is "more") */
const RECIPE_WORDS = { catch: ['catch', 'catching'], pop: ['pop', 'popping'], dodge: ['dodge', 'dodging', 'avoid'], collect: ['collect', 'gather', 'collecting'], keepup: ['keepup', 'bounce', 'juggle', 'keepy'] };
const thingWords = (pc) => { const one = pc.label.toLowerCase(), pl = pc.plural.toLowerCase(); return [...new Set([one, pl, pc.id, pc.id + 's', stem(pc.id)])]; };

export const VOICE_PHRASES = [
  { group: 'Speed', say: ['faster', 'slower'] },
  { group: 'How many', say: ['more', 'fewer'] },
  { group: 'Size', say: ['bigger', 'smaller'] },
  { group: 'Round', say: ['longer', 'shorter'] },
  { group: 'World', say: ['make it night', 'make it snowy', 'make it a beach', 'make it evening', 'make it autumn', 'make it day'] },
  { group: 'Specials', say: ['add a golden one', 'no golden one', 'add a bomb', 'no bomb'] },
  { group: 'Players', say: ['together', 'race', 'who wins'] },
  { group: 'Game', say: ['catch', 'pop', 'dodge', 'collect', 'keep it up'] },
  { group: 'Things', say: ['apples', 'bees', 'stars', 'balloons', 'fish', '...and any other picture name'] }
];

const norm = (phrase) => String(phrase ?? '').toLowerCase().replace(/[’']/g, '').replace(/keep it up|keep up/g, ' keepup ').replace(/ice cream/g, 'icecream').replace(/glow star/g, 'glowstar').replace(/beach ball/g, 'beachball').replace(/soccer ball/g, 'soccerball').replace(/maple leaf/g, 'mapleleaf')
  .replace(/get rid of/g, ' remove ').replace(/take away/g, ' remove ').replace(/turn off/g, ' remove ').replace(/more time|longer time|extra time/g, ' longer ').replace(/less time|shorter time/g, ' shorter ').replace(/speed up/g, ' faster ').replace(/slow down/g, ' slower ')
  .replace(/[^a-z0-9 ]+/g, ' ').trim();

export function voice(picks, phrase){
  const p = clean(picks), toks = norm(phrase).split(/\s+/).filter(Boolean), unknown = { picks: p, changed: [], unknown: true };
  if (!toks.length) return unknown;
  const st = toks.map(stem), all = [...new Set([...toks, ...st])];
  /* the earliest command word in the sentence wins; one command changes one setting by one step */
  let best = null;
  for (const c of COMMANDS){
    if (c.when && !c.when(all)) continue;
    const j = Math.min(at(toks, c.keys), at(st, c.keys));
    if (j !== Infinity && (!best || j < best.i)) best = { i: j, c };
  }
  if (best){
    if ((best.c.say.includes('golden') || best.c.say.includes('bomb')) && !specialsOn(p)) return unknown;
    const r = best.c.does(p);
    if (!r) return { picks: p, changed: [], atLimit: best.c.label };
    const { __label, ...next } = r;
    return { picks: clean(next), changed: [__label] };
  }
  for (const [id, words] of Object.entries(RECIPE_WORDS)) if (has(all, ...words)) return p.how === id ? { picks: p, changed: [], atLimit: how(p).label } : { picks: { ...p, how: id }, changed: [HOW.find(h => h.id === id).label] };
  /* a thing: the longest name wins ("glow star" over "star") */
  let found = null;
  for (const pc of PIECES) for (const w of thingWords(pc)) if ((all.includes(w) || (w.includes(' ') && toks.join(' ').includes(w))) && (!found || w.length > found.w.length)) found = { pc, w };
  if (found) return found.pc.id === p.what ? { picks: p, changed: [], atLimit: found.pc.label } : { picks: { ...p, what: found.pc.id }, changed: [title(found.pc.plural)] };
  return unknown;
}
