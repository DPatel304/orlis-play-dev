/* How a game's count is said: "1 balloon", "12 balloons" (U2). A game's `unit` is the plural ('balloons'); the singular comes from this
   list, or from dropping the final "s" ("ies" becomes "y"). Words that do not change (fruit) are listed too. */
const ONE = {
  leaves: 'leaf', stories: 'story', fruit: 'fruit',
  'bits of sky painted': 'bit of sky painted'
};
export function singular(unit){
  const u = String(unit || 'points');
  if (ONE[u]) return ONE[u];
  if (/ies$/.test(u)) return u.slice(0, -3) + 'y';
  if (/s$/.test(u)) return u.slice(0, -1);
  return u;
}
/* a number and its unit, the right way round: countText(1, 'balloons') is "1 balloon" */
export function countText(n, unit){
  const k = Math.round(Number(n) || 0);
  return `${k} ${k === 1 ? singular(unit) : (unit || 'points')}`;
}

/* The words under the big number on the results card: "balloons popped", "leaves swept"... (a game without its own says its unit).
   n = 1 gives the singular. Two lines at most. */
const DONE = { 'pop-party': ['balloons', 'popped'], 'leaf-pile': ['leaves', 'swept'], 'stack-it-high': ['blocks', 'stacked'], 'keep-it-up': ['bounces', 'together'],
  'sleepy-bear': ['stars', 'earned'], 'animal-gym': ['moves', 'made'], 'ptero-flight': ['wonders', 'spotted'], 'sky-painter': ['bits of sky', 'painted'],
  'save-the-harvest': ['fruit', 'picked'] };
export function resultWords(game, n = 2){
  const [unit, verb] = DONE[game && game.id] || [(game && game.unit) || 'points', ''];
  const word = Math.round(Number(n) || 0) === 1 ? singular(unit) : unit;
  return verb ? [word, verb] : [word];
}
