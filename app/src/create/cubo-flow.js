/* Cubo's Create as a state machine (decisions 0060, 0061), with no DOM: the steps, what each gesture or remote key does in each, and what Cubo says.
   The screen (ui/cubo-create.js) reads bodies (create/gestures.js), turns them into events, calls reduce(), and draws the state and plays the effects.

     steps       start -> where -> game -> what -> rules -> name -> play     (Back goes the other way; from start or where it leaves)
     newFlow({ creation, full, demoed })   a new game (at start), or the game being changed (at where, with its own picks)
     reduce(state, event)            -> { state, fx }      (never changes the state it is given)
     LINES, lineFor(state)           what Cubo says on arriving at a step (once); DEMO_LINES what he says as he shows a gesture the first time
     nameWheel(picks)                the goofy names the wheel spins through (all pass isGoodName)

   Two gestures do everything: reach-and-hold picks (a hand held on a target) and both arms up goes on ("arms"); the remote's OK is the same as either.
   Events (t): arms | ok | back | key (key: left right up down) | tick (dt) | world (ix) | job (id) | group (id) | ungroup | grab (id) | take (id)
               meter (i: the stop the hand is at now, live) | set (the hand held still: the question is answered) | spin (by) | full (full) | saved-failed.
   What is the group tiles (group null), then that group's parade (group set). Rules asks two questions in turn: q = 'speed', then 'many'.
   Effects (fx, in order): { say } Cubo says it | { demo: 'hold'|'arms' } Cubo shows the gesture (the first time only) | { cheer: job|'pick' } | { pop: id }
               { full } slots full | { msg } a short line on screen | { play: {...} } save and play | { exit } leave. */
import { choices, clean, setAllJobs, defaultPicks, isGoodName, suggestNames, MAX_THINGS, pieceInfo } from './recipe.js';
import { FULL_LINE } from './slots.js';

export const STEPS = ['start', 'where', 'game', 'what', 'rules', 'name', 'play'];
export const DOTS = ['where', 'game', 'what', 'rules', 'name'];       /* the step dots across the top */
export const RULES_QUIET = 8;                  /* seconds with nothing touched in Rules before Cubo picks */
export const RULE_KEYS = ['speed', 'many', 'size', 'minutes', 'mode', 'golden', 'bomb'];
export const GROUPS = choices.what.map(c => c.id);
export const WORLDS = choices.where.map(w => w.id);
export const JOBS = choices.jobs.map(j => j.id);
export const SPEED_STOPS = choices.rules.speed.steps, MANY_STOPS = choices.rules.many.steps;

const VERB = { collect: 'collect', dodge: 'dodge', keepup: 'keep up', stack: 'stack' };
export const LINES = {
  start: "Let's make a game! Raise both arms to start.",       /* (or touch and hold Cubo on the banner) */
  where: 'Where shall we play?',
  game: 'What kind of game?',
  speed: 'How fast? Raise your hand!',
  many: 'How many? Raise your hand!',
  name: 'Jump to spin! Arms up to keep it!',
  play: "Here we go!",
  pick: "I'll pick!",
  none: 'Grab one first!'
};
/* what Cubo says as he shows a gesture, and the step each is first needed at */
export const DEMO_LINES = { hold: 'Hold your hand on one!', arms: "Arms up when you're done!" };
export const DEMO_AT = { where: 'arms', game: 'hold' };
export const lineFor = (state) => state.step === 'what' ? `What shall we ${VERB[state.job] || 'play with'}? Hold one to open it!`
  : state.step === 'rules' ? LINES[state.q || 'speed'] : (LINES[state.step] || '');

const clampi = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (v, n) => ((v % n) + n) % n;

/* a new flow. creation: a saved game to change (its picks stay; it opens at Where). full: the family's slots are all used.
   demoed: which gestures Cubo has already shown this session ({ hold, arms }). */
