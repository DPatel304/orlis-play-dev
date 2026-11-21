import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate, OUT } from '../kit/build-creator.mjs';
import { writeOrlis } from '../src/ui/orlis-file.js';
import { newGame, check, build, pack, idOf, FORBIDDEN, DRAWING, COLOUR } from '../src/ui/creator-kit.js';
import { FORBIDDEN as SERVER_FORBIDDEN, DRAWING as SERVER_DRAWING, COLOUR as SERVER_COLOUR, checkGame } from '../../server/src/submissions.js';

test('the kit in the app is built from kit/creator as it is now', async () => {
  assert.equal(readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n'), await generate(), 'run: node kit/build-creator.mjs');
});

test("the app's checks and the server's are the same list", () => {
  assert.deepEqual(FORBIDDEN, SERVER_FORBIDDEN);
  for (const h of ['check.ps1', 'guard.ps1']){
    const ps = newGame({ name: 'x y' }).files['.claude/hooks/' + h];
    for (const [w] of FORBIDDEN) assert.ok(ps.includes(`@('${w.replace(/'/g, "''")}'`), `${h} checks ${w} too`);
  }
});

test('colours come from the palette by name: a raw code fails in the app, the server and the hooks; a palette name passes', async () => {
  assert.deepEqual(COLOUR, SERVER_COLOUR, 'the app and the server have the same colour rule');
  const g = newGame({ name: 'Star Catch' }), man = g.files['orlis.json'];
  const raw = (code) => g.files['game.js'].replace('"touch.sunflower"', JSON.stringify(code));
  assert.deepEqual(check({ game: g.files['game.js'], manifest: man }), [], 'the starter uses palette names');
  for (const code of ['#ff9a55', '#F90', '#ff9a5580', 'rgb(1,2,3)', 'rgba(1, 2, 3, .5)', 'hsl(10 50% 50%)'])
    assert.match(check({ game: raw(code), manifest: man }).join(), /Use a colour from the palette: assets\.color\('touch\.mint'\)/, code);
  assert.deepEqual(check({ game: g.files['game.js'].replace('"touch.sunflower"', '"touch.mint"'), manifest: man }), []);
  assert.deepEqual(check({ game: raw('red'), manifest: man }), [], 'the plain colour words are names, not codes');
  /* the server, on a packed game (the runtime in front has colour codes of its own: only the game's part is looked at) */
  const good = await pack({ game: g.files['game.js'], manifest: man });
  assert.doesNotThrow(() => checkGame(Buffer.from(good.bytes)), 'a palette-name game passes the server');
  const { code } = build({ game: g.files['game.js'], manifest: man });
  const tampered = await writeOrlis({ 'manifest.json': JSON.stringify(good.manifest, null, 2), 'game.js': code.replace('"touch.sunflower"', '"#ff9a55"') });
  assert.throws(() => checkGame(Buffer.from(tampered)), /Use a colour from the palette: assets\.color\('touch\.mint'\)/, 'a raw colour fails the server');
  const ps = newGame({ name: 'x y' }).files;
  for (const h of ['check.ps1', 'guard.ps1']) assert.ok(ps['.claude/hooks/' + h].includes(COLOUR.pattern.replace(/'/g, "''")), `${h} has the colour rule`);
});

test('a new game: the starter, its orlis.json, the rules and the guardrails', () => {
  const g = newGame({ name: 'Bird Hoops!', idea: 'Flap your arms to fly a bird through hoops' });
  assert.match(g.id, /^bird-hoops-[a-z2-9]{4}$/, 'the name, and a tag of its own');
  assert.notEqual(newGame({ name: 'Bird Hoops!' }).id, g.id, 'two creators making a Bird Hoops never clash');
  assert.deepEqual(Object.keys(g.files).sort(), ['.claude/hooks/check.ps1', '.claude/hooks/guard.ps1', '.claude/hooks/prompt.ps1', '.claude/settings.json', '.claude/skills/orlis-game/SKILL.md', 'CLAUDE.md', 'game.js', 'orlis.json']);
  const m = JSON.parse(g.files['orlis.json']);
  assert.deepEqual([m.id, m.name, m.blurb, m.version], [g.id, 'Bird Hoops!', 'Flap your arms to fly a bird through hoops', '0.1']);
  assert.match(g.files['CLAUDE.md'], /^# Bird Hoops!: an Orlis Play game/);
  assert.match(g.files['CLAUDE.md'], /The idea: Flap your arms/);
  assert.ok(!Object.values(g.files).some(t => /\{\{\w+\}\}/.test(t)), 'nothing left to fill in');
  assert.match(g.files['.claude/skills/orlis-game/SKILL.md'], /^---\nname: orlis-game\ndescription: /);
  assert.ok(g.files['CLAUDE.md'].split('\n').length < 200, 'CLAUDE.md under 200 lines');
});

test("Claude Code's settings: no web, no commands, edits only to the game's two files, the guard and the checks", () => {
  const st = JSON.parse(newGame({ name: 'x y' }).files['.claude/settings.json']);
  for (const d of ['Bash', 'WebFetch', 'WebSearch', 'Edit(./CLAUDE.md)', 'Edit(./.claude/**)']) assert.ok(st.permissions.deny.includes(d), d);
  assert.deepEqual(st.permissions.allow.filter(a => a.startsWith('Edit')), ['Edit(./game.js)', 'Edit(./orlis.json)']);
  const pre = st.hooks.PreToolUse[0], post = st.hooks.PostToolUse[0];
  assert.equal(pre.matcher, '*', 'the guard is asked about every tool');
  assert.equal(st.permissions.disableBypassPermissionsMode, 'disable', 'no switching the permissions off');
  assert.equal(st.enableAllProjectMcpServers, false);
  assert.equal(pre.hooks[0].onFailure, 'block', 'a guard that fails says no');
  assert.ok(pre.hooks[0].args.at(-1).endsWith('/.claude/hooks/guard.ps1'));
  assert.ok(post.hooks[0].args.at(-1).endsWith('/.claude/hooks/check.ps1'));
  assert.equal(pre.hooks[0].command, 'powershell.exe', "Windows' own PowerShell: nothing to install");
  const ask = st.hooks.UserPromptSubmit[0].hooks[0];
  assert.ok(ask.args.at(-1).endsWith('/.claude/hooks/prompt.ps1'), 'every message is looked at first');
  const files = newGame({ name: 'x y' }).files;
  for (const h of ['guard.ps1', 'check.ps1', 'prompt.ps1']) assert.ok(files['.claude/hooks/' + h].includes("'kill', 'kills'"), `${h} has the words list`);
});

test('the checks: the starter passes; reaching for the internet, a broken orlis.json and the like do not', () => {
  const g = newGame({ name: 'Star Catch' });
  assert.deepEqual(check({ game: g.files['game.js'], manifest: g.files['orlis.json'] }), []);
  assert.match(check({ game: 'fetch("x"); Orlis.run({})', manifest: g.files['orlis.json'] }).join(), /the internet/);
  assert.match(check({ game: 'import x from "y"; Orlis.run({})', manifest: g.files['orlis.json'] }).join(), /no import or export/);
  assert.match(check({ game: g.files['game.js'], manifest: '{ "id": "a", // no\n }' }).join(), /not valid JSON/);
  assert.match(check({ game: g.files['game.js'], manifest: { ...JSON.parse(g.files['orlis.json']), icon: { glyph: '<a href="x">' } } }).join(), /simple shapes/);
  const withCover = (cover) => check({ game: g.files['game.js'], manifest: { ...JSON.parse(g.files['orlis.json']), cover } }).join();
  assert.equal(withCover(''), '', 'no cover yet is fine');
  assert.equal(withCover('<svg viewBox="0 0 160 100"><circle cx="80" cy="50" r="30" fill="#f90"/></svg>'), '', 'a cover in shapes is fine');
  assert.match(withCover('<svg><text>Hi</text></svg>'), /no words/);
  assert.match(withCover('<svg><image href="x"/></svg>'), /shapes only/);
  assert.match(withCover('just words'), /must be an SVG/);
  assert.equal(idOf('  ¡Hola, Mundo!  '), 'hola-mundo');
  assert.equal(idOf('A'), 'game-a');
});

test('packed, a new game is one the family\'s server takes', async () => {
  const g = newGame({ name: 'Bird Hoops', idea: 'Flap to fly' });
  const { bytes, manifest } = await pack({ game: g.files['game.js'], manifest: g.files['orlis.json'] });
  assert.equal(manifest.kit, 2);
  const { manifest: m, parts } = checkGame(Buffer.from(bytes));
  assert.deepEqual([m.id, m.name, m.version, m.blurb], [g.id, 'Bird Hoops', '0.1', 'Flap to fly']);
  const code = parts['game.js'].toString();
  assert.ok(code.includes(`Orlis.manifest={"id":"${g.id}"`));
  assert.ok(code.indexOf('globalThis.Orlis') < code.indexOf('Star Catch') || code.includes('Orlis.run'), 'the runtime first, then the game');
  await assert.rejects(pack({ game: 'fetch(1)', manifest: g.files['orlis.json'] }), /the internet/);
});

test('a new game can start from another: its code and its look, a new id and version, and Claude told', async () => {
  const { newGame: make, unpack, guardrails } = await import('../src/ui/creator-kit.js');
  const first = make({ name: 'Bird Hoops', idea: 'Flap to fly' });
  const m0 = JSON.parse(first.files['orlis.json']);
  const { POP } = await import('../src/games/play/examples.js');
  const game = '/* balloons */\nOrlis.play(' + JSON.stringify(POP) + ');\n';
  const { bytes } = await pack({ game, manifest: { ...m0, tags: ['Flying'], icon: { cols: ['#111111', '#222222'], glyph: '<circle cx="50" cy="50" r="20" fill="#fff"/>' }, by: 'Max', version: '0.4' } });
  /* (as the Store hands it back: the runtime in front, then the game) */
  const { parts, manifest } = checkGame(Buffer.from(bytes));
  const code = unpack(parts['game.js'].toString());
  assert.equal(code, game, 'the game\'s own code, without the runtime');
  assert.equal(unpack('just some code'), null, 'not made in Create: nothing');
  const copy = make({ name: 'Bird Hoops', idea: 'Hoops at night', from: { name: 'Bird Hoops', game: code, manifest }, taken: ['bird-hoops'] });
  const m = JSON.parse(copy.files['orlis.json']);
  assert.ok(copy.id.startsWith('bird-hoops-') && copy.id !== 'bird-hoops', 'a new id, not the one it came from');
  assert.deepEqual([m.id, m.version, m.blurb, m.by, m.tags], [copy.id, '0.1', 'Hoops at night', undefined, ['Flying']]);
  assert.equal(m.icon.cols[0], '#111111', 'it keeps the look');
  assert.equal(copy.files['game.js'], game);
  assert.match(copy.files['CLAUDE.md'], /starts as a copy of Bird Hoops/);
  assert.deepEqual(check({ game: copy.files['game.js'], manifest: copy.files['orlis.json'] }), []);
  assert.deepEqual(Object.keys(guardrails()).sort(), ['.claude/hooks/check.ps1', '.claude/hooks/guard.ps1', '.claude/hooks/prompt.ps1', '.claude/settings.json', '.claude/skills/orlis-game/SKILL.md']);
});

test("words that aren't for children: the app's list is the server's, checked before sending and on screen", async () => {
  const { WORDS: SERVER_WORDS } = await import('../../server/src/words.js');
  const { clean, badWords } = await import('../kit/creator/words.js');
  const { WORDS, RUNTIME } = await import('../src/ui/creator-kit.gen.js');
  assert.deepEqual(WORDS, SERVER_WORDS, 'one list: change server/src/words.js and kit/creator/words.json together');
  assert.deepEqual(badWords(RUNTIME), [], 'the runtime carries the list as codes, not words');
  const g = newGame({ name: 'Star Catch' });
  assert.match(check({ game: g.files['game.js'] + '\n// kill the stars that fall off\n', manifest: g.files['orlis.json'] }).join(), /aren't for children: kill/);
  assert.match(check({ game: g.files['game.js'], manifest: { ...JSON.parse(g.files['orlis.json']), about: 'A bloody good time' } }).join(), /bloody/);
  /* on screen */
  assert.equal(clean('Great!'), 'Great!');
  assert.equal(clean('Score: 12'), 'Score: 12');
  assert.match(clean('you got k1lled'), /^★+$/);
  assert.match(clean('K I L L'), /^★+$/, 'spelled out with gaps');
  assert.equal(clean('Skill shot'), 'Skill shot', 'ordinary words around them are fine');
});

test('colours and hex numbers are not words (#ff9a55 is no a55), but a word spelled with numbers is', async () => {
  const { badWords } = await import('../kit/creator/words.js');
  const { badWords: serverBad } = await import('../../server/src/words.js');
  for (const f of [badWords, serverBad]){
    assert.deepEqual(f('sun: "#ff9a55", leaf: "#3d9a55", mask: 0xA55, c: "#a55"'), []);
    assert.deepEqual(f('you are an a55'), ['ass']);
  }
});

test('the creator kit teaches the shared screen: the helpers are in the runtime, the skill names every move card and the words for the hint, goal and card, the starter uses them', async () => {
  const { RUNTIME, TEMPLATE } = await import('../src/ui/creator-kit.gen.js');
  const { POSE_NAMES } = await import('../src/games/figure.js');
  assert.match(RUNTIME, /zones/, 'Orlis.ui.zones is in the runtime');
  assert.match(RUNTIME, /under/, 'Orlis.ui.under is in the runtime');
  const skill = TEMPLATE['.claude/skills/orlis-game/SKILL.md'], claude = TEMPLATE['CLAUDE.md'], game = TEMPLATE['game.js'];
  for (const n of POSE_NAMES) assert.ok(skill.includes('`' + n + '`'), `the skill lists the ${n} card`);
  for (const w of ['"hint"', '"card"', '"goal"', 'hint words', 'move card', 'goal bar']) assert.ok(skill.includes(w), `the skill explains ${w}`);
  assert.match(claude, /shared screen/i, 'CLAUDE.md points at the shared screen');
  assert.match(game, /"hint"/, 'the starter game shows a hint the shared way');
  assert.match(game, /"card"/, 'and asks for a move card');
});

test("games draw only with the asset library: the check turns away drawing of its own, the server's list is the same, and the starter passes", () => {
  assert.deepEqual(DRAWING, SERVER_DRAWING);
  for (const h of ['check.ps1', 'guard.ps1']){
    const ps = newGame({ name: 'x y' }).files['.claude/hooks/' + h];
    for (const [w] of DRAWING) assert.ok(ps.includes(`@('${w.replace(/'/g, "''")}'`), `${h} checks ${w} too`);
  }
  const g = newGame({ name: 'Star Hop', idea: 'Hop on stars' });
  const base = { game: g.files['game.js'], manifest: g.files['orlis.json'] };
  assert.deepEqual(check(base), [], 'the starter draws with the library and passes');
  for (const own of ['c.fillRect(0, 0, 9, 9);', 'c.arc(1, 1, 5, 0, 7);', 'c.fillText("Hi", 1, 1);', 'const k = new OffscreenCanvas(9, 9);', 'x.getContext("2d");', 'c.drawImage(a, 0, 0);', 'c.beginPath();', 'c.createRadialGradient(0, 0, 1, 0, 0, 2);'])
    assert.match(check({ ...base, game: base.game + '\n' + own }).join(' '), /Orlis\.play/, own);
  assert.ok(!DRAWING.some(([w]) => base.game.includes(w)), 'nothing drawn by hand in the starter');
});
