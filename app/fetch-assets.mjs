/* Pulls the pose model and the MediaPipe WASM into public/ so Orlis Play runs with
   the network unplugged. Optional: without it the app falls back to the CDN,
   which is fine on a laptop that stays online. */
import { mkdir, writeFile, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/' +
              'pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

await mkdir('public/models', { recursive: true });
if (!existsSync('public/models/pose_landmarker_lite.task')){
  const r = await fetch(MODEL);
  if (!r.ok) throw new Error('model download failed: ' + r.status);
  await writeFile('public/models/pose_landmarker_lite.task',
                  Buffer.from(await r.arrayBuffer()));
  console.log('model fetched');
} else console.log('model already here');

/* The hand model, for the Testing switch "Exact hands" (src/tracking/hands.js): about 7.8 MB (7,819,105 bytes; sha256 fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1 when it
   was fetched on 2026-11-28). Optional: without it the app asks the CDN for the same file the first time Exact hands is on (pose.js `_handerReady`). A failure here
   does not stop the rest. */
const HAND = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
if (!existsSync('public/models/hand_landmarker.task')){
  try {
    const r = await fetch(HAND);
    if (!r.ok) throw new Error('hand model download failed: ' + r.status);
    await writeFile('public/models/hand_landmarker.task', Buffer.from(await r.arrayBuffer()));
    console.log('hand model fetched');
  } catch (e){ console.log('(hand model not fetched: ' + e.message + '; Exact hands will use the CDN copy)'); }
} else console.log('hand model already here');

await cp('node_modules/@mediapipe/tasks-vision/wasm', 'public/wasm', { recursive: true });
/* (the same library as a plain script, for the tracker's worker) */
await cp('node_modules/@mediapipe/tasks-vision/vision_bundle.js', 'public/wasm/vision_bundle.js');
console.log('wasm copied — Orlis Play will now run offline');
