/* The builder's state, with no DOM (decisions 0056, 0057, 0059; the look is docs/create-mockup.html): four steps (Where, What, Rules,
   Name & play), the picks, and what each move does. The screen (ui/create-studio.js) draws this and calls these; the tests walk it.

     state = { step: 0..4, picks, name: the name picked (or null), editing: the id of the game being changed (or null) }
   Every function gives back a new state. */
import { defaultPicks, clean, build, sentence, suggestNames, addThing, removeThing, setJob, setAllJobs, gameJob, hasThing, goldenOn, bombOn, MAX_THINGS } from './recipe.js';

export const STEPS = [
  { id: 'where', label: 'Where' },
  { id: 'what', label: 'What' },
  { id: 'rules', label: 'Rules' },
  { id: 'name', label: 'Name & play' }
];
export const LAST = STEPS.length - 1;
/* the settings the Rules step owns (a skip puts these back to the usual) */
export const RULE_KEYS = ['speed', 'many', 'size', 'minutes', 'mode', 'golden', 'bomb'];
export const SKIP_LABEL = 'Skip, use the usual rules';

/* a new game, or (with a creation) the builder opened on the game's own picks, to save back into its slot (a game made before 0059 opens as one thing with its job) */
export function newBuilder(creation = null){
  if (!creation) return { step: 0, picks: defaultPicks(), name: null, editing: null };
  const { name: _n, ...picks } = clean({ ...creation.picks });
  return { step: 0, picks, name: creation.name || creation.picks.name || null, editing: creation.id };
}

/* a pick: one setting changes, everything stays whole and valid */
export function pick(state, key, value){
  const { name: _n, ...rest } = state.picks;
  return { ...state, picks: clean({ ...rest, [key]: value }) };
}
export const flip = (state, key) => pick(state, key, !state.picks[key]);

/* the things (What): add one (up to five, each once), take one off (one always stays), give one its job */
const withPicks = (state, make) => { const { name: _n, ...rest } = state.picks; return { ...state, picks: make(clean(rest)) }; };
export const addPiece = (state, id) => withPicks(state, (p) => addThing(p, id));
export const removePiece = (state, id) => withPicks(state, (p) => removeThing(p, id));
export const togglePiece = (state, id) => hasThing(state.picks, id) ? removePiece(state, id) : addPiece(state, id);
/* the game's one job, for every thing (the builder asks for this; each thing can still hold its own) */
export const jobAll = (state, job) => withPicks(state, (p) => setAllJobs(p, job));
export const jobNow = (state) => gameJob(state.picks);
export const jobOf = (state, id, job) => withPicks(state, (p) => setJob(p, id, job));
export const isPicked = (state, id) => hasThing(state.picks, id);
export const canAdd = (state) => state.picks.things.length < MAX_THINGS;
export const canRemove = (state) => state.picks.things.length > 1;

export const go = (state, by) => ({ ...state, step: Math.max(0, Math.min(LAST, state.step + by)) });
export const next = (state) => go(state, 1);
export const back = (state) => go(state, -1);
export const isLast = (state) => state.step === LAST;
export const canBack = (state) => state.step > 0;

/* "Skip, use the usual rules": speed, how many, round, together, specials all go back to what a first game has, and it goes on to the name */
export function skipRules(state){
  const d = defaultPicks(), usual = {}, { name: _n, ...rest } = state.picks;
  for (const k of RULE_KEYS) usual[k] = d[k];
  return { ...state, picks: clean({ ...rest, ...usual }), step: LAST };
}

/* which specials make sense for the things picked: a golden one needs something to Collect; a bomb needs something that moves about (not only a ball to keep up) */
export const hasGolden = (picks) => goldenOn(picks);
export const hasBomb = (picks) => bombOn(picks);
export const hasSpecials = (picks) => goldenOn(picks) || bombOn(picks);

/* the step's title and line, as the right-hand side opens */
const STEP_INFO = {
  where: { title: 'Where is it?', sub: '' },
  what: { title: 'What is in it?', sub: 'Pick a job, then up to 5 things.' },
  rules: { title: 'Make the rules', sub: '' },
  name: { title: 'Name your game', sub: 'Pick one.' }
};
export function stepInfo(state){
  const s = STEPS[state.step];
  return { id: s.id, index: state.step, label: s.label, ...STEP_INFO[s.id], nextLabel: s.id === 'name' ? 'Play it!' : 'Next' };
}
/* the strip on top: done (ticked), current, to come */
export const stripOf = (state) => STEPS.map((s, i) => ({ id: s.id, label: s.label, n: i + 1, status: i < state.step ? 'done' : i === state.step ? 'cur' : 'todo' }));

/* the three names to pick from (the game's own name first when it is being changed), and the one picked */
export function nameChoices(state){
  const { name: _n, ...picks } = state.picks;
  const names = suggestNames(picks);
  if (state.editing && state.name && !names.includes(state.name)) return [state.name, ...names].slice(0, 3);
  return names;
}
export const nameOf = (state) => { const list = nameChoices(state); return state.name && list.includes(state.name) ? state.name : list[0]; };
export const setName = (state, name) => ({ ...state, name });

/* the picks as they are saved, and the game description they make (it always passes validate.js) */
export const finalPicks = (state) => ({ ...state.picks, name: nameOf(state) });
export const specOf = (state) => build(finalPicks(state));
export const sumUp = (state) => sentence(state.picks);
