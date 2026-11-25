/* The picture-built games (decisions 0056, 0059): Create's Phase 1 menus as data, and the pure logic that turns a kid's picks into a game
   in the Orlis.play vocabulary - no AI, no free text, no DOM.

   A game is up to five THINGS (the builder gives them all one job; the model can hold a job for each), each with a JOB (Collect, Dodge, Keep up, Stack), in a place (a world), and a few
   rules (speed, how many, size, minutes, together or who wins, a golden one, a bomb).

     choices                 the menus the screens show (jobs, what, where, rules)
     defaultPicks()          a first pick, so a game runs from the first second
     clean(picks)            any picks (even half empty, or from before 0059: one thing with a `how`) -> whole, valid picks
     addThing / removeThing / setJob / toggleThing   changing the things (each gives new picks)
     build(picks)            -> a game description for Orlis.play (always passes games/play/validate.js)
     suggestNames(picks)     -> 3 goofy names of 3 to 5 words, from the things, their jobs and the place
     sentence(picks)         -> the one line under the preview
     voice(picks, phrase)    -> { picks, changed: ['Faster'] } or { picks, changed: [], unknown: true }; a fixed phrase map
     VOICE_PHRASES           what voice() knows, for the screen to show

   picks = { things: [{ id: 'apple', job: 'collect' }, ...1 to 5], where, speed 0..6, many 0..6, size 0..4, minutes 1|2|3, mode, golden, bomb, name? }
   Before 0059 a game was { how, what, ... }: clean() turns that into one thing with the matching job (and its 5-stop speed and how many onto the 7 stops), so old creations still open and play.
   There is no move to pick: how you play is the job's (moveOf). */
import { LIMITS } from '../games/play/vocabulary.js';
import { SCENES } from '../games/assets/scenes.js';
import { badWords } from '../../kit/creator/words.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lim = (key, v) => clamp(v, LIMITS[key][0], LIMITS[key][1]);
const round3 = (v) => Math.round(v * 1000) / 1000;

export const MAX_THINGS = 5;
/* the longest a game's name can be (3 to 5 words) */
export const NAME_MAX = 40;

/* ---------- the menus ---------- */
/* the four jobs a thing can have. `word`: in a name; `done`: what the results card says of it */
const JOBS = [
  { id: 'collect', label: 'Collect', line: 'Touch it to score', word: 'Catch', icon: 'collect', done: 'caught' },
  { id: 'dodge', label: 'Dodge', line: 'Keep away from it', word: 'Dodge', icon: 'dodge', done: 'dodged' },
  { id: 'keepup', label: 'Keep up', line: "Don't let it drop", word: 'Keep-Up', icon: 'keepup', done: 'bounces' },
  { id: 'stack', label: 'Stack', line: 'Build a tower', word: 'Stack', icon: 'stack', done: 'stacked' }
];
const job = (id) => JOBS.find(j => j.id === id);
/* the old recipes (before 0059) and the job each one is now */
const OLD_HOW = { catch: 'collect', pop: 'collect', collect: 'collect', dodge: 'dodge', keepup: 'keepup' };

