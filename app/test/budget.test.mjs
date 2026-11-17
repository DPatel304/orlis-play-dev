import test from 'node:test';
import assert from 'node:assert/strict';
import { CAM, HD, posesWanted, nextSkip, isIdle, IDLE_AFTER, renderScale, SLOW_MS, EASY_MS } from '../src/tracking/budget.js';

test('the camera is asked for a small picture; the sharp one is bigger, same shape', () => {
  assert.ok(CAM.width * CAM.height < HD.width * HD.height / 3);
  assert.equal(CAM.width / CAM.height, HD.width / HD.height);
});

test('it looks for the players and one more, never fewer than one, never more than four', () => {
  assert.equal(posesWanted(1), 2); assert.equal(posesWanted(2), 3); assert.equal(posesWanted(4), 4);
  assert.equal(posesWanted(0), 2); assert.equal(posesWanted(undefined), 2); assert.equal(posesWanted(9), 4);
});

test('a slow look makes it look less often; an easy one makes it look every frame again - not flapping in between', () => {
  assert.equal(nextSkip(1, SLOW_MS + 5), 2);
  assert.equal(nextSkip(2, SLOW_MS + 5), 3);
  assert.equal(nextSkip(3, 80), 3, 'no more than every 3rd frame');
  assert.equal(nextSkip(3, EASY_MS - 2), 2);
  assert.equal(nextSkip(1, EASY_MS - 2), 1);
  assert.equal(nextSkip(2, (SLOW_MS + EASY_MS) / 2), 2, 'in between: it stays as it is');
});

test('idle starts a few seconds after the last person left', () => {
  assert.equal(isIdle(0), false); assert.equal(isIdle(IDLE_AFTER), false); assert.equal(isIdle(IDLE_AFTER + 0.1), true);
});

test('the picture is drawn at no more pixels than a TV can use', () => {
  assert.equal(renderScale(1920, 1080, 1), 1, 'a 1080p screen is left alone');
  assert.equal(renderScale(960, 540, 2), 2, 'a small sharp screen keeps its sharpness');
  const k = renderScale(3840, 2160, 1);
  assert.ok(k < 0.9 && 3840 * 2160 * k * k <= 2.6e6 + 1, '4K is drawn at about 1080p');
  const hi = renderScale(2560, 1440, 1.5);
  assert.ok(2560 * 1440 * hi * hi <= 2.6e6 + 1);
});
