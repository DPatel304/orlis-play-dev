/* Firefly Jar. Fireflies drift around a dusky meadow. Reach out (or cup
   both hands) near one to catch it - it follows your hand - then carry it to
   the glass jar in the middle. The jar glows brighter with every firefly.
   When it's full, all the fireflies fly free in a big sparkle, and the jar
   is ready to fill again. Two play at once (one alone is fine). */

const ROUND = 90;              /* seconds in a round */
const CAP = 8;                 /* fireflies to fill the jar */
const WILD = 6;                /* fireflies drifting in the meadow */
const JAR = { x: 0.5, y: 0.64 };
const HAND_R = 0.10;           /* one hand catches from this far (x H) */
const CUP_R = 0.16;            /* two hands cupped together catch from further */
const DROP_R = 0.18;           /* bring a firefly this close to the jar */
const FLY_COLS = ['#ffe45a', '#e8ff7a', '#ffd25a'];

function makeRound(players){
  const score = Array(Orlis.MAX_PLAYERS).fill(0);
  const flies = [];   /* in the meadow, or being carried */
  const inJar = [];   /* glowing inside the jar */
  const free = [];    /* set free, floating up and away */
  const sparks = [];
  let t = 0, cheer = 0, glow = 0, refill = 0;

  function addFly(){
    let x, y, tries = 0;
    do { x = 0.08 + Math.random() * 0.84; y = 0.22 + Math.random() * 0.6; tries++; }
    while (tries < 20 && Math.abs(x - JAR.x) < 0.15 && y > 0.4);
    flies.push({ x, y, ph: Math.random() * 6, held: null, born: 0, col: FLY_COLS[Math.floor(Math.random() * 3)] });
  }

  function burst(x, y, n, speed, col){
    for (let k = 0; k < n; k++){
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6 + Math.random() * 0.6,
        col: col || FLY_COLS[k % 3] });
    }
  }

  const dist = (ax, ay, bx, by, W, H) => Math.hypot((ax - bx) * W, (ay - by) * H) / H;

  function fillUp(){
    /* the jar is full: everyone flies free in a big sparkle */
    Orlis.sfx.tada();
    cheer = 2.5; refill = 1.2;
    for (const f of inJar){
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      free.push({ x: JAR.x + f.ox * 0.05, y: JAR.y + f.oy * 0.06, vx: Math.cos(a) * 0.25, vy: Math.sin(a) * 0.3,
        ph: f.ph, life: 3, col: f.col });
    }
    inJar.length = 0;
    burst(JAR.x, JAR.y - 0.05, 40, 0.45);
  }

  return {
    step(dt, W, H){
      t += dt; cheer -= dt; refill -= dt;
      const ps = Orlis.pose.players;

      /* which hands are free, and who's cupping */
      const busy = new Set();
      for (const f of flies) if (f.held) busy.add(f.held.p + f.held.h);

      /* keep the meadow full (a little pause after the jar fills) */
      if (refill <= 0 && flies.length < WILD) addFly();

      for (let k = flies.length - 1; k >= 0; k--){
        const f = flies[k];
        f.born = Math.min(1, f.born + dt * 1.5);
        f.ph += dt;

        if (f.held){
          const p = ps[f.held.p];
          if (!p || !p.present){ f.held = null; continue; }   /* they stepped away: it drifts off */
          const hand = p.hands[f.held.h];
          f.x += (hand.x - f.x) * Math.min(1, dt * 12);
          f.y += (hand.y - 0.03 - f.y) * Math.min(1, dt * 12);
          /* near the jar: it hops in */
          if (dist(hand.x, hand.y, JAR.x, JAR.y, W, H) < DROP_R){
            score[f.held.p] += 1;
            inJar.push({ ox: (Math.random() - 0.5) * 1.4, oy: (Math.random() - 0.3) * 1.4, ph: Math.random() * 6, col: f.col });
            flies.splice(k, 1);
            Orlis.sfx.chime();
            burst(JAR.x, JAR.y - 0.08, 10, 0.25, Orlis.PLAYER_COLORS[f.held.p]);
            if (inJar.length >= CAP) fillUp();
          }
          continue;
        }

        /* drifting: a lazy wander */
        f.x += Math.sin(t * 0.6 + f.ph * 3) * 0.05 * dt;
        f.y += Math.cos(t * 0.5 + f.ph * 2) * 0.04 * dt;
        /* stay in the meadow, and off the jar */
        if (f.x < 0.07) f.x += 0.1 * dt; if (f.x > 0.93) f.x -= 0.1 * dt;
        if (f.y < 0.2) f.y += 0.1 * dt;  if (f.y > 0.85) f.y -= 0.1 * dt;
        if (dist(f.x, f.y, JAR.x, JAR.y, W, H) < 0.22) f.x += (f.x < JAR.x ? -0.08 : 0.08) * dt;
        if (f.born < 1) continue;

        /* every player who's there: cupped hands, or one hand */
        let caught = false;
        ps.forEach((p, i) => {
          if (caught || !p.present) return;
          const L = p.hands.left, R = p.hands.right;
          const cupped = dist(L.x, L.y, R.x, R.y, W, H) < 0.18;
          const mx = (L.x + R.x) / 2, my = (L.y + R.y) / 2;
          for (const h of ['left', 'right']){
            if (busy.has(i + h)) continue;
            const hand = p.hands[h];
            const d = dist(hand.x, hand.y, f.x, f.y, W, H);
            const near = d < HAND_R || (cupped && dist(mx, my, f.x, f.y, W, H) < CUP_R);
            if (near){
              f.held = { p: i, h }; busy.add(i + h); caught = true;
              Orlis.sfx.firefly();
              burst(f.x, f.y, 6, 0.2, Orlis.PLAYER_COLORS[i]);
              return;
            }
            /* a little help: fireflies drift towards a hand that's nearly there */
            if (d < 0.28){
              f.x += (hand.x - f.x) * dt * 0.6;
              f.y += (hand.y - f.y) * dt * 0.6;
            }
          }
        });
      }

      for (let k = free.length - 1; k >= 0; k--){
        const f = free[k];
        f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.99; f.vy -= 0.02 * dt; f.ph += dt; f.life -= dt;
        if (f.life <= 0) free.splice(k, 1);
      }
      for (let k = sparks.length - 1; k >= 0; k--){
        const s = sparks[k];
        s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.96; s.vy *= 0.96; s.life -= dt;
        if (s.life <= 0) sparks.splice(k, 1);
      }

      const target = cheer > 0 ? 1 : inJar.length / CAP;
      glow += (target - glow) * Math.min(1, dt * 3);
    },

    draw(c, W, H){
      drawWorld(c, W, H);
      const carrying = flies.some(f => f.held);
      drawJar(c, W, H, glow, inJar, t, carrying);
      for (const f of flies) drawFly(c, f.x * W, f.y * H, H, f.ph, f.col, f.born, f.held ? Orlis.PLAYER_COLORS[f.held.p] : null);
      for (const f of free) drawFly(c, f.x * W, f.y * H, H, f.ph, f.col, Math.min(1, f.life), null);
      for (const s of sparks){
        c.globalAlpha = Math.max(0, Math.min(1, s.life));
        twinkle(c, s.x * W, s.y * H, H * 0.012, s.col);
      }
      c.globalAlpha = 1;

      if (t < 3) say(c, 'Fill the jar!', W / 2, H * 0.19, H);
      else if (cheer > 0) say(c, 'Hooray!', W / 2, H * 0.19, H);

      /* each player's hands, on top of everything */
      Orlis.pose.players.forEach((p, i) => {
        if (!p.present) return;
        for (const hand of [p.hands.left, p.hands.right]) mitt(c, hand.x * W, hand.y * H, H * 0.03, Orlis.PLAYER_COLORS[i]);
      });
    },

    hud(){ return { score }; },
    value(){ return Math.max(...score.slice(0, players)); },
    get mood(){ return inJar.length / CAP; },
    over: false
  };
}

