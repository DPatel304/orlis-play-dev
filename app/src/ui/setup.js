/* Setting up, from the app itself, for a creator who lives elsewhere: is
   Tailscale there and signed in (to reach the family's Orlis), and Claude
   Code (to make games)? A button to get each (setup.rs, in the Windows app).

   setup.status()            { tailscale: { installed, state }, claude: { installed } }
                             state: 'on' | 'signin' | 'off' | 'starting' | 'missing'
   setup.installTailscale()  { how: 'winget' | 'browser' }
   setup.tailscaleLogin()    { opened }
   setup.installClaude()
   setup.open(url)           a setup page in the browser

   connectSteps(status, found) - the "connect to the family's Orlis"
   checklist, worked out from what's there: each step { key, state ('done' |
   'now' | 'later'), title, line, action ('install' | 'signin' | null) }. */

const invoke = (cmd, args) => window.__TAURI__.core.invoke(cmd, args);
const asError = (e) => new Error(typeof e === 'string' ? e : (e && e.message) || 'That didn’t work.');
const call = async (cmd, args) => { try { return await invoke(cmd, args); } catch (e){ throw asError(e); } };

export const setup = {
  get available(){ return typeof window !== 'undefined' && !!(window.__TAURI__ && window.__TAURI__.core); },
  async status(){
    const none = { tailscale: { installed: false, state: 'missing' }, claude: { installed: false } };
    if (!this.available) return none;
    /* (anything missing - an older app, no answer - counts as not there yet) */
    try { const r = await call('setup_status'); return { tailscale: (r && r.tailscale) || none.tailscale, claude: (r && r.claude) || none.claude }; }
    catch { return none; }
  },
  installTailscale(){ return call('install_tailscale'); },
  tailscaleLogin(){ return call('tailscale_login'); },
  installClaude(){ return call('install_claude'); },
  open(url){ return call('open_link', { url }); }
};

export function connectSteps(status, found = false){
  const ts = (status && status.tailscale) || { installed: false, state: 'missing' };
  const steps = [];
  const installed = ts.state !== 'missing';
  const on = ts.state === 'on';
  steps.push({ key: 'install', state: installed ? 'done' : 'now', title: 'Install Tailscale',
    line: installed ? 'Tailscale is on this PC.' : 'A free app that links this PC privately to the family’s Orlis laptop.',
    action: installed ? null : 'install' });
  steps.push({ key: 'signin', state: on ? 'done' : installed ? 'now' : 'later', title: 'Sign in to Tailscale',
    line: on ? 'Signed in.' : ts.state === 'off' ? 'Tailscale is switched off: click its icon by the clock and switch it on.'
      : ts.state === 'starting' ? 'Tailscale is starting…' : 'Any account works, like Google.',
    action: installed && !on && ts.state !== 'starting' ? 'signin' : null });
  steps.push({ key: 'share', state: found ? 'done' : on ? 'now' : 'later', title: 'Accept the share link you were sent',
    line: found ? 'Found the family’s Orlis.' : 'Open the link in your email or messages and accept it. This connects by itself once you have.',
    action: null });
  return steps;
}
