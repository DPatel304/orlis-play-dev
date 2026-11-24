import { TRY_SECS } from './submissions.js';
import { OUTFIT_REGULAR, OUTFIT_BOLD } from './manage-fonts.js';
/* The management page: the server's own, opened from the Orlis icon by the
   clock (Manage Orlis Server), in the browser on this laptop only. It's where
   the owner looks after the server - what needs them, every family, the
   Store's games, what happened, the settings and backups - so Orlis Play
   itself stays the family app, the same for everyone.

   One page, nothing loaded from anywhere: its look, its font (Outfit, below as
   data) and its code are in this file. It asks the server's usual routes and
   the owner's lists in admin.js (which page, search and sort on the server,
   so thousands of families are never sent at once), with the key the cube
   opened it with (in the address, which never leaves the laptop - and is
   taken out of sight as the page opens).

   (The page's script is written without backticks and without dollar-braces,
   because it lives inside a template here: its text is built with T(), where
   {name} is put in as text and {!name} as it is.) */

const CSS = String.raw`
/* An admin console in the Orlis clean look: a sidebar with counts, dense tables built to page through thousands of rows
   (search, filter chips, sortable headers, paging - all on the server), and a detail panel that slides in from the right. Light only. */
:root{
  --ink:#1d1b2e; --soft:#6b6a82; --faint:#9a99ad; --paper:#f4f5f9; --surface:#ffffff; --line:#e7e8f0; --hover:#f7f7fb;
  --blue:#3da9ff; --violet:#8b5cf6; --grad:linear-gradient(120deg,#3da9ff,#8b5cf6); --sel:#efeaff;
  --ok:#16a34a; --warn:#d97706; --bad:#dc2626;
  --ui:"Outfit",system-ui,-apple-system,"Segoe UI",sans-serif;
  --mono:"Cascadia Mono",Consolas,ui-monospace,monospace;
  --shadow:0 4px 18px rgba(29,27,46,.07);
  color-scheme:light;
}
*{ box-sizing:border-box }
html,body{ height:100% }
body{ margin:0; background:var(--paper); color:var(--ink); font:400 14px/1.45 var(--ui); }
button, input, select, textarea{ font:inherit; color:inherit }
.app{ display:grid; grid-template-columns:220px minmax(0,1fr); min-height:100% }
@media (max-width:820px){ .app{ grid-template-columns:1fr } aside{ position:static!important; height:auto!important; flex-direction:row!important; flex-wrap:wrap; } aside .foot{ display:none } .brand{ padding-bottom:6px!important } }
/* sidebar */
aside{ position:sticky; top:0; height:100vh; display:flex; flex-direction:column; gap:2px; padding-block:18px; padding-left:max(14px,env(safe-area-inset-left,0px)); padding-right:14px; background:var(--surface); border-right:1px solid var(--line) }
.brand{ display:flex; align-items:center; gap:9px; font-weight:700; font-size:17px; padding:2px 8px 16px }
.brand svg{ width:30px; height:30px }
.brand i{ font-style:normal; font-weight:400; color:var(--soft) }
aside a{ display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:10px; text-decoration:none; color:var(--ink); font-weight:500; cursor:pointer }
aside a svg{ width:17px; height:17px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; color:var(--soft); flex:none }
aside a:hover{ background:var(--hover) }
aside a.on{ background:var(--sel); color:#5b3fd6 }
aside a.on svg{ color:#5b3fd6 }
aside a .c{ margin-left:auto; font:500 12px var(--mono); color:var(--faint) }
aside a .c.hot{ background:var(--violet); color:#fff; padding:1px 7px; border-radius:999px }
aside a .c:empty{ display:none }
aside .foot{ margin-top:auto; padding:10px; font:11.5px/1.7 var(--mono); color:var(--soft) }
.foot .led{ margin-right:4px } .foot .fi{ display:inline-block; margin-right:8px; white-space:nowrap }
.led{ display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--ok); margin-right:7px; vertical-align:1px }
.led.warn{ background:var(--warn) } .led.bad{ background:var(--bad) } .led.off{ background:var(--faint) }
/* main */
main{ padding-block:20px 60px; padding-left:24px; padding-right:max(24px,env(safe-area-inset-right,0px)); min-width:0; display:grid; gap:16px; align-content:start }
@media (max-width:820px){ main{ padding-left:max(16px,env(safe-area-inset-left,0px)); padding-right:max(16px,env(safe-area-inset-right,0px)) } }
[hidden]{ display:none!important }
section[data-v]{ display:grid; gap:16px; min-width:0 }
#setsbody{ display:grid; gap:16px }
.top{ display:flex; align-items:baseline; gap:12px; flex-wrap:wrap }
h1{ margin:0; font-size:22px; font-weight:700 }
.top .sub, .sub{ color:var(--soft) }
.card{ background:var(--surface); border-radius:14px; box-shadow:var(--shadow); min-width:0 }
.card > h2{ margin:0; font-size:15px; font-weight:600; padding:14px 18px; border-bottom:1px solid var(--line); display:flex; gap:10px; align-items:center }
.card > h2 .more{ margin-left:auto; font-weight:500; color:#5b3fd6; cursor:pointer; font-size:13px; background:none; border:0; padding:0 }
.pad{ padding:14px 18px }
.empty{ padding:22px 18px; color:var(--soft) }
.err{ padding:14px 18px; color:var(--bad) }
.msg{ padding:8px 18px; font-size:13px; color:var(--soft); border-top:1px solid var(--line); overflow-wrap:anywhere }
.msg.bad{ color:var(--bad) } .msg.ok{ color:#166534 } .msg.warn{ color:#92400e; background:#fff8e6 }
/* health strip */
.health{ display:flex; flex-wrap:wrap; gap:0; }
.health > div{ flex:1 1 150px; padding:12px 16px; border-right:1px solid var(--line); min-width:0 }
.health > div:last-child{ border-right:0 }
.health > div:first-child{ flex:1.45 1 190px }
.health .k{ color:var(--soft); font-size:12px }
.health .v{ font:500 12.5px var(--mono); white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
/* stats */
.stats{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:0 }
.stat{ padding:14px 18px; min-width:0 }
.stat .k{ color:var(--soft); font-size:13px }
.stat .v{ font-size:26px; font-weight:700; font-variant-numeric:tabular-nums; line-height:1.2 }
.stat .d{ font-size:12px; color:var(--ok); font-variant-numeric:tabular-nums }
.stat .d.dn{ color:var(--bad) } .stat .d.flat{ color:var(--soft) }
.stat svg{ display:block; width:100%; height:28px; margin-top:6px }
.grid2{ display:grid; grid-template-columns:minmax(0,1.3fr) minmax(0,1fr); gap:16px; align-items:start }
@media (max-width:1100px){ .grid2{ grid-template-columns:1fr } }
/* toolbars + tables */
.bar{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; padding:12px 18px; border-bottom:1px solid var(--line) }
.search{ flex:1 1 240px; display:flex; align-items:center; gap:8px; padding:7px 12px; border:1px solid var(--line); border-radius:10px; background:var(--surface) }
.search svg{ width:15px; height:15px; stroke:var(--faint); fill:none; stroke-width:2; flex:none }
.search input{ border:0; outline:0; flex:1; min-width:0; background:none }
.search kbd{ font:11px var(--mono); color:var(--faint); border:1px solid var(--line); border-radius:5px; padding:0 5px }
.search:focus-within{ border-color:var(--blue); box-shadow:0 0 0 3px rgba(61,169,255,.15) }
.chips{ display:flex; gap:6px; flex-wrap:wrap }
.chip{ border:1px solid var(--line); background:var(--surface); border-radius:999px; padding:5px 11px; cursor:pointer; font-size:13px; white-space:nowrap }
.chip b{ font:500 11px var(--mono); color:var(--faint); margin-left:4px }
.chip.on{ background:var(--ink); border-color:var(--ink); color:#fff }
.chip.on b{ color:#cfcbe6 }
select.chip{ padding-right:8px }
.btn{ border:0; padding:7px 14px; border-radius:10px; cursor:pointer; font-weight:600; font-size:13px; background:var(--ink); color:#fff; white-space:nowrap }
.btn.ghost{ background:var(--paper); color:var(--ink) }
.btn.no{ background:none; color:var(--bad); box-shadow:inset 0 0 0 1px var(--line) }
.btn:disabled{ opacity:.45; cursor:default }
.btn.sm{ padding:4px 10px; font-size:12px }
.btn:focus-visible, .chip:focus-visible, aside a:focus-visible, th button:focus-visible, .more:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible{ outline:2px solid var(--blue); outline-offset:2px }
.scroll{ overflow-x:auto }
table{ width:100%; border-collapse:collapse }
th{ text-align:left; font-weight:500; color:var(--soft); font-size:12px; padding:9px 12px; border-bottom:1px solid var(--line); white-space:nowrap; background:var(--surface) }
th button{ border:0; background:none; padding:0; cursor:pointer; color:inherit; font-weight:inherit }
th.sorted button{ color:var(--ink) }
th.num, td.num{ text-align:right; font-variant-numeric:tabular-nums }
td{ padding:8px 12px; border-bottom:1px solid var(--line); white-space:nowrap }
tbody tr{ cursor:pointer }
tbody tr:hover{ background:var(--hover) }
tbody tr.sel{ background:var(--sel) }
td .id, .id{ font:12px var(--mono); color:var(--faint) }
td.cb, th.cb{ width:34px; padding-right:0 }
.face{ width:24px; height:24px; border-radius:7px; display:inline-grid; place-items:center; color:#fff; font-size:11px; font-weight:700; margin-right:-5px; border:2px solid var(--surface); vertical-align:middle }
.faces{ display:inline-block; padding-right:5px } .faces i{ font:normal 11px var(--mono); color:var(--faint); margin-left:9px }
.tag{ display:inline-block; font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px; background:var(--paper); color:var(--soft) }
.tag.new{ background:#efeaff; color:#5b3fd6 } .tag.wait{ background:#fff4dc; color:#92400e } .tag.act{ background:#e7f8ee; color:#166534 } .tag.off{ background:#f1f1f4; color:var(--faint) }
.pager{ display:flex; gap:8px; align-items:center; padding:10px 18px; color:var(--soft); font-size:13px; flex-wrap:wrap }
.pager .sp{ margin-left:auto }
.pager button{ border:1px solid var(--line); background:var(--surface); border-radius:8px; padding:4px 10px; cursor:pointer }
.pager button:disabled{ opacity:.4; cursor:default }
.bulk{ display:none; gap:8px; align-items:center; padding:8px 18px; background:var(--sel); font-size:13px; flex-wrap:wrap }
.bulk.on{ display:flex }
/* queue + log */
.q{ display:flex; gap:12px; align-items:center; padding:10px 18px; border-bottom:1px solid var(--line); flex-wrap:wrap }
.q:last-child{ border-bottom:0 }
.q .w{ flex:1; min-width:180px; overflow-wrap:anywhere }
.q small, .log small{ color:var(--faint) }
.note{ padding:0 18px 12px; border-bottom:1px solid var(--line); display:grid; gap:8px }
.note textarea{ width:100%; min-height:60px; border:1px solid var(--line); border-radius:10px; padding:8px 10px; resize:vertical }
.log{ list-style:none; margin:0; padding:0 }
.log li{ display:grid; grid-template-columns:92px 122px minmax(0,1fr); gap:10px; padding:7px 18px; border-bottom:1px solid var(--line); align-items:baseline }
.log li:last-child{ border-bottom:0 }
.log .t{ font:12px var(--mono); color:var(--faint); white-space:nowrap }
.log .e{ font:11px var(--mono); color:var(--soft); white-space:nowrap }
.log .m{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.log .m .h{ color:var(--violet); margin-right:4px }
.mini li{ grid-template-columns:92px 118px minmax(0,1fr) }
@media (max-width:820px){ .log li, .mini li{ grid-template-columns:78px minmax(0,1fr) } .log .e{ display:none } #fhead th:nth-child(7), #fbody td:nth-child(7){ display:none } td, th{ padding-left:8px; padding-right:8px } }
/* detail panel */
.panel{ position:fixed; top:0; right:0; bottom:0; width:min(440px,100%); background:var(--surface); box-shadow:-12px 0 40px rgba(29,27,46,.15); transform:translateX(105%); visibility:hidden; transition:transform .25s cubic-bezier(.2,.8,.25,1), visibility 0s .25s; z-index:20; display:flex; flex-direction:column; padding-top:env(safe-area-inset-top,0px); padding-right:env(safe-area-inset-right,0px) }
.panel.open{ transform:none; visibility:visible; transition:transform .25s cubic-bezier(.2,.8,.25,1) }
.panel header{ display:flex; gap:10px; align-items:center; padding:16px 18px; border-bottom:1px solid var(--line) }
.panel header h2{ margin:0; font-size:17px; min-width:0; overflow-wrap:anywhere }
.panel header button{ margin-left:auto; border:0; background:var(--paper); border-radius:8px; width:30px; height:30px; cursor:pointer; font-size:16px; flex:none }
.panel .body{ overflow:auto; padding:14px 18px 20px; display:grid; gap:16px; align-content:start }
.kv{ display:grid; grid-template-columns:110px minmax(0,1fr); gap:6px 12px; font-size:13px; margin:0 }
.kv dt{ color:var(--soft) } .kv dd{ margin:0; font-variant-numeric:tabular-nums; overflow-wrap:anywhere }
.kv code{ font:12px var(--mono) }
.panel h3{ margin:6px 0 0; font-size:12px; font-weight:600; color:var(--soft); text-transform:uppercase; letter-spacing:.05em }
.people{ display:grid; gap:6px }
.people div{ display:flex; gap:10px; align-items:center }
.people .face{ margin:0; width:28px; height:28px }
.acts{ display:flex; gap:8px; flex-wrap:wrap; align-items:center }
.acct{ display:grid; gap:8px; padding:10px 12px; border:1px solid var(--line); border-radius:12px }
.acct .em{ overflow-wrap:anywhere; font-weight:500 }
.seg{ display:inline-flex; padding:2px; border-radius:999px; background:var(--paper) }
.seg button{ border:0; background:transparent; font-size:12px; font-weight:600; padding:3px 11px; border-radius:999px; cursor:pointer; color:var(--soft) }
.seg button.on{ background:var(--surface); color:var(--ink); box-shadow:0 1px 4px rgba(20,24,50,.12) }
.pw{ display:flex; gap:6px; flex-wrap:wrap }
.pw input, .form input{ flex:1 1 150px; min-width:0; border:1px solid var(--line); border-radius:10px; padding:6px 10px; background:var(--surface) }
.cover{ width:44px; height:26px; border-radius:6px; vertical-align:middle; margin-right:8px; display:inline-block; background-size:cover; background-position:center }
.coverbig{ height:120px; border-radius:12px; background-size:cover; background-position:center }
.toast{ position:fixed; left:50%; bottom:22px; transform:translateX(-50%); background:var(--ink); color:#fff; padding:9px 16px; border-radius:12px; font-size:13px; z-index:40; box-shadow:var(--shadow); max-width:min(560px,calc(100% - 32px)); overflow-wrap:anywhere }
.toast.bad{ background:var(--bad) }
.toast[hidden]{ display:none }
.pwlist{ font:12px/1.7 var(--mono); background:var(--paper); border-radius:10px; padding:8px 12px; white-space:pre-wrap; overflow-wrap:anywhere; margin:0 }
@media (prefers-reduced-motion:reduce){ .panel{ transition:none } }
/* settings */
.set{ display:grid; grid-template-columns:180px minmax(0,1fr) auto; gap:12px; align-items:center; padding:11px 18px; border-bottom:1px solid var(--line) }
.set:last-child{ border-bottom:0 }
.set .k{ color:var(--soft) }
.set code{ font:12.5px var(--mono); overflow-wrap:anywhere }
.set .r{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end }
.set .form{ display:flex; gap:8px; flex-wrap:wrap; grid-column:2 / 4 }
@media (max-width:640px){ .set{ grid-template-columns:1fr } .set .r{ justify-content:flex-start } .set .form{ grid-column:1 } }
`;

