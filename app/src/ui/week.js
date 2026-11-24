/* This week, from the family's Orlis server, for the Play page: Discover's
   games (and which are featured this week), and the family challenges.
   Kept between visits; asked again at most once a minute (and straight
   after a round, which may have moved a challenge on). Each finished round
   is told to the server here too. */
import { account } from './account.js';
import { library } from './library.js';
import { appMode } from './mode.js';
import { newer } from './store.js';
import { seesWaiting, waitingEntries } from './submissions.js';

export const week = {
  store: null,          /* { games, featured } */
  challenges: null,     /* { week, ends, challenges, stars } */
  drafts: [],           /* the games a creator in the family is testing on this TV (kept by tvwatch.js) */
  waiting: [],          /* the owner only: games creators sent, waiting for the owner's OK (submissions.js) */
  at: 0,

  /* true if anything changed */
  async refresh({ force = false } = {}){
    if (!account.needed || !account.signedIn) return false;
    if (!force && Date.now() - this.at < 60000) return false;
    this.at = Date.now();
    const was = this.key();
    const [st, ch, wt] = await Promise.all([
      account.waiting ? null : account.call('GET', '/api/store').catch(() => null),
      account.call('GET', '/api/challenges').catch(() => null),
      seesWaiting() ? account.call('GET', '/api/submissions?all=1').catch(() => null) : null
    ]);
    if (st) this.store = st;
    if (ch) this.challenges = ch;
    if (wt) this.waiting = waitingEntries(wt.submissions);
    else if (!seesWaiting()) this.waiting = [];
    /* a game the family's own creator published: it comes down to this TV by itself (and a newer version of one) */
    let got = false;
    if (st && !appMode.creator() && library.installed){
      for (const g of st.games || []){
        if (!g.mine) continue;
        const have = library.installed.get(g.id);
        if (have && !newer(g.version, have)) continue;
        try { await library.install(g); got = true; } catch {}
      }
    }
    return got || this.key() !== was;
  },
  key(){ return JSON.stringify([this.store && this.store.featured, this.store && this.store.featuredSlots && this.store.featuredSlots.map(s => [s.slot, s.id, s.rotating]),this.store && this.store.games && this.store.games.map(g => g.id + g.version), this.challenges, this.waiting.map(x => x.submission), this.drafts.map(d => d.id + d.version + d.sha256)]); },

  /* this week's featured Discover games, as entries */
  featured(){
    const st = this.store;
    if (!st || !st.featured) return [];
    return st.featured.map(id => st.games.find(g => g.id === id)).filter(Boolean);
  },

  /* Home's Featured slots (decision 0058): [slot 1, 2, 3], each { id, name, builtIn, rotating, ...the Store entry, for a Store game }, as the server
     sends them (the owner's picks, an empty slot filled from the weekly rotation). An older server sends only the list of Discover ids: those become
     rotating slots. No server (or nothing cached yet): none. */
  featuredSlots(){
    const st = this.store;
    if (!st) return [];
    if (Array.isArray(st.featuredSlots)) return st.featuredSlots;
    return this.featured().slice(0, 3).map((e, i) => ({ ...e, slot: i + 1, builtIn: false, rotating: true }));
  },

  /* a round's over: which game, its best score, how long, how many played.
     Answers what it moved this week: [{ id, kind, title, need, before, after, finished, slot }] (finished: it reached its goal this round). */
  async played(round){
    if (!account.needed || !account.signedIn) return [];
    const was = new Map(((this.challenges && this.challenges.challenges) || []).map(c => [c.id, c]));
    try { await account.call('POST', '/api/plays', round); } catch { return []; }
    await this.refresh({ force: true }).catch(() => {});
    return movesOf(was, (this.challenges && this.challenges.challenges) || []);
  }
};

/* what changed between two looks at this week's challenges (was: a Map by id) */
export function movesOf(was, now){
  const out = [];
  now.forEach((c, slot) => {
    const b = was.get(c.id), before = b ? b.have : 0, wasDone = !!(b && b.done);
    if (c.have > before || (c.done && !wasDone)) out.push({ id: c.id, kind: c.kind, title: c.title, need: c.need, before, after: c.have, finished: !!c.done && !wasDone, slot });
  });
  return out;
}
