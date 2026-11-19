/* Games creators send in, and the owner's OK.

   A creator (or the owner) sends a game's .orlis file. The server checks it
   first, trusting nothing the creator's own PC said: that it's a proper
   .orlis file for the sandbox (kit 2), not too big, its picture only shapes,
   and that its code reaches for nothing a game never needs (the internet,
   the app's storage, other windows...). The sandbox would stop those
   anyway; a game that tries isn't one for the family. A game's id can't
   take over another family's game, or one of Orlis Play's own.

   Then it waits - in "submissions" in the data folder - for the owner, who
   tries it (in Orlis Play's Store, "Waiting for your OK") and approves it,
   or declines it with a note for the creator. Approved, it goes into the
   Store, made by the creator's family. */
import { readOrlis, writeOrlis, manifestOf, sha256, COVER_MAX, UNSAFE_COVER } from './orlis-file.js';
import { badWords } from './words.js';
import { Fail, Raw } from './http.js';
import { now } from './db.js';
import { newId } from './secure.js';
import { newer } from './store.js';

export const KIT = 2;
export const LIMITS = { waiting: 5, code: 4 * 1024 * 1024 };
/* what a game's code never needs, inside the sandbox */
export const FORBIDDEN = [
  ['fetch(', 'the internet'], ['XMLHttpRequest', 'the internet'], ['WebSocket', 'the internet'], ['EventSource', 'the internet'],
  ['sendBeacon', 'the internet'], ['RTCPeerConnection', 'the internet'], ['importScripts', 'other code'], ['import(', 'other code'],
  ['eval(', 'code made up as it runs'], ['new Function', 'code made up as it runs'], ['document.cookie', 'the app\'s storage'],
  ['localStorage', 'the app\'s storage'], ['sessionStorage', 'the app\'s storage'], ['indexedDB', 'the app\'s storage'],
  ['window.parent', 'other windows'], ['window.top', 'other windows'], ['top.location', 'other windows'], ['window.open', 'other windows'],
  ['opener', 'other windows'], ['navigator.', 'the computer\'s details'], ['Worker(', 'other code'],
  /* (ways round the words check: pictures, pages and letters made as it runs) */
  ['Image(', 'pictures made as it runs'], ['createImageBitmap', 'pictures made as it runs'], ['Blob(', 'pictures made as it runs'],
  ['FontFace', 'other letters'], ['createElement', 'parts of a web page'], ['innerHTML', 'parts of a web page'], ['iframe', 'other windows'],
  ['contentWindow', 'other windows'], ['fromCharCode', 'hidden words'], ['fromCodePoint', 'hidden words'], ['atob(', 'hidden words']
];
/* A game made in Create draws only with the Orlis asset library (kit/creator/drawing.json - the same list); its own code, after
   the runtime's, never reaches for a canvas or draws a shape, a word or a picture itself. (Only the game's own part is looked
   at: the runtime in front of it is the library and does the drawing.) */
export const DRAWING = [
  ['.getContext', 'a canvas of its own'], ['OffscreenCanvas', 'a canvas of its own'],
  ['CanvasRenderingContext2D', 'the canvas\'s own drawing'], ['Path2D', 'drawing of its own'],
  ['.fillRect(', 'drawing of its own'], ['.strokeRect(', 'drawing of its own'],
  ['.clearRect(', 'drawing of its own'], ['.beginPath(', 'drawing of its own'],
  ['.arc(', 'drawing of its own'], ['.ellipse(', 'drawing of its own'],
  ['.lineTo(', 'drawing of its own'], ['.moveTo(', 'drawing of its own'],
  ['.bezierCurveTo(', 'drawing of its own'], ['.quadraticCurveTo(', 'drawing of its own'],
  ['.roundRect(', 'drawing of its own'], ['.fillText(', 'words of its own'],
  ['.strokeText(', 'words of its own'], ['.drawImage(', 'pictures of its own'],
  ['.putImageData(', 'pictures of its own'], ['.createLinearGradient(', 'drawing of its own'],
  ['.createRadialGradient(', 'drawing of its own'], ['.createConicGradient(', 'drawing of its own'],
  ['.setTransform(', 'the canvas\'s own drawing'], ['Orlis.run(', 'game code of its own'],
  ['=>', 'game code of its own'], ['function', 'game code of its own'],
  ['class ', 'game code of its own']
];
const OWN = '\nOrlis.manifest=';
const UNSAFE_PICTURE = /<\s*script|\bon\w+\s*=|javascript:|<\s*foreign|href|<\s*image/i;

