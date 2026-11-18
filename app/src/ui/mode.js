/* The app's two modes - one app, and the install decides which it is:

     player   Play, Discover, Create      the one that plays on the TV; what a
                                           hardware box would be locked to
     creator  Create, Create Pro          for a grown-up's laptop or phone: only
                                           for making games - it can't play them

   A build that is told its mode (ORLIS_MODE=player or creator when it's
   built -> window.ORLIS_MODE) is locked to it: no way to change it. One that
   isn't - the Beta, and the app in a browser - is for testing, so Settings has
   a Mode switch (kept on this PC); until it's used, it's the Player app.
   In a browser, ?mode=player or ?mode=creator picks it for that page. */
export const MODES = { player: ['home', 'store', 'create'], creator: ['create', 'pro'] };

const KEY = 'orlis_mode';
const built = () => (typeof window !== 'undefined' && MODES[window.ORLIS_MODE]) ? window.ORLIS_MODE : null;
const asked = () => { const m = typeof location !== 'undefined' ? /[?&]mode=(player|creator)\b/.exec(location.search || '') : null; return m ? m[1] : null; };
const kept = () => { try { const m = localStorage.getItem(KEY); return MODES[m] ? m : null; } catch (e){ return null; } };

export const appMode = {
  /* may the mode be switched here: only in a testing build (not one that was told its mode, and not a release) */
  canSwitch(){
    if (built()) return false;
    const label = typeof window !== 'undefined' && window.ORLIS_LABEL;
    return !label || !!label.beta;
  },
  get(){ return built() || asked() || (this.canSwitch() ? kept() : null) || 'player'; },
  set(mode){
    if (!this.canSwitch() || !MODES[mode]) return;
    try { localStorage.setItem(KEY, mode); } catch (e){}
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('orlismode', { detail: mode }));
  },
  /* the Creator app can't play games (the Player app can) */
  creator(){ return this.get() === 'creator'; },
  /* the tab ids this mode shows */
  tabs(){ return MODES[this.get()]; }
};
