/* The vocabulary of Orlis.play: everything a game made in Create can say. A game is a short description (kit/creator/template/game.js)
   made of these ready-made words - nothing else is understood, which is what keeps every game consistent and safe. Add to this
   file (and engine.js) to teach every game a new word; `doc` is what the creator's skill tells Claude about it.

   Positions are fractions of the screen (x across, y down, 0 to 1); sizes are fractions of the screen's height; speeds are
   screen heights a second. */

/* how things move */
export const MOVES = {
  fall:   { doc: 'drops down the screen', speed: 0.1 },
  rise:   { doc: 'floats up the screen', speed: 0.1 },
  drift:  { doc: 'glides across the screen, from the side it appeared on (or either way)', speed: 0.12 },
  bob:    { doc: 'stays where it is, bobbing gently', speed: 0 },
  wander: { doc: 'ambles about slowly', speed: 0.05 },
  bounce: { doc: 'a ball: gravity pulls it down and it bounces off the floor and the sides', speed: 0 },
  stay:   { doc: 'stays exactly where it is', speed: 0 }
};

/* when something happens to a thing */
export const TRIGGERS = {
  touched:    { doc: 'a hand touches it' },
  swiped:     { doc: 'a hand sweeps through it (fast)' },
  leftScreen: { doc: 'it goes off the edge of the screen' },
  lands:      { doc: 'it reaches the floor' },
  age:        { doc: 'it has been there a while ("after": seconds)' }
};

/* what happens (in a rule's "then" list). A string, or an object for the ones with a value. */
export const RESULTS = {
  score:     { doc: 'a point for whoever did it ({ "score": 2 } for more)', value: 'number' },
  sparkle:   { doc: 'a burst of sparkles' },
  pop:       { doc: 'a ring pops out' },
  vanish:    { doc: 'it disappears' },
  grow:      { doc: 'it gets bigger ({ "grow": 1.3 } is 30% bigger)', value: 'number' },
  become:    { doc: 'it turns into another piece ({ "become": "bunny" })', value: 'piece' },
  sound:     { doc: 'a sound ({ "sound": "pop" })', value: 'sound' },
  say:       { doc: 'new hint words ({ "say": "Well done!" } - a picture and up to four words)', value: 'text' },
  spawn:     { doc: 'another thing appears here ({ "spawn": "name of a thing" })', value: 'thing' },
  kickUp:    { doc: 'a ball is hit upward, a little the way the hand was going' },
  celebrate: { doc: 'confetti and a cheer' }
};

export const SOUNDS = ['pop', 'gold', 'hooray', 'whoosh', 'tada', 'chime', 'boing', 'chirp', 'plop', 'splash', 'spring', 'rustle', 'twinkle', 'bloom', 'tick'];
export const FROM = ['top', 'bottom', 'left', 'right', 'anywhere'];
/* colour names a game can use for a piece that takes a colour (or a #rrggbb) */
export const COLORS = { red: '#ff5d6c', orange: '#ffb84d', yellow: '#ffe36e', green: '#4cc9a0', blue: '#4da3ff', purple: '#a98bff', pink: '#ff7eb3', gold: '#ffb02e' };

/* the keys a game and a thing may have, with what each is */
export const GAME_KEYS = {
  secs: 'seconds in a round (20 to 600)', endless: 'true: no clock, it runs until the goal', scene: 'the background (a name from the library)',
  hint: 'the hint words: a picture and up to four words', hintFor: 'seconds the hint stays (then it fades)', card: 'the move card shown bottom left',
  cardFor: 'seconds the move card stays', team: 'true: everyone scores together (no score pills)', goal: '{ "score": 30, "ends": true } fills the goal bar; ends: true finishes the round at the goal',
  things: 'the things in the game (a list)', title: 'a name for the game (optional)'
};
export const THING_KEYS = {
  name: 'a name other things can refer to (spawn)', piece: 'a piece, or a list to pick from', color: 'a colour name, #rrggbb, or a list to pick from',
  size: 'height, as a share of the screen (0.02 to 0.4)', speed: 'how fast it moves', sway: 'side-to-side wobble as it moves (0 to 0.2)', spins: 'true: it turns as it goes',
  count: 'how many at the start (static things)', at: '{ "x": 0.5, "y": 0.8 } where it starts', appears: '{ "every": 1.2, "from": "top", "max": 8, "everyEnd": 0.6 } more keep coming',
  moves: 'one of the movements', rules: 'a list of { "when": trigger, "then": [results] }', flips: 'true: faces the way it moves'
};
export const LIMITS = { secs: [20, 600], size: [0.02, 0.4], speed: [0, 1], every: [0.15, 30], max: [1, 40], count: [1, 30], sway: [0, 0.2], hintFor: [1, 60], cardFor: [1, 600] };
