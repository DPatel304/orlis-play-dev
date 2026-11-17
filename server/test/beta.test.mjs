import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { start } from '../src/app.js';
import { mailer } from '../src/mail.js';

/* a mail server, standing in: it says yes to everything, and keeps what it's sent */
function fakeSmtp(){
  const got = [];
  const server = net.createServer((sock) => {
    let data = false, msg = '', buf = '';
    const say = (t) => sock.write(t + '\r\n');
    say('220 fake ready');
    sock.on('data', (d) => {
      buf += d;
      let at;
      while ((at = buf.indexOf('\r\n')) >= 0){
        const line = buf.slice(0, at); buf = buf.slice(at + 2);
        if (data){ if (line === '.'){ data = false; got.push(msg); msg = ''; say('250 queued'); } else msg += line + '\n'; continue; }
        if (/^EHLO/.test(line)) say('250-fake\r\n250 AUTH PLAIN');
        else if (/^AUTH PLAIN /.test(line)) say(Buffer.from(line.slice(11), 'base64').toString().includes('right-password') ? '235 ok' : '535 no');
        else if (/^MAIL FROM|^RCPT TO/.test(line)) { got.push(line); say('250 ok'); }
        else if (line === 'DATA') { data = true; say('354 go'); }
        else if (line === 'QUIT') { say('221 bye'); sock.end(); }
      }
    });
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok({ got, port: server.address().port, close: () => server.close() })));
}

test('the closed beta: a page with one box; the owner approves; the email goes; they\'re straight in', async () => {
  const smtp = await fakeSmtp();
  const dataDir = mkdtempSync(join(tmpdir(), 'orlis-beta-'));
  const said = [];
  const mail = mailer({ dataDir, connect: () => net.connect(smtp.port, '127.0.0.1') });
  const s = await start({ dataDir, port: 0, discoveryPort: false, approveJoins: true, betaPage: true, tailscaleJoin: () => false, mail, notify: (t, x) => said.push([t, x]),
    downloadUrl: 'https://example.com/Orlis-Play-Setup.exe' });
  const base = `http://127.0.0.1:${s.port}`;
  const call = async (method, path, body, token, manage) => {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(manage ? { 'X-Orlis-Manage': s.manageKey } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, ...(await r.json().catch(() => ({}))) };
  };
  try {
    await call('POST', '/api/signup', { email: 'owner@example.com', password: 'correct horse', name: 'Owner', adult: true });
    /* the page, at the family's address */
    const page = await (await fetch(base + '/')).text();
    assert.match(page, /Closed beta/);
    assert.match(page, /Request access/);

    /* asking */
    assert.equal((await call('POST', '/api/beta', { email: 'not an email' })).status, 400);
    assert.equal((await call('POST', '/api/beta', { email: 'Sam@Example.com ' })).status, 201);
    assert.equal((await call('POST', '/api/beta', { email: 'sam@example.com' })).status, 201, 'asked twice: the same thanks');
    assert.deepEqual(said[0], ['Someone asked for the beta', 'sam@example.com - open Manage Orlis Server to let them in']);
    assert.equal((await call('GET', '/api/beta')).status, 401, 'only the owner sees who asked');
    const list = await call('GET', '/api/beta', null, null, true);
    assert.deepEqual(list.beta.map(x => [x.email, x.status]), [['sam@example.com', 'requested']]);
    assert.equal(list.mail, false);

    /* approving with no email set up: the link, to send yourself */
    const noMail = await call('POST', '/api/beta/approve', { email: 'sam@example.com' }, null, true);
    assert.equal(noMail.sent, false);
    assert.equal(noMail.link, 'https://example.com/Orlis-Play-Setup.exe');

    /* email set up (a wrong password is said plainly), tested, then the "you're in" email */
    await call('POST', '/api/mail', { user: 'owner@gmail.com', pass: 'wrong' }, null, true);
    assert.match((await call('POST', '/api/mail/test', null, null, true)).message, /app password/);
    const set = await call('POST', '/api/mail', { user: 'owner@gmail.com', pass: 'right-password' }, null, true);
    assert.equal(set.ready, true);
    assert.equal(set.pass, undefined, 'the password never comes back');
    assert.equal((await call('POST', '/api/mail/test', null, null, true)).ok, true);
    const dad = await call('POST', '/api/beta/approve', { email: 'dad@example.com' }, null, true);
    assert.equal(dad.sent, true, 'added by the owner, and emailed');
    assert.ok(smtp.got.includes('RCPT TO:<dad@example.com>'));
    const sent = smtp.got.filter(x => x.includes('Subject:')).pop();
    const subject = /Subject: =\?UTF-8\?B\?([^?]+)\?=/.exec(sent);
    assert.equal(Buffer.from(subject[1], 'base64').toString(), 'You’re in the Orlis Play beta');
    /* each part of the email, read back */
    const parts = sent.split(/--orlis-[0-9a-f]+/).map(p => p.split('\n\n').slice(1).join('').replace(/\s+/g, '')).filter(Boolean).map(b => Buffer.from(b, 'base64').toString());
    assert.ok(parts.some(p => p.includes('https://example.com/Orlis-Play-Setup.exe') && p.includes('dad@example.com')), 'the download link, and the email to sign up with');
    assert.ok(parts.some(p => p.includes('<a href="https://example.com/Orlis-Play-Setup.exe"')), 'and a button in the HTML one');

    /* they sign up in the app with that email: straight in, no waiting */
    const sam = await call('POST', '/api/signup', { email: 'sam@example.com', password: 'correct horse', name: 'Sam', adult: true });
    assert.equal(sam.account.waiting, false);
    assert.equal((await call('GET', '/api/store', null, sam.token)).status, 200);
    assert.equal((await call('GET', '/api/beta', null, null, true)).beta.find(x => x.email === 'sam@example.com').status, 'joined');
    /* someone not approved still waits */
    const other = await call('POST', '/api/signup', { email: 'other@example.com', password: 'correct horse', name: 'O', adult: true });
    assert.equal(other.account.waiting, true);

    /* declining */
    await call('POST', '/api/beta', { email: 'nope@example.com' });
    assert.equal((await call('POST', '/api/beta/decline', { email: 'nope@example.com' }, null, true)).ok, true);
    const hist = (await call('GET', '/api/history', null, null, true)).history.map(x => x.what);
    for (const w of ['beta-requested', 'beta-approved', 'beta-declined']) assert.ok(hist.includes(w), w);
  } finally { await s.close(); smtp.close(); }
});

test('the closed beta\'s page is off unless the owner turns it on: the address shows nothing, and nobody can ask', async () => {
  const s = await start({ dataDir: mkdtempSync(join(tmpdir(), 'orlis-beta-off-')), port: 0, discoveryPort: false, tailscaleJoin: () => false });
  const base = `http://127.0.0.1:${s.port}`;
  try {
    assert.equal((await fetch(base + '/')).status, 404);
    assert.equal((await fetch(base + '/beta')).status, 404);
    const ask = await fetch(base + '/api/beta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'sam@example.com' }) });
    assert.equal(ask.status, 404);
    /* (the owner's side still works: they can approve an email themselves) */
    assert.equal((await fetch(base + '/api/beta')).status, 401);
  } finally { await s.close(); }
});
