// Builds docs/decisions.html: every decision record on one page, newest first, in plain words, plus links to the mockups.
// Run: node tools/decisions-page.mjs   (re-run whenever a record or a mockup link changes)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const dir = new URL('../docs/decisions/', import.meta.url);
const MOCKUPS = [
  ['UI kit (colours, HUD pieces, home, pause, results, phones)', 'https://claude.ai/artifact/PM65z23jr5BDBPrp5kAc1L'],
  ['HUD grid: anchors and docks', 'https://claude.ai/artifact/Xf2sV5sProE7sbeP4rigBQ'],
  ['Clock and player pill options', 'https://claude.ai/artifact/7AbG9QPYwZtMmdRy2nhSWg'],
  ['Cube-headed avatars (sketches)', 'https://claude.ai/artifact/WeYMRAhPUyVbPfrFLgP1Tx'],
  ['Hand mode for the home screen', 'https://claude.ai/artifact/JpqtM4eGRUL1un8kYN21Mg'],
  ['Peekaboo Garden design', 'https://claude.ai/artifact/3FkbPkANwpoojigxvTj1t6'],
  ['UI review (screenshots and findings)', 'https://claude.ai/artifact/FPM7dmEB8hKR6LaSaDRPrK'],
  ['Pop Party 3D lab (private)', 'https://claude.ai/artifact/UAy4sp9A9AvMeg7Ne3QgFS'],
  ['Shapes and skins demo (private)', 'https://claude.ai/artifact/4pk4PJUCMSAZdQT4rT8hmD'],
];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
const recs = readdirSync(dir).filter(f => /^\d{4}-.*\.md$/.test(f)).map(f => {
  const t = readFileSync(new URL(f, dir), 'utf8');
  const title = (t.match(/^#\s*\d{4}:\s*(.+)$/m) || [])[1] || f;
  const status = ((t.match(/^Status:\s*(.+)$/m) || [])[1] || '').trim();
  const secs = {}; let cur = null;
  for (const line of t.split('\n')){ const h = line.match(/^##\s+(.+)$/); if (h){ cur = h[1].trim(); secs[cur] = []; } else if (cur) secs[cur].push(line); }
  const block = (name) => (secs[name] || []).join('\n').trim();
  const dec = block(Object.keys(secs).find(k => /^Decision/.test(k)) || '');
  const later = Object.keys(secs).filter(k => /^(Update|Owner)/.test(k)).map(k => [k, block(k)]);
  return { n: f.slice(0, 4), file: f, title, status, dec, later };
}).sort((a, b) => b.n.localeCompare(a.n));
const kind = (s) => /^Superseded/i.test(s) ? 'old' : /^Proposed/i.test(s) ? 'prop' : /^Open/i.test(s) ? 'open' : 'ok';
const lines = (txt) => { const out = []; for (const raw of txt.split('\n')){ const l = raw.trim(); if (!l) continue; if (/^([-*]|\d+\.)\s+/.test(l) || !out.length) out.push(l.replace(/^[-*]\s+/, '')); else out[out.length - 1] += ' ' + l; } return out; };
const card = (r) => `<details class="rec ${kind(r.status)}" ${kind(r.status) === 'old' ? '' : 'open'}><summary><span class="n">${r.n}</span><span class="t">${md(r.title)}</span><span class="st">${esc(r.status.split('(')[0].trim())}</span></summary>
  ${r.status.includes('(') ? `<p class="note">${esc(r.status)}</p>` : ''}
  <ul>${lines(r.dec).slice(0, 8).map(l => `<li>${md(l)}</li>`).join('')}</ul>
  ${r.later.map(([k, v]) => `<p class="up"><b>${esc(k)}:</b> ${md(lines(v).join(' '))}</p>`).join('')}
  <p class="src"><a href="https://github.com/DPatel304/hello-world/blob/main/docs/decisions/${r.file}">The full record on GitHub</a></p></details>`;
const html = `<title>Orlis Decisions</title>
<style>
:root{ --paper:#faf6ec; --card:#fffdf8; --ink:#2f2b45; --soft:#6b6680; --line:#e6dcc7; --ok:#2f9e6b; --prop:#c27a12; --open:#5b5fc7; --old:#9a96a8; color-scheme:light; }
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){ --paper:#17161d; --card:#211f29; --ink:#ecebf3; --soft:#a7a3bd; --line:#34313f; color-scheme:dark; } }
:root[data-theme="dark"]{ --paper:#17161d; --card:#211f29; --ink:#ecebf3; --soft:#a7a3bd; --line:#34313f; color-scheme:dark; }
*{ box-sizing:border-box; } body{ margin:0; background:var(--paper); color:var(--ink); font:15px/1.5 'Inter',system-ui,-apple-system,'Segoe UI',sans-serif; }
main{ max-width:920px; margin:0 auto; padding:24px 16px 60px; } h1{ margin:0 0 4px; font-size:28px; } h2{ font-size:19px; margin:26px 0 8px; } .sub{ color:var(--soft); margin:0 0 14px; }
.filters{ display:flex; gap:8px; flex-wrap:wrap; margin:0 0 12px; } .filters button{ font:600 13px inherit; font-family:inherit; padding:7px 13px; border-radius:999px; border:1px solid var(--line); background:var(--card); color:var(--ink); cursor:pointer; } .filters button[aria-pressed="true"]{ background:var(--ink); color:var(--paper); }
.filters button:focus-visible, summary:focus-visible, a:focus-visible{ outline:3px solid #3da9ff; outline-offset:2px; }
.rec{ background:var(--card); border:1px solid var(--line); border-left:6px solid var(--k); border-radius:14px; padding:10px 16px; margin:0 0 10px; }
.rec.ok{ --k:var(--ok); } .rec.prop{ --k:var(--prop); } .rec.open{ --k:var(--open); } .rec.old{ --k:var(--old); opacity:.75; }
summary{ display:flex; gap:10px; align-items:baseline; cursor:pointer; list-style:none; } summary::-webkit-details-marker{ display:none; }
.n{ font-weight:700; color:var(--soft); font-variant-numeric:tabular-nums; } .t{ font-weight:700; flex:1; } .st{ font-size:12px; font-weight:700; color:#fff; background:var(--k); padding:2px 9px; border-radius:999px; white-space:nowrap; }
ul{ margin:8px 0; padding-left:20px; } li{ margin:3px 0; } .note,.up{ color:var(--soft); margin:6px 0; font-size:14px; } .src{ margin:6px 0 2px; font-size:13px; } a{ color:#2c6fb0; } code{ font-size:13px; }
.links{ display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:8px; } .links a{ display:block; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:10px 14px; text-decoration:none; color:var(--ink); font-weight:600; }
</style>
<main><h1>Orlis decisions</h1>
<p class="sub">Every decision in plain words, newest first. Green: decided. Amber: proposed, waiting for you. Blue: open question. Grey: replaced by a later one. Built from <code>docs/decisions/</code> on ${new Date().toISOString().slice(0, 10)}.</p>
<h2>Mockups and demos</h2><div class="links">${MOCKUPS.map(([t, u]) => `<a href="${u}">${esc(t)}</a>`).join('')}</div>
<h2>Decisions</h2>
<div class="filters"><button data-f="all" aria-pressed="true">All</button><button data-f="prop" aria-pressed="false">Waiting for you</button><button data-f="ok" aria-pressed="false">Decided</button><button data-f="old" aria-pressed="false">Replaced</button></div>
${recs.map(card).join('\n')}
</main>
<script>document.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { const f = b.dataset.f; document.querySelectorAll('[data-f]').forEach(x => x.setAttribute('aria-pressed', x === b)); document.querySelectorAll('.rec').forEach(r => { r.style.display = f === 'all' || r.classList.contains(f) || (f === 'prop' && r.classList.contains('open')) ? '' : 'none'; }); }));</script>`;
writeFileSync(new URL('../docs/decisions.html', import.meta.url), html);
console.log('wrote docs/decisions.html with', recs.length, 'records');
