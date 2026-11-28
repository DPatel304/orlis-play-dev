import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { trackingSwitchOn, setTrackingSwitch } from '../src/ui/testing.js';
import { pose } from '../src/tracking/pose.js';

const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('Settings > Testing has the tracking switches, for the owner, in this order, with a plain name and one hint each', () => {
  const menu = src('../src/ui/menu.js');
  const owner = menu.slice(menu.indexOf("account.role === 'owner'"), menu.indexOf('s.appendChild(card);'));
  const rows = [['appearance', 'Recognise players by clothes'], ['zoom', 'Look closer at small players'], ['apart', 'Tell players apart better'], ['steady', 'Steadier hands'],
    ['light', 'Lighting tips'], ['screenlight', 'Brighten the screen in dark rooms'], ['camera', 'Sharper camera'], ['record', 'Record tracking (points only)'], ['info', 'Show tracking details']];
  let at = -1;
  for (const [key, name] of rows){
    const i = owner.indexOf(`'${key}', '${name}', '`);
    assert.ok(i > at, name + ' is a row in the owner-only part, after the one before it');
    at = i;
  }
  assert.match(owner, /Save recording/);
  assert.match(owner, /\[false, 'Off'\], \[true, 'On'\]/);
  assert.match(owner, /hint = tip;[\s\S]*row\(name, seg(, \.\.\.more)?\)/, 'a one-line hint under each name, as the other rows');
});

test('the switches are off by default, kept like the other Testing switches, and read by the tracker', () => {
  for (const k of ['appearance', 'zoom', 'info', 'record', 'steady', 'camera', 'light', 'screenlight', 'apart']) assert.equal(trackingSwitchOn(k), false);
  setTrackingSwitch('zoom', true);
  assert.equal(pose.zoomOn(), true); assert.equal(pose.appearanceOn(), false); assert.equal(pose.infoOn(), false);
  assert.equal(localStorage.getItem('orlis_zoomin'), '1');
  setTrackingSwitch('zoom', false);
  assert.equal(pose.zoomOn(), false);
});

test('the tracking details are drawn only for the owner with the switch on, and the readout is small', () => {
  const main = src('../src/main.js');
  assert.match(main, /function drawTrackInfo\(\)\{\s*if \(account\.role !== 'owner' \|\| !pose\.infoOn\(\)\) return;/);
  assert.match(main, /drawPerf\(dt\);\s*drawTrackInfo\(\);/);
  const info = pose.trackInfo();
  assert.deepEqual(Object.keys(info).sort(), ['apart', 'camera', 'clothes', 'cropMs', 'light', 'record', 'rows', 'steady', 'zoom']);
  assert.equal(info.record, null); assert.equal(info.camera, null); assert.equal(info.light, null);
  assert.equal(info.zoom, 'off');
});

test('the camera picture is only read inside the tracker, and the switches change nothing when off', () => {
  const p = src('../src/tracking/pose.js');
  assert.match(p, /this\.zoomOn\(\)\)\{\s*try \{ const z = this\._zoom/);
  assert.match(p, /this\.appearanceOn\(\) \? \(\) => this\._grab\(\) : undefined/);
});
