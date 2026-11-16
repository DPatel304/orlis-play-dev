import { TRY_SECS } from './submissions.js';
/* The management page: the server's own, opened from the Orlis cube by the
   clock (Manage Orlis Server), in the browser on this laptop only. It's
   where the owner looks after the server - every family and who's a
   creator, the Store's games, backups - so Orlis Play itself stays the
   family app, the same for everyone.

   One page, nothing loaded from anywhere: its look and its code are below.
   It asks the server's usual routes, with the key the cube opened it with
   (in the address, which never leaves the laptop - and is taken out of
   sight as the page opens). */
export function managePage(){
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Orlis Server</title>
<style>
:root{ --ink:#16161d; --dim:#5b5f6e; --faint:#8a8ea0; --paper:#f3f4f7; --card:#fff; --line:#eef0f4; --violet:#6d5efc; --bad:#be123c; }
*{ box-sizing:border-box }
body{ margin:0; background:var(--paper); color:var(--ink); font:16px/1.45 "Segoe UI Variable Text","Segoe UI",system-ui,sans-serif; }
header{ display:flex; align-items:center; gap:16px; padding:20px 32px; }
header h1{ font-size:22px; margin:0; font-weight:650; }
header h1 i{ font-style:normal; font-weight:400; background:linear-gradient(90deg,#2bb6c9,#5b8cf5,#a66bf5); -webkit-background-clip:text; background-clip:text; color:transparent; }
nav{ display:flex; gap:4px; margin-left:auto; padding:4px; border-radius:999px; background:#fff; box-shadow:0 2px 10px rgba(20,24,50,.08); }
nav button{ border:0; background:transparent; font:inherit; font-weight:600; color:#3b3e4d; padding:8px 18px; border-radius:999px; cursor:pointer; }
nav button.on{ background:var(--ink); color:#fff; }
main{ max-width:880px; margin:8px auto 60px; padding:0 24px; }
.steps{margin:6px 0 10px 20px;line-height:1.55}.steps li{margin:4px 0}.card{ background:var(--card); border-radius:18px; padding:22px 24px; box-shadow:0 6px 22px rgba(20,24,50,.07); margin-bottom:18px; }
.card h2{ margin:0 0 6px; font-size:19px; }
.row{ display:flex; align-items:center; justify-content:space-between; gap:16px; padding:12px 0; border-top:1px solid var(--line); }
.row:first-of-type{ border-top:0; }
.row small{ display:block; color:var(--faint); font-size:13.5px; }
.big{ font-size:30px; font-weight:700; letter-spacing:-.01em; }
.ok{ color:#15803d; font-weight:600; }
.warn{ color:#92400e; background:#fef3c7; border-radius:10px; padding:10px 14px; margin:10px 0 0; }
.err{ color:var(--bad); margin:10px 0 0; }
.muted{ color:var(--faint); font-size:14px; margin:10px 0 0; }
button.b{ font:inherit; font-size:14.5px; font-weight:600; border:1px solid #e3e5ec; background:#fff; color:var(--ink); padding:7px 15px; border-radius:999px; cursor:pointer; white-space:nowrap; }
button.b:hover{ background:#f5f6fa; }
button.go{ background:var(--violet); border-color:var(--violet); color:#fff; }
button.go:hover{ background:#5b4ce6; }
button.danger{ color:var(--bad); }
.seg{ display:inline-flex; padding:3px; border-radius:999px; background:#f1f2f6; }
.seg button{ border:0; background:transparent; font:inherit; font-size:14px; font-weight:600; padding:5px 13px; border-radius:999px; cursor:pointer; color:var(--dim); }
.seg button.on{ background:#fff; color:var(--ink); box-shadow:0 1px 4px rgba(20,24,50,.12); }
.kit{ border:1px solid var(--line, #e3e5ec); background:#fff; font:inherit; font-size:14px; font-weight:600; padding:5px 13px; border-radius:999px; cursor:pointer; color:var(--dim); margin-left:8px; }
.kit.on{ background:#6d5efc; border-color:#6d5efc; color:#fff; }
.slots{ margin-left:8px; font-size:14px; color:var(--dim); white-space:nowrap; }
.slots button{ border:1px solid #e3e5ec; background:#fff; border-radius:999px; width:26px; height:26px; font:inherit; cursor:pointer; }
.fam{ font-weight:700; }
.code{ font-size:26px; font-weight:800; letter-spacing:.14em; color:var(--violet); }
.icon{ width:40px; height:40px; border-radius:23%; display:inline-flex; align-items:center; justify-content:center; vertical-align:middle; margin-right:12px; }
.icon svg{ width:60%; height:60%; }
.who{ display:flex; align-items:center; }
#waiting:not(:empty){ display:inline-block; min-width:20px; margin-left:6px; padding:0 6px; border-radius:999px; background:var(--violet); color:#fff; font-size:12.5px; line-height:20px; }
nav button.on #waiting{ background:#fff; color:var(--ink); }
textarea{ width:100%; font:inherit; font-size:15px; border:1px solid #e3e5ec; border-radius:12px; padding:10px 12px; margin-top:10px; resize:vertical; min-height:70px; }
blockquote.words{ margin:8px 0 0; padding:8px 12px; border-left:3px solid #d6d2f5; color:#3b3d4a; white-space:pre-wrap; font-size:14px; } details.prompt{ margin:-4px 0 14px; } details.prompt summary{ cursor:pointer; color:#6d5efc; font-weight:600; font-size:14px; } textarea.promptbox{ width:100%; min-height:220px; margin-top:8px; font:13px/1.45 ui-monospace,Consolas,monospace; }
.tag{ display:inline-block; font-size:12.5px; font-weight:700; padding:2px 9px; border-radius:999px; background:#f1f2f6; color:var(--dim); }
.tag.approved, .tag.ok{ background:#dcfce7; color:#15803d; }
button:disabled{ opacity:.55; cursor:not-allowed; } .tag.declined{ background:#fee2e2; color:var(--bad); }
.empty{ text-align:center; color:var(--dim); padding:60px 20px; font-size:18px; }
</style></head>
<body>
<header><h1>Orlis <i>Server</i></h1>
<nav id="tabs"><button data-t="overview" class="on">Overview</button><button data-t="approvals">Approvals<span id="waiting"></span></button><button data-t="families">Families</button><button data-t="store">Store</button><button data-t="backups">Backups</button><button data-t="history">History</button></nav></header>
<main id="main"></main>
<script>
var TRY = ${TRY_SECS};
(function(){
  /* the key: from the address the cube opened (then out of sight) */
  var key = '';
  try { var m = /[?#&]k=([0-9a-f]+)/.exec(location.search + location.hash); if (m){ key = m[1]; sessionStorage.setItem('k', key); history.replaceState(null, '', location.pathname); } else key = sessionStorage.getItem('k') || ''; } catch (e) {}
  var main = document.getElementById('main'), tab = 'overview';
  function esc(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function when(iso){ var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }); }
  function size(n){ return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function call(method, path, body){
    return fetch(path, { method: method, headers: { 'Content-Type': 'application/json', 'X-Orlis-Manage': key }, body: body ? JSON.stringify(body) : undefined })
      .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.message || 'That didn\\u2019t work.'); return d; }); });
  }
  function h(html){ var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
  function card(title){ var c = h('<section class="card"><h2>' + esc(title) + '</h2></section>'); main.appendChild(c); return c; }
  function row(c, left, right){ var r = h('<div class="row"><div>' + left + '</div><div></div></div>'); (right || []).forEach(function(x){ r.lastChild.appendChild(x); }); c.appendChild(r); return r; }
  function btn(label, cls, fn){ var b = document.createElement('button'); b.className = 'b ' + (cls || ''); b.textContent = label; b.onclick = function(){ fn(b); }; return b; }
  /* a button that asks first: picked once it asks, picked again it does it */
  function sure(label, ask, cls, fn){ var at = 0; return btn(label, cls, function(b){ if (Date.now() - at < 4000){ at = 0; fn(b); return; } at = Date.now(); b.textContent = ask; setTimeout(function(){ if (at && Date.now() - at >= 3950){ at = 0; b.textContent = label; } }, 4000); }); }
  function note(c, t, cls){ var p = document.createElement('p'); p.className = cls || 'muted'; p.textContent = t; c.appendChild(p); return p; }
  function fail(c){ return function(e){ note(c, e.message, 'err'); }; }

  var UPDATE = { 'up to date': ['Up to date', 'ok'], ready: ['A newer version is ready - it switches at a quiet moment', ''], offline: ['Couldn\\u2019t check for updates just now', ''], waiting: ['Checking for updates soon', ''], off: ['Updates only in the Windows exe', ''] };
  var KINDS = { daily: 'Daily', update: 'Before an update', manual: 'Made by you', 'before-restore': 'Before a restore' };

  /* Game requests: each read here - its sentence, their words, the prompt
     Claude gets (changeable) - then Make this game, or Decline with a note.
     They're made on this laptop with its Claude Code (the maker). */
  var MAKER = { ready: '', making: 'Making one now on this laptop…', 'no-claude': 'Claude Code isn’t on this laptop yet, so requests can’t be made here. Install it (code.claude.com/docs/en/setup), sign in once, then restart Orlis Server.', off: 'Making games is switched off on this server ("maker": false).' };
  function requestsCard(list, maker){
    var waiting = list.filter(function(x){ return x.state === 'waiting' || x.state === 'making'; });
    var done = list.filter(function(x){ return x.state !== 'waiting' && x.state !== 'making'; });
    var c = card('Game requests');
    var m = maker && MAKER[maker.state]; if (m) note(c, m, maker.state === 'making' ? '' : 'warn');
    if (!waiting.length) note(c, 'Nothing asked for. When someone uses Request a game in Orlis Play, it shows up here - and by the clock.');
    waiting.forEach(function(x){
      var making = x.state === 'making';
      var top = '<b>' + esc(x.sentence) + '</b>' + (making ? ' <span class="tag">being made…</span>' : '') +
        '<small>From ' + esc(x.family) + ' (' + esc(x.by) + ') · asked ' + esc(when(x.createdAt)) + (x.kind === 'change' ? ' · a change to their game' : '') + '</small>' +
        (x.words ? '<blockquote class="words">' + esc(x.words) + '</blockquote>' : '') +
        (x.problem ? '<p class="err">Last time it couldn’t be made: ' + esc(x.problem) + '</p>' : '');
      var r2 = row(c, top, making ? [] : [
        btn('Decline…', '', function(){
          if (r2.nextSibling && r2.nextSibling.dataset && r2.nextSibling.dataset.note) return;
          var box = h('<div data-note="1"><textarea maxlength="300" placeholder="A note for them (they’ll see it in Orlis Play)"></textarea><div style="text-align:right;margin-top:8px"></div></div>');
          box.lastChild.appendChild(btn('Decline it', 'danger', function(){ call('POST', '/api/requests/' + encodeURIComponent(x.id) + '/decline', { note: box.firstChild.value }).then(show, fail(c)); }));
          r2.after(box); box.firstChild.focus();
        }),
        btn('Make this game', 'go', function(b){
          b.textContent = 'Starting…';
          call('POST', '/api/requests/' + encodeURIComponent(x.id) + '/prompt', { prompt: area.value }).then(function(){ return call('POST', '/api/requests/' + encodeURIComponent(x.id) + '/make'); }).then(show, fail(c));
        })
      ]);
      /* the prompt Claude will get - theirs, made into instructions; change it before making it */
      var det = h('<details class="prompt"><summary>The prompt for Claude (you can change it)</summary></details>');
      var area = document.createElement('textarea'); area.className = 'promptbox'; area.value = x.prompt || ''; area.disabled = making;
      det.appendChild(area); r2.after(det);
    });
    if (done.length){
      var d = card('Requests lately');
      var SAY = { made: 'Made - waiting for your OK', ready: 'Made - waiting for your OK', 'in-store': 'In the Store', declined: 'Declined' };
      done.forEach(function(x){ row(d, '<b>' + esc(x.sentence) + '</b> <span class="tag ' + (x.state === 'in-store' ? 'approved' : x.state === 'declined' ? 'declined' : '') + '">' + esc(SAY[x.state] || x.state) + '</span><small>' + esc(x.family) + (x.note ? ' · “' + esc(x.note) + '”' : '') + '</small>'); });
    }
  }

  var views = {
    approvals: function(){
      return Promise.all([call('GET', '/api/requests'), call('GET', '/api/server')]).then(function(rs){ requestsCard(rs[0].requests, rs[1].maker); })
        .then(function(){ return call('GET', '/api/submissions'); }).then(function(r){
        var waiting = r.submissions.filter(function(x){ return x.state === 'waiting'; });
        var done = r.submissions.filter(function(x){ return x.state !== 'waiting'; });
        var c = card('Waiting for your OK');
        if (!waiting.length) note(c, 'Nothing waiting. Games your creators send in show up here.');
        waiting.forEach(function(x){
          var r2 = row(c, '<b>' + esc(x.name) + '</b> <span class="tag">version ' + esc(x.version) + '</span>' + (x.tried ? ' <span class="tag ok">played \u2713</span>' : ' <span class="tag">not played yet</span>') + '<small>From ' + esc(x.family) + ' (' + esc(x.by) + ') \u00b7 sent ' + esc(when(x.createdAt)) + ' \u00b7 ' + size(x.bytes) + '</small>', [
            btn('Decline\u2026', '', function(){
              if (r2.nextSibling && r2.nextSibling.dataset && r2.nextSibling.dataset.note) return;
              var box = h('<div data-note="1"><textarea maxlength="300" placeholder="A note for them: what to change, say (they\u2019ll see it in Orlis Play)"></textarea><div style="text-align:right;margin-top:8px"></div></div>');
              box.lastChild.appendChild(btn('Decline it', 'danger', function(){ call('POST', '/api/submissions/' + encodeURIComponent(x.id) + '/decline', { note: box.firstChild.value }).then(show, fail(c)); }));
              r2.after(box); box.firstChild.focus();
            }),
            /* (only once it's been played: in Orlis Play, Try it) */
            x.tried ? btn('Approve', 'go', function(b){ b.textContent = 'Approving\u2026'; call('POST', '/api/submissions/' + encodeURIComponent(x.id) + '/approve').then(show, fail(c)); })
              : (function(){ var b = btn('Play it first', '', function(){}); b.disabled = true; b.title = 'Approve comes on once you\u2019ve played this version in Orlis Play (the Store, Waiting for your OK, Try it).'; return b; })()
          ]);
        });
        if (waiting.length) note(c, 'Every game is played before it\u2019s approved: open Orlis Play, then the Store - games waiting for your OK are at the top (only you see them). Press Try it and play for at least ' + TRY + ' seconds; Approve comes on here.');
        if (done.length){
          var d = card('Lately');
          done.forEach(function(x){ row(d, '<b>' + esc(x.name) + '</b> <span class="tag ' + esc(x.state) + '">' + (x.state === 'approved' ? 'In the Store' : 'Declined') + '</span><small>' + esc(x.family) + ' \u00b7 ' + esc(when(x.decidedAt)) + (x.note ? ' \u00b7 \u201c' + esc(x.note) + '\u201d' : '') + '</small>'); });
        }
      });
    },
    overview: function(){
      return call('GET', '/api/server').then(function(s){
        var c = card('This server');
        var u = UPDATE[s.update && s.update.state] || ['', ''];
        row(c, '<div class="big">' + esc(s.name) + '</div><small>Orlis Server ' + esc(s.version) + '</small>');
        row(c, '<span class="' + u[1] + '">' + esc(u[0]) + '</span>');
        row(c, 'Making requested games<small>' + esc({ ready: 'Ready - with this laptop\u2019s Claude Code', making: 'Making one now', 'no-claude': 'Claude Code isn\u2019t on this laptop yet', off: 'Switched off' }[(s.maker || {}).state] || 'Switched off') + '</small>');
        row(c, 'Last backup<small>' + (s.backups[0] ? esc(when(s.backups[0].at)) : 'None yet - one is made each day') + '</small>');
        if (s.addresses && s.addresses.length) row(c, 'Its address on the home Wi-Fi<small>' + esc(s.addresses.join('  or  ')) + ' - Orlis Play finds it by itself; this is in case it ever asks</small>');
        if (s.restoring) note(c, 'A restore is waiting: it happens as the server next starts.', 'warn');
        /* people who live elsewhere: Tailscale */
        var t = card('Family who live elsewhere');
        if (s.tailscale){
          row(t, '<span class="ok">Tailscale is on</span><small>This laptop\u2019s Tailscale address: http://' + esc(s.tailscale) + ':47871</small>');
          note(t, 'To let someone make and send games from their own home:');
          var ol = h('<ol class="steps"><li>In Tailscale on this laptop, <b>share this laptop</b> with them (right-click Tailscale by the clock > Admin console > Machines > this laptop > Share). They get an email.</li><li>They install Tailscale, sign in, and accept your share.</li><li>They install Orlis Play. It finds this server by itself, and they make an account - <b>no invite code needed</b>. They\u2019re a creator straight away.</li></ol>');
          t.appendChild(ol);
          if (!s.awayJoins) note(t, 'Joining over Tailscale needs an invite code on this server.', 'warn');
        } else {
          row(t, '<span>Tailscale isn\u2019t on</span><small>To let family make and send games from their own homes, install Tailscale on this laptop (tailscale.com/download) and sign in - then this shows the next steps.</small>');
        }
        note(t, 'This laptop needs to be on for their games to send; until then they wait on their PC and go in by themselves later.');
      });
    },
    families: function(){
      return Promise.all([call('GET', '/api/households'), call('GET', '/api/invites')]).then(function(r){
        var c = card('Families');
        r[0].households.forEach(function(f){
          row(c, '<span class="fam">' + esc(f.name) + '</span><small>' + f.profiles + ' profile' + (f.profiles === 1 ? '' : 's') + '</small>');
          f.accounts.forEach(function(a){
            var right = [];
            if (a.role === 'owner') right.push(h('<b style="color:#6d5efc">Owner</b>'));
            else {
              var seg = h('<span class="seg"></span>');
              [['player', 'Player'], ['creator', 'Creator']].forEach(function(p){
                var b = document.createElement('button'); b.textContent = p[1]; if (a.role === p[0]) b.className = 'on';
                b.onclick = function(){ call('POST', '/api/accounts/' + encodeURIComponent(a.id) + '/role', { role: p[0] }).then(function(){ a.role = p[0]; [].forEach.call(seg.children, function(x){ x.className = x === b ? 'on' : ''; }); }, fail(c)); };
                seg.appendChild(b);
              });
              right.push(seg);
              /* the Dev Kit: building games with Claude Code (off unless you switch it on) */
              var kit = document.createElement('button'); kit.className = 'kit' + (a.devkit ? ' on' : '');
              var label = function(){ kit.textContent = a.devkit ? 'Dev Kit \u2713' : 'Dev Kit'; kit.className = 'kit' + (a.devkit ? ' on' : ''); };
              kit.title = 'Build games themselves with Claude Code';
              kit.onclick = function(){ call('POST', '/api/accounts/' + encodeURIComponent(a.id) + '/devkit', { on: !a.devkit }).then(function(r){ a.devkit = r.devkit; label(); }, fail(c)); };
              label();
              right.push(kit);
              /* game slots: how many made-for-them games they can keep */
              var sl = h('<span class="slots"></span>');
              var showSlots = function(){ sl.innerHTML = ''; var minus = document.createElement('button'); minus.textContent = '\\u2212'; var plus = document.createElement('button'); plus.textContent = '+';
                var set = function(n){ call('POST', '/api/accounts/' + encodeURIComponent(a.id) + '/slots', { slots: n }).then(function(r){ a.slots = r.slots; showSlots(); }, fail(c)); };
                minus.onclick = function(){ if (a.slots > 0) set(a.slots - 1); }; plus.onclick = function(){ set(a.slots + 1); };
                sl.append(minus, document.createTextNode(' ' + a.slots + ' slots '), plus); };
              showSlots();
              right.push(sl);
            }
            row(c, '&nbsp;&nbsp;' + esc(a.email), right);
          });
        });
        note(c, 'Creators can make games with Create in Orlis Play; you approve them before they\\u2019re in the Store.');
        var inv = card('Invite a new family');
        r[1].invites.filter(function(i){ return !i.usedAt && i.kind === 'new'; }).forEach(function(i){
          row(inv, '<span class="code">' + esc(i.code) + '</span><small>Made ' + esc(when(i.createdAt)) + '</small>', [sure('Remove', 'Remove? Click again', '', function(){ call('DELETE', '/api/invites/' + encodeURIComponent(i.code)).then(show, fail(inv)); })]);
        });
        row(inv, 'A friend\\u2019s family gets its own grown-ups and kids, kept apart from yours.<small>They set up Orlis Play on this Wi-Fi and type the code.</small>', [btn('Make an invite', 'go', function(){ call('POST', '/api/invites', { household: 'new' }).then(show, fail(inv)); })]);
      });
    },
    history: function(){
      return call('GET', '/api/history').then(function(r){
        var c = card('What happened to the family\\u2019s games');
        if (!r.history.length) note(c, 'Nothing yet. Every game sent, played, approved, declined or taken out is kept here, and every grown-up made a creator or not.');
        var SAY = { sent: 'Sent for your OK', played: 'Played', approved: 'Approved', declined: 'Declined', withdrawn: 'Taken back by its maker', removed: 'Taken out of the Store', creator: 'Made a creator', 'not-creator': 'No longer a creator', joined: 'Joined from away (Tailscale)', requested: 'Asked for a game', making: 'Making a requested game', made: 'Made a requested game', 'request-declined': 'Request declined', 'devkit-on': 'Given the Dev Kit', 'devkit-off': 'Dev Kit taken away', shared: 'Shared with everyone', 'family-only': 'Kept to its family', slots: 'Game slots changed' };
        r.history.forEach(function(x){
          row(c, '<span class="tag ' + (x.what === 'approved' ? 'ok' : x.what === 'declined' || x.what === 'removed' ? 'declined' : '') + '">' + esc(SAY[x.what] || x.what) + '</span> ' +
            (x.name ? '<b>' + esc(x.name) + '</b>' + (x.version ? ' <span class="tag">version ' + esc(x.version) + '</span>' : '') : '') +
            '<small>' + esc(when(x.at)) + ' \\u00b7 ' + esc(x.who) + (x.note ? ' \\u00b7 ' + esc(x.note) : '') + '</small>', []);
        });
        note(c, 'Kept for good, in the server\\u2019s own data (and its backups).');
      });
    },
    store: function(){
      return Promise.all([call('GET', '/api/store'), call('GET', '/api/history').catch(function(){ return { history: [] }; })]).then(function(both){
        var st = both[0], ok = {};
        /* (each game's latest approval: who made it, and who said OK when) */
        both[1].history.forEach(function(x){ if (x.what === 'approved' && !ok[x.gameId]) ok[x.gameId] = x; });
        var c = card('The Store\\u2019s games');
        if (!st.games || !st.games.length) note(c, 'Nothing in the Store yet. Games your creators send in come here once you\u2019ve approved them.');
        (st.games || []).forEach(function(g){
          var cols = (g.icon && g.icon.cols) || ['#6d5efc', '#6d5efc'];
          var glyph = g.icon && g.icon.glyph && !/<\\s*script|on\\w+\\s*=|javascript:|href/i.test(g.icon.glyph) ? g.icon.glyph : '';
          row(c, '<span class="who"><span class="icon" style="background:linear-gradient(135deg,' + esc(cols[0]) + ',' + esc(cols[1] || cols[0]) + ')"><svg viewBox="0 0 100 100">' + glyph + '</svg></span><span><b>' + esc(g.name) + '</b><small>' + (g.reach === 'family' ? '<b>Their family only</b> \\u00b7 ' : '') + 'Version ' + esc(g.version) + (g.by ? ' \\u00b7 ' + esc(g.by) : '') + ' \\u00b7 ' + size(g.bytes) + (ok[g.id] ? '<br>' + esc(ok[g.id].note.split(' \\u00b7 ')[0]) + ' \\u00b7 approved ' + esc(when(ok[g.id].at)) + ' by ' + esc(ok[g.id].who) : '') + '</small></span></span>',
            [g.reach === 'family'
              ? btn('Share with everyone', '', function(){ call('POST', '/api/store/' + encodeURIComponent(g.id) + '/reach', { everyone: true }).then(show, fail(c)); })
              : (g.by && !g.starter ? btn('Family only', '', function(){ call('POST', '/api/store/' + encodeURIComponent(g.id) + '/reach', { everyone: false }).then(show, fail(c)); }) : h('<span></span>')),
             sure('Take out', 'Take it out? Click again', 'danger', function(){ call('DELETE', '/api/store/' + encodeURIComponent(g.id)).then(show, fail(c)); })]);
        });
        note(c, 'Taking a game out of the Store leaves it on any PC that already downloaded it.');
      });
    },
    backups: function(){
      return call('GET', '/api/server').then(function(s){
        var c = card('Backups');
        row(c, 'One is made every day, and before each update.<small>The accounts, kids\\u2019 profiles, the Store\\u2019s games, games waiting for your OK, and the history. (Each PC keeps its own downloads, scores and settings.)</small>', [btn('Back up now', 'go', function(b){ b.textContent = 'Backing up\\u2026'; call('POST', '/api/backups').then(show, fail(c)); })]);
        s.backups.forEach(function(b){
          var what = [b.accounts != null ? b.accounts + ' account' + (b.accounts === 1 ? '' : 's') : '', b.profiles != null ? b.profiles + ' profile' + (b.profiles === 1 ? '' : 's') : '', b.games + ' game' + (b.games === 1 ? '' : 's'), size(b.bytes)].filter(Boolean).join(' \\u00b7 ');
          row(c, '<b>' + esc(when(b.at)) + '</b><small>' + esc(KINDS[b.reason] || b.reason) + ' \\u00b7 ' + esc(what) + '</small>', [sure('Restore', 'Restore it? Click again', '', function(x){
            call('POST', '/api/backups/' + encodeURIComponent(b.id) + '/restore').then(function(r){
              x.textContent = r.restarting ? 'Restoring\\u2026' : 'At next start';
              note(c, r.restarting ? 'Restoring: the server restarts in a moment with the data as it was then. What it had just now is kept as a backup too.' : 'This restore happens the next time the server starts.', 'warn');
              if (r.restarting) setTimeout(show, 6000);
            }, fail(c));
          })]);
        });
      });
    }
  };
  /* how many are waiting, on the tab */
  function count(){ call('GET', '/api/submissions').then(function(r){ var n = r.submissions.filter(function(x){ return x.state === 'waiting'; }).length; document.getElementById('waiting').textContent = n ? n : ''; }, function(){}); }
  function show(){
    main.innerHTML = '';
    if (key) count();
    [].forEach.call(document.querySelectorAll('#tabs button'), function(b){ b.className = b.dataset.t === tab ? 'on' : ''; });
    if (!key){ main.innerHTML = '<p class="empty">Open this page from the Orlis cube by the clock:<br>right-click it, then <b>Manage Orlis Server</b>.</p>'; return; }
    views[tab]().catch(function(e){ main.innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; });
  }
  document.getElementById('tabs').onclick = function(e){ var t = e.target.dataset && e.target.dataset.t; if (t){ tab = t; show(); } };
  show();
})();
</script>
</body></html>`;
}
