/* Test and Publish: a creator's game going to their own family's TV Orlis
   (the Orlis Server at home), with no one else in between.

   tv.test(bytes)    the game goes where the TV can find it; the Player app
                     lists it under Play's "Testing" row and plays it, without keeping it
   tv.drafts()       what's being tested now
   tv.publish(id)    it goes into the family's Store; the Player app downloads
                     it, and it's one of the games under Play
   tv.remove(id)     take it off the TV's testing row */
import { account } from './account.js';

async function fail(r, fallback){
  let why = fallback;
  try { why = (await r.json()).message || why; } catch {}
  throw new Error(why);
}
export const tv = {
  async test(bytes){
    const s = account.state;
    const send = () => fetch(s.server.url.replace(/\/$/, '') + '/api/drafts', { method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/octet-stream', Authorization: `Bearer ${s.token}` }, body: bytes });
    let r;
    try { r = await send(); }
    catch {
      if (!(await account.findAgain())) throw new Error('Can’t reach the TV’s Orlis. Is it on, on the same Wi-Fi?');
      try { r = await send(); } catch { throw new Error('Can’t reach the TV’s Orlis. Is it on, on the same Wi-Fi?'); }
    }
    if (!r.ok) await fail(r, 'The TV’s Orlis didn’t take it.');
    return r.json();
  },
  async drafts(){
    try { return (await account.call('GET', '/api/drafts')).drafts || []; } catch { return null; }
  },
  /* Create Pro is open: the family's TV knows a creator is here */
  here(){ return account.call('POST', '/api/drafts/here').catch(() => {}); },
  publish(id){ return account.call('POST', `/api/drafts/${encodeURIComponent(id)}/publish`); },
  remove(id){ return account.call('DELETE', `/api/drafts/${encodeURIComponent(id)}`); }
};
