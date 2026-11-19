/* Star Catch - the starter game. Stars drift down through an evening sky;
   reach out and catch them with your hands. Gold ones are worth double. Two
   play at once (one alone is fine), each with their own score.

   A game is one object handed to Orlis.run at the end of this file. Its
   create(n) starts a round and gives back the round: step it, draw it,
   say the score. Everything about how this works is in CLAUDE.md and the
   orlis-game skill. Change anything - this is yours. */

const ROUND = 90;              /* seconds in a round */

function makeRound(players){
  const stars = [];
  const score = Array(Orlis.MAX_PLAYERS).fill(0);
  let t = 0, spawn = 0;

  /* a new star, somewhere along the top */
  function addStar(W, H){
    const gold = Math.random() < 0.15;
    stars.push({ x: 0.08 + Math.random() * 0.84, y: -0.05, r: gold ? 0.045 : 0.035, vy: 0.08 + Math.random() * 0.06,
      spin: Math.random() * 6, gold, caught: -1, fade: 1 });
  }

  /* is a hand (0..1 across and down the screen) touching a star? */
  const touching = (hand, s, W, H) => Math.hypot((hand.x - s.x) * W, (hand.y - s.y) * H) < (s.r * 1.6) * H;

  return {
    step(dt, W, H){
      t += dt;
      /* more stars as the round goes on */
      spawn -= dt;
      if (spawn <= 0){ addStar(W, H); spawn = Math.max(0.45, 1.3 - t / 90); }
      for (const s of stars){
        if (s.caught >= 0){ s.fade -= dt * 3; continue; }
        s.y += s.vy * dt; s.spin += dt * 2;
        /* every player who's there, both hands */
        Orlis.pose.players.forEach((p, i) => {
          if (!p.present || s.caught >= 0) return;
          for (const hand of [p.hands.left, p.hands.right]){
            if (touching(hand, s, W, H)){
              s.caught = i; score[i] += s.gold ? 2 : 1;
              s.gold ? Orlis.sfx.gold() : Orlis.sfx.pop();
              break;
            }
          }
        });
      }
      /* (gone: caught and faded, or off the bottom) */
      for (let k = stars.length - 1; k >= 0; k--) if (stars[k].fade <= 0 || stars[k].y > 1.1) stars.splice(k, 1);
    },

    draw(c, W, H){
      /* the world: a calm painted evening, from the library - a game draws only with Orlis.assets (see the skill's Pictures section) */
      Orlis.assets.scene(c, W, H, 'sunset', { t });
      /* the stars: a catcher's colour rings one as it's caught */
      for (const s of stars){
        const size = s.r * 2.4 * H;
        Orlis.assets.draw(c, 'star', s.x * W, s.y * H, size, { color: s.gold ? '#ffb02e' : '#ffe680', rotate: s.spin * 0.3, alpha: Math.max(0, s.fade) });
        if (s.caught >= 0) Orlis.assets.draw(c, 'popring', s.x * W, s.y * H, size * 1.8, { color: Orlis.PLAYER_COLORS[s.caught], t: 1 - s.fade });
      }
      /* the hint: a picture and a few words, on the shared screen (it arrives big, then docks under the clock) */
      Orlis.ui.say(c, W, H, { text: '\u2B50 Catch the stars!', t, until: 8 });
      /* each player's hands: glowing mitts in their colour, on top of everything */
      Orlis.pose.players.forEach((p, i) => {
        if (!p.present) return;
        for (const hand of [p.hands.left, p.hands.right]) Orlis.assets.draw(c, 'hand', hand.x * W, hand.y * H, H * 0.12, { color: Orlis.PLAYER_COLORS[i] });
      });
    },

    /* the scores (top left, a pill for each player) - Orlis Play draws them; the card shows the move for a few seconds */
    hud(){ return { score }; },
    card(){ return t < 8 ? 'reach' : null; },
    /* the best score, for the results */
    value(){ return Math.max(...score.slice(0, players)); },
    over: false
  };
}

Orlis.run({
  secs: ROUND,
  create(n){ return makeRound(n); }
});
