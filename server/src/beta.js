/* The closed beta. The family's server, on the internet (Tailscale Funnel),
   shows a small page: Orlis Play, in closed beta - your email, Request
   access. The owner sees each request on the management page and approves
   it (or adds someone themselves); approving emails them the download link.
   They install Orlis Play and make an account with that email - and since
   it's approved, they're straight in (api.js), no waiting.

     beta(db, { mail, log, notify, downloadUrl, open })   .routes(owner) .approved(email) .joined(email) */
import { Fail, Page } from './http.js';
import { history } from './history.js';

const EMAIL = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[^\s@<>"]{2,}$/;
export const LIMITS = { perHour: 30, waiting: 500 };
const now = () => new Date().toISOString();

export function beta(db, { mail, log = history(db), notify = () => {}, downloadUrl, open = false }){
  const q = (sql) => db.prepare(sql);
  const tidy = (e) => String(e || '').trim().toLowerCase();

  /* the email that says you're in */
  const welcome = (email) => ({
    to: email,
    subject: 'You’re in the Orlis Play beta',
    text: `You're in!\n\nDownload Orlis Play for Windows:\n${downloadUrl}\n\nInstall it, then make your account with this email (${email}) - you'll be straight in.\n\nHave fun moving!\nOrlis Play`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:auto;padding:24px;color:#2d2a26">
      <h1 style="font-size:24px;margin:0 0 12px">You’re in!</h1>
      <p style="font-size:16px;line-height:1.5">Welcome to the Orlis Play beta - movement games for the whole family.</p>
      <p><a href="${downloadUrl}" style="display:inline-block;background:#6d5efc;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:999px">Download Orlis Play for Windows</a></p>
      <p style="font-size:15px;line-height:1.5">Install it, then make your account with this email (<b>${email.replace(/[<>&]/g, '')}</b>) - you’ll be straight in.</p>
      <p style="font-size:15px;color:#6b6f80">Have fun moving!</p></div>`
  });

  async function approve(me, email){
    const e = tidy(email);
    if (!EMAIL.test(e)) throw new Fail(400, 'email', 'That doesn’t look like an email address.');
    const was = q('SELECT status FROM beta WHERE email = ?').get(e);
    if (was) q("UPDATE beta SET status = 'approved', decided_at = ? WHERE email = ?").run(now(), e);
    else q("INSERT INTO beta (email, status, created_at, decided_at) VALUES (?, 'approved', ?, ?)").run(e, now(), now());
    log.add(me, 'beta-approved', { note: e });
    /* the email: sent if email's set up; otherwise the link, to send yourself */
    if (!mail.ready) return { email: e, sent: false, link: downloadUrl, why: 'Email isn’t set up - send them the link yourself.' };
    try { await mail.send(welcome(e)); q('UPDATE beta SET sent_at = ? WHERE email = ?').run(now(), e); return { email: e, sent: true }; }
    catch (err){ return { email: e, sent: false, link: downloadUrl, why: err.message }; }
  }

  return {
    approved: (email) => !!q("SELECT 1 FROM beta WHERE email = ? AND status IN ('approved', 'joined')").get(tidy(email)),
    joined: (email) => q("UPDATE beta SET status = 'joined' WHERE email = ? AND status = 'approved'").run(tidy(email)),
    welcome,
    routes: (owner) => [
      /* the page anyone sees at the family's address */
      /* (only when the owner has turned the page on: otherwise the address shows nothing) */
      ['GET', '/', () => { if (!open) throw new Fail(404, 'not_found', 'Nothing here.'); return new Page(page()); }],
      ['GET', '/beta', () => { if (!open) throw new Fail(404, 'not_found', 'Nothing here.'); return new Page(page()); }],
      /* asking to join the beta: an email, nothing else */
      ['POST', '/api/beta', ({ body }) => {
        if (!open) throw new Fail(404, 'not_found', 'Nothing here.');
        const e = tidy(body && body.email);
        if (!EMAIL.test(e)) throw new Fail(400, 'email', 'That doesn’t look like an email address.');
        if (q('SELECT COUNT(*) AS n FROM beta WHERE created_at > ?').get(new Date(Date.now() - 3600e3).toISOString()).n >= LIMITS.perHour
          || q("SELECT COUNT(*) AS n FROM beta WHERE status = 'requested'").get().n >= LIMITS.waiting)
          throw new Fail(429, 'busy', 'Lots of people are asking right now - try again later.');
        /* (asked before, or already in: the same thanks - it doesn't say which) */
        if (!q('SELECT 1 FROM beta WHERE email = ?').get(e)){
          q("INSERT INTO beta (email, status, created_at) VALUES (?, 'requested', ?)").run(e, now());
          log.add({ email: e }, 'beta-requested', { note: e });
          notify('Someone asked for the beta', `${e} - open Manage Orlis Server to let them in`);
        }
        return [201, { ok: true }];
      }],
      /* the owner's: who's asked, approve (or add someone), decline */
      ['GET', '/api/beta', ({ headers, ip }) => {
        owner(headers, ip);
        return { beta: q("SELECT email, status, created_at AS createdAt, decided_at AS decidedAt, sent_at AS sentAt FROM beta ORDER BY (status = 'requested') DESC, created_at DESC LIMIT 300").all().map(r => ({ ...r })),
          mail: mail.ready, link: downloadUrl };
      }],
      ['POST', '/api/beta/approve', async ({ headers, ip, body }) => approve(owner(headers, ip), body && body.email)],
      ['POST', '/api/beta/decline', ({ headers, ip, body }) => {
        const me = owner(headers, ip);
        const e = tidy(body && body.email);
        const r = q("UPDATE beta SET status = 'declined', decided_at = ? WHERE email = ? AND status = 'requested'").run(now(), e);
        if (!r.changes) throw new Fail(404, 'no_one', 'They aren’t waiting.');
        log.add(me, 'beta-declined', { note: e });
        return { ok: true };
      }],
      /* email: the owner's Gmail and app password, kept on this laptop */
      ['GET', '/api/mail', ({ headers, ip }) => { owner(headers, ip); return { ready: mail.ready, ...(mail.settings() || {}) }; }],
      ['POST', '/api/mail', ({ headers, ip, body }) => {
        owner(headers, ip);
        const user = tidy(body && body.user);
        if (user && !EMAIL.test(user)) throw new Fail(400, 'email', 'That doesn’t look like an email address.');
        mail.save({ user, pass: body && body.pass });
        return { ready: mail.ready, ...(mail.settings() || {}) };
      }],
      ['POST', '/api/mail/test', async ({ headers, ip }) => {
        owner(headers, ip);
        const s = mail.settings();
        if (!s) throw new Fail(400, 'no_mail', 'Email isn’t set up yet.');
        try { await mail.send({ to: s.user, subject: 'Orlis Play can send email', text: 'This is Orlis Server, checking it can send email. It can!' }); }
        catch (e){ throw new Fail(400, 'mail', e.message); }
        return { ok: true, to: s.user };
      }]
    ]
  };
}

/* the page: one line about Orlis, and one box */
function page(){
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Orlis Play - closed beta</title>
<style>
:root{ --ink:#2d2a26; --dim:#6b6f80; --paper:#f6f1e7; --card:rgba(250,247,238,.95); --go:#6d5efc; }
*{ box-sizing:border-box; }
body{ margin:0; min-height:100vh; display:grid; place-items:center; padding:24px 16px; font-family:system-ui,-apple-system,"Segoe UI",sans-serif; color:var(--ink);
  background:radial-gradient(120% 80% at 20% 0%, #bfd8ea 0%, #e4e6dc 55%, var(--paper) 100%); }
main{ width:min(100%, 460px); background:var(--card); border-radius:28px; padding:36px 28px 30px; box-shadow:0 18px 50px rgba(58,51,96,.18); text-align:center; }
.mark{ display:block; width:64px; height:64px; margin:0 auto 12px; }
h1{ font-size:30px; margin:0 0 6px; letter-spacing:-.02em; }
.tag{ display:inline-block; background:#3a3360; color:#fff; font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; padding:5px 12px; border-radius:999px; margin-bottom:16px; }
p{ font-size:17px; line-height:1.5; color:var(--dim); margin:0 0 22px; }
form{ display:flex; flex-direction:column; gap:10px; }
input{ font:inherit; font-size:17px; padding:14px 18px; border-radius:999px; border:1px solid #ddd8cc; background:#fff; color:var(--ink); outline:none; }
input:focus{ border-color:var(--go); box-shadow:0 0 0 4px rgba(109,94,252,.15); }
button{ font:inherit; font-size:17px; font-weight:700; padding:14px 18px; border-radius:999px; border:0; background:var(--go); color:#fff; cursor:pointer; }
button[disabled]{ opacity:.6; }
.said{ min-height:1.5em; font-size:15px; margin:12px 0 0; }
.bad{ color:#be123c; }
.done h2{ font-size:22px; margin:6px 0 8px; }
</style></head><body><main>
<svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6 56 19v26L32 58 8 45V19z" fill="#7fb8c9"/><path d="M32 6 56 19 32 32 8 19z" fill="#cfe4ea"/><path d="M32 32v26L8 45V19z" fill="#9f97d6"/></svg>
<div class="tag">Closed beta</div>
<h1>Orlis Play</h1>
<p>Movement games for the whole family - you play by moving. Ask to join the beta, and we’ll email you a download link.</p>
<form id="f"><input id="e" type="email" required autocomplete="email" placeholder="Your email" aria-label="Your email"><button id="b">Request access</button></form>
<p class="said" id="s" role="status"></p>
</main>
<script>
var f = document.getElementById('f'), e = document.getElementById('e'), b = document.getElementById('b'), s = document.getElementById('s');
f.onsubmit = function(ev){
  ev.preventDefault(); b.disabled = true; s.className = 'said'; s.textContent = '';
  fetch('/api/beta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e.value }) })
    .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, d: d }; }); })
    .then(function(x){
      if (!x.ok) throw new Error(x.d.message || 'That didn\\u2019t work - try again.');
      document.querySelector('main').className = 'done';
      f.remove(); s.remove();
      document.querySelector('main p').innerHTML = '<h2>Thanks!</h2>We\\u2019ll email <b></b> when you\\u2019re in.';
      document.querySelector('main p b').textContent = e.value;
    })
    .catch(function(err){ b.disabled = false; s.className = 'said bad'; s.textContent = err.message; });
};
</script></body></html>`;
}
