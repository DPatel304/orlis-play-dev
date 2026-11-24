import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { CAM, HD, posesWanted, nextSkip, isIdle, IDLE_EVERY_MS } from './budget.js';

/* (the names of the body's points, the skeleton, and the players' colours:
   in pose-shared.js, which games can carry without the camera engine) */
import { L, BONES, MAX_PLAYERS, PLAYING, PLAYER_COLORS } from './pose-shared.js';
export { L, BONES, MAX_PLAYERS, PLAYING, PLAYER_COLORS };

/* Steadying the landmarks: a One Euro filter on each - smoothing hard
   while a point is nearly still, where the camera's jitter shows, and less
   and less the faster it moves, so a quick reach isn't left behind. At rest
   it filters at MIN_CUTOFF Hz; each screen-width a second of speed lifts
   that by BETA Hz. */
export const MIN_CUTOFF = 0.7, BETA = 6, D_CUTOFF = 0.4;
const alpha = (cutoff, dt) => { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / Math.max(dt, 1e-3)); };
/* One coordinate through the filter: f holds { x, dx } between frames. */
export function oneEuro(f, x, dt, minCutoff = MIN_CUTOFF, beta = BETA){
  if (f.x == null){ f.x = x; f.dx = 0; return x; }
  const dx = (x - f.x) / Math.max(dt, 1e-3);
  f.dx += (dx - f.dx) * alpha(D_CUTOFF, dt);
  f.x += (x - f.x) * alpha(minCutoff + beta * Math.abs(f.dx), dt);
  return f.x;
}
/* Drawing between samples. The camera gives a new picture of the body 10 to 30 times a second but the screen draws at up to 165,
   so a hand drawn straight from the last sample holds still, then jumps. Instead each landmark keeps its last two filtered samples
   and is drawn on the line between them, one sample interval behind the newest, so the motion is continuous. When a sample is
   late it carries on at the same speed, but never for more than LEAD_MAX seconds, and when the next one comes the drawing
   continues from where it was and eases to it (it never steps back to the older sample). */
export const LEAD_MAX = 0.03, IV_MIN = 0.008, IV_MAX = 0.25;
/* One coordinate drawn: the stretch from a (where it was drawn when the sample came) to b takes iv seconds; after that it goes on
   at b's own speed, (b - before) / iv, for at most LEAD_MAX. */
export function between(a, b, before, iv, since){
  const u = since / iv;
  if (u <= 1) return a + (b - a) * Math.max(0, u);
  return b + (b - before) / iv * Math.min(since - iv, LEAD_MAX);
}
/* The hand that drives the cursor only changes when the other one is
   clearly better seen - not back and forth every frame. */
const HAND_SWAP = 0.2;
const LOST_AFTER = 0.6;     /* seconds without a detection before a player counts as gone */

/* Players and watchers. Everyone the camera can see is looked at, but only
   someone standing up, and about as close to the TV as the nearest person,
   joins in: a grown-up on the sofa is sitting, and further back. Once in, a
   player is followed by where they are rather than by their place in the
   line, so a squat in Animal Copycat doesn't drop them; sitting down or
   stepping back for WATCH_AFTER seconds does.

   What tells a player from a watcher (three things, none of them clever):
   1. SIZE, as a share of the biggest body in view (torso, shoulders to hips).
      A 6 to 8 year old beside a parent is 49 to 60% of them, so the bar is
      low: JOIN_CLOSE 0.46 to take a place, and, once in, only STAY_CLOSE 0.38
      to keep it (a child who bends, squats or leans in toward the screen
      comes and goes through the 50s; someone on the sofa or at the back of
      the room is 35 to 45%). Size is never decided in one frame - a player
      has to be under STAY_CLOSE for WATCH_AFTER seconds to be dropped.
   2. STANDING. A seated body has its knees level with its hips (seated()).
      A body whose knees are in the picture but can't be seen is behind
      someone or something in front of it, so it doesn't join (legs below the
      bottom of the picture are fine: a child up close).
   3. STILL FOR A MOMENT. To join you stand still for JOIN_AFTER seconds: a
      body that keeps moving more than STEADY torso lengths across the picture
      is walking through, not joining.
   Position in the frame is not used: a grown-up's hips are higher than a
   child's however far back each stands. And once in, a player is followed by
   body, not just hips (SIZE_COST, SAT_COST, UPPER_COST below), so someone
   walking by behind them can't take their place when they cross. */
export const SEEN_MAX = 4;          /* people the camera looks for at once */
export const JOIN_CLOSE = 0.46;     /* body size, as a share of the biggest in view, to take a place */
export const STAY_CLOSE = 0.38;     /* ...and to keep it */
export const CLOSE = JOIN_CLOSE;    /* (the old name: what it takes to count as close) */
export const SEATED = 0.45;         /* knee drop below the hips, in torso lengths, under which you're sitting */
const STEADY = 0.4;                 /* torso lengths a joiner may wander while they wait the JOIN_AFTER seconds */
export const WATCH_AFTER = 4;       /* seconds sitting or back before a player becomes a watcher */
const REFIND_SIZE = 1.8;            /* a body picked up again by its head is within this factor of the player's own size */
/* Following a player from frame to frame is nearest hips, but with costs added (picture heights of distance) so that a body walking past
   behind them, or sitting behind them, doesn't take over their place when it crosses their hips: */
