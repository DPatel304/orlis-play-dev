/* This week, from the family's Orlis server, for the Play page: Discover's
   games (and which are featured this week), and the family challenges.
   Kept between visits; asked again at most once a minute (and straight
   after a round, which may have moved a challenge on). Each finished round
   is told to the server here too. */
import { account } from './account.js';

export const week = {
  store: null,          /* { games, featured } */
  challenges: null,     /* { week, ends, challenges, trophies } */
  at: 0,

  /* true if anything changed */
  async refresh({ force = false } = {}){
    if (!account.needed || !account.signedIn) return false;
    if (!force && Date.now() - this.at < 60000) return false;
    this.at = Date.now();
    const was = this.key();
    const [st, ch] = await Promise.all([
      account.waiting ? null : account.call('GET', '/api/store').catch(() => null),
      account.call('GET', '/api/challenges').catch(() => null)
    ]);
    if (st) this.store = st;
    if (ch) this.challenges = ch;
    return this.key() !== was;
  },
  key(){ return JSON.stringify([this.store && this.store.featured, this.store && this.store.games && this.store.games.map(g => g.id + g.version), this.challenges]); },

  /* this week's featured Discover games, as entries */
  featured(){
    const st = this.store;
    if (!st || !st.featured) return [];
    return st.featured.map(id => st.games.find(g => g.id === id)).filter(Boolean);
  },

  /* a round's over: which game, its best score, how long, how many played */
  played(round){
    if (!account.needed || !account.signedIn) return;
    account.call('POST', '/api/plays', round).catch(() => {});
    this.at = 0;
  }
};
