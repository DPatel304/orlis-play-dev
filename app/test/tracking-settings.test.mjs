import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { trackingSwitchOn, setTrackingSwitch } from '../src/ui/testing.js';
import { pose } from '../src/tracking/pose.js';

const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('Settings > Testing has the three tracking switches, for the owner, with a plain name and one hint each', () => {
  const menu = src('../src/ui/menu.js');
  const owner = menu.slice(menu.indexOf("account.role === 'owner'"), menu.indexOf('s.appendChild(card);'));
  for (const [key, name] of [['appearance', 'Recognise players by clothes'], ['zoom', 'Look closer at small players'], ['info', 'Show tracking details']]){
    assert.ok(owner.includes(`'${key}', '${name}', '`), name + ' is a row in the owner-only part');
  }
  assert.match(owner, /\[false, 'Off'\], \[true, 'On'\]/);
  assert.match(owner, /hint = tip;\s*row\(name, seg\)/, 'a one-line hint under each name, as the other rows');
});

test('the switches are off by default, kept like the other Testing switches, and read by the tracker', () => {
  for (const k of ['appearance', 'zoom', 'info']) assert.equal(trackingSwitchOn(k), false);
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
  assert.deepEqual(Object.keys(info).sort(), ['clothes', 'cropMs', 'rows', 'zoom']);
  assert.equal(info.zoom, 'off');
});

test('the camera picture is only read inside the tracker, and the switches change nothing when off', () => {
  const p = src('../src/tracking/pose.js');
  assert.match(p, /this\.zoomOn\(\)\)\{\s*try \{ const z = this\._zoom/);
  assert.match(p, /this\.appearanceOn\(\) \? \(\) => this\._grab\(\) : undefined/);
});