const SIZE_COST = 0.3;              /* ...per unit of log size ratio (a doubling in size is worth 0.2) */
const SAT_COST = 0.3;               /* ...a seated body, for a player who isn't sitting */
const UPPER_COST = 0.5;             /* ...the shoulders and head not being where this player's were (mean distance, after the hips' own move) */
const upper = (lm) => ({ sh: { x: (lm[L.L_SHOULDER].x + lm[L.R_SHOULDER].x) / 2, y: (lm[L.L_SHOULDER].y + lm[L.R_SHOULDER].y) / 2 }, hd: headOf(lm) });
const MATCH = 0.25;                 /* how far a player can move between detections and still be them */
const SAME = 0.5;                   /* torso lengths apart under which two skeletons are one person */
/* One head, one person. Two skeletons whose heads are within HEAD_SAME
   torso lengths are the same person, however their hips disagree; a
   newcomer whose head is within HEAD_TAKEN of a player's is that player,
   not someone new; and a player lost for a moment picks their body up again
   by its head, within REFIND of where it was. */
export const HEAD_SAME = 0.4, HEAD_TAKEN = 0.6, REFIND = 0.35;
/* Joining takes a face and a moment. Phantoms - a coat on a chair, a
   shadow, a reflection, a glitch for a few frames - rarely show a clear
   face and rarely last; a child does both. Once in, a player stays in
   whichever way they face. */
export const JOIN_AFTER = 0.5;      /* seconds seen steadily, face and all, before joining */
const FACE_SEEN = 0.7;              /* landmark confidence that counts as clearly seen */

/* Where a head is: the nose, or between the eyes, or the ears; failing
   all those, just above the shoulders. */
export function headOf(lm){
  const seen = (k) => lm[k] && (lm[k].v ?? lm[k].visibility ?? 1) > 0.5;
  const mid = (a, b) => ({ x: (lm[a].x + lm[b].x) / 2, y: (lm[a].y + lm[b].y) / 2 });
  if (seen(L.NOSE)) return { x: lm[L.NOSE].x, y: lm[L.NOSE].y };
  if (seen(L.L_EYE) && seen(L.R_EYE)) return mid(L.L_EYE, L.R_EYE);
  if (seen(7) && seen(8)) return mid(7, 8);
  const sh = mid(L.L_SHOULDER, L.R_SHOULDER);
  return { x: sh.x, y: sh.y - sizeOf(lm) * 0.35 };
}
const apart = (a, b) => Math.hypot((a.x - b.x) * 16 / 9, a.y - b.y);

/* The model sometimes reports one person twice, two skeletons nearly on top
   of each other - or sharing a head with the hips somewhere else. Keep the
   clearer of any pair whose shoulders and hips both sit within half a torso
   of each other, or whose heads are within HEAD_SAME. */
export function onePerPerson(people){
  const mid = (lm, a, b) => ({ x: (lm[a].x + lm[b].x) / 2, y: (lm[a].y + lm[b].y) / 2 });
  const vis = (lm) => lm.reduce((s, k) => s + (k.v ?? k.visibility ?? 1), 0);
  const kept = [];
  for (const lm of [...people].sort((a, b) => vis(b) - vis(a))){
    const sh = mid(lm, L.L_SHOULDER, L.R_SHOULDER), hp = mid(lm, L.L_HIP, L.R_HIP), size = sizeOf(lm);
    const twin = kept.some(o => {
      const osh = mid(o, L.L_SHOULDER, L.R_SHOULDER), ohp = mid(o, L.L_HIP, L.R_HIP), s = Math.max(size, sizeOf(o)) * SAME;
      if (Math.hypot((sh.x - osh.x) * 16 / 9, sh.y - osh.y) < s && Math.hypot((hp.x - ohp.x) * 16 / 9, hp.y - ohp.y) < s) return true;
      return apart(headOf(lm), headOf(o)) < Math.max(size, sizeOf(o)) * HEAD_SAME;
    });
    if (!twin) kept.push(lm);
  }
  return kept;
}

/* A face the camera can clearly see: the nose and at least one eye, with
   the head above the shoulders. */
export function faceSeen(lm){
  const vis = (k) => (lm[k].v ?? lm[k].visibility ?? 1) > FACE_SEEN;
  const shY = (lm[L.L_SHOULDER].y + lm[L.R_SHOULDER].y) / 2;
  return vis(L.NOSE) && (vis(L.L_EYE) || vis(L.R_EYE)) && lm[L.NOSE].y < shY;
}

/* Torso length: shoulders to hips. Bigger is closer to the camera. */
export function sizeOf(lm){
  const sx = (lm[L.L_SHOULDER].x + lm[L.R_SHOULDER].x) / 2, sy = (lm[L.L_SHOULDER].y + lm[L.R_SHOULDER].y) / 2;
  const hx = (lm[L.L_HIP].x + lm[L.R_HIP].x) / 2, hy = (lm[L.L_HIP].y + lm[L.R_HIP].y) / 2;
  return Math.hypot((hx - sx) * 16 / 9, hy - sy);
}