const BODY = String.raw`
<div class="app">
<aside>
  <div class="brand"><svg viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3da9ff"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs><rect x="4" y="4" width="32" height="32" rx="10" fill="url(#cg)"/><circle cx="15" cy="19" r="2.6" fill="#1d1b2e"/><circle cx="25" cy="19" r="2.6" fill="#1d1b2e"/><path d="M15.5 25.5 q4.5 3.5 9 0" stroke="#1d1b2e" stroke-width="2" fill="none" stroke-linecap="round"/></svg>Orlis <i>Server</i></div>
  <a data-t="home" class="on" tabindex="0"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>Overview</a>
  <a data-t="queue" tabindex="0"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h7"/><circle cx="18" cy="17" r="3"/></svg>Queue<span class="c hot" id="nq"></span></a>
  <a data-t="fams" tabindex="0"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.8"/><path d="M16 14.2c3 .2 5.5 2.4 5.5 5.8"/></svg>Families<span class="c" id="nf"></span></a>
  <a data-t="games" tabindex="0"><svg viewBox="0 0 24 24"><rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="16" cy="11.5" r="1"/><circle cx="18" cy="13.5" r="1"/></svg>Games<span class="c" id="ng"></span></a>
  <a data-t="log" tabindex="0"><svg viewBox="0 0 24 24"><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/></svg>Activity</a>
  <a data-t="sets" tabindex="0"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>Settings</a>
  <div class="foot" id="foot"></div>
</aside>

<main id="main">
<!-- OVERVIEW -->
<section data-v="home">
  <div class="top"><h1>Overview</h1><span class="sub" id="now"></span></div>
  <div class="card health" id="health"></div>
  <div class="card stats" id="stats"></div>
  <div class="grid2">
    <div class="card"><h2>Queue<button class="more" data-go="queue" id="qall">All</button></h2><div id="qmini"></div></div>
    <div class="card"><h2>Activity<button class="more" data-go="log">All</button></h2><ul class="log mini" id="logmini"></ul></div>
  </div>
  <div class="card"><h2>Top games (7d)<button class="more" data-go="games" id="gall">All</button></h2>
    <div class="scroll"><table><thead><tr><th>Game</th><th class="num">Plays</th><th class="num">Families</th><th class="num">Avg round</th><th>Featured</th></tr></thead><tbody id="topg"></tbody></table></div></div>
</section>

<!-- QUEUE -->
<section data-v="queue" hidden>
  <div class="top"><h1>Queue</h1><span class="sub">Joins and games waiting for you</span></div>
  <div class="card"><h2>Add email to allowlist</h2>
    <form class="bar" id="allowform" style="border:0"><label class="search"><input id="allow" type="text" placeholder="name@example.com, one or more, comma-separated" aria-label="Emails to allow" autocomplete="off"></label><button class="btn" id="allowgo">Allow</button></form>
    <div id="allowmsg"></div>
  </div>
  <div class="card"><div class="bar"><span class="chips" id="qchips"></span><span style="margin-left:auto" class="sub">Oldest first</span></div><div id="qfull"></div></div>
  <div class="card" id="allowcard" hidden><h2>On the allowlist<span class="sub" id="allowcount"></span></h2><div class="pad sub" id="allowlist"></div></div>
</section>

<!-- FAMILIES -->
<section data-v="fams" hidden>
  <div class="top"><h1>Families</h1><span class="sub" id="fcount"></span></div>
  <div class="card">
    <div class="bar">
      <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="fq" placeholder="Search name, email, profile or id" aria-label="Search families" autocomplete="off"><kbd>/</kbd></label>
      <span class="chips" id="fchips"></span>
      <button class="btn ghost" id="fcsv">Export CSV</button>
    </div>
    <div class="bulk" id="fbulk"><b id="nsel">0</b> selected<button class="btn ghost" data-act="bulk-pw">New passwords</button><button class="btn ghost" data-act="bulk-clear">Clear</button></div>
    <div id="fbulkmsg"></div>
    <div class="scroll"><table><thead><tr id="fhead"></tr></thead><tbody id="fbody"></tbody></table></div>
    <div class="pager" id="fpager"></div>
  </div>
</section>

<!-- GAMES -->
<section data-v="games" hidden>
  <div class="top"><h1>Games</h1><span class="sub" id="gcount"></span></div>
  <div class="card">
    <div class="bar">
      <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="gq" placeholder="Search title, maker or id" aria-label="Search games" autocomplete="off"><kbd>/</kbd></label>
      <span class="chips" id="gchips"></span>
      <select id="gcat" class="chip" aria-label="Category"><option value="">All categories</option></select>
    </div>
    <div class="scroll"><table><thead><tr id="ghead"></tr></thead><tbody id="gbody"></tbody></table></div>
    <div class="pager" id="gpager"></div>
  </div>
</section>

<!-- ACTIVITY -->
<section data-v="log" hidden>
  <div class="top"><h1>Activity</h1><span class="sub">Everything that changed, newest first. Heads-ups are marked &#9679;.</span></div>
  <div class="card">
    <div class="bar"><label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="lq" placeholder="Filter by family, email or game" aria-label="Filter activity" autocomplete="off"><kbd>/</kbd></label>
      <span class="chips" id="lchips"></span></div>
    <ul class="log" id="logfull"></ul>
    <div class="pager" id="lpager"></div>
  </div>
</section>

<!-- SETTINGS -->
<section data-v="sets" hidden>
  <div class="top"><h1>Settings</h1></div>
  <div id="setsbody"></div>
</section>
</main>
</div>

<div class="panel" id="panel" aria-hidden="true" role="dialog" aria-labelledby="ptitle"><header><h2 id="ptitle"></h2><button id="pclose" aria-label="Close">&times;</button></header><div class="body" id="pbody"></div></div>
<div class="toast" id="toast" role="status" hidden></div>
`;

