/* This week, from the family's Orlis server, for the Play page: Discover's
   games (and which are featured this week), and the family challenges.
   Kept between visits; asked again at most once a minute (and straight
   after a round, which may have moved a challenge on). Each finished round
   is told to the server here too. */
import { account } from './account.js';
import { library } from './library.js';
import { appMode } from './mode.js';
import { newer } from './store.js';

export const week = {
  store: null,          /* { games, featured } */
  challenges: null,     /* { week, ends, challenges, stars } */
  drafts: [],           /* the games a creator in the family is testing on this TV (kept by tvwatch.js) */
  requests: [],         /* the games this account asked to have made, and how each is going */
  at: 0,

  /* true if anything changed */
  async refresh({ force = false } = {}){
    if (!account.needed || !account.signedIn) return false;
    /* (a game on its way is looked at more often: how it's going is news) */
    if (!force && Date.now() - this.at < (this.building().length ? 15000 : 60000)) return false;
    this.at = Date.now();
    const was = this.key();
    const [st, ch, rq] = await Promise.all([
      account.waiting ? null : account.call('GET', '/api/store').catch(() => null),
      account.call('GET', '/api/challenges').catch(() => null),
      account.waiting || account.isKid ? null : account.call('GET', '/api/requests').catch(() => null)
    ]);
    if (st) this.store = st;
    if (ch) this.challenges = ch;
    if (rq) this.requests = rq.requests || [];
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
  key(){ return JSON.stringify([this.store && this.store.featured, this.store && this.store.games && this.store.games.map(g => g.id + g.version), this.challenges, this.requests.map(x => x.id + x.state), this.drafts.map(d => d.id + d.version + d.sha256)]); },

  /* the ones still being made (or not going to be), for Play's Under construction row */
  building(){
    return (this.requests || []).filter(x => ['waiting', 'making', 'made', 'ready', 'declined'].includes(x.state));
  },

  /* this week's featured Discover games, as entries */
  featured(){
    const st = this.store;
    if (!st || !st.featured) return [];
    return st.featured.map(id => st.games.find(g => g.id === id)).filter(Boolean);
  },

  /* a round's over: which game, its best score, how long, how many played */
  async played(round){
    if (!account.needed || !account.signedIn) return [];
    const was = new Set(((this.challenges && this.challenges.challenges) || []).filter(c => c.done).map(c => c.id));
    try { await account.call('POST', '/api/plays', round); } catch { return []; }
    await this.refresh({ force: true }).catch(() => {});
    return ((this.challenges && this.challenges.challenges) || []).filter(c => c.done && !was.has(c.id));
  }
};
