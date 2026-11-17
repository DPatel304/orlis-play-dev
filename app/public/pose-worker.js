/* The body tracker, off the main thread. A plain (classic) worker, because
   MediaPipe loads its engine with importScripts, which a module worker doesn't
   have. Pictures come in as bitmaps, one at a time; what it finds goes back.
   If anything here fails the page is told and carries on with the tracker on
   its own thread (src/tracking/pose.js). */
let lm = null;
self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.t === 'init'){
      importScripts(m.bundle);
      const files = await Vision.FilesetResolver.forVisionTasks(m.wasmDir);
      lm = await Vision.PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: m.model, delegate: 'GPU' },
        runningMode: 'VIDEO', numPoses: m.numPoses,
        minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5
      });
      self.postMessage({ t: 'ready' });
    } else if (m.t === 'opts'){
      if (lm) await lm.setOptions(m.options);
    } else if (m.t === 'frame'){
      const t0 = performance.now();
      const res = lm ? lm.detectForVideo(m.bmp, m.ts) : null;
      try { m.bmp.close(); } catch (err){}
      self.postMessage({ t: 'result', landmarks: (res && res.landmarks) || [], ms: performance.now() - t0 });
    }
  } catch (err){
    self.postMessage({ t: 'error', message: (err && err.message) || String(err), on: m.t });
  }
};
