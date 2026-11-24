/* The games Orlis Play has built in: [id, name], in the order Home shows them (decision 0058: the owner can put one in a Featured slot).
   The server cannot import the app, so this is the one copy it keeps; app/test/builtin-ids.test.mjs checks it against
   app/src/games/index.js (the Home games, without the HIDDEN ones in app/src/ui/menu.js). Change a game there, change it here. */
export const BUILT_IN_GAMES = [
  ['pop-party', 'Pop Party'], ['sleepy-bear', 'Sleepy Bear'], ['leaf-pile', 'Leaf Pile'], ['stack-it-high', 'Stack It High'], ['sky-painter', 'Sky Painter'],
  ['animal-gym', 'Animal Gym'], ['keep-it-up', 'Keep It Up!'], ['ptero-flight', 'Pterry Flight'], ['save-the-harvest', 'Save the Harvest'],
  ['cubions-long-way-home', 'Cubion’s Long Way Home'], ['peekaboo', 'Peekaboo Garden']
];
export const builtIn = (id) => { const g = BUILT_IN_GAMES.find(x => x[0] === id); return g ? { id: g[0], name: g[1] } : null; };
