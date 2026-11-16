/* Sending an email: the closed beta's "you're in" with the download link.

   Through the owner's own email account (Gmail, with an app password - a
   password Google makes for one app, that can be taken back any time),
   over SMTP with TLS. Its settings live in the data folder (mail.json), on
   this laptop only - typed in on the management page, never sent anywhere
   but the mail server.

     mailer({ dataDir, connect })   .settings() .save(s) .ready .send({ to, subject, text, html })

   No packages: SMTP is a short conversation - hello, sign in, from, to, the
   message, bye - so it's written out here. */
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import tls from 'node:tls';
import net from 'node:net';
import { randomBytes } from 'node:crypto';

/* Gmail's; another provider's can be set in mail.json */
const DEFAULT = { host: 'smtp.gmail.com', port: 465 };

export function mailer({ dataDir, connect = null }){
  const file = join(dataDir, 'mail.json');
  const read = () => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
  return {
    /* what's set (never the password) */
    settings(){ const m = read(); return m ? { user: m.user, from: m.from || m.user, host: m.host || DEFAULT.host } : null; },
    get ready(){ const m = read(); return !!(m && m.user && m.pass); },
    save({ user, pass, from = null }){
      if (!user || !pass){ if (existsSync(file)) rmSync(file); return; }
      writeFileSync(file, JSON.stringify({ ...DEFAULT, ...(read() || {}), user: String(user).trim(), pass: String(pass).replace(/\s+/g, ''), from: from || null }, null, 2), { mode: 0o600 });
    },
    async send({ to, subject, text, html = null }){
      const m = read();
      if (!m || !m.user || !m.pass) throw new Error('Email isn’t set up yet.');
      return smtp({ ...DEFAULT, ...m, connect }, { from: m.from || m.user, to, subject, text, html });
    }
  };
}

/* the message itself: headers, then plain text (and HTML, if there is) */
export function message({ from, to, subject, text, html, id = randomBytes(8).toString('hex') }){
  const enc = (s) => /[^\x20-\x7e]/.test(s) ? `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=` : s;
  const b64 = (s) => Buffer.from(s).toString('base64').replace(/.{76}/g, '$&\r\n');
  const head = [`From: Orlis Play <${from}>`, `To: <${to}>`, `Subject: ${enc(subject)}`, `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${id}@orlis.play>`, 'MIME-Version: 1.0'];
  if (!html) return [...head, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(text)].join('\r\n');
  const cut = 'orlis-' + id;
  return [...head, `Content-Type: multipart/alternative; boundary="${cut}"`, '',
    `--${cut}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(text),
    `--${cut}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(html),
    `--${cut}--`, ''].join('\r\n');
}

/* The SMTP conversation. Each step waits for the server's answer (a 3-digit
   code; a line with "-" after it means more lines follow). */
function smtp({ host, port, user, pass, connect, secure = true }, mail){
  return new Promise((resolve, reject) => {
    const sock = connect ? connect() : secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    let buf = '', waiting = null, done = false;
    const fail = (e) => { if (done) return; done = true; try { sock.destroy(); } catch {} reject(e instanceof Error ? e : new Error(String(e))); };
    const timer = setTimeout(() => fail(new Error('The mail server didn’t answer.')), 20000);
    sock.setEncoding('utf8');
    sock.on('error', (e) => fail(new Error(`Couldn’t reach the mail server: ${e.message}`)));
    sock.on('data', (d) => {
      buf += d;
      let at;
      while ((at = buf.indexOf('\r\n')) >= 0){
        const line = buf.slice(0, at); buf = buf.slice(at + 2);
        if (/^\d{3} /.test(line) && waiting){ const w = waiting; waiting = null; w(line); }
      }
    });
    const expect = (code) => new Promise((ok, no) => { waiting = (line) => line.startsWith(String(code)) ? ok(line) : no(new Error(line.slice(4) || line)); });
    const say = (cmd, code) => { const p = expect(code); sock.write(cmd + '\r\n'); return p; };
    (async () => {
      await expect(220);
      await say('EHLO orlis.play', 250);
      try { await say('AUTH PLAIN ' + Buffer.from(`\0${user}\0${pass}`).toString('base64'), 235); }
      catch { throw new Error('The email or app password wasn’t accepted. Check them, and that it’s an app password.'); }
      await say(`MAIL FROM:<${mail.from}>`, 250);
      await say(`RCPT TO:<${mail.to}>`, 250);
      await say('DATA', 354);
      const body = message(mail).split('\r\n').map(l => l.startsWith('.') ? '.' + l : l).join('\r\n');
      await say(body + '\r\n.', 250);
      sock.write('QUIT\r\n');
      clearTimeout(timer); done = true; try { sock.end(); } catch {}
      resolve();
    })().catch((e) => { clearTimeout(timer); fail(e); });
  });
}