/* [id, singular, plural]: pieces that look right falling, floating or bouncing; all from the library, all kid-friendly */
const P = (id, one, many) => ({ id, label: one || id[0].toUpperCase() + id.slice(1), plural: many || (one || id).toLowerCase() + 's' });
const WHAT = [
  { id: 'food', label: 'Food', pieces: [P('apple'), P('pear'), P('strawberry', 'Strawberry', 'strawberries'), P('banana'), P('orange'), P('cherry', 'Cherry', 'cherries'), P('cupcake'), P('cookie'), P('lollipop'), P('icecream', 'Ice cream', 'ice creams')] },
  { id: 'animals', label: 'Animals', pieces: [P('bee'), P('butterfly', 'Butterfly', 'butterflies'), P('bird'), P('ladybug'), P('fish', 'Fish', 'fish'), P('frog'), P('duck'), P('bunny', 'Bunny', 'bunnies')] },
  { id: 'sky', label: 'Sky', pieces: [P('star'), P('glowstar', 'Glow star', 'glow stars'), P('moon'), P('sun'), P('cloud'), P('snowflake'), P('raindrop'), P('feather'), P('kite')] },
  { id: 'toys', label: 'Toys', pieces: [P('balloon'), P('beachball', 'Beach ball', 'beach balls'), P('soccerball', 'Soccer ball', 'soccer balls'), P('basketball', 'Basketball'), P('volleyball', 'Volleyball'), P('teddy', 'Teddy', 'teddies'), P('block'), P('dice', 'Dice', 'dice'), P('gift'), P('heart')] },
  { id: 'nature', label: 'Nature', pieces: [P('mapleleaf', 'Maple leaf', 'maple leaves'), P('leaf', 'Leaf', 'leaves'), P('flower'), P('sunflower'), P('tulip'), P('mushroom'), P('shell'), P('egg'), P('seedling')] }
];
const PIECES = WHAT.flatMap(c => c.pieces.map(p => ({ ...p, category: c.id })));
const piece = (id) => PIECES.find(p => p.id === id);
/* the ones that look right floating in from below rather than falling (a Collect thing) */
const FLOATERS = new Set(['balloon', 'butterfly', 'bee', 'bumblebee', 'bird', 'kite', 'feather', 'ladybug', 'cloud']);

const WORLD_WORDS = {   /* the sentence's name for the place, and an adjective for names */
  meadow: ['sunny meadow', 'Sunny'], sunset: ['evening sky', 'Evening'], autumn: ['autumn afternoon', 'Autumn'], night: ['starry night', 'Starry'], snow: ['snowy hills', 'Snowy'], beach: ['sunny beach', 'Beachy']
};
const WHERE = ['meadow', 'night', 'beach', 'snow', 'sunset', 'autumn'].map(id => ({ id, label: SCENES[id].name, palette: !SCENES[id].legacy }));

/* how you play is the job's: the move card the game shows, and how the sentence says it (Collect: reach and touch; Dodge: lean away; Keep up: bat it up; Stack: touch it to send it to the tower) */
const JOB_MOVE = { collect: ['reach', 'reaching up'], dodge: ['lean', 'leaning away'], keepup: ['reach', 'batting it up'], stack: ['reach', 'reaching up'] };

/* the rules' stops: speed and how many are 7 (0 to 6, the middle one the usual), size 5 */
const STOPS = { speed: 7, many: 7, size: 5 };
export const choices = {
  jobs: JOBS.map(({ id, label, line, icon }) => ({ id, label, line, icon })),
  maxThings: MAX_THINGS,
  what: WHAT.map(c => ({ id: c.id, label: c.label, pieces: c.pieces.map(p => ({ ...p })) })),
  where: WHERE,
  /* the rules: speed and how many are 5 steps (0 to 4), round length is minutes */
  rules: {
    speed: { steps: STOPS.speed, labels: ['Snail', 'Very slow', 'Slow', 'Medium', 'Quick', 'Fast', 'Rocket'], icons: ['snail', 'rocket'] },
    many: { steps: STOPS.many, labels: ['One', 'A couple', 'A few', 'Some', 'Lots', 'Loads', 'A storm'], icons: ['few', 'lots'] },
    size: { steps: STOPS.size, labels: ['Tiny', 'Small', 'Medium', 'Big', 'Huge'], voiceOnly: true },
    minutes: { options: [1, 2, 3] },
    mode: [{ id: 'together', label: 'Together', icon: 'together' }, { id: 'versus', label: 'Who wins?', icon: 'versus' }],
    specials: [{ id: 'golden', label: 'Golden one', line: 'worth 5', icon: 'golden' }, { id: 'bomb', label: 'A bomb', line: 'to avoid', icon: 'bomb' }]
  }
};
/* a piece's words ({ id, label, plural, category }), or null */
export const pieceInfo = (id) => { const p = piece(id); return p ? { ...p } : null; };

