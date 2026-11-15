/* Starting with Windows: Orlis Server in the list of things Windows starts
   when this person signs in (their own "Run" list in the registry - no admin
   needed, and it shows in Task Manager's Startup apps, where it can be
   switched off too). On by default the first time it runs; after that it
   keeps whatever's picked on the icon's menu ("Start with Windows").

   Windows' own reg.exe does the work, so there's nothing to install. */
import { execFile } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
export const NAME = 'Orlis Server';
/* (in the data folder: it's been set up once - from then on, it's as picked) */
const CHOSEN = 'start-with-windows.chosen';

/* run(args) -> Promise<{ code, out }> - reg.exe, or a stand-in in the tests */
function regExe(args){
  return new Promise((resolve) => {
    execFile('reg.exe', args, { windowsHide: true }, (err, out) => resolve({ code: err ? (err.code ?? 1) : 0, out: String(out || '') }));
  });
}

export function startup({ exe, dataDir, run = regExe }){
  const value = `"${exe}"`;
  const s = {
    /* whether it's on (and pointing at this exe) */
    async on(){ const r = await run(['query', KEY, '/v', NAME]); return r.code === 0 && r.out.includes(exe); },
    async set(on){
      const r = on ? await run(['add', KEY, '/v', NAME, '/t', 'REG_SZ', '/d', value, '/f'])
                   : await run(['delete', KEY, '/v', NAME, '/f']);
      try { writeFileSync(join(dataDir, CHOSEN), on ? 'on' : 'off'); } catch {}
      return on ? r.code === 0 : true;
    },
    /* As it starts: the first time, switch it on; after that, if it's on,
       point it at this exe (it may have been moved). Returns whether it's on. */
    async settle(){
      if (!existsSync(join(dataDir, CHOSEN))) return s.set(true);
      const r = await run(['query', KEY, '/v', NAME]);
      if (r.code !== 0) return false;
      if (!r.out.includes(exe)) await run(['add', KEY, '/v', NAME, '/t', 'REG_SZ', '/d', value, '/f']);
      return true;
    }
  };
  return s;
}
