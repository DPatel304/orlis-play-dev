/* Prints the summary tables (Markdown) from docs/playtest/results.json:  node tools/playtest.mjs --tables */
const med = (a) => { const b = a.filter(x => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const mean = (a) => { const b = a.filter(x => x != null && Number.isFinite(x)); return b.length ? b.reduce((s, x) => s + x, 0) / b.length : null; };
const f = (v, d = 0) => v == null ? '-' : (Math.round(v * 10 ** d) / 10 ** d).toString();
export const LU = { '1c': '1 child', '1a': '1 adult', '4c': '4 children', '4m': '2 adults + 2 children' };
export const ORDER = ['pop-party', 'sky-painter', 'sleepy-bear', 'leaf-pile', 'stack-it-high', 'animal-gym', 'keep-it-up', 'ptero-flight', 'save-the-harvest', 'cubions-long-way-home'];

export function cells(runs, game, lu){
  const rs = runs.filter(r => r.game === game && r.lineup === lu && !r.error);
  if (!rs.length) return null;
  const kids = (r) => r.players.filter(p => p.who === 'child'), ads = (r) => r.players.filter(p => p.who === 'adult');
  return {
    n: rs.length,
    perMin: med(rs.map(r => mean(r.players.map(p => p.perMin)))),
    childPerMin: med(rs.map(r => mean(kids(r).map(p => p.perMin)))),
    adultPerMin: med(rs.map(r => mean(ads(r).map(p => p.perMin)))),
    ratio: med(rs.map(r => { const a = mean(ads(r).map(p => p.score)), c = mean(kids(r).map(p => p.score)); return a > 0 && c != null ? c / a : null; })),
    noPts: med(rs.map(r => Math.max(...r.players.map(p => p.longestNoPoints)))),
    off: med(rs.map(r => Math.max(...r.players.map(p => p.longestOffTarget)))),
    on: med(rs.map(r => mean(r.players.map(p => p.onShare)))),
    secs: med(rs.map(r => r.roundSecs)),
    first: med(rs.map(r => mean(r.players.map(p => p.firstPoint)))),
    ties: rs.filter(r => r.topTied).length,
    never: rs.filter(r => r.issues.neverEnded).length,
    nonf: rs.filter(r => r.issues.nonFinite).length,
    down: rs.filter(r => r.issues.scoreWentDown).length,
    notIn: rs.filter(r => r.issues.anyoneNeverJoined).length,
    rs
  };
}

export function tables(data){
  const runs = data.runs.filter(r => r.mode === 'assist');
  console.log('| Game | Line-up | Score/min each (median) | Child / adult score ratio | Longest stretch with no points (s) | Longest stretch off target (s) | On target % | Round (s) |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const g of ORDER) for (const lu of Object.keys(LU)){
    const c = cells(runs, g, lu); if (!c) continue;
    const pm = lu === '4m' ? `child ${f(c.childPerMin)} / adult ${f(c.adultPerMin)}` : f(c.perMin);
    console.log(`| ${g} | ${LU[lu]} | ${pm} | ${lu === '4m' ? f(c.ratio, 2) : '-'} | ${f(c.noPts)} | ${f(c.off)} | ${f(c.on * 100)} | ${f(c.secs)} |`);
  }
  if (data.calibration){
    console.log('\nCalibration (how big a move has to be to count)');
    console.log('| Who | Move | ~cm | counted |'); console.log('|---|---|---|---|');
    for (const r of data.calibration) console.log(`| ${r.kind} | ${r.move} | ${r.approxCm} | ${f(r.rate * 100)}% |`);
  }
  if (data.admission && data.admission.length){
    console.log('\nWho the tracker lets in (40 s standing in view)');
    for (const cap of [2, 4]) for (const lu of Object.keys(LU)){
      const rs = data.admission.filter(a => a.cap === cap && a.lineup === lu);
      if (rs.length) console.log(`cap ${cap}, ${LU[lu]}: in at the end ${rs.map(a => a.inAtEnd + '/' + a.of).join(' ')}; child size vs biggest ${rs.map(a => a.people.filter(p => p.who === 'child').map(p => p.sizeRatio).join('/')).join(' | ')}`);
    }
  }
}