/* Everything a game's file says about it in the Store. */
function storeText(parts){
  try { const m = JSON.parse(parts['manifest.json'].toString('utf8')); return [m.name, m.blurb, m.about, ...(m.tags || []), ...(m.howto || []).flatMap(h => [h.title, h.line])].filter(x => typeof x === 'string').join('\n'); }
  catch { return ''; }
}

/* The checks, on a game's file. Throws, with every problem found. */
/* Seconds of play before a game can be approved. */
export const TRY_SECS = 20;

export function checkGame(bytes){
  let parts, m;
  try { parts = readOrlis(bytes); m = manifestOf(parts); }
  catch (e){ throw new Fail(400, 'not_a_game', `That isn't a game Orlis Play can use: ${e.message}.`); }
  const problems = [];
  if (m.kit !== KIT) problems.push(`it was made for a different Orlis Play (kit ${m.kit}; this one is kit ${KIT})`);
  const code = parts['game.js'];
  if (!code || !code.length) problems.push('it has no game in it');
  else if (code.length > LIMITS.code) problems.push('its code is too big');
  else {
    const js = code.toString('utf8');
    const seen = new Set();
    for (const [what, why] of FORBIDDEN) if (js.includes(what) && !seen.has(why)){ seen.add(why); problems.push(`it reaches for ${why} (${what.replace(/\($/, '')})`); }
    const own = js.indexOf(OWN) >= 0 ? js.slice(js.indexOf(OWN)) : '';
    if (own && !own.includes('Orlis.play(')) problems.push('it has no Orlis.play( ... ) - a game made in Create is a description of the game');
    for (const [what, why] of DRAWING) if (own.includes(what) && !seen.has(why)){ seen.add(why); problems.push(`it has ${why} (${what.replace(/\($/, '').trim()}) - games are described with Orlis.play and draw with the Orlis asset library`); }
  }
  /* words no game for children has - in its code or its Store text */
  const said = badWords([code ? code.toString('utf8') : '', storeText(parts)].join('\n'));
  if (said.length) problems.push(`it has words that aren't for children (${said.join(', ')})`);
  if (!m.blurb) problems.push('it needs a line saying what the game is');
  if (m.icon && UNSAFE_PICTURE.test(m.icon.glyph)) problems.push('its picture has more than shapes in it');
  /* its cover: a picture in shapes, no words in it, not too big */
  const rawCover = (() => { try { return JSON.parse(parts['manifest.json'].toString('utf8')).cover; } catch { return undefined; } })();
  if (rawCover !== undefined && rawCover !== ''){
    if (typeof rawCover !== 'string' || !/^\s*<svg[\s>]/i.test(rawCover)) problems.push('its cover must be an SVG picture');
    else if (rawCover.length > COVER_MAX) problems.push('its cover picture is too big');
    else if (UNSAFE_COVER.test(rawCover)) problems.push('its cover has more than shapes in it (no words, links or images)');
  }
  if (problems.length) throw new Fail(400, 'checks', `It didn't pass the checks: ${problems.join('; ')}.`, );
  return { parts, manifest: m };
}

