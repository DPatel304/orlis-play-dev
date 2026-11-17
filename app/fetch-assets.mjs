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

await cp('node_modules/@mediapipe/tasks-vision/wasm', 'public/wasm', { recursive: true });
/* (the same library as a plain script, for the tracker's worker) */
await cp('node_modules/@mediapipe/tasks-vision/vision_bundle.js', 'public/wasm/vision_bundle.js');
console.log('wasm copied — Orlis Play will now run offline');