export function newFlow({ creation = null, full = false, demoed = {} } = {}){
  const base = creation ? clean({ ...creation.picks, name: undefined }) : defaultPicks();
  const job = base.things[0].job;
  const flow = {
    step: creation ? 'where' : 'start', full: !!full && !creation,
    picks: base, job: creation ? job : null, editing: creation ? creation.id : null,
    worldIx: Math.max(0, WORLDS.indexOf(base.where)),
    gameIx: Math.max(0, JOBS.indexOf(job)),
    tray: creation ? base.things.map(t => t.id) : [],
    group: null, groupIx: 0, zone: 'parade', parIx: 0, trayIx: 0, q: 'speed', manySet: false,
    quiet: 0, touched: false, names: [], nameIx: 0, startName: creation ? (creation.name || creation.picks.name || null) : null,
    demoed: { hold: !!demoed.hold, arms: !!demoed.arms }, demo: null,
    say: null
  };
  if (creation && !flow.demoed.arms){ flow.demo = 'arms'; flow.demoed.arms = true; }
  return { ...flow, say: creation ? LINES.where : LINES.start };
}

/* the names the wheel turns through: the picks' own three first, then the same picks in each world and led by each thing, all good names */
export function nameWheel(picks, own = null){
  const p = clean({ ...picks, name: undefined }), out = [];
  const add = (n) => { if (n && isGoodName(n) && !out.includes(n)) out.push(n); };
  add(own);
  suggestNames(p).forEach(add);
  for (const w of WORLDS) suggestNames({ ...p, where: w }).forEach(add);
  p.things.forEach((_, i) => suggestNames({ ...p, things: [...p.things.slice(i), ...p.things.slice(0, i)] }).forEach(add));
  return out;
}

/* the things picked, as picks: the tray, each with the game's one job */
const picksFrom = (state) => state.tray.length
  ? setAllJobs(clean({ ...state.picks, things: state.tray.map(id => ({ id, job: state.job || 'collect' })) }), state.job || 'collect')
  : state.picks;

const groupIds = (g) => g ? choices.what.find(c => c.id === g).pieces.map(p => p.id) : [];
export const idsOf = groupIds;

const enter = (state, step, fx, extra = {}) => {
  const next = { ...state, ...extra, step, quiet: 0, touched: false, demo: null };
  if (step === 'rules') Object.assign(next, { q: 'speed', manySet: false });
  next.say = lineFor(next);
  if (next.say) fx.push({ say: next.say });
  const g = DEMO_AT[step];
  if (g && !next.demoed[g]){ next.demoed = { ...next.demoed, [g]: true }; next.demo = g; fx.push({ demo: g }); }
  return next;
};

