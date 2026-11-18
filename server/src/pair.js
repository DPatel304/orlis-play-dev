/* Pairing a creator's laptop tool (the `orlis` command, run by Claude Code) with this server.

   A signed-in creator or owner asks for a code (from the app: POST /api/pair). It's good once, for a few minutes,
   and only held in memory. The tool trades it for its own sign-in (POST /api/pair/redeem): a session for that
   account, called "Orlis tool", which the creator can see and end like any other device. Same Wi-Fi only: nothing
   here is for the internet - and the tool is never given the creator's password. */
import { Fail } from './http.js';
import { TOOL_DEVICE } from './guardrails.js';
import { now } from './db.js';
import { newToken, hashToken } from './secure.js';
import { randomInt } from 'node:crypto';

export const PAIR_MS = 5 * 60 * 1000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';     /* (no 0, O, 1, I) */
const tidy = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function pairing(db){
  const codes = new Map();                   /* code -> { account, until } */
  let wrong = [];                            /* when wrong codes were tried (lately) */
  const fresh = () => { for (const [c, v] of codes) if (v.until <= Date.now()) codes.delete(c); };
  return {
    routes: (who) => [
      ['POST', '/api/pair', ({ headers }) => {
        const a = who(headers);
        if (a.role !== 'creator' && a.role !== 'owner') throw new Fail(403, 'not_creator', 'Only creators can connect Claude Code.');
        fresh();
        for (const [c, v] of codes) if (v.account === a.id) codes.delete(c);        /* (one at a time) */
        let code; do { code = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''); } while (codes.has(code));
        codes.set(code, { account: a.id, until: Date.now() + PAIR_MS });
        return { code: `${code.slice(0, 4)}-${code.slice(4)}`, expiresIn: Math.round(PAIR_MS / 1000) };
      }],
      /* (no sign-in: the code is the proof - a few wrong tries and it waits) */
      ['POST', '/api/pair/redeem', ({ body }) => {
        const t = Date.now();
        wrong = wrong.filter(x => t - x < 60e3);
        if (wrong.length >= 8) throw new Fail(429, 'paused', 'Too many tries. Wait a minute, then try again.');
        fresh();
        const code = tidy(body && body.code), hit = codes.get(code);
        if (!hit){ wrong.push(t); throw new Fail(400, 'bad_code', 'That code didn\'t work. It may have run out - ask for a new one.'); }
        codes.delete(code);
        const a = db.prepare('SELECT * FROM accounts WHERE id = ?').get(hit.account);
        if (!a || (a.role !== 'creator' && a.role !== 'owner')) throw new Fail(403, 'not_creator', 'Only creators can connect Claude Code.');
        const token = newToken(), n = now();
        db.prepare('INSERT INTO sessions (token_hash, account_id, device, created_at, last_seen) VALUES (?, ?, ?, ?, ?)').run(hashToken(token), a.id, TOOL_DEVICE, n, n);
        return { token, email: a.email };
      }]
    ]
  };
}