const SCRIPT = String.raw`
(function(){
  /* the key: from the address the cube opened (then out of sight) */
  var key = '';
  try { var m = /[?#&]k=([0-9a-f]+)/.exec(location.search + location.hash); if (m){ key = m[1]; sessionStorage.setItem('k', key); history.replaceState(null, '', location.pathname); } else key = sessionStorage.getItem('k') || ''; } catch (e) {}

  /* ---------- small tools ---------- */
  var $ = function(id){ return document.getElementById(id); };
  var VIEWS = ['home', 'queue', 'fams', 'games', 'log', 'sets'];
  var view = 'home';
  try { var sv = sessionStorage.getItem('v'); if (VIEWS.indexOf(sv) >= 0) view = sv; } catch (e) {}
  function esc(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  /* T('<b>{name}</b>{!html}', { name, html }): {x} is put in as text, {!x} as it is */
  function T(s, v){ return s.replace(/\{(!?)(\w+)\}/g, function(_, raw, k){ var x = v[k]; if (x == null) x = ''; return raw ? x : esc(x); }); }
  function fmt(n){ return Number(n || 0).toLocaleString('en-US'); }
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function ago(iso){
    var ms = Date.now() - Date.parse(iso); if (!iso || isNaN(ms)) return '';
    var m = Math.round(ms / 60000); if (m < 1) return 'just now'; if (m < 60) return m + 'm ago';
    var h = Math.round(m / 60); if (h < 48) return h + 'h ago';
    var d = Math.round(h / 24); return d < 60 ? d + 'd ago' : Math.round(d / 30) + 'mo ago';
  }
  function stamp(iso){
    var d = new Date(iso); if (isNaN(d)) return '';
    var t = pad(d.getHours()) + ':' + pad(d.getMinutes()), n = new Date();
    return d.toDateString() === n.toDateString() ? t : MON[d.getMonth()] + ' ' + d.getDate() + ' ' + t;
  }
  function dateOf(iso){ var d = new Date(iso); return isNaN(d) ? '' : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function size(n){ return n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(n >= 10485760 ? 0 : 1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function up(secs){ var d = Math.floor(secs / 86400), h = Math.floor(secs % 86400 / 3600), m = Math.floor(secs % 3600 / 60); return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + m + 'm' : m + 'm'; }
  var TAGS = { active: 'act', new: 'new', waiting: 'wait', inactive: 'off', live: 'act', hidden: 'off', review: 'wait' };
  var tag = function(s){ return '<span class="tag ' + (TAGS[s] || '') + '">' + esc(s) + '</span>'; };
  var face = function(p){ return '<span class="face" style="background:' + esc(p.colour) + '" title="' + esc(p.name) + '">' + esc((p.name || '?').charAt(0).toUpperCase()) + '</span>'; };
  var enc = encodeURIComponent;
  var SEARCH = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';

  function api(method, path, body){
    return fetch(path, { method: method, headers: { 'Content-Type': 'application/json', 'X-Orlis-Manage': key }, body: body ? JSON.stringify(body) : undefined })
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if (!r.ok) throw new Error(d.message || 'That didn’t work.'); return d; }); });
  }
  function qs(o){ var a = []; Object.keys(o).forEach(function(k){ if (o[k] !== '' && o[k] != null) a.push(k + '=' + enc(o[k])); }); return a.length ? '?' + a.join('&') : ''; }
  var toastTimer = 0;
  function toast(msg, bad){ var t = $('toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function(){ t.hidden = true; }, bad ? 6000 : 3500); }
  function oops(e){ toast(e && e.message || 'That didn’t work.', true); }
  function debounce(fn, ms){ var t = 0; return function(){ var a = arguments, self = this; clearTimeout(t); t = setTimeout(function(){ fn.apply(self, a); }, ms); }; }
  function fail(el, e){ el.innerHTML = T('<div class="err">{m} <button class="btn ghost sm" data-act="reload">Try again</button></div>', { m: e.message }); }

  /* ---------- navigation, the side panel ---------- */
  var loaded = {};
  function go(t){
    view = t; try { sessionStorage.setItem('v', t); } catch (e) {}
    [].forEach.call(document.querySelectorAll('aside a[data-t]'), function(a){ a.classList.toggle('on', a.dataset.t === t); });
    [].forEach.call(document.querySelectorAll('section[data-v]'), function(s){ s.hidden = s.dataset.v !== t; });
    closePanel();
    refresh(t);
  }
  function refresh(t){
    if (!key) return;
    ({ home: loadHome, queue: loadQueue, fams: loadFams, games: loadGames, log: loadLog, sets: loadSets })[t]();
  }
  var panel = $('panel'), panelFrom = null;
  function openPanel(title, html){
    if (!panel.classList.contains('open')) panelFrom = document.activeElement;
    $('ptitle').innerHTML = title; $('pbody').innerHTML = html;
    panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false');
  }
  function closePanel(){
    if (!panel.classList.contains('open')) return;
    panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true');
    [].forEach.call(document.querySelectorAll('tr.sel'), function(r){ r.classList.remove('sel'); });
    P = null;
    if (panelFrom && panelFrom.focus) try { panelFrom.focus(); } catch (e) {}
  }
  var P = null;      /* what the panel shows: { kind: 'fam' | 'game', ... } */

  /* a button that asks first: the first press changes its words, the second (within 4 seconds) does it */
  function armed(b){
    var ask = b.dataset.sure; if (!ask) return true;
    if (b._at && Date.now() - b._at < 4000){ b._at = 0; return true; }
    b._at = Date.now(); b._was = b.textContent; b.textContent = ask;
    setTimeout(function(){ if (b._at && Date.now() - b._at >= 3900){ b._at = 0; b.textContent = b._was; } }, 4000);
    return false;
  }

  /* ---------- the health strip, the stats, the sidebar ---------- */
  var overview = null;
  function led(level){ return '<span class="led ' + (level === 'ok' ? '' : level) + '"></span>'; }
  function hostOf(u){ return String(u || '').replace(/^https?:\/\//, ''); }
  function spark(vals, color){
    var n = vals.length, max = Math.max.apply(null, vals), min = Math.min.apply(null, vals), span = max - min;
    var pts = vals.map(function(v, i){ return (i * 100 / Math.max(1, n - 1)).toFixed(1) + ',' + (span ? (26 - (v - min) / span * 24) : 14).toFixed(1); }).join(' ');
    return '<svg viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="' + color + '" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" points="' + pts + '"/></svg>';
  }
  function drawHealth(o){
    var h = o.health, f = h.funnel, s = h.smtp, b = h.backup, d = h.disk, e = h.errors;
    var cells = [
      ['Funnel', f.level, f.door ? 'open · ' + (f.publicUrl ? hostOf(f.publicUrl) : 'port ' + f.port + ' (no public address set)') : 'off · internet door closed'],
      ['SMTP', s.level, !s.ready ? 'not set up' : s.error ? 'error · ' + s.error : 'ok · ' + (s.lastSent ? 'sent ' + ago(s.lastSent) : 'none sent yet')],
      ['Backup', b.level, b.last ? stamp(b.last.at) + ' · ' + b.count + ' kept · ' + size(b.bytes) : 'none yet'],
      ['Disk', d ? d.level : 'warn', d ? d.usedPct + '% used · ' + size(d.freeBytes) + ' free' : 'unknown'],
      ['Errors (24h)', e.level, e.count24h + ' · p95 ' + (e.p95ms == null ? '–' : Math.round(e.p95ms) + ' ms')]
    ];
    $('health').innerHTML = cells.map(function(c){ return T('<div><div class="k">{k}</div><div class="v" title="{v}">{!l}{v}</div></div>', { k: c[0], v: c[2], l: led(c[1]) }); }).join('');
    $('foot').innerHTML = T('{!l}v{v} · up {u}<br><span class="fi">{!f}funnel</span><span class="fi">{!s}smtp</span><span class="fi">{!b}backup</span>', { l: '<span class="led"></span>', v: h.server.version, u: up(h.server.uptimeSecs), f: led(f.level), s: led(s.level), b: led(b.level) });
  }
  function drawCounts(o){
    var q = o.stats.queue.all; $('nq').textContent = q ? q : '';
    $('nf').textContent = fmt(o.stats.families.total); $('ng').textContent = fmt(o.stats.games);
  }
  function qrow(x){
    var when = ago(x.at);
    if (x.kind === 'join') return T('<div class="q"><span class="tag wait">join</span><div class="w"><b>{name}</b> · {family}<br><small>{email} · {when} · asked to join</small></div><button class="btn" data-act="join-ok" data-id="{id}">Approve</button><button class="btn no" data-act="join-no" data-id="{id}" data-sure="Decline? Click again">Decline</button></div>', { name: x.name || x.email, family: x.family, email: x.email, when: when, id: x.id });
    if (x.kind === 'beta') return T('<div class="q"><span class="tag wait">beta</span><div class="w"><b>{email}</b><br><small>asked on the beta page · {when} · not on the allowlist</small></div><button class="btn" data-act="beta-ok" data-email="{email}">Allow</button><button class="btn no" data-act="beta-no" data-email="{email}" data-sure="Decline? Click again">Decline</button></div>', { email: x.email, when: when });
    return T('<div class="q" data-sub="{id}"><span class="tag new">game</span><div class="w"><b>{name}</b> <span class="id">{gid}@{ver}</span><br><small>by {family} · {when} · {size} · passed checks · {played}</small></div><button class="btn ghost" data-act="game-try">Try</button><button class="btn" data-act="game-publish" data-id="{id}" {!dis}>Publish</button><button class="btn no" data-act="game-reject" data-id="{id}">Reject&hellip;</button></div>',
      { id: x.id, name: x.name, gid: x.gameId, ver: x.version, family: x.family, when: when, size: size(x.bytes), played: x.tried ? 'played ✓' : 'not played yet', dis: x.tried ? '' : 'disabled title="Play it first in Orlis Play (Try it, ' + TRY + ' seconds)"' });
  }
  function drawHome(o){
    var st = o.stats, wd = new Date().toLocaleDateString([], { weekday: 'short' });
    $('now').textContent = new Date(o.now).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    drawHealth(o); drawCounts(o);
    var p = st.plays, delta = p.lastWeekSameTime ? Math.round((p.today - p.lastWeekSameTime) / p.lastWeekSameTime * 100) : null;
    var dcls = delta == null || delta === 0 ? 'flat' : delta < 0 ? 'dn' : '';
    $('stats').innerHTML =
      T('<div class="stat"><div class="k">Families</div><div class="v">{n}</div><div class="d">+{w} this week</div>{!s}</div>', { n: fmt(st.families.total), w: fmt(st.families.newThisWeek), s: spark(o.series.newFamilies, '#8b5cf6') }) +
      T('<div class="stat"><div class="k">Active (7d)</div><div class="v">{n}</div><div class="d flat">{p}% of families</div></div>', { n: fmt(st.active7.households), p: st.active7.pct }) +
      T('<div class="stat"><div class="k">Plays today</div><div class="v">{n}</div><div class="d {c}">{d}</div>{!s}</div>', { n: fmt(p.today), c: dcls, s: spark(o.series.plays, '#3da9ff'),
        d: delta == null ? 'none last ' + wd + ' by now' : (delta > 0 ? '+' : delta < 0 ? '−' : '') + Math.abs(delta) + '% vs last ' + wd }) +
      T('<div class="stat"><div class="k">Queue</div><div class="v">{n}</div><div class="d flat">{j} joins · {g} games</div></div>', { n: fmt(st.queue.all), j: st.queue.joins, g: st.queue.games });
    $('qmini').innerHTML = o.queue.items.length ? o.queue.items.map(qrow).join('') : '<div class="empty">All caught up.</div>';
    $('qall').textContent = 'All ' + st.queue.all + ' →'; $('gall').textContent = 'All ' + fmt(st.games) + ' →';
    $('logmini').innerHTML = o.activity.length ? o.activity.map(function(r){ return lrow(r); }).join('') : '<li><span class="m sub">Nothing yet.</span></li>';
    $('topg').innerHTML = o.top.length ? o.top.map(function(g){
      return T('<tr data-g="{id}"><td><b>{t}</b> <span class="id">{id}</span></td><td class="num">{p}</td><td class="num">{f}</td><td class="num">{m} min</td><td>{!s}</td></tr>', { id: g.id, t: g.title, p: fmt(g.plays), f: fmt(g.fams), m: g.mins, s: g.featured ? '★' : '<span class="sub">–</span>' });
    }).join('') : '<tr><td colspan="5" class="sub" style="padding:18px 12px;cursor:default">No plays in the last 7 days.</td></tr>';
  }
  function loadHome(){
    return api('GET', '/api/admin/overview').then(function(o){ overview = o; drawHome(o); }, function(e){ if (view === 'home') toast(e.message, true); });
  }
  function lrow(r){
    return T('<li><span class="t">{t}</span><span class="e">{c}</span><span class="m" title="{title}">{!h}<b>{s}</b> {x}</span></li>', { t: stamp(r.at), c: r.code, s: r.subject, x: r.text, title: r.subject + ' ' + r.text, h: r.head ? '<span class="h" title="a heads-up">●</span>' : '' });
  }

  /* ---------- a list that pages, searches and sorts on the server ---------- */
  function Table(o){
    var S = { q: '', st: 'all', sort: o.sort[0], dir: o.sort[1], page: 1, cat: '', total: 0, pages: 1, rows: [], sel: {}, n: 0 };
    var head = $(o.key + 'head'), body = $(o.key + 'body'), pager = $(o.key + 'pager'), chips = $(o.key + 'chips');
    function url(){ return o.path + qs({ q: S.q, status: S.st === 'all' ? '' : S.st, cat: S.cat, sort: S.sort, dir: S.dir, page: S.page, per: 25 }); }
    function draw(r){
      S.total = r.total; S.pages = r.pages; S.page = r.page; S.rows = r.rows; S.counts = r.counts;
      chips.innerHTML = o.chips.map(function(c){ return T('<button class="chip{!on}" data-chip="{k}">{l} <b>{n}</b></button>', { k: c[0], l: c[1], n: fmt(r.counts[c[0]]), on: S.st === c[0] ? ' on' : '' }); }).join('');
      var allOn = S.rows.length && S.rows.every(function(x){ return S.sel[x.id]; });
      head.innerHTML = (o.select ? '<th class="cb"><input type="checkbox" data-all="1" aria-label="Select this page"' + (allOn ? ' checked' : '') + '></th>' : '') + o.cols.map(function(c){
        return T('<th class="{c}">{!b}</th>', { c: (c.num ? 'num ' : '') + (S.sort === c.k ? 'sorted' : ''), b: c.sort ? T('<button data-sort="{k}">{l}{a}</button>', { k: c.k, l: c.l, a: S.sort === c.k ? (S.dir === 'asc' ? ' ↑' : ' ↓') : '' }) : esc(c.l) });
      }).join('');
      body.innerHTML = S.rows.length ? S.rows.map(function(x){
        var id = o.id(x), on = o.select && S.sel[id];
        return '<tr data-id="' + esc(id) + '" class="' + (P && P.id === id && P.kind === o.key ? 'sel' : on ? 'sel' : '') + '">' + (o.select ? '<td class="cb"><input type="checkbox" ' + (on ? 'checked' : '') + ' aria-label="Select"></td>' : '') + o.row(x) + '</tr>';
      }).join('') : '<tr><td colspan="9" class="sub" style="padding:24px 12px;cursor:default">' + (S.q || S.st !== 'all' || S.cat ? 'No matches.' : o.none) + '</td></tr>';
      var from = r.total ? (S.page - 1) * 25 + 1 : 0;
      pager.innerHTML = '<span>' + fmt(from) + '–' + fmt(Math.min(r.total, S.page * 25)) + ' of ' + fmt(r.total) + '</span><span class="sp">Page ' + S.page + ' / ' + fmt(S.pages) + '</span><button data-p="-1" aria-label="Previous page"' + (S.page > 1 ? '' : ' disabled') + '>←</button><button data-p="1" aria-label="Next page"' + (S.page < S.pages ? '' : ' disabled') + '>→</button>';
      if (o.after) o.after(r, S);
      if (o.select) bulk();
    }
    function bulk(){ var n = Object.keys(S.sel).length; $('fbulk').classList.toggle('on', n > 0); $('nsel').textContent = n; }
    function load(){
      var mine = ++S.n;
      return api('GET', url()).then(function(r){ if (mine === S.n) draw(r); }, function(e){ if (mine === S.n) fail(pager, e); });
    }
    $(o.key + 'q').addEventListener('input', debounce(function(){ S.q = $(o.key + 'q').value.trim(); S.page = 1; load(); }, 200));
    document.addEventListener('click', function(e){
      var t = e.target, chip = t.closest('[data-chip]');
      if (chip && chips.contains(chip)){ S.st = chip.dataset.chip; S.page = 1; load(); }
      if (t.dataset.sort && head.contains(t)){ S.dir = S.sort === t.dataset.sort && S.dir === 'desc' ? 'asc' : S.sort === t.dataset.sort ? 'desc' : (t.dataset.sort === 'name' || t.dataset.sort === 'title' || t.dataset.sort === 'cat' || t.dataset.sort === 'maker' ? 'asc' : 'desc'); S.sort = t.dataset.sort; S.page = 1; load(); }
      if (t.dataset.p && pager.contains(t)){ S.page += Number(t.dataset.p); load(); }
      if (t.dataset.all && head.contains(t)){ S.rows.forEach(function(x){ if (t.checked) S.sel[x.id] = x; else delete S.sel[x.id]; }); draw({ total: S.total, pages: S.pages, page: S.page, rows: S.rows, counts: S.counts }); }
      if (body.contains(t)){
        var tr = t.closest('tr[data-id]'); if (!tr) return;
        if (t.type === 'checkbox'){ var row = S.rows.filter(function(x){ return o.id(x) === tr.dataset.id; })[0]; if (t.checked) S.sel[tr.dataset.id] = row; else delete S.sel[tr.dataset.id]; tr.classList.toggle('sel', t.checked); bulk(); return; }
        [].forEach.call(body.querySelectorAll('tr.sel'), function(r){ r.classList.remove('sel'); });
        tr.classList.add('sel');
        o.open(S.rows.filter(function(x){ return o.id(x) === tr.dataset.id; })[0]);
      }
    });
    return { S: S, load: load, draw: draw, redraw: function(){ load(); } };
  }

  /* ---------- families ---------- */
  var FSTAT = [['all', 'All'], ['active', 'Active'], ['new', 'New (7d)'], ['waiting', 'Waiting'], ['inactive', 'Inactive 30d+']];
  var fam = Table({ key: 'f', path: '/api/admin/families', sort: ['last', 'desc'], select: true, none: 'No families yet.',
    chips: FSTAT, id: function(x){ return x.id; },
    cols: [{ k: 'name', l: 'Family', sort: 1 }, { k: 'ppl', l: 'Profiles' }, { k: 'status', l: 'Status', sort: 1 }, { k: 'last', l: 'Last played', sort: 1 }, { k: 'plays', l: 'Plays', num: 1, sort: 1 }, { k: 'made', l: 'Made', num: 1, sort: 1 }, { k: 'joined', l: 'Joined', sort: 1 }],
    row: function(f){
      var shown = f.profiles.slice(0, 6).map(face).join('') + (f.profiles.length > 6 ? '<i>+' + (f.profiles.length - 6) + '</i>' : '');
      var owner = f.accounts.some(function(a){ return a.role === 'owner'; });
      return T('<td><b>{name}</b>{!you}<br><span class="id">{email}{more}</span></td><td><span class="faces">{!faces}</span></td><td>{!st}</td><td>{!last}</td><td class="num">{plays}</td><td class="num">{made}</td><td>{joined}</td>',
        { name: f.name, you: owner ? ' <span class="tag">you</span>' : '', email: f.emails[0] || '', more: f.emails.length > 1 ? ' +' + (f.emails.length - 1) : '', faces: shown, st: tag(f.status),
          last: f.last ? esc(ago(f.last)) : '<span class="sub">never</span>', plays: fmt(f.plays), made: f.made + '/' + f.slots, joined: dateOf(f.joined) });
    },
    open: function(f){ openFamily(f.id); },
    after: function(r){ $('fcount').textContent = fmt(r.counts.all) + (famSearching() ? ' match' : ' total'); }
  });
  var famSearching = function(){ return !!fam.S.q; };
  function loadFams(){ return fam.load(); }
  $('fcsv').addEventListener('click', function(){
    var u = '/api/admin/families.csv' + qs({ q: fam.S.q, status: fam.S.st === 'all' ? '' : fam.S.st, sort: fam.S.sort, dir: fam.S.dir });
    fetch(u, { headers: { 'X-Orlis-Manage': key } }).then(function(r){ if (!r.ok) throw new Error('The export didn’t work.'); return r.blob().then(function(b){ return [b, (/filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '') || [])[1] || 'orlis-families.csv']; }); })
      .then(function(x){ var a = document.createElement('a'); a.href = URL.createObjectURL(x[0]); a.download = x[1]; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000); toast('Exported ' + x[1]); }, oops);
  });

  function acctRow(a){
    var isOwner = a.role === 'owner';
    return T('<div class="acct" data-acct="{id}"><div><span class="em">{email}</span> {!st}</div><div class="acts">{!role}<button class="btn ghost sm" data-act="pw-open" data-id="{id}">New password</button></div><div class="pw" data-pw="{id}" hidden><input type="text" placeholder="8+ characters" minlength="8" aria-label="New password for {email}" autocomplete="off"><button class="btn sm" data-act="pw-set" data-id="{id}">Set</button><button class="btn ghost sm" data-act="pw-rand" data-id="{id}">Random</button></div></div>',
      { id: a.id, email: a.email, st: isOwner ? '<span class="tag new">owner</span>' : a.waiting ? tag('waiting') : '',
        role: isOwner ? '' : '<span class="seg" data-role="' + esc(a.id) + '"><button data-act="role" data-id="' + esc(a.id) + '" data-role="player"' + (a.role === 'player' ? ' class="on"' : '') + '>Player</button><button data-act="role" data-id="' + esc(a.id) + '" data-role="creator"' + (a.role === 'creator' ? ' class="on"' : '') + '>Creator</button></span>' });
  }
  function openFamily(id){
    P = { kind: 'f', id: id };
    openPanel('Loading…', '');
    api('GET', '/api/admin/families/' + enc(id)).then(function(f){
      if (!P || P.id !== id) return;
      P.data = f;
      var waiting = f.accounts.some(function(a){ return a.waiting; });
      openPanel(esc(f.name), T(
        '<dl class="kv"><dt>Id</dt><dd><code>{id}</code></dd><dt>Status</dt><dd>{!st}</dd><dt>Grown-ups</dt><dd>{emails}</dd><dt>Joined</dt><dd>{joined}</dd><dt>Last played</dt><dd>{last}</dd><dt>Plays</dt><dd>{plays} all time · {tried} games</dd><dt>Game slots</dt><dd>{made} of {slots} used</dd></dl>' +
        '<h3>Profiles</h3><div class="people">{!people}</div><h3>Most played</h3><div class="sub">{!top}</div><h3>Accounts</h3>{!accts}<h3>Actions</h3><div class="acts">{!ok}<button class="btn ghost" data-act="see-log" data-q="{q}">View activity</button></div>',
        { id: f.id, st: tag(f.status), emails: f.emails.join(', '), joined: dateOf(f.joined), last: f.last ? ago(f.last) : 'never', plays: fmt(f.plays), tried: f.tried, made: f.made, slots: f.slots,
          people: f.profiles.map(function(p){ return '<div>' + face(p) + esc(p.name) + '</div>'; }).join('') || '<span class="sub">None</span>',
          top: f.top.length ? f.top.map(function(g){ return esc(g.title) + ' <span class="id">×' + g.plays + '</span>'; }).join(' · ') : 'Nothing played yet.',
          accts: f.accounts.map(acctRow).join(''), ok: waiting ? '<button class="btn" data-act="fam-ok" data-id="' + esc(f.id) + '">Approve</button>' : '', q: f.emails[0] || f.name }));
    }, function(e){ closePanel(); oops(e); });
  }
  function acctOf(id){ var f = (P && P.data) || { accounts: [] }, found = null; f.accounts.forEach(function(a){ if (a.id === id) found = a; }); if (!found) Object.keys(fam.S.sel).forEach(function(k){ fam.S.sel[k].accounts.forEach(function(a){ if (a.id === id) found = a; }); }); return found; }
  function randomPassword(){
    var A = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = new Uint32Array(14), out = '';
    crypto.getRandomValues(b); for (var i = 0; i < b.length; i++) out += A.charAt(b[i] % A.length);
    return out;
  }
  function setPassword(a, pw){ return api('POST', '/api/accounts/' + enc(a.id) + '/password', { password: pw }); }

  /* ---------- games ---------- */
  var GSTAT = [['all', 'All'], ['live', 'Live'], ['featured', 'Featured'], ['review', 'In review'], ['hidden', 'Hidden']];
  var gcat = $('gcat'), featuredTotal = 0;
  function cover(g){ var c = g.cols && g.cols.length ? g.cols : ['#6d5efc', '#8b5cf6']; return '<span class="cover" style="background-image:linear-gradient(135deg,' + esc(c[0]) + ',' + esc(c[1] || c[0]) + ')"></span>'; }
  var games = Table({ key: 'g', path: '/api/admin/games', sort: ['plays', 'desc'], none: 'No games in the Store yet.',
    chips: GSTAT, id: function(g){ return g.key; },
    cols: [{ k: 'title', l: 'Game', sort: 1 }, { k: 'cat', l: 'Category', sort: 1 }, { k: 'maker', l: 'Made by', sort: 1 }, { k: 'status', l: 'Status', sort: 1 }, { k: 'plays', l: 'Plays 7d', num: 1, sort: 1 }, { k: 'fams', l: 'Families 7d', num: 1, sort: 1 }, { k: 'feat', l: 'Featured', sort: 1 }],
    row: function(g){
      return T('<td>{!cv}<b>{title}</b> <span class="id">{id}@{ver}</span></td><td>{cat}</td><td>{maker}</td><td>{!st}</td><td class="num">{plays}</td><td class="num">{fams}</td><td>{!feat}</td>',
        { cv: cover(g), title: g.title, id: g.id, ver: g.version, cat: g.cat, maker: g.maker, st: tag(g.status), plays: fmt(g.plays), fams: fmt(g.fams), feat: g.slot ? (g.slot <= 3 ? '★ slot ' + g.slot : '★ pinned') : '<span class="sub">–</span>' });
    },
    open: function(g){ openGame(g); },
    after: function(r){
      featuredTotal = r.featuredTotal; $('gcount').textContent = fmt(r.counts.all) + (games.S.q || games.S.cat ? ' match' : ' total');
      var have = [].map.call(gcat.options, function(o){ return o.value; }).join('|'), want = [''].concat(r.cats).join('|');
      if (have !== want){ gcat.innerHTML = '<option value="">All categories</option>' + r.cats.map(function(c){ return '<option>' + esc(c) + '</option>'; }).join(''); gcat.value = games.S.cat; }
    }
  });
  function loadGames(){ return games.load(); }
  gcat.addEventListener('change', function(){ games.S.cat = gcat.value; games.S.page = 1; games.load(); });
  var SAFE_COVER = /^\s*<svg[\s>]/i, UNSAFE_COVER = /<\s*script|\bon\w+\s*=|javascript:|<\s*foreign|href|<\s*image|<\s*style|<\s*text|<\s*use\b|url\(\s*['"]?(?!#)/i;
  function coverUrl(svg){
    if (!svg || !SAFE_COVER.test(svg) || UNSAFE_COVER.test(svg)) return '';
    var s = /xmlns\s*=/.test(svg) ? svg : svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    return 'url(data:image/svg+xml;charset=utf-8,' + enc(s).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29') + ')';
  }
  function gameActs(g){
    var b = [];
    if (g.status === 'review'){
      b.push('<button class="btn ghost" data-act="game-try">Try</button>');
      b.push('<button class="btn" data-act="game-publish" data-id="' + esc(g.submission) + '"' + (g.tried ? '' : ' disabled title="Play it first in Orlis Play (Try it, ' + TRY + ' seconds)"') + '>Publish</button>');
      b.push('<button class="btn no" data-act="game-reject" data-id="' + esc(g.submission) + '">Reject&hellip;</button>');
      return b.join('');
    }
    var full = featuredTotal >= 3 && !g.featured;
    b.push('<button class="btn ghost" data-act="feature" data-id="' + esc(g.id) + '" data-on="' + (g.featured ? '0' : '1') + '"' + (full ? ' disabled title="Three are featured already: unfeature one first"' : '') + '>' + (g.featured ? 'Unfeature' : 'Feature') + '</button>');
    /* hiding is what the Store has: a family's game kept to that family (not Orlis Play's own, or the owner's starters) */
    if (g.maker !== 'Orlis' && !g.starter) b.push('<button class="btn ghost" data-act="reach" data-id="' + esc(g.id) + '" data-everyone="' + (g.status === 'hidden' ? '1' : '0') + '">' + (g.status === 'hidden' ? 'Unhide (share with everyone)' : 'Hide (their family only)') + '</button>');
    b.push('<button class="btn no" data-act="takeout" data-id="' + esc(g.id) + '" data-sure="Take out? Click again">Take out of Discover</button>');
    return b.join('');
  }
  function openGame(g){
    P = { kind: 'g', id: g.key, row: g };
    var base = T('<dl class="kv"><dt>Id</dt><dd><code>{id}@{ver}</code></dd><dt>Status</dt><dd>{!st}</dd><dt>Category</dt><dd>{cat}</dd><dt>Made by</dt><dd>{maker}</dd><dt>Plays 7d</dt><dd>{plays} by {fams} families</dd><dt>Size</dt><dd>{size}</dd><dt>Featured</dt><dd>{feat}</dd><span id="gmore" style="display:contents"></span></dl>',
      { id: g.id, ver: g.version, st: tag(g.status), cat: g.cat, maker: g.maker, plays: fmt(g.plays), fams: fmt(g.fams), size: size(g.bytes), feat: g.slot ? (g.slot <= 3 ? 'slot ' + g.slot : 'pinned, past the top 3') : 'no' });
    var c = g.cols && g.cols.length ? g.cols : ['#6d5efc', '#8b5cf6'];
    openPanel(esc(g.title), '<div class="coverbig" id="gcover" style="background-image:linear-gradient(135deg,' + esc(c[0]) + ',' + esc(c[1] || c[0]) + ')"></div>' + base + '<h3>Actions</h3><div class="acts">' + gameActs(g) + '</div>');
    if (g.status !== 'review') api('GET', '/api/admin/games/' + enc(g.id)).then(function(d){
      if (!P || P.id !== g.key) return;
      var cu = coverUrl(d.cover); if (cu) $('gcover').style.backgroundImage = cu;
      $('gmore').outerHTML = T('<dt>About</dt><dd>{about}</dd><dt>Plays all time</dt><dd>{all} by {fams} families · avg round {mins} min</dd><dt>Added</dt><dd>{added}</dd><dt>Approved</dt><dd>{ok}</dd>',
        { about: d.about || d.blurb || '–', all: fmt(d.plays.all), fams: fmt(d.plays.families), mins: d.plays.mins, added: dateOf(d.added), ok: d.approved ? ago(d.approved.at) + ' by ' + (d.approved.who || '') : 'starter, or put in by hand' });
    }, function(){});
  }

  /* ---------- the queue ---------- */
  var qstat = 'all', qdata = null;
  function drawQueue(){
    var d = qdata, c = d.counts;
    $('qchips').innerHTML = [['all', 'All', c.all], ['joins', 'Join requests', c.joins], ['games', 'Games', c.games]].map(function(x){ return T('<button class="chip{!on}" data-qchip="{k}">{l} <b>{n}</b></button>', { k: x[0], l: x[1], n: x[2], on: qstat === x[0] ? ' on' : '' }); }).join('');
    var items = d.items.filter(function(x){ return qstat === 'all' || (qstat === 'games' ? x.kind === 'game' : x.kind !== 'game'); });
    $('qfull').innerHTML = items.length ? items.map(qrow).join('') : '<div class="empty">' + (c.all ? 'Nothing of that kind.' : 'All caught up. New join requests and games show up here, and by the clock.') + '</div>';
    $('allowcard').hidden = !d.allowlist.length;
    $('allowcount').textContent = d.allowlist.length;
    $('allowlist').innerHTML = d.allowlist.map(function(x){ return esc(x.email) + ' <span class="id">' + (x.status === 'joined' ? 'joined' : x.sentAt ? 'emailed' : 'allowed') + '</span>'; }).join(' &nbsp;·&nbsp; ');
  }
  function loadQueue(){ return api('GET', '/api/admin/queue').then(function(d){ qdata = d; drawQueue(); }, function(e){ fail($('qfull'), e); }); }
  $('qchips').addEventListener('click', function(e){ var k = e.target.closest('[data-qchip]'); if (k && qdata){ qstat = k.dataset.qchip; drawQueue(); } });
  $('allowform').addEventListener('submit', function(ev){
    ev.preventDefault();
    var list = $('allow').value.split(/[\s,;]+/).filter(Boolean), msg = $('allowmsg'); if (!list.length) return;
    $('allowgo').disabled = true; msg.innerHTML = '';
    var lines = [];
    list.reduce(function(p, email){
      return p.then(function(){ return api('POST', '/api/beta/approve', { email: email }).then(function(r){
        lines.push(r.sent ? '<div class="msg ok">Allowed ' + esc(r.email) + ' and sent the download link.</div>' : '<div class="msg warn">Allowed ' + esc(r.email) + '. ' + esc(r.why || '') + ' Their link: ' + esc(r.link || '') + '</div>');
      }, function(e){ lines.push('<div class="msg bad">' + esc(email) + ': ' + esc(e.message) + '</div>'); }); });
    }, Promise.resolve()).then(function(){ msg.innerHTML = lines.join(''); $('allowgo').disabled = false; $('allow').value = ''; loadQueue(); loadHome(); });
  });

  /* ---------- activity ---------- */
  var LCH = [['all', 'All'], ['joins', 'Joins'], ['plays', 'First plays'], ['games', 'Games'], ['owner', 'Owner actions'], ['backup', 'Backups']];
  var L = { type: 'all', q: '', before: '', stack: [], n: 0, next: null };
  function loadLog(){
    var mine = ++L.n;
    $('lchips').innerHTML = LCH.map(function(c){ return T('<button class="chip{!on}" data-lchip="{k}">{l}</button>', { k: c[0], l: c[1], on: L.type === c[0] ? ' on' : '' }); }).join('');
    return api('GET', '/api/admin/activity' + qs({ type: L.type === 'all' ? '' : L.type, q: L.q, before: L.before, limit: 30 })).then(function(r){
      if (mine !== L.n) return;
      L.next = r.next;
      $('logfull').innerHTML = r.rows.length ? r.rows.map(lrow).join('') : '<li><span class="m sub">' + (L.q || L.type !== 'all' ? 'No matches.' : 'Nothing yet.') + '</span></li>';
      $('lpager').innerHTML = '<span>' + fmt(r.total) + ' event' + (r.total === 1 ? '' : 's') + (L.q || L.type !== 'all' ? ' match' : '') + '</span><span class="sp"></span><button data-lp="newer"' + (L.stack.length ? '' : ' disabled') + '>← Newer</button><button data-lp="older"' + (r.next ? '' : ' disabled') + '>Older →</button>';
    }, function(e){ fail($('logfull'), e); });
  }
  $('lchips').addEventListener('click', function(e){ var k = e.target.closest('[data-lchip]'); if (k){ L.type = k.dataset.lchip; L.before = ''; L.stack = []; loadLog(); } });
  $('lpager').addEventListener('click', function(e){
    var b = e.target.closest('[data-lp]'); if (!b || b.disabled) return;
    if (b.dataset.lp === 'older'){ L.stack.push(L.before); L.before = L.next; } else L.before = L.stack.pop() || '';
    loadLog();
  });
  $('lq').addEventListener('input', debounce(function(){ L.q = $('lq').value.trim(); L.before = ''; L.stack = []; loadLog(); }, 200));

  /* ---------- settings ---------- */
  var KINDS = { daily: 'Daily', update: 'Before an update', manual: 'Made by you', 'before-restore': 'Before a restore' };
  var UPDATE = { 'up to date': 'up to date', ready: 'a newer version is ready - it switches at a quiet moment', offline: 'couldn’t check just now', waiting: 'checking soon', off: 'this copy doesn’t update itself (the Windows app does)' };
  function set(k, v, right, extra){ return T('<div class="set"><span class="k">{k}</span><span>{!v}</span><span class="r">{!r}</span>{!x}</div>', { k: k, v: v, r: right || '', x: extra || '' }); }
  var code = function(s){ return '<code>' + esc(s) + '</code>'; };
  function drawSets(s, srv, o){
    var net = s.internet, mailBox;
    var smtp = s.mail.ready
      ? set('SMTP', code((s.mail.user || '') + (s.mail.host ? ' · ' + s.mail.host : '')) + '<br><small class="sub">' + (s.mail.error ? 'last send failed: ' + esc(s.mail.error) : s.mail.lastSent ? 'last sent ' + esc(ago(s.mail.lastSent)) : 'none sent since start') + '</small>',
          '<button class="btn ghost" data-act="mail-test">Send a test</button><button class="btn no" data-act="mail-off" data-sure="Turn off? Click again">Turn off</button>')
      : set('SMTP', '<span class="sub">Not set up. Without it, approving someone shows their download link for you to send, and heads-ups stay by the clock.</span>', '',
          '<form class="form" id="mailform"><input type="email" name="user" placeholder="you@gmail.com" required aria-label="Gmail address"><input type="password" name="pass" placeholder="App password (16 letters)" required aria-label="App password"><button class="btn">Save</button></form>');
    var backups = srv.backups.map(function(b){
      var what = [b.accounts != null ? b.accounts + ' account' + (b.accounts === 1 ? '' : 's') : '', b.profiles != null ? b.profiles + ' profile' + (b.profiles === 1 ? '' : 's') : '', b.games + ' game' + (b.games === 1 ? '' : 's'), size(b.bytes)].filter(Boolean).join(' · ');
      return set(stamp(b.at), esc(KINDS[b.reason] || b.reason) + ' · ' + esc(what), '<button class="btn ghost" data-act="restore" data-id="' + esc(b.id) + '" data-sure="Restore it? Click again">Restore&hellip;</button>');
    }).join('');
    $('setsbody').innerHTML =
      '<div class="card"><h2>Server</h2>' +
        '<div class="set" id="namerow"><span class="k">Name</span><span>' + code(s.name) + '</span><span class="r"><button class="btn ghost" data-act="rename">Rename</button></span></div>' +
        set('Version', code(s.version + ' · up ' + up(s.uptimeSecs)) + '<br><small class="sub">Updates: ' + esc(UPDATE[(srv.update || {}).state] || (srv.update || {}).state || '') + '</small>') +
        set('LAN', s.lan.length ? s.lan.map(code).join(' ') : '<span class="sub">no home network found</span>') +
        set('Internet (Funnel)', net.door === null ? '<span class="sub">The internet door is off.</span>' : code((net.publicUrl || 'no public address set') + ' → :' + net.door), net.door === null ? '<span class="tag off">off</span>' : '<span class="tag act">door open</span>') +
        set('Start with Windows', code(s.startWithWindows), '<span class="sub">change it from the tray icon</span>') +
        set('Data folder', code(s.dataDir)) + '</div>' +
      '<div class="card"><h2>Joining</h2>' +
        set('Mode', code(s.joining.mode) + '<br><small class="sub">' + (s.joining.approveJoins ? 'Emails on the allowlist are straight in; anyone else asks, and waits in the Queue.' : 'Emails on the allowlist are straight in; everyone else needs an invite code.') + (s.joining.awayJoins ? ' People on Tailscale join freely.' : '') + '</small>') +
        set('Game slots', code(s.defaultSlots), '<span class="sub">per family, for games made in Create (fixed)</span>') + '</div>' +
      '<div class="card"><h2>Heads-ups</h2>' + smtp + set('Email me on', code(s.heads.join(', ')), '<span class="sub">by the clock; and by email when SMTP is set up</span>') + '<div id="mailmsg"></div></div>' +
      '<div class="card"><h2>Backups</h2>' +
        set('Schedule', code('daily, at a quiet moment'), '<button class="btn ghost" data-act="backup-now">Back up now</button>', '<span class="sub" style="grid-column:2 / 4">Also before each update and each restore. Keeps ' + Object.keys(s.backups.keep).map(function(k){ return s.backups.keep[k] + ' ' + (KINDS[k] || k).toLowerCase(); }).join(', ') + '.</span>') +
        (backups || '<div class="empty">No backups yet.</div>') +
        (srv.restoring ? '<div class="msg warn">A restore is waiting: it happens as the server next starts.</div>' : '') + '<div id="bumsg"></div></div>';
    var mf = $('mailform');
    if (mf) mf.addEventListener('submit', function(ev){ ev.preventDefault(); api('POST', '/api/mail', { user: mf.user.value, pass: mf.pass.value }).then(function(){ toast('Email is set up.'); loadSets(); loadHome(); }, oops); });
  }
  function loadSets(){
    return Promise.all([api('GET', '/api/admin/settings'), api('GET', '/api/server'), overview ? Promise.resolve(overview) : api('GET', '/api/admin/overview')]).then(function(r){ if (!overview) overview = r[2]; drawSets(r[0], r[1], r[2]); }, function(e){ fail($('setsbody'), e); });
  }

  /* ---------- what the buttons do ---------- */
  function after(){ loadHome(); if (view === 'queue') loadQueue(); if (view === 'fams') fam.load(); if (view === 'games') games.load(); }
  var ACT = {
    reload: function(){ refresh(view); },
    'join-ok': function(b){ return api('POST', '/api/joins/' + enc(b.dataset.id) + '/approve').then(function(){ toast('Let in.'); after(); }); },
    'join-no': function(b){ return api('POST', '/api/joins/' + enc(b.dataset.id) + '/decline').then(function(){ toast('Declined.'); after(); }); },
    'beta-ok': function(b){ return api('POST', '/api/beta/approve', { email: b.dataset.email }).then(function(r){ toast(r.sent ? 'Allowed, and the download link is sent.' : 'Allowed. ' + (r.why || '') + ' Their link: ' + (r.link || '')); after(); }); },
    'beta-no': function(b){ return api('POST', '/api/beta/decline', { email: b.dataset.email }).then(function(){ toast('Declined.'); after(); }); },
    'game-try': function(){ toast('Try it in Orlis Play: Discover, Waiting for your OK, Try it. Play ' + TRY + ' seconds, and Publish comes on.'); },
    'game-publish': function(b){ b.textContent = 'Publishing…'; return api('POST', '/api/submissions/' + enc(b.dataset.id) + '/approve').then(function(){ toast('Published to Discover.'); closePanel(); after(); }, function(e){ b.textContent = 'Publish'; throw e; }); },
    'game-reject': function(b){
      var host = b.closest('.q') || b.closest('.acts');
      if (host.nextElementSibling && host.nextElementSibling.dataset.note) return;
      var box = document.createElement('div'); box.className = 'note'; box.dataset.note = '1';
      box.innerHTML = '<textarea maxlength="300" placeholder="A note for the maker: what to change, say (they’ll see it in Orlis Play)" aria-label="Note for the maker"></textarea><div><button class="btn no" data-act="game-reject-go" data-id="' + esc(b.dataset.id) + '">Reject it</button></div>';
      host.after(box); box.firstChild.focus();
    },
    'game-reject-go': function(b){ return api('POST', '/api/submissions/' + enc(b.dataset.id) + '/decline', { note: b.closest('.note').firstChild.value }).then(function(){ toast('Rejected.'); closePanel(); after(); }); },
    feature: function(b){ return api('POST', '/api/store/' + enc(b.dataset.id) + '/feature', { on: b.dataset.on === '1' }).then(function(){ toast(b.dataset.on === '1' ? 'Featured.' : 'Unfeatured.'); closePanel(); after(); }); },
    reach: function(b){ return api('POST', '/api/store/' + enc(b.dataset.id) + '/reach', { everyone: b.dataset.everyone === '1' }).then(function(){ toast(b.dataset.everyone === '1' ? 'Shared with everyone.' : 'Kept to its family.'); closePanel(); after(); }); },
    takeout: function(b){ return api('DELETE', '/api/store/' + enc(b.dataset.id)).then(function(){ toast('Taken out of Discover. It stays on any PC that already has it.'); closePanel(); after(); }); },
    'fam-ok': function(b){
      var list = ((P && P.data && P.data.accounts) || []).filter(function(a){ return a.waiting; });
      return Promise.all(list.map(function(a){ return api('POST', '/api/joins/' + enc(a.id) + '/approve'); })).then(function(){ toast('Let in.'); closePanel(); after(); });
    },
    'see-log': function(b){ $('lq').value = b.dataset.q; L.q = b.dataset.q; L.type = 'all'; L.before = ''; L.stack = []; go('log'); },
    role: function(b){
      return api('POST', '/api/accounts/' + enc(b.dataset.id) + '/role', { role: b.dataset.role }).then(function(){
        [].forEach.call(b.parentNode.children, function(x){ x.classList.toggle('on', x === b); }); var a = acctOf(b.dataset.id); if (a) a.role = b.dataset.role; toast('Now a ' + b.dataset.role + '.');
      });
    },
    'pw-open': function(b){ var box = document.querySelector('[data-pw="' + b.dataset.id + '"]'); box.hidden = !box.hidden; if (!box.hidden) box.firstChild.focus(); },
    'pw-rand': function(b){ document.querySelector('[data-pw="' + b.dataset.id + '"] input').value = randomPassword(); },
    'pw-set': function(b){
      var a = acctOf(b.dataset.id), input = document.querySelector('[data-pw="' + b.dataset.id + '"] input');
      if (input.value.length < 8){ toast('Passwords need at least 8 characters.', true); return; }
      return setPassword(a, input.value).then(function(){ toast('Password set for ' + a.email + ': ' + input.value + ' (every device signed in as them needs it)'); input.value = ''; });
    },
    'bulk-clear': function(){ fam.S.sel = {}; fam.load(); $('fbulkmsg').innerHTML = ''; },
    'bulk-pw': function(b){
      var todo = [];
      Object.keys(fam.S.sel).forEach(function(k){ fam.S.sel[k].accounts.forEach(function(a){ if (a.role !== 'owner') todo.push(a); }); });
      if (!todo.length){ toast('Nothing to change (your own account is left alone).'); return; }
      if (!b.dataset.ready){ b.dataset.ready = '1'; b.textContent = 'Set ' + todo.length + ' new passwords? Click again'; setTimeout(function(){ b.dataset.ready = ''; b.textContent = 'New passwords'; }, 4000); return; }
      b.dataset.ready = ''; b.textContent = 'New passwords';
      var lines = [];
      return todo.reduce(function(p, a){ var pw = randomPassword(); return p.then(function(){ return setPassword(a, pw).then(function(){ lines.push(a.email + '  ' + pw); }, function(e){ lines.push(a.email + '  (' + e.message + ')'); }); }); }, Promise.resolve()).then(function(){
        $('fbulkmsg').innerHTML = '<div class="msg ok">New passwords set - every device signed in as them needs it. Shown once:<pre class="pwlist" id="pwlist"></pre><button class="btn ghost sm" data-act="copy-pw">Copy</button></div>';
        $('pwlist').textContent = lines.join('\n');
      });
    },
    'copy-pw': function(){ var t = $('pwlist').textContent; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function(){ toast('Copied.'); }, function(){ toast('Select the text and copy it.', true); }); },
    rename: function(b){
      var row = $('namerow'); var cur = row.querySelector('code').textContent;
      row.innerHTML = '<span class="k">Name</span><form class="form" style="display:flex;gap:8px;grid-column:2 / 4" id="nameform"><input name="n" maxlength="40" value="" aria-label="Server name"><button class="btn">Save</button><button type="button" class="btn ghost" data-act="reload">Cancel</button></form>';
      var f = $('nameform'); f.n.value = cur; f.n.focus(); f.n.select();
      f.addEventListener('submit', function(ev){ ev.preventDefault(); if (!f.n.value.trim()) return; api('POST', '/api/server/name', { name: f.n.value }).then(function(){ toast('Renamed.'); loadSets(); loadHome(); }, oops); });
    },
    'mail-test': function(b){ b.textContent = 'Sending…'; return api('POST', '/api/mail/test').then(function(r){ b.textContent = 'Send a test'; toast('Sent a test to ' + r.to + '.'); loadSets(); loadHome(); }, function(e){ b.textContent = 'Send a test'; throw e; }); },
    'mail-off': function(){ return api('POST', '/api/mail', { user: '', pass: '' }).then(function(){ toast('Email is off.'); loadSets(); loadHome(); }); },
    'backup-now': function(b){ b.textContent = 'Backing up…'; return api('POST', '/api/backups').then(function(){ toast('Backed up.'); loadSets(); loadHome(); }, function(e){ b.textContent = 'Back up now'; throw e; }); },
    restore: function(b){
      return api('POST', '/api/backups/' + enc(b.dataset.id) + '/restore').then(function(r){
        $('bumsg').innerHTML = '<div class="msg warn">' + (r.restarting ? 'Restoring: the server restarts in a moment with the data as it was then. What it had just now is kept as a backup too.' : 'This restore happens the next time the server starts.') + '</div>';
        if (r.restarting) setTimeout(function(){ refresh(view); }, 6000);
      });
    }
  };
  document.addEventListener('click', function(e){
    var go_ = e.target.closest('[data-go]'); if (go_){ go(go_.dataset.go); return; }
    var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    var fn = ACT[b.dataset.act]; if (!fn) return;
    if (!armed(b)) return;
    var r; try { r = fn(b); } catch (err){ oops(err); return; }
    if (r && r.then) r.then(null, oops);
  });
  var topg = $('topg');
  topg.addEventListener('click', function(e){
    var tr = e.target.closest('tr[data-g]'); if (!tr) return;
    api('GET', '/api/admin/games' + qs({ q: tr.dataset.g, per: 100 })).then(function(r){ var g = r.rows.filter(function(x){ return x.id === tr.dataset.g && x.status !== 'review'; })[0]; if (g){ featuredTotal = r.featuredTotal; openGame(g); } else toast('That one isn’t in the Store (it’s one of the app’s own).'); }, oops);
  });
  $('pclose').addEventListener('click', closePanel);
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') closePanel();
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)){ var v = document.querySelector('section[data-v]:not([hidden]) .search input'); if (v){ e.preventDefault(); v.focus(); } }
  });
  var nav = document.querySelector('aside');
  nav.addEventListener('click', function(e){ var a = e.target.closest('a[data-t]'); if (a) go(a.dataset.t); });
  nav.addEventListener('keydown', function(e){ var a = e.target.closest('a[data-t]'); if (a && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); go(a.dataset.t); } });

  /* ---------- start ---------- */
  if (!key){
    document.getElementById('main').innerHTML = '<div class="card"><div class="empty">Open this page from the Orlis icon by the clock:<br>right-click it, then <b>Manage Orlis Server</b>.</div></div>';
    return;
  }
  go(view);
  if (view !== 'home') loadHome();
  /* (the numbers in the side and the Overview stay fresh: every half minute, while it's in view) */
  setInterval(function(){ if (!document.hidden){ loadHome(); if (view === 'queue') loadQueue(); } }, 30000);
})();
`;

export function managePage(){
  const fonts = `@font-face{ font-family:"Outfit"; font-weight:300 500; font-style:normal; font-display:swap; src:url(data:font/woff2;base64,${OUTFIT_REGULAR}) format("woff2") }
@font-face{ font-family:"Outfit"; font-weight:600 800; font-style:normal; font-display:swap; src:url(data:font/woff2;base64,${OUTFIT_BOLD}) format("woff2") }`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Orlis Server</title>
<style>${fonts}${CSS}</style></head>
<body>${BODY}<script>var TRY = ${TRY_SECS};${SCRIPT}</script>
</body></html>`;
}