/* Sitting: the knees are nearly level with the hips, because the thighs
   point at the camera. With no knee in sight there's no telling, and it
   counts as standing - a child up close often has their legs out of frame. */
export function seated(lm){
  const vis = (k) => (lm[k].v ?? lm[k].visibility ?? 1) > 0.5;
  const knees = [L.L_KNEE, L.R_KNEE].filter(vis);
  if (!knees.length) return false;
  const hipY = (lm[L.L_HIP].y + lm[L.R_HIP].y) / 2;
  const drop = knees.reduce((a, k) => a + lm[k].y, 0) / knees.length - hipY;
  return drop < SEATED * sizeOf(lm);
}

/* Legs that are in the picture but can't be seen: both knees low in confidence while their place is inside the frame, so something
   - a person, a table - is in front. (Knees below the bottom of the picture aren't hidden, just not there.) Such a body doesn't join. */
export function legsHidden(lm){
  const vis = (k) => (lm[k].v ?? lm[k].visibility ?? 1) > 0.5;
  const kn = [L.L_KNEE, L.R_KNEE];
  if (kn.some(vis)) return false;
  return kn.every(k => lm[k].y < 0.97);
}


function blank(i){
  return {
    id:i, color:PLAYER_COLORS[i], present:false, lostFor:99, watching:0, at:null,
    lm:null, raw:null,
    hands:{ left:{x:.5,y:.5,vx:0,vy:0,speed:0}, right:{x:.5,y:.5,vx:0,vy:0,speed:0} },
    centre:{x:.5,y:.5}, scale:0.3
  };
}

function withTimeout(promise, ms){
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timed out after ' + (ms/1000) + 's')), ms))
  ]);
}

/* the camera is started over (quietly) if no new picture comes for this long, and not more often than this */
export const FROZEN_MS = 4000, HEAL_EVERY_MS = 30000;

