/* The app's modes - one app, and the install decides which it is:

     family   Play, Discover, Create      the one that plays on the TV; what a
                                           hardware box would be locked to
     studio   Create, Create Pro          for a grown-up's laptop or phone: only
                                           for making games - it can't play them
     all      all four tabs               the default for now, for building and
                                           testing every tab

   The Windows build says which it is (window.ORLIS_MODE, set when it's built
   - ORLIS_MODE=family or studio; unset, it's all). In a browser, ?mode=family,
   ?mode=studio or ?mode=all stands in for it. Nothing in the app lets anyone
   switch. */
export const MODES = { family: ['home', 'store', 'create'], studio: ['create', 'pro'], all: ['home', 'store', 'create', 'pro'] };

const built = () => (typeof window !== 'undefined' && MODES[window.ORLIS_MODE]) ? window.ORLIS_MODE : null;
const asked = () => { const m = typeof location !== 'undefined' ? /[?&]mode=(family|studio|all)\b/.exec(location.search || '') : null; return m ? m[1] : null; };

export const appMode = {
  get(){ return built() || asked() || 'all'; },
  /* the Studio can't play games (the other modes can) */
  studio(){ return this.get() === 'studio'; },
  /* the tab ids this mode shows */
  tabs(){ return MODES[this.get()]; }
};
