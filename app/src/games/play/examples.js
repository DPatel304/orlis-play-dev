/* Three games, in the vocabulary of Orlis.play: they prove the words are enough for the games Orlis already has (catching,
   popping, keeping a ball up), and are the starting point for new ones. The first is the starter every new game begins as. */
export const CATCH = {
  secs: 90, scene: 'sunset', hint: '⭐ Catch the stars!', hintFor: 8, card: 'reach', cardFor: 8,
  goal: { score: 40 },
  things: [{
    name: 'star', piece: 'star', color: ['touch.sunflower', 'touch.sunflower', 'touch.sunflower', 'ui.gold'], size: 0.085, spins: true, sway: 0.01,
    appears: { every: 1.3, everyEnd: 0.5, from: 'top', max: 9 }, moves: 'fall', speed: 0.1,
    rules: [{ when: 'touched', then: ['sparkle', 'score', { sound: 'pop' }, 'vanish'] }]
  }]
};

export const POP = {
  secs: 90, scene: 'meadow', hint: '\u{1F388} Pop the balloons!', hintFor: 8, card: 'reach', cardFor: 8,
  things: [{
    piece: 'balloon', color: ['touch.cherry', 'touch.tangerine', 'touch.sunflower', 'touch.mint', 'touch.skyBlue', 'touch.grape', 'touch.bubblegum'], size: 0.12, sway: 0.03,
    appears: { every: 0.9, everyEnd: 0.4, from: 'bottom', max: 10 }, moves: 'rise', speed: 0.11,
    rules: [{ when: 'touched', then: ['pop', 'score', { sound: 'pop' }, 'vanish'] }]
  }]
};

export const KEEP_UP = {
  secs: 90, scene: 'sunset', hint: '\u{1F3D0} Keep it up!', hintFor: 6, card: 'reach', cardFor: 6,
  things: [{
    piece: 'beachball', size: 0.13, at: { x: 0.5, y: 0.35 }, moves: 'bounce',
    rules: [{ when: 'touched', then: ['kickUp', 'score', { sound: 'pop' }] }]
  }]
};
export const EXAMPLES = { catch: CATCH, pop: POP, keepUp: KEEP_UP };