export const pose = {
  ready:false, usingCamera:false, reason:'', detail:'', activeId:'',
  players:Array.from({ length: MAX_PLAYERS }, (_, i) => blank(i)),
  cap:PLAYING,               /* how many places can fill (see PLAYING) */
  personCount:0,             /* players: people in the game */
  seenCount:0,               /* everyone the camera can see, watchers too */
  /* Measured, not declared. "Will it run on a Pi" is a question about these
     three numbers and nothing else, so the app has to be able to answer it on
     whatever machine it is sitting on. */
  fps:0, inferMs:0, _hits:0, _since:0,
  /* What the camera costs (see budget.js): look at every Nth frame when a look
     is slow; look only now and then when nobody is there; not at all while the
     pause screen is up. `wanted` is how many people to look for. */
  skip:1, paused:false, wanted:SEEN_MAX, _n:0, _acc:0, _emptyFor:0, _idleAt:0,
  clock:() => performance.now(),   /* (ms; a test can set its own) */
  worker:null, _wbusy:false, _wres:null,
  look(players){
    const n = players == null ? SEEN_MAX : posesWanted(players, SEEN_MAX);
    if (n === this.wanted) return;
    this.wanted = n;
    const options = { numPoses:n };
    try { if (this.lm) this.lm.setOptions(options); } catch (e){}
    try { if (this.worker) this.worker.postMessage({ t:'opts', options }); } catch (e){}
  },

  /* Mouse stands in for a body when there is no camera: the whole interface is
     hover-driven, so a pointer can reach everything a hand can. Without it the
     app is untestable on any machine that cannot see a person. */
  mouse:{ active:false, x:.5, y:.5 },

  /* The camera is on only while it's wanted - in a game, or the camera
     check - and off everywhere else (the home screen is the mouse's), so
     the laptop isn't watching anyone, or working, for nothing. on() turns it
     on (the first time, loading the body tracker as well) and off() turns it
     off; the tracker stays loaded, so the next on() takes a moment, not
     seconds. Each on() tries the camera afresh: one that was missing or
     refused last time may be there now. */
  on:false,
  setVideo(video, { forceMouse = false } = {}){
    this.video = video;
    if (forceMouse){ this.reason = 'debug'; this.enableMouse(); }
  },
  async wake(){
    if (this.reason === 'debug') return false;
    if (this.on && this.ready) return true;
    if (this._waking) return this._waking;
    this._waking = this._wake().finally(() => { this._waking = null; });
    return this._waking;
  },
  async _wake(){
    const video = this.video;
    try {
      await this._open(this.preferred(), false);
    } catch (e){
      if (e && e.name === 'Off') return false;
      this.reason = (e && e.name) === 'NotAllowedError' ? 'denied' : 'nocamera';
      this.enableMouse();
      return false;
    }
    if (!this.lm && !this.worker){
      /* Local copies if `npm run offline` has been run, otherwise the CDN. A
         living-room box should not need the internet, but nobody should have to
         download 40MB before they can try it either.

         Opened straight off the filesystem there is nothing to probe: a fetch of
         a sibling file from a file:// page is refused by CORS, which logs an
         error and tells us nothing. Skip to the CDN. */
      /* (The Windows app always carries them, and says so.) */
      const local = typeof window !== 'undefined' && window.ORLIS_LOCAL ? true
        : location.protocol === 'file:' ? false
        : await fetch('/wasm/vision_wasm_internal.js', { method:'HEAD' })
                .then(r => r.ok).catch(() => false);
      const wasmDir = local ? '/wasm'
        : 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm';
      const model = local ? '/models/pose_landmarker_lite.task'
        : 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/' +
          'pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
      /* The runtime is tens of megabytes over somebody else's CDN. If it is slow,
         blocked or offline, the app used to sit on "Starting the camera…"
         forever with the camera light on and nothing to show for it. Give it a
         deadline and say what went wrong instead. */
      /* (the opt-in smoother way first; if it can't start, the usual way) */
      if (this.smoother() && !this.worker && typeof Worker !== 'undefined' && await this._startWorker(wasmDir, model)){
        this.reason = ''; this.mouse.active = false;
        this.ready = true; this.usingCamera = true; this.on = true;
        return this._want ? true : (this._close(), false);
      }
      try {
        const files = await withTimeout(FilesetResolver.forVisionTasks(wasmDir), 25000);
        this.lm = await withTimeout(PoseLandmarker.createFromOptions(files, {
          baseOptions:{ modelAssetPath: model, delegate:'GPU' },
          runningMode:'VIDEO', numPoses:this.wanted,
          minPoseDetectionConfidence:0.5, minPosePresenceConfidence:0.5, minTrackingConfidence:0.5
        }), 40000);
      } catch (e){
        this.reason = local ? 'badassets' : 'nonetwork';
        this.detail = (e && e.message) || String(e);
        this._close();
        this.usingCamera = false;
        this.enableMouse();
        return false;
      }
    }
    /* (turned off again while it was starting) */
    if (!this._want){ this._close(); return false; }
    this.reason = ''; this.mouse.active = false;
    this.ready = true; this.usingCamera = true; this.on = true;
    return true;
  },
  /* the camera off: the light goes out, and nobody's tracked */
  sleep(){
    this._want = false;
    this.on = false;
    this._close();
    for (const p of this.players){ p.lm = null; p.present = false; p.lostFor = 99; }
    this.personCount = 0; this.seenCount = 0; this.fps = 0;
    this.skip = 1; this._n = 0; this._acc = 0; this._emptyFor = 0; this._wbusy = false;
  },
  /* Settings can ask for the sharper (and costlier) picture, or for the
     tracker to work off the main thread. Kept as plain flags so nothing here
     breaks when storage is unavailable. */
  sharp(){ try { return localStorage.getItem('orlis_camsharp') === '1'; } catch (e){ return false; } },
  smoother(){ try { return localStorage.getItem('orlis_trackworker') === '1'; } catch (e){ return false; } },
  async _open(deviceId, exact){
    this._want = true;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: Object.assign(
        (() => { const c = this.sharp() ? HD : CAM;
                 return { width:{ideal:c.width}, height:{ideal:c.height}, frameRate:{ideal:c.frameRate} }; })(),
        /* Ask for the remembered camera by id. The moment a second one exists -
           a phone running Camo, a USB webcam beside the laptop's built-in -
           whatever Windows calls default is as likely to be the wrong one, and
           without this there is no way to say otherwise. An id that has gone
           away is `ideal`, not `exact`, so an unplugged camera degrades to the
           default instead of refusing to start. */
        deviceId ? { deviceId: exact ? { exact: deviceId } : { ideal: deviceId } } : {}),
      audio:false
    });
    if (!this._want){ stream.getTracks().forEach(t => t.stop()); throw Object.assign(new Error('off'), { name:'Off' }); }
    this.activeId = stream.getVideoTracks()[0].getSettings().deviceId || deviceId || '';
    this.video.srcObject = stream;
    await this.video.play();
  },
  /* Quietly starting the camera over, with no screen and nothing to press (there's no Re-calibrate button to ask
     for it): when its pictures stop coming (a frozen or unplugged-and-back camera), or when nobody's been seen for
     a long while in a game. Players are started over, as for a new camera; the tracker stays loaded. At most once
     every half minute. Gives back whether it tried. */
  async heal(){
    if (!this.on || this.mouse.active || this._healing || !this.video) return false;
    const now = performance.now();
    if (this._healedAt && now - this._healedAt < HEAL_EVERY_MS) return false;
    this._healedAt = now; this._healing = true;
    try {
      this._close();
      await this._open(this.preferred(), false);
      for (const p of this.players){ p.lm = null; p.present = false; p.lostFor = 99; }
      this._frameAt = performance.now(); this._emptyFor = 0;
    } catch (e){ /* (it'll try again later) */ }
    this._healing = false;
    return true;
  },
  _close(){
    try { this.video.srcObject && this.video.srcObject.getTracks().forEach(t => t.stop()); } catch (e){}
    try { this.video.srcObject = null; } catch (e){}
    this._lastT = undefined;
  },

  /* (the old way in: the camera on, from the start) */
  async start(video, opts = {}){
    this.setVideo(video, opts);
    return this.wake();
  },

  /* Labels only come back once permission has been granted, which is why the
     picker lives in Settings rather than in front of the first run. */
  async cameras(){
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      return all.filter(d => d.kind === 'videoinput')
                .map((d, i) => ({ id:d.deviceId, label:d.label || ('Camera ' + (i + 1)) }));
    } catch (e){ return []; }
  },

  preferred(){
    try { return localStorage.getItem('orlis_camera') || ''; } catch (e){ return ''; }
  },

  /* Settings' camera picker: remembered, and switched to now if it's on. */
  async use(deviceId){
    try { localStorage.setItem('orlis_camera', deviceId); } catch (e){}
    this.activeId = deviceId;
    if (!this.on) return;
    this._close();
    await this._open(deviceId, true);
    /* The new camera sees a different room: everything learned about the old
       one is wrong, so start the players over. */
    for (const p of this.players){ p.lm = null; p.present = false; p.lostFor = 99; }
  },

  enableMouse(){
    if (this.mouse.active) return;
    this.mouse.active = true;
    addEventListener('pointermove', (e) => {
      this.mouse.x = e.clientX / innerWidth;
      this.mouse.y = e.clientY / innerHeight;
    });
  },

  /* Called once per animation frame. Detection runs only when the video has a
     new frame, so games keep their own smooth cadence even if pose dips. */
  update(nowMs, dt){
    const r = this._update(nowMs, dt);
    this.at();
    return r;
  },
  _update(nowMs, dt){
    if (this.mouse.active) return this._mouseUpdate(dt);
    if (!this.ready || !this.on) return;
    const v = this.video;
    if (v.readyState < 2) return;
    /* Wall clock, not dt: the loop clamps dt to 50ms so a frame that really
       took 600ms is reported as 50, which inflated this rate elevenfold and
       had the readout claiming 20fps next to a 570ms inference. */
    const wall = performance.now();
    if (!this._since) this._since = wall;
    if (wall - this._since > 500){
      this.fps = this._hits * 1000 / (wall - this._since);
      this._hits = 0; this._since = wall;
    }
    if (v.currentTime === this._lastT){
      /* no new picture: if that goes on, the camera is stuck (or was unplugged and back) - start it over */
      if (!this._frameAt) this._frameAt = wall;
      const tr = v.srcObject && v.srcObject.getVideoTracks && v.srcObject.getVideoTracks()[0];
      if (!this.paused && (wall - this._frameAt > FROZEN_MS || (tr && tr.readyState === 'ended' && wall - this._frameAt > 1000))) this.heal();
      this._decay(dt); return;
    }
    this._lastT = v.currentTime; this._frameAt = wall;

    /* The pause screen has no use for bodies. */
    if (this.paused){ this._decay(dt); return; }
    /* Nobody there for a few seconds: look a few times a second, not thirty. */
    this._acc += dt;
    if (isIdle(this._emptyFor)){
      if (wall - this._idleAt < IDLE_EVERY_MS){ return; }
      this._idleAt = wall;
    } else if (this.skip > 1 && (++this._n % this.skip) !== 0){
      return;
    }
    const step = this._acc; this._acc = 0;

    if (this.worker) return this._viaWorker(v, nowMs, step);

    let res;
    const t0 = performance.now();
    try { res = this.lm.detectForVideo(v, nowMs); }
    catch (e){ return; }
    this._took(performance.now() - t0, res, step);
  },
  /* One look finished (here or in the worker): the timing, the pacing, the people. */
  _took(ms, res, step){
    /* Smoothed, because a single inference tells you nothing useful. */
    this.inferMs += (ms - this.inferMs) * 0.1;
    this._hits++;
    this.skip = nextSkip(this.skip, this.inferMs);

    const found = (res && res.landmarks) ? res.landmarks : [];
    this._emptyFor = found.length ? 0 : this._emptyFor + step;
    this._assign(found.map(lm => lm.map(k => ({ x: 1 - k.x, y: k.y, z: k.z, v: k.visibility }))), step);
  },
  /* The off-the-main-thread way: hand over a bitmap of this frame, and take
     whatever came back from the last one (a frame behind - fine for a body). */
  _viaWorker(v, nowMs, step){
    if (this._wres){
      const r = this._wres; this._wres = null;
      this._took(r.ms, { landmarks:r.landmarks }, step);
    }
    if (this._wbusy) return;
    this._wbusy = true;
    createImageBitmap(v).then(bmp => {
      if (!this.worker){ try { bmp.close(); } catch (e){} this._wbusy = false; return; }
      this.worker.postMessage({ t:'frame', bmp, ts:nowMs }, [bmp]);
    }).catch(() => { this._wbusy = false; });
  },
  /* Start the worker, or say why not; the caller falls back to the main thread. */
  _startWorker(wasmDir, model){
    return new Promise(resolve => {
      let w;
      try { w = new Worker(new URL('pose-worker.js', location.href)); }
      catch (e){ resolve(false); return; }
      const fail = () => { try { w.terminate(); } catch (e){} resolve(false); };
      const timer = setTimeout(fail, 15000);
      w.onerror = () => { clearTimeout(timer); fail(); };
      w.onmessage = (e) => {
        const m = e.data;
        if (m.t === 'ready'){ clearTimeout(timer); this.worker = w; resolve(true); }
        else if (m.t === 'error' && m.on === 'init'){ clearTimeout(timer); fail(); }
        else if (m.t === 'result'){ this._wbusy = false; this._wres = m; }
        else if (m.t === 'error'){ this._wbusy = false; }
      };
      w.postMessage({ t:'init', bundle:new URL(wasmDir.replace(/\/wasm$/, '') + (wasmDir === '/wasm' ? '/wasm/vision_bundle.js' : '/vision_bundle.js'), location.href).href,
                      wasmDir:new URL(wasmDir, location.href).href.replace(/\/$/, ''),
                      model:new URL(model, location.href).href, numPoses:this.wanted });
    });
  },

  /* Who's who. Landmarks arrive mirrored, so screen left is the player's own
     left as they face the TV. */
  _assign(people, dt){
    people = onePerPerson(people);
    this.seenCount = people.length;
    const biggest = Math.max(0, ...people.map(sizeOf));
    const dets = people.map(lm => ({
      lm, taken: false,
      x: (lm[L.L_HIP].x + lm[L.R_HIP].x) / 2, y: (lm[L.L_HIP].y + lm[L.R_HIP].y) / 2,
      playing: !seated(lm) && sizeOf(lm) >= STAY_CLOSE * biggest,
      close: sizeOf(lm) >= STAY_CLOSE * biggest,
      joinable: !seated(lm) && !legsHidden(lm) && sizeOf(lm) >= JOIN_CLOSE * biggest,
      face: faceSeen(lm), head: headOf(lm), size: sizeOf(lm), up: upper(lm), sat: seated(lm)
    }));

    /* Players already in keep following their own body: whoever is nearest
       to where they were heading. Heading matters when two children cross. */
    const pairs = [];
    this.players.forEach((p, i) => {
      if (!p.present || !p.at) return;
      const k = Math.min(p.lostFor + dt, 0.5), px = p.at.x + p.at.vx * k, py = p.at.y + p.at.vy * k;
      /* nearest hips win - but the shoulders and head have to agree too, and the size: someone walking past at the back crosses a
         player's hips without taking their place (a smaller body, its head and shoulders somewhere else) */
      const sz = p.at.size, dx = px - p.at.x, dy = py - p.at.y, ps = p.lm && upper(p.lm), psat = !!p.lm && seated(p.lm);
      dets.forEach((d, j) => {
        const dist = Math.hypot(d.x - px, d.y - py);
        if (dist >= MATCH) return;
        let cost = dist;
        if (d.sat && !psat) cost += SAT_COST;      /* someone sitting is not a standing player who has bent down beside them */
        if (sz) cost += SIZE_COST * Math.abs(Math.log(d.size / sz));
        if (ps){ const du = d.up; cost += UPPER_COST * (apart({ x: du.sh.x - dx, y: du.sh.y - dy }, ps.sh) + apart({ x: du.hd.x - dx, y: du.hd.y - dy }, ps.hd)) / 2; }
        pairs.push({ i, j, dist: cost });
      });
    });
    pairs.sort((a, b) => a.dist - b.dist);
    const matched = new Set();
    for (const { i, j } of pairs){
      if (matched.has(i) || dets[j].taken) continue;
      matched.add(i); dets[j].taken = true;
      const p = this.players[i], d = dets[j];
      p.head = d.head;
      this._apply(p, d.lm, dt);
      this._track(p, d, dt + p.lostFor);
      p.lostFor = 0;
      /* In a game that says so (squats are a move in Tower Defense), a
         player who sits or crouches stays in; stepping back still counts. */
      p.watching = d.playing || (this.keepSitters && d.close) ? 0 : p.watching + dt;
      if (p.watching > WATCH_AFTER){ p.present = false; p.lm = null; p.watching = 0; }
    }
    /* A player not found where their hips were heading - they moved fast,
       or the hips were misread - picks up a body left over by its head. */
    this.players.forEach((p, i) => {
      if (matched.has(i) || !p.present || !p.head) return;
      let best = null, bd = REFIND;
      for (const d of dets){
        if (d.taken) continue;
        if (p.at && p.at.size && (d.size > p.at.size * REFIND_SIZE || d.size * REFIND_SIZE < p.at.size)) continue;   /* (not someone twice or half their size) */
        const dist = apart(d.head, p.head); if (dist < bd){ bd = dist; best = d; }
      }
      if (!best) return;
      matched.add(i); best.taken = true; p.head = best.head;
      this._apply(p, best.lm, dt); p.at = null; this._track(p, best, dt);
      p.lostFor = 0;
    });
    /* Everyone in the game who wasn't seen this time ages toward gone. */
    this.players.forEach((p, i) => {
      if (matched.has(i) || !p.present) return;
      p.lostFor += dt;
      if (p.lostFor > LOST_AFTER) p.present = false;
    });
    /* Newcomers: someone standing up front with their face in view is a
       candidate, followed from frame to frame; one seen steadily for
       JOIN_AFTER takes an empty place, left to right. A candidate who
       flickers out for more than a moment starts again. */
    const cands = this._cands || (this._cands = []);
    for (const c of cands) c.hit = null;
    /* A body whose head is a player's - even one lost for a moment - is
       that player, never a newcomer. */
    const heads = this.players.filter(p => p.present && p.head).map(p => p.head);
    for (const d of dets){
      if (d.taken || !d.joinable || !d.face) continue;
      if (heads.some(h => apart(h, d.head) < d.size * HEAD_TAKEN)) continue;
      let best = null, bd = MATCH;
      for (const c of cands){ const dist = Math.hypot(d.x - c.x, d.y - c.y); if (!c.hit && dist < bd){ bd = dist; best = c; } }
      if (!best){ best = { x: d.x, y: d.y, ax: d.x, ay: d.y, seen: 0, miss: 0 }; cands.push(best); }
      /* walking through: moved on from where the wait began, so the wait starts again */
      if (Math.hypot((d.x - best.ax) * 16 / 9, d.y - best.ay) > STEADY * d.size){ best.ax = d.x; best.ay = d.y; best.seen = 0; }
      best.hit = d; best.x = d.x; best.y = d.y; best.seen += dt; best.miss = 0;
    }
    for (const c of cands) if (!c.hit) c.miss += dt;
    this._cands = cands.filter(c => c.miss < 0.25);
    const free = this.players.filter((p, i) => !p.present && i < this.cap);
    const joiners = this._cands.filter(c => c.hit && c.seen >= JOIN_AFTER).map(c => c.hit).sort((a, b) => a.x - b.x);
    for (const d of joiners) this._cands = this._cands.filter(c => c.hit !== d);
    for (const p of free){
      const d = joiners.shift();
      if (!d) break;
      p.lm = null; this._apply(p, d.lm, dt); p.head = d.head;
      p.at = null; this._track(p, d, dt);
      p.present = true; p.lostFor = 0; p.watching = 0;
    }
    this.personCount = this.players.filter(p => p.present).length;
  },

  /* Where a player's hips are and how they're moving, unsmoothed. */
  _track(p, d, dt){
    if (!p.at){ p.at = { x: d.x, y: d.y, vx: 0, vy: 0, size: d.size }; return; }
    if (d.size){ const m = p.at.size || d.size; p.at.size = d.size > m ? m + (d.size - m) * 0.3 : m + (d.size - m) * Math.min(1, dt * 0.2); }   /* (their standing size: a crouch doesn't shrink it for long) */
    const t = Math.max(dt, 1 / 120), k = 0.5;
    p.at.vx += ((d.x - p.at.x) / t - p.at.vx) * k; p.at.vy += ((d.y - p.at.y) / t - p.at.vy) * k;
    p.at.x = d.x; p.at.y = d.y;
  },

  _apply(p, lm, dt){
    const now = this.clock(), n = lm.length;
    const fresh = !p.lm;
    if (fresh){ p.lm = lm.map(k => ({...k})); p.filt = null; }
    const sg = p.seg && p.seg.lm === p.lm && p.seg.n === n ? p.seg : null;
    /* where it is drawn right now (the start of the next stretch), before the new sample lands */
    if (sg){
      const since = Math.max(0, (now - sg.t1) / 1000);
      for (let j = 0; j < n * 3; j++) sg.a[j] = between(sg.a[j], sg.b[j], sg.before[j], sg.iv, since);
    }
    if (!fresh){
      for (let i = 0; i < lm.length; i++){
        const f = (p.filt ||= [])[i] ||= { x: {}, y: {}, z: {} };
        p.lm[i].x = oneEuro(f.x, lm[i].x, dt);
        p.lm[i].y = oneEuro(f.y, lm[i].y, dt);
        /* Depth too - nearer the camera is smaller - for leaning toward or
           away from the screen. */
        p.lm[i].z = oneEuro(f.z, lm[i].z ?? 0, dt);
        p.lm[i].v  = lm[i].v;
      }
    }
    if (sg){
      sg.before.set(sg.b);
      const meas = Math.min(IV_MAX, Math.max(IV_MIN, (now - sg.t1) / 1000));
      sg.iv = Math.min(IV_MAX, Math.max(IV_MIN, sg.iv * 0.75 + meas * 0.25));
    } else {
      p.seg = { lm: p.lm, n, t1: 0, iv: 1 / 30, a: new Float64Array(n * 3), b: new Float64Array(n * 3), before: new Float64Array(n * 3) };
    }
    const g = p.seg;
    for (let i = 0; i < n; i++){ const k = p.lm[i], j = i * 3; g.b[j] = k.x; g.b[j+1] = k.y; g.b[j+2] = k.z ?? 0; }
    if (!sg){ g.a.set(g.b); g.before.set(g.b); }
    g.t1 = now;
    this._body(p, dt);
  },

  /* Everything drawn from a body (the landmarks, the hands, the centre and size) as it is at this moment: between the last two
     samples, as above. Called once a frame after the looking; the games read p.lm, p.hands, p.centre and p.scale as ever. */
  at(now = this.clock()){
    if (this.mouse.active) return;
    for (const p of this.players){
      const g = p.seg;
      if (!p.present || !p.lm || !g || g.lm !== p.lm) continue;
      const since = Math.max(0, (now - g.t1) / 1000);
      for (let i = 0; i < g.n; i++){
        const k = p.lm[i], j = i * 3;
        k.x = between(g.a[j], g.b[j], g.before[j], g.iv, since);
        k.y = between(g.a[j+1], g.b[j+1], g.before[j+1], g.iv, since);
        k.z = between(g.a[j+2], g.b[j+2], g.before[j+2], g.iv, since);
      }
      this._body(p, 0);
    }
  },

  /* The centre and size, and the hands, from the landmarks as they are. A new sample (dt > 0) gives the hands' speed; drawing
     between samples (dt 0) only moves them. */
  _body(p, dt){
    const hip = { x:(p.lm[L.L_HIP].x + p.lm[L.R_HIP].x)/2, y:(p.lm[L.L_HIP].y + p.lm[L.R_HIP].y)/2 };
    const sh  = { x:(p.lm[L.L_SHOULDER].x + p.lm[L.R_SHOULDER].x)/2,
                  y:(p.lm[L.L_SHOULDER].y + p.lm[L.R_SHOULDER].y)/2 };
    p.centre = { x:(hip.x + sh.x)/2, y:(hip.y + sh.y)/2 };
    p.scale  = Math.max(0.08, Math.hypot(hip.x - sh.x, hip.y - sh.y) * 2.4);

    this._hand(p.hands.left,  p.lm[L.L_WRIST], dt);
    this._hand(p.hands.right, p.lm[L.R_WRIST], dt);
  },

  /* Speed is for games that care how hard a hand moves, so it is kept in
     screen-widths per second rather than pixels: the same swing scores the
     same on any size of television. */
  _hand(h, k, dt){
    const nx = k.x, ny = k.y;
    if (dt > 0){
      const d = Math.max(dt, 1/120), px = h.px ?? h.x, py = h.py ?? h.y;
      h.vx = (nx - px) / d; h.vy = (ny - py) / d;
      h.speed = Math.hypot(h.vx, h.vy);
      h.px = nx; h.py = ny;
    }
    h.x = nx; h.y = ny;
  },

  /* No new video frame means no detection ran. Ageing the players here matters:
     without it a frozen or unplugged camera leaves everyone marked present
     forever, and the game waits for a motionless person who is not there. */
  _decay(dt){
    for (const p of this.players){
      if (!p.present) continue;
      p.lostFor += dt;
      if (p.lostFor > LOST_AFTER * 4) p.present = false;
    }
  },

  _mouseUpdate(dt){
    const p = this.players[0];
    p.present = true; p.lostFor = 0;
    this._hand(p.hands.right, { x:this.mouse.x, y:this.mouse.y }, dt);
    p.hands.left.x = this.mouse.x; p.hands.left.y = this.mouse.y;
    p.centre = { x:this.mouse.x, y:Math.min(0.9, this.mouse.y + 0.2) };
    p.scale = 0.3;
    for (const q of this.players.slice(1)) q.present = false;
    this.personCount = 1;
  },

  /* The cursor hand. Right wrist by default, but a hand that has gone missing
     should not drag the cursor into a corner, so fall back to the other. */
  cursorHand(p){
    const r = p.lm ? p.lm[L.R_WRIST] : null, l = p.lm ? p.lm[L.L_WRIST] : null;
    if (this.mouse.active) return p.hands.right;
    if (r && l){
      const rv = r.v ?? 1, lv = l.v ?? 1;
      if (p.cursorSide === 'left' ? rv > lv + HAND_SWAP : p.cursorSide === 'right' ? lv > rv + HAND_SWAP : true) p.cursorSide = rv >= lv ? 'right' : 'left';
      return p.cursorSide === 'left' ? p.hands.left : p.hands.right;
    }
    return p.hands.right;
  },

  /* Enough of a body in frame to play: head, both hips, and a knee or an ankle.
     Measured against live landmarks rather than guessed - ankle visibility on a
     standing figure swings between 0.26 and 0.93 frame to frame, so demanding
     0.5 at both ankles strands people on the calibration screen with the
     camera plainly working. Knees carry the same information (if a knee is in
     frame you are standing back far enough) and are steadier. */
  fullBody(p){
    if (!p.lm || !p.present) return false;
    const seen = (i) => (p.lm[i].v ?? 1) > 0.3;
    const inFrame = (i) => p.lm[i].y > 0.02 && p.lm[i].y < 0.99;
    const legs = seen(L.L_KNEE) || seen(L.R_KNEE) || seen(L.L_ANKLE) || seen(L.R_ANKLE);
    return seen(L.NOSE) && inFrame(L.NOSE) && seen(L.L_HIP) && seen(L.R_HIP) && legs;
  }
};