/* ---------- picks ---------- */
export const defaultPicks = () => ({ things: [{ id: 'apple', job: 'collect' }], where: 'meadow', speed: 3, many: 3, size: 2, minutes: 1, mode: 'together', golden: true, bomb: false });
const step = (v, d, key) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? clamp(n, 0, STOPS[key] - 1) : d; };
/* (a game from before 0059 had 5 stops of speed and how many; they land on the same places on the 7) */
const fromOld = (v) => Number.isFinite(Number(v)) ? Math.round(clamp(Number(v), 0, 4) * 6 / 4) : v;
/* the things of any picks: from a list, or from before 0059 (one `what` with a `how`); never empty, never more than five, each piece once */
/* pieces taken out of the picker, and what an old saved game's pick becomes (owner, 2026-11-25: Bumblebee drawn the same as Bee) */
const RETIRED = { bumblebee: 'bee' };
function thingsOf(p){
  let list = [];
  if (Array.isArray(p.things)) list = p.things;
  else if (p.what !== undefined || p.how !== undefined) list = [{ id: p.what, job: OLD_HOW[p.how] || 'collect' }];
  const out = [];
  for (const t of list){
    const raw = t && typeof t === 'object' ? t.id : t, id = RETIRED[raw] || raw;
    if (!piece(id) || out.some(o => o.id === id) || out.length >= MAX_THINGS) continue;
    out.push({ id, job: t && job(t.job) ? t.job : 'collect' });
  }
  return out.length ? out : defaultPicks().things;
}
/* any picks (even half empty or wrong) -> whole, valid picks */
export function clean(p = {}){
  p = p && typeof p === 'object' ? p : {};
  const d = defaultPicks(), old = !Array.isArray(p.things);
  return {
    things: thingsOf(p), where: WHERE.some(w => w.id === p.where) ? p.where : d.where,
    speed: step(old ? fromOld(p.speed) : p.speed, d.speed, 'speed'), many: step(old ? fromOld(p.many) : p.many, d.many, 'many'), size: step(p.size, d.size, 'size'),
    minutes: [1, 2, 3].includes(p.minutes) ? p.minutes : d.minutes, mode: p.mode === 'versus' ? 'versus' : 'together', golden: p.golden === undefined ? d.golden : !!p.golden, bomb: p.bomb === undefined ? d.bomb : !!p.bomb,
    ...(typeof p.name === 'string' && p.name.trim() ? { name: p.name.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX) } : {})
  };
}
/* changing the things */
export const hasThing = (picks, id) => clean(picks).things.some(t => t.id === id);
export function addThing(picks, id, jobId){
  const p = clean(picks);
  jobId = job(jobId) ? jobId : p.things[0].job;
  if (!piece(id) || p.things.some(t => t.id === id) || p.things.length >= MAX_THINGS) return p;
  return clean({ ...p, things: [...p.things, { id, job: jobId }] });
}
/* (the last one stays: a game needs a thing) */
export function removeThing(picks, id){
  const p = clean(picks);
  return p.things.length > 1 ? clean({ ...p, things: p.things.filter(t => t.id !== id) }) : p;
}
export const toggleThing = (picks, id) => hasThing(picks, id) ? removeThing(picks, id) : addThing(picks, id);
/* the job of the game (the first thing's), and one job for every thing: what the builder asks for */
export const gameJob = (picks) => clean(picks).things[0].job;
export const setAllJobs = (picks, jobId) => { const p = clean(picks); return job(jobId) ? clean({ ...p, things: p.things.map(t => ({ ...t, job: jobId })) }) : p; };
/* the move card the game shows (the job's), and how to say it */
export const moveOf = (picks) => JOB_MOVE[gameJob(picks)][0];
export const setJob = (picks, id, jobId) => { const p = clean(picks); return job(jobId) ? clean({ ...p, things: p.things.map(t => t.id === id ? { ...t, job: jobId } : t) }) : p; };

