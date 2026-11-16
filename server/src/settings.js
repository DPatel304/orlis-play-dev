/* Orlis Server's settings, in one place. Each comes from (first that has it):

     1. an environment variable (ORLIS_...)     - how a cloud server is set up
     2. "settings.json" in the data folder       - for the owner to change
     3. the default                              - right for the laptop

     dataDir         where its data lives          ORLIS_DATA
     name            the name apps show            ORLIS_NAME
     port            its web port (47871)          ORLIS_PORT
     host            what it listens on            ORLIS_HOST
     discovery       answer apps looking on the Wi-Fi (true; false in the
                     cloud, where there's no Wi-Fi)  ORLIS_DISCOVERY
     everyoneCreates every new account a creator   ORLIS_EVERYONE_CREATES
     tailscaleJoin   join over Tailscale with no invite  ORLIS_TAILSCALE_JOIN
     approveJoins    anyone can ask to join, and waits for the owner's OK
                     (no invite code needed) (true)  ORLIS_APPROVE_JOINS
     publicUrl       its address on the internet, if it has one (none on the
                     laptop) - for setup links     ORLIS_PUBLIC_URL
     internetPort    the internet door: where a tunnel (Tailscale Funnel)
                     hands in requests from the internet. Only this laptop
                     can reach it; everyone through it counts as the
                     internet (47872; 0 or false: none)  ORLIS_INTERNET_PORT
     maker           make requested games here, with this computer's
                     Claude Code (true)            ORLIS_MAKER

   (Whether the Windows exe shows its icon or updates itself are about the
   exe, not the server: ORLIS_NO_TRAY and ORLIS_NO_UPDATE, read in main.js.) */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DISCOVERY_PORT } from './discovery.js';

export const DEFAULTS = { name: null, port: 47871, host: '0.0.0.0', discovery: true, everyoneCreates: true, tailscaleJoin: true, approveJoins: true, publicUrl: null, internetPort: 47872, maker: true };
const ENV = { dataDir: 'ORLIS_DATA', name: 'ORLIS_NAME', port: 'ORLIS_PORT', host: 'ORLIS_HOST', discovery: 'ORLIS_DISCOVERY',
  everyoneCreates: 'ORLIS_EVERYONE_CREATES', tailscaleJoin: 'ORLIS_TAILSCALE_JOIN', approveJoins: 'ORLIS_APPROVE_JOINS', publicUrl: 'ORLIS_PUBLIC_URL', internetPort: 'ORLIS_INTERNET_PORT', maker: 'ORLIS_MAKER' };

const yes = (v) => /^(1|true|yes|on)$/i.test(String(v).trim());
const as = (key, v) => {
  if (v == null || v === '') return undefined;
  if (key === 'internetPort' && (v === false || /^(false|off|no|0)$/i.test(String(v).trim()))) return false;
  if (key === 'port' || key === 'internetPort'){ const n = Number(v); if (!Number.isInteger(n) || n < 0 || n > 65535) throw new Error(`${key} must be a port number`); return n; }
  if (['discovery', 'everyoneCreates', 'tailscaleJoin', 'approveJoins', 'maker'].includes(key)) return typeof v === 'boolean' ? v : yes(v);
  if (key === 'publicUrl'){ const u = String(v).trim().replace(/\/$/, ''); if (!/^https:\/\/[^\s/]+/.test(u)) throw new Error('publicUrl must start with https://'); return u; }
  return String(v);
};

/* settings({ env, defaultDataDir }): the settings, worked out */
export function settings({ env = {}, defaultDataDir }){
  const dataDir = env[ENV.dataDir] || defaultDataDir;
  let file = {};
  try { file = JSON.parse(readFileSync(join(dataDir, 'settings.json'), 'utf8')) || {}; } catch (e){ if (e.code !== 'ENOENT') console.error(`settings.json skipped: ${e.message}`); }
  const out = { dataDir };
  for (const key of Object.keys(DEFAULTS)){
    const fromEnv = as(key, env[ENV[key]]), fromFile = as(key, file[key]);
    out[key] = fromEnv !== undefined ? fromEnv : fromFile !== undefined ? fromFile : DEFAULTS[key];
  }
  return out;
}

/* what start() (app.js) takes, from the settings */
export const startOptions = (s) => ({ dataDir: s.dataDir, name: s.name || undefined, port: s.port, host: s.host,
  discoveryPort: s.discovery ? DISCOVERY_PORT : false, everyoneCreates: s.everyoneCreates, tailscaleJoin: s.tailscaleJoin, approveJoins: s.approveJoins, publicUrl: s.publicUrl, internetPort: s.internetPort });
