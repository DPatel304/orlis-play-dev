/* The TV's side of Test: one request held open at the family's server, which answers only when a creator
   in the family presses Test, takes a game off, publishes, or arrives or goes (server: drafts.js). Until then
   nothing is sent or done - an idle connection. Each answer is the games being tested now (week.drafts); the
   request is made again at once. Only the Player app, signed in. */
import { account } from './account.js';
import { week } from './week.js';
import { appMode } from './mode.js';
import { toast } from './toast.js';

let running = false;
export function watchTests({ onChange }){
  if (running) return;
  running = true;
  (async () => {
    let n = 0, seen = new Map();
    while (true){
      if (!account.needed || !account.signedIn || account.waiting || appMode.creator()){ await new Promise(r => setTimeout(r, 5000)); continue; }
      const s = account.state;
      try {
        const r = await fetch(`${s.server.url.replace(/\/$/, '')}/api/drafts/wait?since=${n}`, { headers: { Authorization: `Bearer ${s.token}` }, signal: AbortSignal.timeout(60000) });
        if (!r.ok) throw new Error(String(r.status));
        const got = await r.json();
        if (got.n === n) continue;                       /* (nothing happened: ask again) */
        n = got.n;
        const next = new Map((got.drafts || []).map(d => [d.id, d.sha256]));
        const fresh = (got.drafts || []).filter(d => seen.get(d.id) !== d.sha256);
        seen = next; week.drafts = got.drafts || [];
        if (fresh.length) toast(`New test: ${fresh[0].name}`, { ms: 4000 });
        onChange();
      } catch {
        await new Promise(r => setTimeout(r, 5000));       /* (server out of reach: try again shortly) */
      }
    }
  })();
}