/* the rules that only make sense with some jobs: a golden one is a Collect thing worth 5; a bomb is something to avoid, so it needs things
   that move about (not only a ball to keep up) */
const jobsOf = (p) => p.things.map(t => t.job);
export const goldenOn = (picks) => jobsOf(clean(picks)).includes('collect');
export const bombOn = (picks) => jobsOf(clean(picks)).some(j => j !== 'keepup');

/* ---------- names and the sentence ---------- */
const title = (s) => s.replace(/\b[a-z]/g, c => c.toUpperCase());
const wordCount = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

/* goofy words (all friendly: nothing that could read as mean) */
const ADJ = ['Wobbly', 'Sneaky', 'Dizzy', 'Giggly', 'Zippy', 'Bouncy', 'Fluffy', 'Wacky', 'Jolly', 'Funky', 'Squishy', 'Zany', 'Silly', 'Sparkly', 'Snazzy', 'Peppy', 'Bubbly', 'Jiggly', 'Goofy', 'Dazzling'];
/* {A} a goofy word, {T} the first thing, {Tp} its plural, {U} the second thing, {J} its job's word, {P} the place */
const NAMES = {
  collect: ['The Great {A} {T} Bonanza', 'Super {A} {T} Catch', 'Mega {T} Grab Party', '{A} {Tp} Roundup Day', 'Catch That {A} {T}', 'The {A} {T} Catching Party'],
  dodge: ['Super Sneaky {T} Dodge', '{A} {T} Dodge Party', 'Dodge The {A} {Tp}', 'The Great {T} Dodge-Off', 'Mega {T} Dodge Dash', 'Tiptoe Past The {Tp}'],
  keepup: ['Dizzy {T} Keep-Up Party', '{A} {T} Bounce Bash', 'Keep That {A} {T} Up', 'The Great {T} Bounce-Off', 'Mega {T} Keep-Up Time', 'Super {A} {T} Juggle'],
  stack: ['Mega {T} Stack Attack', 'The {A} {T} Tower Time', 'Stack That {A} {T}', 'Super {A} {T} Stack-Off', 'The Great {T} Tower Party', '{A} {Tp} Sky Tower']
};
const MIX = ['{A} {T} And {U} Party', 'Super {T} {U} Mix-Up', 'Mega {T} And {U} Bash', 'The {A} {T} {U} Show', 'Wacky {T} {U} Mix-Up', 'The Great {T} {U} Mix-Up'];
const PLACE = ['{P} {T} {J} Party', 'Super {P} {T} {J}', '{P} {Tp} Go Wild', 'Mega {P} {T} {J} Time'];
const AROUND = ['{A} {Tp} Gone Wild', 'Super {A} {T} Time', 'The Great {A} {T} Show', 'Mega {A} {Tp} Party', '{A} {T} Fun Time'];

/* a name that can be shown: 3 to 5 words, no longer than NAME_MAX, nothing left unfilled, and no word that is not for children (the creator kit's list) */
export function isGoodName(s){ const w = wordCount(s); return w >= 3 && w <= 5 && s.length <= NAME_MAX && !/[{}]/.test(s) && !badWords(s).length; }

