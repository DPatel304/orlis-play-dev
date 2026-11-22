/* Peekaboo Garden's host rules (K3). Pure logic: no drawing, no DOM, no network.
   The host calls step(dt, inputs) every frame and sends snapshot() to the hider's phone.
   Spec: docs/specs/peekaboo-rules.md */
import { KINDS } from './world.js';

export const HIDE_TIME = 10, SEEK_TIME = 60, REVEAL_TIME = 4;
export const LEN = { hide: HIDE_TIME, seek: SEEK_TIME, reveal: REVEAL_TIME };
export const SPEED = 3;            /* steps per second at full tilt */
export const DEAD_ZONE = 0.15;
export const LIGHT_RADIUS = 1.5;   /* a lantern lights the hider within this many steps */
export const FAR = 6;              /* beyond this, "near" is 1 */
export const RUSTLE_REACH = 1.5;   /* moving this close to a bush's edge makes it rustle */
export const RUSTLE_EVERY = 0.4;   /* seconds between rustle events while moving */
const EPS = 1e-9;

export function createRound(world, { hider = 0, seekers = [], rng = Math.random } = {}) {
  const me = {
    hider, seekers: seekers.slice(), rng,
    round: 1, phase: 'hide', t: 0,
    x: world.start.x, z: world.start.z, facing: 0, moving: false,
    place: null,            /* id of the place the hider is inside, or null */
    meter: 0, near: 1,
    credit: {},             /* seat -> how much of the meter that seeker's lantern filled this round */
    result: null, foundBy: null,
  };
  let rustleIn = 0;

  const kindOf = id => (id ? world.place(id).kind : 'open');
  const foundTime = () => KINDS[kindOf(me.place)].T;

  function startHide(events) {
    me.phase = 'hide'; me.t = 0; me.meter = 0; me.near = 1; me.credit = {};
    me.result = null; me.foundBy = null; me.moving = false;
    me.x = world.start.x; me.z = world.start.z; me.place = null; rustleIn = 0;
    events.push({ type: 'phase', name: 'hide' });
  }
  function setPhase(name, events) { me.phase = name; me.t = 0; events.push({ type: 'phase', name }); }

  /* Move the hider from the stick; report entering / leaving places and rustling. */
  function move(dt, stick, act, events) {
    const was = me.place;
    const potLocked = was && kindOf(was) === 'pot';
    me.moving = false;
    if (potLocked && act === 'out') {
      const p = world.place(was);
      /* step out to the front edge (the side nearest the TV), just clear of the pot */
      const q = world.clamp(p.x, p.z - p.r - 0.05);
      me.x = q.x; me.z = q.z; me.place = null;
      events.push({ type: 'leave', placeId: was });
      return;
    }
    if (potLocked) return;                       /* stick is ignored inside a pot */
    let sx = stick ? stick.x || 0 : 0, sy = stick ? stick.y || 0 : 0;   /* y > 0 is away from the TV */
    const mag = Math.hypot(sx, sy);
    if (mag < DEAD_ZONE) { rustleIn = 0; return; }       /* standing still: the next move rustles at once */
    if (mag > 1) { sx /= mag; sy /= mag; }
    const q = world.clamp(me.x + sx * SPEED * dt, me.z + sy * SPEED * dt);
    me.x = q.x; me.z = q.z; me.moving = true;
    me.facing = Math.atan2(sx, sy);
    const p = world.placeAt(me.x, me.z);
    me.place = p ? p.id : null;
    if (me.place !== was) {
      if (was) events.push({ type: 'leave', placeId: was });
      if (me.place) events.push({ type: 'enter', placeId: me.place });
    }
    /* rustle: moving inside, or close to the edge of, any bush */
    rustleIn -= dt;
    const bush = world.places.find(b => b.kind === 'bush' && Math.hypot(me.x - b.x, me.z - b.z) <= b.r + RUSTLE_REACH);
    if (bush && rustleIn <= 0) { events.push({ type: 'rustle', placeId: bush.id }); rustleIn = RUSTLE_EVERY; }
  }

  /* Lanterns (seek only): fill or drain the meter, work out "near". */
  function lanterns(dt, list, events) {
    let nearest = Infinity, lit = null;
    for (const l of list || []) {
      if (!l) continue;
      const d = Math.hypot(l.x - me.x, l.z - me.z);
      if (d < nearest) nearest = d;
      if (d <= LIGHT_RADIUS && (!lit || d < lit.d)) lit = { seat: l.seat, d };
    }
    me.near = nearest === Infinity ? 1 : Math.min(1, Math.max(0, (nearest - LIGHT_RADIUS) / (FAR - LIGHT_RADIUS)));
    const T = foundTime();
    if (lit) {
      const add = Math.min(dt / T, 1 - me.meter);
      me.meter += add;                           /* several lanterns do not stack */
      me.credit[lit.seat] = (me.credit[lit.seat] || 0) + add;   /* credit goes to the closest lit lantern */
      if (me.meter >= 1 - EPS) {
        me.meter = 1; me.result = 'found';
        let best = null, bv = 0;
        for (const s of Object.keys(me.credit)) if (me.credit[s] > bv) { bv = me.credit[s]; best = Number(s); }
        me.foundBy = best;
        events.push({ type: 'found', by: best });
        setPhase('reveal', events);
      }
    } else {
      me.meter = Math.max(0, me.meter - dt / (2 * T));
    }
  }

  /* inputs: { stick:{x,y}, act:'out'?, lanterns:[{seat,x,z}] }; returns the events since the last step */
  function step(dt, inputs = {}) {
    const events = [];
    me.t += dt;
    if (me.phase === 'hide' || me.phase === 'seek') {
      move(dt, inputs.stick, inputs.act, events);
      if (me.phase === 'seek') lanterns(dt, inputs.lanterns, events);
    }
    if (me.phase === 'hide' && me.t >= HIDE_TIME - EPS) setPhase('seek', events);
    else if (me.phase === 'seek' && me.t >= SEEK_TIME - EPS) {
      me.result = 'hidden'; me.foundBy = null;
      events.push({ type: 'hidden' });
      setPhase('reveal', events);
    } else if (me.phase === 'reveal' && me.t >= REVEAL_TIME - EPS) {
      me.round++;
      if (inputs.seekers) me.seekers = inputs.seekers.slice();   /* the host passes the tracked seats at each hide */
      startHide(events);
    }
    return events;
  }

  /* what the hider's phone gets (15 to 20 a second); never goes to other phones */
  function snapshot() {
    const k = KINDS[kindOf(me.place)];
    return {
      phase: me.phase,
      clock: Math.min(1, me.t / LEN[me.phase]),
      hider: { x: me.x, z: me.z, facing: me.facing, moving: me.moving, place: me.place },
      leaves: Math.max(0, k.leaves - (me.moving ? 1 : 0)),
      near: me.near,
      meter: me.meter,
    };
  }

  return {
    step, snapshot, state: me,
    setSeekers(list) { me.seekers = list.slice(); },
  };
}