export function reduce(state, ev){
  const fx = [];
  let s = state;
  const done = () => ({ state: s, fx });
  const { t } = ev;

  /* a quiet clock in Rules: nothing touched for a while and Cubo picks (once anything is touched, the choosing is theirs: Cubo never picks over it) */
  if (t === 'tick'){
    if (s.step === 'rules' && !s.touched){
      s = { ...s, quiet: s.quiet + ev.dt };
      if (s.quiet >= RULES_QUIET){ fx.push({ say: LINES.pick }); s = toName(s.editing ? s : usualRules(s), fx); }      /* (a game being changed keeps its own rules) */
    }
    return done();
  }

  if (t === 'back'){
    switch (s.step){
      case 'start': fx.push({ exit: true }); break;
      case 'where': if (s.editing) fx.push({ exit: true }); else s = enter(s, 'start', fx); break;
      case 'game': s = enter(s, 'where', fx); break;
      case 'what':
        if (s.group) s = { ...s, group: null }; else s = enter(s, 'game', fx);
        break;
      case 'rules':
        if (s.q === 'many') s = { ...s, q: 'speed', manySet: false, quiet: 0, say: LINES.speed }; else s = enter(s, 'what', fx, { group: null });
        if (s.step === 'rules') fx.push({ say: LINES.speed });
        break;
      case 'name': s = enter(s, 'rules', fx); break;
      case 'play': s = enter(s, 'name', fx); break;
    }
    return done();
  }

  if (t === 'saved-failed'){ if (s.step === 'play') s = enter(s, 'name', fx); return done(); }

  /* "arms up" and the remote's OK both go on from a step; OK also picks what the remote has lit */
  if (t === 'arms' || t === 'ok'){
    switch (s.step){
      case 'start':
        if (s.full){ fx.push({ full: true }, { say: FULL_LINE }); break; }
        s = enter(s, 'where', fx); break;
      case 'where':
        s = enter(s, 'game', fx, { picks: clean({ ...s.picks, where: WORLDS[s.worldIx] }) }); fx.push({ cheer: 'pick' });
        break;
      case 'game':
        if (t === 'ok') return reduce(s, { t: 'job', id: JOBS[s.gameIx] });
        break;
      case 'what':
        if (t === 'ok'){
          if (!s.group) return reduce(s, { t: 'group', id: GROUPS[s.groupIx] });
          if (s.zone === 'parade'){ const id = groupIds(s.group)[s.parIx]; if (id) return reduce(s, { t: 'grab', id, explicit: true }); break; }
          if (s.zone === 'groups') return reduce(s, { t: 'ungroup' });
          if (s.zone === 'tray'){ if (s.tray[s.trayIx]) return reduce(s, { t: 'take', id: s.tray[s.trayIx] }); break; }
          /* zone 'done' falls through to finishing */
        }
        if (!s.tray.length){ fx.push({ say: LINES.none }); break; }
        s = enter(s, 'rules', fx, { picks: picksFrom(s) }); break;
      case 'rules':
        /* arms up or OK: this answer is accepted, and on to the next question (or the name) */
        if (s.q === 'speed'){ s = { ...s, q: 'many', manySet: false, quiet: 0, touched: true }; fx.push({ say: LINES.many }); }
        else s = toName(s, fx);
        break;
      case 'name':
        s = keepName(s, fx); break;
    }
    return done();
  }

  switch (t){
    case 'world': {
      if (s.step !== 'where') break;
      const ix = clampi(ev.ix, 0, WORLDS.length - 1);
      if (ix !== s.worldIx) s = { ...s, worldIx: ix, picks: clean({ ...s.picks, where: WORLDS[ix] }) };
      break;
    }
    case 'job': {
      if (s.step !== 'game' || !JOBS.includes(ev.id)) break;
      /* a new kind keeps the picks; every thing gets the job */
      s = { ...s, job: ev.id, gameIx: JOBS.indexOf(ev.id), picks: setAllJobs(s.picks, ev.id) };
      fx.push({ cheer: ev.id });
      s = enter(s, 'what', fx, { group: null, zone: 'parade' });
      break;
    }
    case 'group': {
      if (s.step !== 'what' || !GROUPS.includes(ev.id)) break;
      s = { ...s, group: ev.id, groupIx: GROUPS.indexOf(ev.id), zone: 'parade', parIx: 0 };
      fx.push({ cheer: 'pick' });
      break;
    }
    case 'ungroup': {
      if (s.step !== 'what' || !s.group) break;
      s = { ...s, group: null, zone: 'parade' };
      break;
    }
    case 'grab': {
      if (s.step !== 'what' || !pieceInfo(ev.id)) break;
      if (s.tray.includes(ev.id)){ if (ev.explicit) fx.push({ msg: 'You have that one! Wait for another.' }); break; }      /* (OK or a click on a thing already picked says so) */
      if (s.tray.length >= MAX_THINGS){ fx.push({ msg: `${MAX_THINGS} is plenty! Touch one in the tray to put it back.` }); break; }
      s = { ...s, tray: [...s.tray, ev.id] };
      fx.push({ pop: ev.id }, { cheer: 'pick' });
      break;
    }
    case 'take': {
      if (s.step !== 'what' || !s.tray.includes(ev.id)) break;
      const tray = s.tray.filter(x => x !== ev.id);
      s = { ...s, tray, trayIx: clampi(s.trayIx, 0, Math.max(0, tray.length - 1)), zone: tray.length || s.zone !== 'tray' ? s.zone : 'parade' };
      if (s.zone === 'done' && !tray.length) s = { ...s, zone: 'parade' };
      break;
    }
    case 'meter': {                      /* the hand's height, live: the stop it is at for this question */
      if (s.step !== 'rules') break;
      const n = s.q === 'speed' ? SPEED_STOPS : MANY_STOPS, i = clampi(ev.i, 0, n - 1);
      if (i !== s.picks[s.q] || !s.touched) s = { ...s, picks: clean({ ...s.picks, [s.q]: i }), quiet: 0, touched: true };
      break;
    }
    case 'set': {                        /* the hand held still: this question is answered */
      if (s.step !== 'rules') break;
      if (s.q === 'speed'){ s = { ...s, q: 'many', manySet: false, quiet: 0, touched: true }; fx.push({ say: LINES.many }, { cheer: 'pick' }); }
      else if (!s.manySet){ s = { ...s, manySet: true, touched: true }; fx.push({ cheer: 'pick' }); }
      break;
    }
    case 'spin': {                       /* a jump, or the wheel held: the name wheel turns on */
      if (s.step !== 'name') break;
      s = { ...s, nameIx: wrap(s.nameIx + (ev.by || 1), s.names.length) };
      break;
    }
    case 'key': s = keyed(s, ev.key, fx); break;
    case 'full': s = { ...s, full: !!ev.full && !s.editing }; break;      /* (the family's slots filled or freed while the start screen waits) */
  }
  return done();
}