/* a dusky meadow: sky from soft evening blue to cream at the horizon, the
   last warm glow of the sun on the left, far hills fading into the sky */
function drawWorld(c, W, H){
  const sky = c.createLinearGradient(0, 0, 0, H * 0.78);
  sky.addColorStop(0, '#7f8fc6'); sky.addColorStop(0.55, '#c7b9cf'); sky.addColorStop(1, '#f6ead2');
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  const sun = c.createRadialGradient(W * 0.12, H * 0.7, 10, W * 0.12, H * 0.7, H * 0.7);
  sun.addColorStop(0, 'rgba(255,214,160,.75)'); sun.addColorStop(1, 'rgba(255,214,160,0)');
  c.fillStyle = sun; c.fillRect(0, 0, W, H);
  /* a few first stars */
  c.fillStyle = 'rgba(250,247,238,.7)';
  for (const [x, y] of [[0.62, 0.08], [0.78, 0.14], [0.9, 0.06], [0.3, 0.1], [0.7, 0.24]]){
    c.beginPath(); c.arc(x * W, y * H, H * 0.004, 0, Math.PI * 2); c.fill();
  }
  /* a long soft cloud */
  c.fillStyle = 'rgba(246,234,210,.35)';
  c.beginPath(); c.ellipse(W * 0.28, H * 0.3, W * 0.16, H * 0.025, 0, 0, Math.PI * 2); c.fill();
  for (const [y, col, amp] of [[0.74, '#b3bfa6', 0.05], [0.83, '#93ad80', 0.045], [0.93, '#7fa165', 0.03]]){
    c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += W / 40) c.lineTo(x, H * (y - amp * (0.5 + 0.5 * Math.sin(x / W * 6 + y * 11))));
    c.lineTo(W, H); c.closePath(); c.fill();
  }
  /* little grass tufts */
  c.fillStyle = '#6f9a5e';
  for (const gx of [0.08, 0.22, 0.79, 0.91]){
    const x = gx * W, y = H * 0.95;
    c.beginPath(); c.moveTo(x - H * 0.02, y); c.lineTo(x - H * 0.006, y - H * 0.05); c.lineTo(x, y);
    c.lineTo(x + H * 0.008, y - H * 0.04); c.lineTo(x + H * 0.02, y); c.closePath(); c.fill();
  }
}

