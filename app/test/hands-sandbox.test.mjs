/* Hands on screen reaches games that run sealed in the sandbox: they have their own copy of the drawing code and no storage,
   so the app's choice travels in the messages (at the start of a round and with every frame), and H still works if the frame has the keyboard. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handsMode, setHandsMode } from '../src/ui/handshow.js';
import { buildOrlis } from '../kit/build-orlis.mjs';
import { readOrlis } from '../../server/src/orlis-file.js';

/* the page, as the shell sees it: frames that remember what they were sent, and a message line in */
function shellRig(){
  const listeners = {}, sent = [], frames = [], keys = [];
  globalThis.addEventListener = (t, fn) => { (listeners[t] ||= []).push(fn); };
  globalThis.removeEventListener = (t, fn) => { listeners[t] = (listeners[t] || []).filter(x => x !== fn); };
  globalThis.KeyboardEvent = class { constructor(type, init){ this.type = type; Object.assign(this, init); } };
  const realDispatch = globalThis.dispatchEvent;
  globalThis.dispatchEvent = (ev) => { keys.push(ev); return true; };
  const realCreate = document.createElement;
  document.createElement = (tag) => {
    const el = realCreate(tag);
    if (tag === 'iframe'){ el.contentWindow = { postMessage: (m) => sent.push(m) }; frames.push(el); }
    return el;
  };
  return {
    sent, frames, keys,
    say(frame, data){ (listeners.message || []).slice().forEach(fn => fn({ source: frame.contentWindow, data })); },
    undo(){ document.createElement = realCreate; globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {}; globalThis.dispatchEvent = realDispatch; delete globalThis.KeyboardEvent; }
  };
}

test('the shell tells a sandboxed round how hands are shown: at the start and with every frame', async () => {
  const { sandboxed } = await import('../src/ui/sandbox.js');
  const rig = shellRig();
  try {
    setHandsMode('body');
    const p = sandboxed({ id: 'g', code: '1', manifest: { name: 'G' } });
    rig.say(rig.frames[0], { t: 'ready', meta: { id: 'g', name: 'G' } });
    const game = await p;
    const round = game.create(2);
    const live = rig.frames[rig.frames.length - 1];
    rig.say(live, { t: 'ready', meta: {} });
    const create = rig.sent.find(m => m.t === 'create');
    assert.equal(create.n, 2); assert.equal(create.hands, 'body');
    round.step(0.016, 800, 600);
    assert.equal(rig.sent.filter(m => m.t === 'frame').pop().hands, 'body');
    setHandsMode('glow');
    rig.say(live, { t: 'frame', state: {} });          /* (the last frame came back: the next may go) */
    round.step(0.016, 800, 600);
    assert.equal(rig.sent.filter(m => m.t === 'frame').pop().hands, 'glow', 'a change reaches it on the next frame');
    /* H pressed inside the frame is handed to the app like a key pressed in it */
    rig.say(live, { t: 'key', key: 'h' });
    assert.equal(rig.keys.length, 1); assert.equal(rig.keys[0].type, 'keydown'); assert.equal(rig.keys[0].key, 'h');
    rig.say(live, { t: 'key', key: 'g' });
    assert.equal(rig.keys.length, 1, 'only H is passed on');
    round.close();
  } finally { rig.undo(); setHandsMode('rings'); }
});

test('inside the sandbox the runtime takes the app\'s choice and passes H up', async () => {
  const listeners = {}, posted = [];
  globalThis.addEventListener = (t, fn) => { (listeners[t] ||= []).push(fn); };
  globalThis.parent = { postMessage: (m) => posted.push(m) };
  globalThis.OffscreenCanvas = class { constructor(w, h){ this.width = w; this.height = h; } getContext(){ return new Proxy({}, { get: () => () => {}, set: () => true }); } transferToImageBitmap(){ return {}; } };
  try {
    setHandsMode('rings');
    const { run } = await import('../kit/runtime/main.js');
    let seen = null;
    run({ id: 'g', create: () => ({ step(){}, draw(){ seen = handsMode(); } }) });
    const msg = (data) => listeners.message.forEach(fn => fn({ source: globalThis.parent, data }));
    msg({ t: 'create', n: 1, hands: 'glow' });
    assert.equal(handsMode(), 'glow', 'set at the start of the round');
    msg({ t: 'frame', dt: 0.01, W: 10, H: 10, pose: null, hands: 'body', step: true });
    assert.equal(seen, 'body', 'and for every frame, before the game draws');
    msg({ t: 'frame', dt: 0.01, W: 10, H: 10, pose: null, step: true });
    assert.equal(seen, 'body', 'a message without it changes nothing');
    listeners.keydown.forEach(fn => fn({ key: 'H' }));
    listeners.keydown.forEach(fn => fn({ key: 'h', ctrlKey: true }));
    assert.deepEqual(posted.filter(m => m.t === 'key'), [{ t: 'key', key: 'H' }]);
  } finally { globalThis.addEventListener = () => {}; delete globalThis.parent; delete globalThis.OffscreenCanvas; setHandsMode('rings'); }
});

test('a packaged game carries its own hands drawing, which only the messages steer', async () => {
  await buildOrlis('pop-party');
  const parts = readOrlis(readFileSync(new URL('../../server/starter/pop-party.orlis', import.meta.url)));
  const code = parts['game.js'].toString();
  assert.ok(code.includes('body') && !code.includes('orlis_handsmode'), 'its own copy of the hands drawing, with no app storage to read it from');
  assert.ok(code.includes('"hands"') || code.includes("'hands'") || code.includes('.hands'), 'and the runtime that reads the choice');
});