/* where the remote is, as the screen must show it: { zone, item } (the one thing OK would act on, or the arrows move).
   where: the world (item = world) | game: a card | what: 'groups' tiles (group null) | in a group's parade: 'parade' (item = the thing), 'groups' (the
   button back to the tiles), 'tray' (item = slot), 'done' | rules: 'meter' (item = 0 speed, 1 many) | name: 'keep'. Other steps: null. */
export function focusOf(s){
  switch (s.step){
    case 'where': return { zone: 'world', item: s.worldIx };
    case 'game': return { zone: 'card', item: s.gameIx };
    case 'what':
      if (!s.group) return { zone: 'tiles', item: s.groupIx };
      if (s.zone === 'tray') return { zone: 'tray', item: s.trayIx };
      return { zone: s.zone, item: s.zone === 'parade' ? s.parIx : 0 };
    case 'rules': return { zone: 'meter', item: s.q === 'many' ? 1 : 0 };
    case 'name': return { zone: 'keep', item: 0 };
  }
  return null;
}

/* the remote's arrows, per step */
function keyed(s, key, fx){
  const dx = key === 'left' ? -1 : key === 'right' ? 1 : 0, dy = key === 'up' ? -1 : key === 'down' ? 1 : 0;
  switch (s.step){
    case 'where':
      if (dx) return reduce(s, { t: 'world', ix: wrap(s.worldIx + dx, WORLDS.length) }).state;
      break;
    case 'game':
      if (dx) s = { ...s, gameIx: wrap(s.gameIx + dx, JOBS.length) };        /* (one row of four) */
      break;
    case 'what': {
      if (!s.group){ if (dx) s = { ...s, groupIx: wrap(s.groupIx + dx, GROUPS.length) }; break; }
      const n = groupIds(s.group).length;
      if (s.zone === 'parade'){
        if (dx) s = { ...s, parIx: wrap(s.parIx + dx, n) };
        else if (dy < 0) s = { ...s, zone: 'groups' };
        else if (dy > 0 && s.tray.length) s = { ...s, zone: 'tray', trayIx: Math.min(s.trayIx, s.tray.length - 1) };
      } else if (s.zone === 'groups'){
        if (dy > 0) s = { ...s, zone: 'parade' };
      } else if (s.zone === 'tray'){
        if (dx) s = { ...s, trayIx: clampi(s.trayIx + dx, 0, s.tray.length - 1) };
        else if (dy) {                                        /* (the tray is three slots across, two rows) */
          const to = s.trayIx + dy * 3;
          if (to < 0) s = { ...s, zone: 'parade' };
          else if (to >= s.tray.length) s = { ...s, zone: 'done' };
          else s = { ...s, trayIx: to };
        }
      } else if (s.zone === 'done'){
        if (dy < 0) s = { ...s, zone: s.tray.length ? 'tray' : 'parade', trayIx: Math.max(0, s.tray.length - 1) };
      }
      break;
    }
    case 'rules':
      /* up is more: a higher hand is a higher stop */
      if (dy) s = reduce(s, { t: 'meter', i: s.picks[s.q] - dy }).state;
      break;
    case 'name':
      if (dx) s = { ...s, nameIx: wrap(s.nameIx + dx, s.names.length) };
      break;
  }
  return s;
}

/* "I'll pick!" and Skip: the usual rules for everything the Rules step owns */
export function usualRules(s){
  const d = defaultPicks(), usual = {};
  for (const k of RULE_KEYS) usual[k] = d[k];
  return { ...s, picks: clean({ ...s.picks, ...usual }) };
}
function toName(s, fx){
  const names = nameWheel(s.picks, s.startName);
  return enter(s, 'name', fx, { names, nameIx: 0 });
}
function keepName(s, fx){
  const name = s.names[s.nameIx] || nameWheel(s.picks)[0];
  const picks = clean({ ...s.picks, name });
  fx.push({ say: LINES.play }, { cheer: 'pick' }, { play: { id: s.editing, name, picks } });
  return { ...s, step: 'play', picks, say: LINES.play, quiet: 0 };
}
