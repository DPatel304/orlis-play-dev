/* The family's creations, on this TV (decisions 0056, 0057).

   They live on the family's server (GET/POST /api/creations, DELETE /api/creations/:id; server/src/creations.js), so every TV in the house
   sees them, and are kept here too (localStorage, per household) so they still play with the server out of reach. A game saved while the
   server can't be reached (or with no account: the browser, the tests) waits here marked `pending` and goes up the next time it can.

     creations.items        the family's games now (a copy kept here)       creations.refresh()   ask the server (true if the list changed)
     creations.save(game)   { id?, name, picks, makerId } -> the saved game   creations.remove(id)
   A game: { id, name, makerId, picks, desc, createdAt, updatedAt, pending? } */
import { account } from '../ui/account.js';
import { build, clean } from './recipe.js';
import { MAX_SLOTS, FULL_LINE } from './slots.js';

const KEY = 'orlis.creations';
const keyOf = () => KEY + ':' + ((account.state && account.state.household && account.state.household.id) || 'here');
const readCache = () => { try { const r = JSON.parse(localStorage.getItem(keyOf())); return Array.isArray(r) ? r : []; } catch { return []; } };
const writeCache = (list) => { try { localStorage.setItem(keyOf(), JSON.stringify(list)); } catch {} };
const isLocal = (id) => String(id).startsWith('local-');
const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = (message, status = 0) => Object.assign(new Error(message), { status });

export const creations = {
  _items: null,
  /* (tests: how the server is asked) */
  call: (method, path, body) => account.call(method, path, body),
  get online(){ return !!account.signedIn && !account.waiting; },
  get items(){ if (!this._items) this._items = readCache(); return this._items; },
  replace(list){ this._items = list; writeCache(list); },
  /* forget what's held (another family signed in, or the tests) */
  reset(){ this._items = null; },
  byId(id){ return this.items.find(c => c.id === id) || null; },
  get full(){ return this.items.length >= MAX_SLOTS; },

  /* send what's waiting, then take the server's list. true if what is shown changed. */
  async refresh(){
    if (!this.online) return false;
    const was = this.items;
    try {
      for (const c of this.items.filter(x => x.pending)) await this._send(c).catch((e) => { if (e.status === 0) throw e; });
      const r = await this.call('GET', '/api/creations');
      const waiting = this.items.filter(x => x.pending);
      const list = [...(r.creations || []).filter(c => !waiting.some(w => w.id === c.id)), ...waiting].slice(0, MAX_SLOTS);
      this.replace(list);
    } catch { return false; }
    return !sameList(was, this.items);
  },

  async _send(c){
    const body = { name: c.name, picks: c.picks, desc: c.desc || build(c.picks), makerId: c.makerId, ...(isLocal(c.id) ? {} : { id: c.id }) };
    const saved = await this.call('POST', '/api/creations', body);
    this.replace(this.items.map(x => x.id === c.id ? saved : x));
    return saved;
  },

  /* a new game takes a free slot; one with an id is saved back into its own slot */
  async save({ id = null, name, picks, makerId }){
    const whole = clean(picks), now = new Date().toISOString();
    const mine = id ? this.byId(id) : null;
    if (!mine && this.full) throw fail(FULL_LINE, 409);
    const game = { id: mine ? mine.id : 'local-' + Math.random().toString(36).slice(2, 10), name: String(name || whole.name || 'My game').slice(0, 24), makerId: makerId || (mine && mine.makerId) || null,
      picks: { ...whole, name: String(name || whole.name || '').slice(0, 24) || undefined }, desc: null, createdAt: mine ? mine.createdAt : now, updatedAt: now };
    if (!game.picks.name) delete game.picks.name;
    game.desc = build(game.picks);
    const put = (g) => this.replace(mine ? this.items.map(x => x.id === g.id ? g : x) : [...this.items, g]);
    if (this.online){
      try {
        const saved = await this.call('POST', '/api/creations', { name: game.name, picks: game.picks, desc: game.desc, makerId: game.makerId, ...(mine && !isLocal(mine.id) ? { id: mine.id } : {}) });
        const at = mine ? this.items.findIndex(x => x.id === mine.id) : -1, rest = this.items.filter(x => !mine || x.id !== mine.id);
        this.replace(at >= 0 ? [...rest.slice(0, at), saved, ...rest.slice(at)] : [...rest, saved]);
        return saved;
      } catch (e){
        if (e.status !== 0) throw e;                     /* (the server said no: its words are the answer) */
      }
    }
    /* the server's out of reach, or there is none here: kept here, and sent when it can be */
    game.pending = true; put(game);
    return game;
  },

  async remove(id){
    const mine = this.byId(id);
    if (!mine) return false;
    if (this.online && !isLocal(mine.id)){
      try { await this.call('DELETE', `/api/creations/${encodeURIComponent(id)}`); }
      catch (e){ if (e.status !== 404) throw e; }
    }
    this.replace(this.items.filter(x => x.id !== id));
    return true;
  }
};
