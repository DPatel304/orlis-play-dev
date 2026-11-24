/* The builder's state, with no DOM (decisions 0056 and 0057; the look is docs/create-mockup.html): six steps, the picks, and what each
   move does. The screen (ui/create-studio.js) draws this and calls these; the tests walk it.

     state = { step: 0..5, picks, name: the name picked (or null), editing: the id of the game being changed (or null) }
   Every function gives back a new state. */
import { defaultPicks, clean, build, sentence, suggestNames, choices } from './recipe.js';

export const STEPS = [
  { id: 'how', label: 'How it plays' },
  { id: 'what', label: 'What' },
  { id: 'where', label: 'Where' },
  { id: 'move', label: 'Your move' },
  { id: 'rules', label: 'Rules' },
  { id: 'name', label: 'Name & play' }
];
export const LAST = STEPS.length - 1;
/* the settings the Rules step owns (a skip puts these back to the usual) */
export const RULE_KEYS = ['speed', 'many', 'size', 'minutes', 'mode', 'golden', 'bomb'];
export const SKIP_LABEL = 'Skip, use the usual rules';

/* a new game, or (with a creation) the builder opened on the game's own picks, to save back into its slot */
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

/* what the specials of this recipe can be (Keep it up has none) */
export const hasSpecials = (picks) => (choices.how.find(h => h.id === picks.how) || {}).specials !== false;

/* the step's title and line, as the right-hand side opens */
const PLURAL_ASK = { catch: 'catch', pop: 'pop', dodge: 'dodge', collect: 'collect', keepup: 'keep up' };
export function stepInfo(state){
  const s = STEPS[state.step], p = state.picks;
  const info = {
    how: { title: 'How does it play?', sub: '' },
    what: { title: `What do you ${PLURAL_ASK[p.how]}?`, sub: '' },
    where: { title: 'Where is it?', sub: '' },
    move: { title: 'How do you move?', sub: 'This card shows in the corner of your game.' },
    rules: { title: 'Make the rules', sub: '' },
    name: { title: 'Name your game', sub: 'Pick one.' }
  }[s.id];
  return { id: s.id, index: state.step, label: s.label, ...info, nextLabel: s.id === 'name' ? 'Play it!' : 'Next' };
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
