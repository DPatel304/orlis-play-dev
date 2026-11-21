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