/* (the files waiting are kept in the file store - files.js - under "submissions/") */
export function submissions(db, files, shop, log = { add(){} }){
  const q = (sql) => db.prepare(sql);
  const out = (r) => r && ({ id: r.id, gameId: r.game_id, name: r.name, version: r.version, bytes: r.bytes, state: r.status, note: r.note, createdAt: r.created_at, decidedAt: r.decided_at, tried: !!r.tried_at,
    ...(r.email ? { by: r.email, family: r.family, sha256: r.sha256 } : {}) });
  const fileOf = (id) => `submissions/${id}.orlis`;
  const familyName = (accountId) => {
    const r = q('SELECT h.name FROM accounts a JOIN households h ON h.id = a.household_id WHERE a.id = ?').get(accountId);
    return r ? r.name : 'A family';
  };

  /* A game file in, for the owner's OK, as sent by account a (a creator
     sending their own, or the owner's laptop sending one it made for them -
     requests.js): the same checks either way. [status, the submission] */
  async function accept(a, raw, note = null){
    if (!raw || !raw.length) throw new Fail(400, 'no_file', 'Send the game\'s .orlis file.');
    const { manifest: m } = checkGame(raw);
    /* whose game this id is */
    const inStore = (await shop.games()).find(g => g.id === m.id);
    if (inStore && inStore.by === 'Orlis Play' && a.role !== 'owner') throw new Fail(409, 'taken', `"${m.id}" is one of Orlis Play's own games. Give your game an id of its own.`);
    const other = q("SELECT 1 FROM submissions WHERE game_id = ? AND account_id != ? AND status IN ('waiting', 'approved')").get(m.id, a.id);
    if (other) throw new Fail(409, 'taken', `Another family already has a game called "${m.id}". Give yours an id of its own.`);
    /* a change to a game in the Store comes as a newer version - or the
       families who have it would never be offered it */
    if (inStore && !newer(m.version, inStore.version)) throw new Fail(409, 'old_version', `The Store already has version ${inStore.version} of ${m.name}. In Create, press Check and send again: it gives this one a newer number.`);
    if (q("SELECT COUNT(*) AS n FROM submissions WHERE account_id = ? AND status = 'waiting'").get(a.id).n >= LIMITS.waiting) throw new Fail(400, 'too_many', `You have ${LIMITS.waiting} games waiting already. Wait for the owner to look at them first.`);
    const sha = sha256(raw);
    const same = q("SELECT * FROM submissions WHERE account_id = ? AND sha256 = ? AND status = 'waiting'").get(a.id, sha);
    if (same) return [200, out(same)];       /* (sent twice: the same one) */
    /* an older version still waiting is replaced by this one */
    for (const r of q("SELECT id FROM submissions WHERE account_id = ? AND game_id = ? AND status = 'waiting'").all(a.id, m.id)){
      q("UPDATE submissions SET status = 'withdrawn', decided_at = ? WHERE id = ?").run(now(), r.id);
      try { await files.del(fileOf(r.id)); } catch {}
    }
    const id = newId();
    await files.put(fileOf(id), raw);
    q("INSERT INTO submissions (id, game_id, name, version, account_id, bytes, sha256, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', ?)").run(id, m.id, m.name, m.version, a.id, raw.length, sha, now());
    log.add(a, 'sent', { gameId: m.id, name: m.name, version: m.version, note: `${note ? note + ' · ' : ''}from ${familyName(a.id)} · fingerprint ${sha.slice(0, 12)}` });
    return [201, out(q('SELECT * FROM submissions WHERE id = ?').get(id))];
  }

  return {
    accept,
    dir: files.where('submissions/'),
    routes: (who, owner, asker) => [
      /* send a game in (the body is the .orlis file itself) */
      ['POST', '/api/submissions', async ({ headers, raw }) => {
        const a = who(headers);
        if (a.role !== 'creator' && a.role !== 'owner') throw new Fail(403, 'not_creator', 'Only creators can send games in. The owner can make you one.');
        return accept(a, raw);
      }],
      /* a creator's own, with how each went; the owner (or the management
         page): every one waiting, and the latest decided */
      ['GET', '/api/submissions', async ({ headers, ip, query }) => {
        const a = asker(headers, ip);
        if (a.role === 'owner' && (headers['x-orlis-manage'] !== undefined || query.get('all') === '1')){
          const rows = q(`SELECT s.*, x.email, h.name AS family FROM submissions s JOIN accounts x ON x.id = s.account_id JOIN households h ON h.id = x.household_id
            WHERE s.status = 'waiting' OR (s.status IN ('approved', 'declined') AND s.decided_at > ?) ORDER BY s.created_at DESC`).all(new Date(Date.now() - 30 * 864e5).toISOString());
          /* (a waiting one's own details, from its file: its icon, its
             lines for the Store, who it's for - so the owner sees it as it
             would be) */
          const details = async (r) => {
            if (r.status !== 'waiting') return {};
            try {
              const data = await files.get(fileOf(r.id)); if (!data) return {};
              const m = manifestOf(readOrlis(data));
              return { game: { icon: m.icon, blurb: m.blurb, about: m.about, players: m.players, uses: m.uses, ages: m.ages, tags: m.tags, howto: m.howto } };
            } catch { return {}; }
          };
          return { submissions: await Promise.all(rows.map(async r => ({ ...out(r), ...(await details(r)) }))) };
        }
        return { submissions: q("SELECT * FROM submissions WHERE account_id = ? AND status != 'withdrawn' ORDER BY created_at DESC LIMIT 50").all(a.id).map(out) };
      }],
      /* the file: the owner's, to try it */
      ['GET', '/api/submissions/:id/file', async ({ headers, ip, params }) => {
        owner(headers, ip);
        const r = q("SELECT * FROM submissions WHERE id = ? AND status = 'waiting'").get(params.id);
        const data = r && await files.get(fileOf(r.id));
        if (!data) throw new Fail(404, 'no_submission', 'That game isn\'t waiting any more.');
        return new Raw(data, `${r.game_id}-${r.version}.orlis`);
      }],
      /* the owner played it (in Orlis Play, for long enough to see it) */
      ['POST', '/api/submissions/:id/tried', ({ headers, ip, params, body }) => {
        const me = owner(headers, ip);
        const r = q("SELECT * FROM submissions WHERE id = ? AND status = 'waiting'").get(params.id);
        if (!r) throw new Fail(404, 'no_submission', 'That game isn\'t waiting any more.');
        if (!(Number(body.secs) >= TRY_SECS)) throw new Fail(400, 'too_short', `Play it for at least ${TRY_SECS} seconds.`);
        if (!r.tried_at) log.add(me, 'played', { gameId: r.game_id, name: r.name, version: r.version, note: `for ${Math.round(Number(body.secs))} seconds` });
        q('UPDATE submissions SET tried_at = ? WHERE id = ?').run(now(), r.id);
        return { ok: true };
      }],
      ['POST', '/api/submissions/:id/approve', async ({ headers, ip, params }) => {
        const me = owner(headers, ip);
        const r = q("SELECT * FROM submissions WHERE id = ? AND status = 'waiting'").get(params.id);
        const data = r && await files.get(fileOf(r.id));
        if (!data) throw new Fail(404, 'no_submission', 'That game isn\'t waiting any more.');
        /* not before the owner's played it */
        if (!r.tried_at) throw new Fail(409, 'try_first', `Play ${r.name} first: in Orlis Play, the Store's "Waiting for your OK" row, Try it.`);
        /* into the Store, made by the creator's family */
        const { parts, manifest } = checkGame(data);
        const raw = JSON.parse(parts['manifest.json'].toString('utf8'));
        raw.by = familyName(r.account_id);
        /* a starter game - one new games can start from - only if the owner
           made it, whatever the file says */
        const maker = q('SELECT role FROM accounts WHERE id = ?').get(r.account_id);
        raw.starter = !!maker && maker.role === 'owner';
        const file = writeOrlis({ 'manifest.json': JSON.stringify(raw, null, 2), 'game.js': parts['game.js'] });
        /* who it reaches: the owner's games, everyone; anyone else's, their
           own family - unless it's a new version of one already shared */
        const shared = (await shop.games()).some(g => g.id === manifest.id) && !q('SELECT 1 FROM reach WHERE game_id = ?').get(manifest.id);
        await shop.add(manifest.id, file);
        if (!raw.starter && !shared) q('INSERT OR REPLACE INTO reach (game_id, household_id) VALUES (?, (SELECT household_id FROM accounts WHERE id = ?))').run(manifest.id, r.account_id);
        q("UPDATE submissions SET status = 'approved', decided_at = ? WHERE id = ?").run(now(), r.id);
        const sender = q('SELECT email FROM accounts WHERE id = ?').get(r.account_id);
        log.add(me, 'approved', { gameId: r.game_id, name: r.name, version: r.version, note: `made by ${sender ? sender.email : 'someone'}, ${raw.by} · fingerprint ${r.sha256.slice(0, 12)}${raw.starter ? ' · a starter game' : ''}` });
        try { await files.del(fileOf(r.id)); } catch {}
        return { ok: true, game: { id: manifest.id, name: manifest.name, version: manifest.version, by: raw.by, reach: q('SELECT 1 FROM reach WHERE game_id = ?').get(manifest.id) ? 'family' : 'everyone' } };
      }],
      ['POST', '/api/submissions/:id/decline', async ({ headers, ip, params, body }) => {
        const me = owner(headers, ip);
        const was = q("SELECT * FROM submissions WHERE id = ? AND status = 'waiting'").get(params.id);
        const note = (typeof body.note === 'string' ? body.note : '').trim().slice(0, 300);
        const r = q("UPDATE submissions SET status = 'declined', note = ?, decided_at = ? WHERE id = ? AND status = 'waiting'").run(note, now(), params.id);
        if (!r.changes) throw new Fail(404, 'no_submission', 'That game isn\'t waiting any more.');
        try { await files.del(fileOf(params.id)); } catch {}
        log.add(me, 'declined', { gameId: was.game_id, name: was.name, version: was.version, note: note || null });
        return { ok: true };
      }],
      /* the creator takes one back, while it's waiting */
      ['DELETE', '/api/submissions/:id', async ({ headers, params }) => {
        const a = who(headers);
        const was = q("SELECT * FROM submissions WHERE id = ? AND account_id = ? AND status = 'waiting'").get(params.id, a.id);
        const r = q("UPDATE submissions SET status = 'withdrawn', decided_at = ? WHERE id = ? AND account_id = ? AND status = 'waiting'").run(now(), params.id, a.id);
        if (!r.changes) throw new Fail(404, 'no_submission', 'That game isn\'t waiting any more.');
        log.add(a, 'withdrawn', { gameId: was.game_id, name: was.name, version: was.version });
        try { await files.del(fileOf(params.id)); } catch {}
        return { ok: true };
      }]
    ]
  };
}