/* the glass jar in the middle, glowing with what's inside */
function drawJar(c, W, H, glow, inJar, t, carrying){
  const cx = JAR.x * W, cy = JAR.y * H;
  const pulse = carrying ? 1 + Math.sin(t * 6) * 0.03 : 1;
  const jw = H * 0.2 * pulse, jh = H * 0.26 * pulse;
  /* shadow on the ground, falling right */
  c.fillStyle = 'rgba(52,40,96,.2)';
  c.beginPath(); c.ellipse(cx + jw * 0.35, cy + jh * 0.5, jw * 0.7, jh * 0.08, 0, 0, Math.PI * 2); c.fill();
  /* the glow */
  const gr = jh * (0.8 + glow * 1.4);
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, gr);
  g.addColorStop(0, `rgba(255,232,120,${0.15 + glow * 0.65})`); g.addColorStop(1, 'rgba(255,232,120,0)');
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, gr, 0, Math.PI * 2); c.fill();
  /* the glass */
  const body = () => { c.beginPath(); c.roundRect(cx - jw / 2, cy - jh / 2, jw, jh, jw * 0.22); };
  body(); c.fillStyle = `rgba(${220 + glow * 35},${236 + glow * 10},${235 - glow * 60},${0.45 + glow * 0.3})`; c.fill();
  c.save(); body(); c.clip();
  /* the fireflies inside */
  for (const f of inJar){
    const fx = cx + f.ox * jw * 0.32 + Math.sin(t * 1.3 + f.ph) * jw * 0.05;
    const fy = cy + f.oy * jh * 0.28 + Math.cos(t * 1.1 + f.ph) * jh * 0.04;
    const fg = c.createRadialGradient(fx, fy, 0, fx, fy, H * 0.04);
    fg.addColorStop(0, f.col); fg.addColorStop(1, 'rgba(255,230,90,0)');
    c.fillStyle = fg; c.beginPath(); c.arc(fx, fy, H * 0.04, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fffbe0'; c.beginPath(); c.arc(fx, fy, H * 0.009, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = 'rgba(52,40,96,.2)';
  c.beginPath(); c.arc(cx + jw * 0.75, cy + jh * 0.1, jw * 0.6, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,.4)';
  c.beginPath(); c.roundRect(cx - jw * 0.36, cy - jh * 0.32, jw * 0.08, jh * 0.55, jw * 0.04); c.fill();
  c.restore();
  /* the lid */
  const lid = () => { c.beginPath(); c.roundRect(cx - jw * 0.4, cy - jh / 2 - jh * 0.1, jw * 0.8, jh * 0.12, jh * 0.03); };
  lid(); c.fillStyle = '#9a7f62'; c.fill();
  c.save(); lid(); c.clip();
  c.fillStyle = 'rgba(52,40,96,.2)'; c.fillRect(cx + jw * 0.18, cy - jh, jw, jh); c.restore();
}

/* a firefly: a bright glowing body with two little wings */
function drawFly(c, x, y, H, ph, col, alpha, ring){
  const r = H * 0.022;
  c.globalAlpha = Math.max(0, alpha);
  const pr = r * (3.5 + Math.sin(ph * 4) * 0.6);
  const g = c.createRadialGradient(x, y, 0, x, y, pr);
  g.addColorStop(0, ring ? ring + 'cc' : 'rgba(255,236,110,.85)'); g.addColorStop(1, 'rgba(255,236,110,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, pr, 0, Math.PI * 2); c.fill();
  const flap = Math.sin(ph * 18) * 0.4;
  c.fillStyle = 'rgba(255,255,255,.75)';
  c.beginPath(); c.ellipse(x - r * 0.7, y - r * 0.8, r * 0.7, r * 0.4, -0.6 + flap, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(x + r * 0.7, y - r * 0.8, r * 0.7, r * 0.4, 0.6 - flap, 0, Math.PI * 2); c.fill();
  c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
  c.fillStyle = 'rgba(52,40,96,.2)'; c.beginPath(); c.arc(x + r * 0.7, y + r * 0.3, r, 0, Math.PI * 2); c.fill();
  c.restore();
  c.globalAlpha = 1;
}

/* a little four-point sparkle */
function twinkle(c, x, y, r, col){
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i < 8; i++){ const a = i * Math.PI / 4, d = i % 2 ? r * 0.3 : r; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
  c.closePath(); c.fill();
}

/* a word card, centred at (x, y) */
function say(c, text, x, y, H){
  const size = Math.round(H * 0.04);
  c.font = `800 ${size}px Inter, Segoe UI, sans-serif`;
  const w = c.measureText(text).width + size * 1.6;
  c.fillStyle = 'rgba(250,247,238,.95)';
  c.beginPath(); c.roundRect(x - w / 2, y - size * 0.95, w, size * 1.9, size * 0.95); c.fill();
  c.fillStyle = '#33322e'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y + 2);
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