/* three names of 3 to 5 words, the same for the same picks: one by the first thing's job, one mixing the things (or a general one), one by the place */
export function suggestNames(picks){
  const p = clean(picks), first = p.things[0], second = p.things[1] || null, it = piece(first.id), jb = job(first.job), seed = p.things.map(t => t.id + t.job).join(',') + p.where;
  const fill = (tpl, salt) => tpl
    .replace('{A}', ADJ[hash(seed + salt) % ADJ.length]).replace('{Tp}', title(it.plural)).replace('{T}', title(it.label)).replace('{U}', second ? title(piece(second.id).label) : '')
    .replace('{J}', jb.word).replace('{P}', WORLD_WORDS[p.where][1]);
  const ok = isGoodName;
  const lists = [NAMES[first.job], second ? MIX : NAMES[first.job], PLACE, NAMES[first.job], AROUND, PLACE, AROUND];
  const used = new Set();
  const out = [];
  lists.forEach((tpls, k) => {
    if (out.length >= 3) return;
    const from = hash(seed + 'at' + k) % tpls.length;
    for (let i = 0; i < tpls.length; i++){
      const tpl = tpls[(from + i) % tpls.length], name = fill(tpl, k + ':' + i);
      if (!used.has(tpl) && ok(name) && !out.includes(name)){ out.push(name); used.add(tpl); break; }
    }
  });
  /* (it can only be short of three if every word was too long: a plain name then) */
  for (const plain of [`${title(it.label)} ${jb.word} Party`, `Super ${title(it.label)} ${jb.word}`, `The ${title(it.plural)} Show`]) if (out.length < 3 && ok(plain) && !out.includes(plain)) out.push(plain);
  return out.slice(0, 3);
}

const listOf = (a) => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
export function sentence(picks){
  const p = clean(picks), world = WORLD_WORDS[p.where][0], by = JOB_MOVE[p.things[0].job][1];
  const of = (j) => p.things.filter(t => t.job === j).map(t => piece(t.id));
  const parts = [];
  if (of('collect').length) parts.push(`catch the ${listOf(of('collect').map(x => x.plural.toLowerCase()))}`);
  if (of('dodge').length) parts.push(`dodge the ${listOf(of('dodge').map(x => x.plural.toLowerCase()))}`);
  if (of('keepup').length) parts.push(`keep the ${listOf(of('keepup').map(x => x.label.toLowerCase()))} up`);
  if (of('stack').length) parts.push(`stack the ${listOf(of('stack').map(x => x.plural.toLowerCase()))}`);
  const lead = listOf(parts).replace(/^./, c => c.toUpperCase());
  const g = p.golden && goldenOn(p), b = p.bomb && bombOn(p);
  const extra = g && b ? ', with a golden one worth 5, and a bomb to avoid' : g ? ', with a golden one worth 5' : b ? ', with a bomb to avoid' : '';
  return `${lead} in the ${world} by ${by}${extra}. ${p.mode === 'together' ? 'Play together.' : 'Who gets the most?'}`;
}

/* ---------- build: picks -> an Orlis.play description ---------- */
/* what each step means for each job (all inside the vocabulary's LIMITS) */
/* speed: the usual speed of each way of moving (screen heights a second) times 0.3x to 3x over the 7 stops; how many: about how many things are on the
   screen at once, from one at a time to a storm (shared by the things in the game: each comes as often as it takes to keep that many about) */
const BASE = { fall: 0.11, rise: 0.11, drift: 0.12 };
export const SPEED_X = [0.3, 0.45, 0.7, 1, 1.45, 2.1, 3];
export const ON_SCREEN = [1, 2, 4, 7, 12, 18, 25];
const CROSS = 1.15;                        /* screens to cross, so a thing is about CROSS / speed seconds on it */
const SIZE = [0.06, 0.075, 0.095, 0.12, 0.15];
const BALLS = [1, 1, 1, 1, 2, 3, 3];       /* keep up: how many balls each player has (how many) */
const BALL_SIZE = [1.3, 1.2, 1.1, 1, 0.9, 0.8, 0.7]; /* keep up: a faster game is a smaller ball (speed) */
export const FLOAT_BACK = 1;               /* keep up: seconds before a popped ball floats back in */
export const TOWER = 6;                    /* stack: blocks in a full tower */
const HINT = { collect: 'Catch the', dodge: 'Dodge the', stack: 'Stack the' };
const FROM = { fall: 'top', rise: 'bottom', drift: undefined };
const MOVE_OF = (t) => t.job === 'dodge' ? 'drift' : t.job === 'keepup' ? 'bounce' : t.job === 'stack' ? 'fall' : FLOATERS.has(t.id) ? 'rise' : 'fall';

