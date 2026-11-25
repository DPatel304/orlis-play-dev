/* Playtest 2: prints Markdown tables from docs/playtest2/results.json, next to docs/playtest/results.json (the last pass), so what got better or worse shows.

     cd app && node tools/playtest2-compare.mjs [new results (../docs/playtest2/results.json)] [old results (../docs/playtest/results.json)]
   Medians of 3 seeds. "assist" runs: everyone is let in, so the game itself is judged; "real": the tracker's admission rules decide who plays. */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const [a, b] = [process.argv[2] || '../../docs/playtest2/results.json', process.argv[3] || '../../docs/playtest/results.json'];
const NEW = JSON.parse(readFileSync(resolve(HERE, a), 'utf8')), OLD = JSON.parse(readFileSync(resolve(HERE, b), 'utf8'));
const med = (x) => { const v = x.filter(n => n != null && Number.isFinite(n)).sort((p, q) => p - q); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const mean = (x) => { const v = x.filter(n => n != null && Number.isFinite(n)); return v.length ? v.reduce((s, n) => s + n, 0) / v.length : null; };
const f = (v, d = 0) => v == null ? '-' : String(Math.round(v * 10 ** d) / 10 ** d);
const LU = { '1c': '1 child', '1a': '1 adult', '4c': '4 children', '4m': 'family' };
const GAMES = ['pop-party', 'sky-painter', 'sleepy-bear', 'leaf-pile', 'stack-it-high', 'animal-gym', 'keep-it-up', 'ptero-flight', 'save-the-harvest', 'cubions-long-way-home', 'made-collect', 'made-dodge', 'made-keepup', 'made-stack', 'castle-defense', 'last-known-position', 'peekaboo'];
const pick = (d, g, lu, mode = 'assist', cap = 4) => d.runs.filter(r => r.game === g && r.lineup === lu && r.mode === mode && r.cap === cap && !r.error);
const kids = (r) => r.players.filter(p => p.who === 'child'), ads = (r) => r.players.filter(p => p.who === 'adult');
const stat = (rs) => rs.length ? {
  n: rs.length, perMin: med(rs.map(r => mean(r.players.map(p => p.perMin)))), noPts: med(rs.map(r => Math.max(...r.players.map(p => p.longestNoPoints)))), secs: med(rs.map(r => r.roundSecs)),
  on: med(rs.map(r => mean(r.players.map(p => p.onShare)))), never: rs.filter(r => r.issues && r.issues.neverEnded).length,
  ratio: med(rs.map(r => { const ad = mean(ads(r).map(p => p.score)), ch = mean(kids(r).map(p => p.score)); return ad > 0 && ch != null ? ch / ad : null; })),
  kidIn: med(rs.map(r => mean(kids(r).map(p => p.presentShare)))), nonf: rs.filter(r => r.issues && r.issues.nonFinite).length, down: rs.filter(r => r.issues && r.issues.scoreWentDown).length,
  absent: rs.filter(r => r.issues && r.issues.scoreWhileAbsent).length
} : null;

console.log('## Score, dead stretches, round length (assist runs: everybody let in)\n');
console.log('| Game | Line-up | Score/min before > now | Longest no points (s) before > now | On target % before > now | Round (s) before > now | Never ended |');
console.log('|---|---|---|---|---|---|---|');
for (const g of GAMES) for (const lu of Object.keys(LU)){
  const n = stat(pick(NEW, g, lu)), o = stat(pick(OLD, g, lu)); if (!n) continue;
  console.log(`| ${g} | ${LU[lu]} | ${o ? f(o.perMin) : 'new'} > ${f(n.perMin)} | ${o ? f(o.noPts) : 'new'} > ${f(n.noPts)} | ${o ? f(o.on * 100) : 'new'} > ${f(n.on * 100)} | ${o ? f(o.secs) : 'new'} > ${f(n.secs)} | ${o ? o.never : '-'} > ${n.never} |`);
}
console.log('\n## Family (2 adults + 2 children): a child\'s score as a share of an adult\'s, and how much of the round the children were players\n');
console.log('| Game | Child / adult score (assist) before > now | Child / adult (real rules) now | Children playing, real rules, cap 4 before > now | Children playing, real rules, cap 2 now |');
console.log('|---|---|---|---|---|');
for (const g of GAMES){
  const n = stat(pick(NEW, g, '4m')), o = stat(pick(OLD, g, '4m')); if (!n) continue;
  const nr = stat(pick(NEW, g, '4m', 'real')), or = stat(pick(OLD, g, '4m', 'real')), n2 = stat(pick(NEW, g, '4m', 'real', 2));
  console.log(`| ${g} | ${o ? f(o.ratio, 2) : 'new'} > ${f(n.ratio, 2)} | ${nr ? f(nr.ratio, 2) : '-'} | ${or ? f(or.kidIn * 100) : '-'}% > ${nr ? f(nr.kidIn * 100) : '-'}% | ${n2 ? f(n2.kidIn * 100) : '-'}% |`);
}
console.log('\n## Checks over all runs\n');
const all = NEW.runs.filter(r => !r.error);
console.log(`runs: ${all.length}; errors: ${NEW.runs.length - all.length}; NaN or infinite: ${all.filter(r => r.issues.nonFinite).length}; a score that went down: ${all.filter(r => r.issues.scoreWentDown).length}; points for a place nobody stands in: ${all.filter(r => r.issues.scoreWhileAbsent).length}; rounds that never ended (cap): ${all.filter(r => r.issues.neverEnded).length}`);
for (const r of all.filter(r => r.issues.neverEnded)) console.log(`- never ended: ${r.game} ${r.lineup} seed ${r.seed} ${r.mode} cap ${r.cap} (stopped at ${f(r.roundSecs)} s)`);
for (const r of all.filter(r => r.issues.nonFinite)) console.log(`- not finite: ${r.game} ${r.lineup} seed ${r.seed}: ${r.issues.nonFinite}`);
for (const r of all.filter(r => r.issues.scoreWhileAbsent)) console.log(`- points while absent: ${r.game} ${r.lineup} seed ${r.seed} ${r.mode} cap ${r.cap}`);
console.log('\n## Glow orbs with 4 players (assist runs; 4 children and the family; per game, over 6 rounds)\n');
console.log('| Game | Orbs at once | Share of orb time under the shell\'s areas | Share of time two players\' orbs were within 4% of the screen height | Closest two orbs (px at 1920) | Same colour | Sparks and rings still on screen when the round ended (most) |');
console.log('|---|---|---|---|---|---|---|');
for (const g of GAMES){
  const rs = NEW.runs.filter(r => r.game === g && r.mode === 'assist' && (r.lineup === '4m' || r.lineup === '4c') && r.orbs); if (!rs.length) continue;
  const o = rs.map(r => r.orbs), gap = Math.min(...o.map(x => x.minGapPx == null ? 1e9 : x.minGapPx));
  console.log(`| ${g} | ${Math.max(...o.map(x => x.maxOrbs))} | ${f(mean(o.map(x => x.underHud / Math.max(1, x.orbFrames))) * 100)}% | ${f(mean(o.map(x => x.tooClose / Math.max(1, x.samples))) * 100)}% | ${gap > 1e8 ? '-' : f(gap, 1)} | ${o.reduce((s, x) => s + x.colourClash, 0)} | ${Math.max(...o.map(x => x.burstsAtOver == null ? 0 : x.burstsAtOver))} |`);
}
const mp = (g) => NEW.runs.filter(r => r.game === g && r.mode === 'assist' && r.game_ && r.game_.reachableShareByPerson);
console.log('\n## Created games: how much of a thing\'s time on screen a body could reach it (assist runs)\n');
console.log('| Game | Line-up | Reachable share, child | Reachable share, adult | Time under the shell\'s areas | Things nobody could reach |');
console.log('|---|---|---|---|---|---|');
for (const g of ['made-collect', 'made-dodge', 'made-stack']) for (const lu of Object.keys(LU)){
  const rs = mp(g).filter(r => r.lineup === lu); if (!rs.length) continue;
  const sh = (who) => med(rs.map(r => mean(r.game_.reachableShareByPerson.filter(p => p.who === who).map(p => p.share))));
  console.log(`| ${g} | ${LU[lu]} | ${f(sh('child') * 100)}% | ${f(sh('adult') * 100)}% | ${f(med(rs.map(r => r.game_.underHudShare)) * 100)}% | ${f(mean(rs.map(r => r.game_.neverReachableByAnyone)), 1)} |`);
}
