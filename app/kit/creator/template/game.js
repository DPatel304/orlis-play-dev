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
      /* the world: a calm painted evening - see "The Orlis look and feel" */
      drawWorld(c, W, H);
      /* the stars: flat colour, one shadow tone on the right */
      for (const s of stars){
        c.save();
        c.globalAlpha = Math.max(0, s.fade);
        c.translate(s.x * W, s.y * H); c.rotate(s.spin * 0.3);
        drawStar(c, s.r * H, s.gold ? '#ffb02e' : '#ffe680', s.caught >= 0 ? Orlis.PLAYER_COLORS[s.caught] : null);
        c.restore();
      }
      /* each player's hands: glowing mitts in their colour, on top of everything */
      Orlis.pose.players.forEach((p, i) => {
        if (!p.present) return;
        for (const hand of [p.hands.left, p.hands.right]) mitt(c, hand.x * W, hand.y * H, H * 0.03, Orlis.PLAYER_COLORS[i]);
      });
    },

    /* the scores at the top, one for each player */
    hud(){ return { score }; },
    /* the best score, for the results */
    value(){ return Math.max(...score.slice(0, players)); },
    over: false
  };
}

/* The world behind the stars: a sky that fades from evening blue to cream
   at the horizon, a warm glow where the sun's going down on the left, and
   two bands of hills - the far one paler, fading into the sky. */
function drawWorld(c, W, H){
  const sky = c.createLinearGradient(0, 0, 0, H * 0.8);
  sky.addColorStop(0, '#8aa8d6'); sky.addColorStop(1, '#f6ead2');
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  const sun = c.createRadialGradient(W * 0.15, H * 0.62, 10, W * 0.15, H * 0.62, H * 0.7);
  sun.addColorStop(0, 'rgba(255,226,170,.8)'); sun.addColorStop(1, 'rgba(255,226,170,0)');
  c.fillStyle = sun; c.fillRect(0, 0, W, H);
  for (const [y, col, amp] of [[0.8, '#a9c98f', 0.05], [0.9, '#8fbf6a', 0.04]]){
    c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += W / 40) c.lineTo(x, H * (y - amp * (0.5 + 0.5 * Math.sin(x / W * 7 + y * 10))));
    c.lineTo(W, H); c.closePath(); c.fill();
  }
}

/* a five-pointed star, centred on 0,0: flat colour, its shadow side on the
   right (the sun's on the left), a ring in the catcher's colour */
function drawStar(c, r, fill, ring){
  const shape = () => {
    c.beginPath();
    for (let k = 0; k < 10; k++){
      const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r;
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
  };
  shape(); c.fillStyle = fill; c.fill();
  c.save(); shape(); c.clip();
  c.fillStyle = 'rgba(52,40,96,.2)'; c.beginPath(); c.arc(r * 0.7, r * 0.4, r, 0, Math.PI * 2); c.fill();
  c.restore();
  if (ring){ shape(); c.lineWidth = r * 0.2; c.strokeStyle = ring; c.stroke(); }
}

/* a player's hand: a glowing mitt in their colour (every Orlis game's hands) */
function mitt(c, x, y, r, col){
  const g = c.createRadialGradient(x, y, r * 0.4, x, y, r * 2.4);
  g.addColorStop(0, col + 'aa'); g.addColorStop(1, col + '00');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.4, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.lineWidth = r * 0.28; c.strokeStyle = col; c.stroke();
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i < 8; i++){ const a = i * Math.PI / 4, d = i % 2 ? r * 0.22 : r * 0.55; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
  c.closePath(); c.fill();
}

Orlis.run({
  secs: ROUND,
  create(n){ return makeRound(n); }
});