export function build(picks){
  const p = clean(picks), size = SIZE[p.size], n = p.things.length, first = p.things[0], firstPiece = piece(first.id);
  const names = suggestNames(p);
  /* the things share the screen: each comes as often as keeps its share about, and no more than its share at once */
  const share = ON_SCREEN[p.many] / n, most = Math.max(1, Math.ceil(share)), rate = (move) => lim('every', round3(CROSS / (BASE[move] * SPEED_X[p.speed]) / share));
  const game = {
    title: p.name || names[0], secs: lim('secs', p.minutes * 60), scene: p.where,
    hint: first.job === 'keepup' ? 'Keep it up!' : `${HINT[first.job]} ${firstPiece.plural}!`, hintIcon: first.id, hintFor: 6, card: moveOf(p), cardFor: 8,
    ...(p.mode === 'together' ? { team: true } : {}), things: []
  };
  const appears = (e, m, from, extra = {}) => ({ every: lim('every', round3(e)), everyEnd: lim('every', round3(e * 0.7)), max: lim('max', m), ...(from ? { from } : {}), ...extra });
  const moving = (move, extra) => ({
    ...extra, size: lim('size', round3(extra.size ?? size)), moves: move, speed: lim('speed', round3(BASE[move] * SPEED_X[p.speed])), ...(move === 'fall' || move === 'rise' ? { sway: 0.02 } : {})
  });
  const keepers = p.things.filter(t => t.job === 'keepup').length;

  for (const t of p.things){
    const name = `${t.job}-${t.id}`, move = MOVE_OF(t);
    if (t.job === 'keepup'){
      /* a ball for each player (each: it floats in their own part of the screen, only they can bat it, and it goes up only as high as they can reach:
         fair for a child beside a grown-up); each touch bats it up; one that drops pops, and a new one floats in a moment later */
      const balls = keepers > 1 ? 1 : BALLS[p.many], s = lim('size', round3(size * BALL_SIZE[p.speed]));
      game.things.push({
        name, piece: t.id, size: s, moves: 'bounce', spins: true, each: true, appears: { every: 1, everyEnd: 1, max: balls, from: 'anywhere', wait: FLOAT_BACK },
        rules: [{ when: 'touched', then: ['kickUp', 'score', { sound: 'pop' }] }, { when: 'lands', then: ['pop', { sound: 'plop' }, 'vanish'] }]
      });
      continue;
    }
    const e = rate(move), m = most;
    const rules = {
      collect: [{ when: 'touched', then: ['sparkle', 'score', { sound: 'twinkle' }, 'vanish'] }],
      /* dodge: a thing you let go by is a point (there is no "time survived" word), one that touches you costs one, with a bump and a wobble */
      dodge: [{ when: 'touched', then: ['pop', { score: -1 }, { sound: 'boing' }, 'wobble', 'vanish'] }, { when: 'leftScreen', then: ['score'] }],
      stack: [{ when: 'touched', then: [{ stack: TOWER }, 'score', { sound: 'whoosh' }, 'vanish'] }]
    }[t.job];
    game.things.push(moving(move, { name, piece: t.id, appears: appears(e, m, FROM[move]), rules }));
  }

  /* specials: a golden one (a Collect thing worth 5), a bomb to avoid */
  if (p.golden && goldenOn(p)){
    const t = p.things.find(x => x.job === 'collect'), move = MOVE_OF(t), e = rate(move) * 4, m = most;
    game.things.push(moving(move, { name: 'golden', piece: t.id, color: 'gold', size: size * 1.25, spins: true, appears: appears(e, Math.max(1, Math.round(m / 6)), FROM[move]),
      rules: [{ when: 'touched', then: ['sparkle', 'pop', { score: 5 }, { sound: 'gold' }, 'vanish'] }] }));
  }
  if (p.bomb && bombOn(p)){
    const e = rate('fall') * 2.5, m = most;
    game.things.push(moving('fall', { name: 'bomb', piece: 'bomb', appears: appears(e, Math.max(1, Math.round(m / 3)), 'top'),
      rules: [{ when: 'touched', then: ['pop', { score: -3 }, { sound: 'plop' }, 'wobble', 'vanish'] }] }));
  }
  return game;
}

