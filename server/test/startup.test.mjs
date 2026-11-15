import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startup, NAME } from '../src/startup.js';

/* a pretend registry, as reg.exe sees it */
function reg(){
  const r = { runs: new Map(), calls: [] };
  r.run = async (args) => {
    r.calls.push(args);
    const [verb, , , name] = args;
    if (verb === 'query') return r.runs.has(name) ? { code: 0, out: `    ${name}    REG_SZ    ${r.runs.get(name)}` } : { code: 1, out: '' };
    if (verb === 'add'){ r.runs.set(name, args[args.indexOf('/d') + 1]); return { code: 0, out: '' }; }
    if (verb === 'delete'){ r.runs.delete(name); return { code: 0, out: '' }; }
  };
  return r;
}
const fresh = () => mkdtempSync(join(tmpdir(), 'orlis-boot-'));
const EXE = 'C:\\Orlis\\Orlis Server.exe';

test('the first time it runs, it adds itself to Windows\' startup list (this user\'s, no admin)', async () => {
  const r = reg(), dataDir = fresh(), s = startup({ exe: EXE, dataDir, run: r.run });
  assert.equal(await s.settle(), true);
  assert.equal(r.runs.get(NAME), `"${EXE}"`);
  assert.ok(r.calls[0].includes('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'));
  assert.ok(existsSync(join(dataDir, 'start-with-windows.chosen')));
  assert.equal(await s.on(), true);
});

test('switched off, it stays off - it isn\'t added back the next time', async () => {
  const r = reg(), dataDir = fresh(), s = startup({ exe: EXE, dataDir, run: r.run });
  await s.settle(); await s.set(false);
  assert.equal(r.runs.has(NAME), false);
  assert.equal(await startup({ exe: EXE, dataDir, run: r.run }).settle(), false);
  assert.equal(r.runs.has(NAME), false);
});

test('moved to another folder, it points Windows at where it is now', async () => {
  const r = reg(), dataDir = fresh();
  await startup({ exe: EXE, dataDir, run: r.run }).settle();
  const moved = 'D:\\Games\\Orlis Server.exe';
  assert.equal(await startup({ exe: moved, dataDir, run: r.run }).settle(), true);
  assert.equal(r.runs.get(NAME), `"${moved}"`);
});