/* ---------- voice: a fixed phrase map, no AI ---------- */
const stem = (w) => w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
const has = (toks, ...words) => words.some(w => toks.includes(w));
const NEG = ['no', 'not', 'without', 'remove', 'dont', 'off', 'away', 'delete', 'nothing', 'never', 'rid', 'stop', 'cancel'];
const at = (toks, words) => { const i = toks.findIndex(t => words.includes(t)); return i < 0 ? Infinity : i; };
const nudge = (key, d, label) => (p) => { const v = p[key] + d; return v < 0 || v > STOPS[key] - 1 ? null : { ...p, [key]: v, __label: label }; };
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
/* a job word gives every thing that job; a thing's name adds it (with "Collect", the usual) - only when no command above was said ("more apples" is "more") */
const JOB_WORDS = { collect: ['catch', 'catching', 'pop', 'popping', 'collect', 'gather', 'collecting'], dodge: ['dodge', 'dodging', 'avoid'], keepup: ['keepup', 'bounce', 'juggle', 'keepy'], stack: ['stack', 'stacking', 'tower', 'build'] };
const thingWords = (pc) => { const one = pc.label.toLowerCase(), pl = pc.plural.toLowerCase(); return [...new Set([one, pl, pc.id, pc.id + 's', stem(pc.id)])]; };

export const VOICE_PHRASES = [
  { group: 'Speed', say: ['faster', 'slower'] },
  { group: 'How many', say: ['more', 'fewer'] },
  { group: 'Size', say: ['bigger', 'smaller'] },
  { group: 'Round', say: ['longer', 'shorter'] },
  { group: 'World', say: ['make it night', 'make it snowy', 'make it a beach', 'make it evening', 'make it autumn', 'make it day'] },
  { group: 'Specials', say: ['add a golden one', 'no golden one', 'add a bomb', 'no bomb'] },
  { group: 'Players', say: ['together', 'race', 'who wins'] },
  { group: 'The job', say: ['catch', 'dodge', 'keep it up', 'stack'] },
  { group: 'Add a thing', say: ['apples', 'bees', 'stars', 'balloons', 'fish', '...and any other picture name'] }
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
    if (best.c.say.includes('golden') && !goldenOn(p)) return unknown;
    if (best.c.say.includes('bomb') && !bombOn(p)) return unknown;
    const r = best.c.does(p);
    if (!r) return { picks: p, changed: [], atLimit: best.c.label };
    const { __label, ...next } = r;
    return { picks: clean(next), changed: [__label] };
  }
  for (const [id, words] of Object.entries(JOB_WORDS)) if (has(all, ...words)){
    return p.things.every(t => t.job === id) ? { picks: p, changed: [], atLimit: job(id).label } : { picks: setAllJobs(p, id), changed: [job(id).label] };
  }
  /* a thing: the longest name wins ("glow star" over "star") */
  let found = null;
  for (const pc of PIECES) for (const w of thingWords(pc)) if ((all.includes(w) || (w.includes(' ') && toks.join(' ').includes(w))) && (!found || w.length > found.w.length)) found = { pc, w };
  if (found){
    if (hasThing(p, found.pc.id)) return { picks: p, changed: [], atLimit: found.pc.label };
    if (p.things.length >= MAX_THINGS) return { picks: p, changed: [], atLimit: 'Five things' };
    return { picks: addThing(p, found.pc.id), changed: [title(found.pc.plural)] };
  }
  return unknown;
}
