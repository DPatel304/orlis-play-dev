import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* The Windows app (client/) can't be built here, so these guard the ways it
   would break quietly: the wrong name or window, the music folder not
   reachable, updates that can't be checked, the camera not allowed. */
const read = (f) => readFileSync(new URL(`../client/${f}`, import.meta.url), 'utf8');
const conf = JSON.parse(read('src-tauri/tauri.conf.json'));
const main = read('src-tauri/src/main.rs');

test('the app is Orlis Play, carrying the game files built into client/dist', () => {
  assert.equal(conf.productName, 'Orlis Play');
  assert.equal(conf.build.frontendDist, '../dist');
  assert.ok(conf.bundle.targets.includes('nsis'), 'a Windows installer');
  assert.ok(main.includes('app.config().product_name') && main.includes('.title(&title)'), 'the window is titled with the app\'s name');
});

test('the game window is the one the permissions are written for', () => {
  const caps = JSON.parse(read('src-tauri/capabilities/default.json'));
  assert.ok(main.includes('WebviewWindowBuilder::new(app, "main"'));
  assert.deepEqual(caps.windows, ['main']);
  assert.ok(caps.permissions.includes('core:window:allow-close'), 'the menu\'s Exit needs this');
});

test('display modes: a window or Big Picture, kept, with a default for new installs', () => {
  assert.match(main, /const DEFAULT_MODE: &str = "(window|bigpicture)";/);
  assert.ok(main.includes('const MODES: &[&str] = &["window", "bigpicture"]'));
  assert.ok(main.includes('generate_handler![set_display_mode') && main.includes('display.json'));
  assert.ok(main.includes(".fullscreen(mode == \"bigpicture\")"), 'opens in the mode chosen');
  const menu = readFileSync(new URL('../src/ui/menu.js', import.meta.url), 'utf8');
  assert.ok(menu.includes("window.orlisDisplay") && menu.includes("'Big Picture'"), 'Settings offers both');
});

test('Settings can check for an update and install it now', () => {
  assert.ok(main.includes('generate_handler![set_display_mode, check_update, install_update'));
  assert.ok(main.includes('window.ORLIS_VERSION') && main.includes('window.orlisApp'));
  const menu = readFileSync(new URL('../src/ui/menu.js', import.meta.url), 'utf8');
  assert.ok(menu.includes("'Check for updates'") && menu.includes('installUpdate()') && menu.includes('checkUpdate()'));
  assert.ok(!readFileSync(new URL('../src/ui/tabs.js', import.meta.url), 'utf8').includes('Check for updates'), 'no longer in the corner menu');
});

test('the music folder is the only place on disk the game can read', () => {
  assert.equal(conf.app.security.assetProtocol.enable, true);
  assert.deepEqual(conf.app.security.assetProtocol.scope, ['$AUDIO/Orlis Play/**']);
  assert.ok(main.includes('join("Orlis Play")'));
  assert.ok(main.includes('window.ORLIS_MUSIC'), 'hands the songs to the game the way it reads them');
});

test('updates are signed, and checked where the release workflow publishes them', () => {
  const up = conf.plugins.updater;
  assert.ok(up.pubkey && up.pubkey.length > 100, 'the public half of the signing key');
  assert.ok(up.endpoints.some(e => e.endsWith('/releases/latest/download/latest.json')));
  const wf = readFileSync(new URL('../../.github/workflows/orlis-play-windows.yml', import.meta.url), 'utf8');
  assert.ok(wf.includes('includeUpdaterJson: true') && wf.includes('TAURI_SIGNING_PRIVATE_KEY'));
  assert.ok(wf.includes('Orlis-Play-Setup.exe') && wf.includes('Orlis-Play-Beta-Setup.exe'), 'each channel\'s installer at an address that never changes');
  assert.ok(wf.includes('"identifier":"com.orlisplay.client.beta"') && wf.includes('releases/download/beta/latest.json'), 'the beta is its own app, updating from its own channel');
  assert.ok(/options: \[beta, release\]/.test(wf) && wf.includes("inputs.channel || 'beta'"), 'pushes make betas; a release is only ever by hand');
});

test('the camera is allowed without a prompt, and the game uses the files it carries', () => {
  assert.ok(main.includes('COREWEBVIEW2_PERMISSION_KIND_CAMERA') && main.includes('allow_camera(&window)'));
  assert.ok(main.includes('window.ORLIS_LOCAL = true'));
  const pose = readFileSync(new URL('../src/tracking/pose.js', import.meta.url), 'utf8');
  assert.ok(pose.includes('window.ORLIS_LOCAL'), 'pose.js takes the hint');
});

test('the app finds Orlis Server on the Wi-Fi on the port the server listens on', () => {
  assert.ok(main.includes('find_servers]') || main.includes('find_servers'), 'the command is registered');
  const port = main.match(/const DISCOVERY_PORT: u16 = (\d+);/)[1];
  const server = readFileSync(new URL('../../server/src/discovery.js', import.meta.url), 'utf8');
  assert.equal(server.match(/DISCOVERY_PORT = (\d+)/)[1], port, 'the same discovery port');
  assert.ok(server.includes("HELLO = 'orlis?'") && main.includes('b"orlis?"'), 'and the same question');
  const web = readFileSync(new URL('../../server/src/app.js', import.meta.url), 'utf8').match(/PORT = (\d+)/)[1];
  assert.ok(main.includes(`unwrap_or(${web})`) && readFileSync(new URL('../src/ui/account.js', import.meta.url), 'utf8').includes(`:${web}`), 'and the same web port');
});

test('an update found at start-up shows "Updating - back in a moment" while it installs, quietly', () => {
  assert.ok(main.includes('WebviewUrl::App("updating.html"') && main.includes('progress('), 'the small window, with progress');
  const page = readFileSync(new URL('../client/updating.html', import.meta.url), 'utf8');
  assert.ok(page.includes('Updating \u2014 back in a moment') && page.includes('window.progress'));
  assert.ok(read('build-web.mjs').includes("'client/updating.html'"), 'carried into the app');
  assert.equal(conf.plugins.updater.windows.installMode, 'quiet', 'no installer window on top of it');
});

test('one version people see (client/VERSION), with the build number behind it', () => {
  const shown = readFileSync(new URL('../client/VERSION', import.meta.url), 'utf8').trim();
  assert.match(shown, /^\d+\.\d+$/, 'like 0.1 or 1.0');
  const wf = readFileSync(new URL('../../.github/workflows/orlis-play-windows.yml', import.meta.url), 'utf8');
  assert.ok(wf.includes('VERSION="$SHOWN.$BUILD"') && wf.includes('BUILD: ${{ github.run_number }}'), 'each build is newer than the last');
  assert.ok(main.includes('Beta \\u00B7 build') && main.includes('nameOf'), 'labelled "0.1 Beta · build 27" in the app');
});

test('the camera is on only in a game (and the camera check): off through the intro, signing in and the home screen', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const set = main.match(/const CAMERA = new Set\(\[([^\]]*)\]\)/)[1];
  for (const m of ['play', 'outro', 'results', 'calibrate', 'starting']) assert.ok(set.includes(`'${m}'`), m);
  for (const m of ['boot', 'menu', 'who']) assert.ok(!set.includes(`'${m}'`), m);
  assert.match(main, /CAMERA\.has\(next\)\) pose\.wake\(\); else pose\.sleep\(\)/);
  assert.ok(!/pose\.start\(/.test(main), 'boot no longer starts the camera');
});

test('updates: the Update button and a slow check both show "Updating"; the beta is swapped, not deleted first', () => {
  const rs = readFileSync(new URL('../client/src-tauri/src/main.rs', import.meta.url), 'utf8');
  assert.match(rs, /async fn install_update[\s\S]*run_update\(&app, found\)/);
  assert.match(rs, /orlisupdate/);
  assert.match(rs, /SPLASH_AT_LEAST/);
  const wf = readFileSync(new URL('../../.github/workflows/orlis-play-windows.yml', import.meta.url), 'utf8');
  assert.ok(!/gh release delete beta/.test(wf), 'the beta stays up while the next one builds');
  assert.ok(wf.indexOf('upload "$TAG" "$UPD"') < wf.indexOf('upload "$TAG" latest.json'), 'the update file goes up last');
});

test('Home, the Store and Create are pages under the same tabs; the corner menu keeps just Settings and Exit', () => {
  const tabs = readFileSync(new URL('../src/ui/tabs.js', import.meta.url), 'utf8');
  assert.match(tabs, /\['home', 'Play'\], \['store', 'Discover'\], \['create', 'Create'\], \['pro', 'Create Pro'\]/);
  for (const w of ["'Settings'", "'Exit'"]) assert.ok(tabs.includes(`item(`) && tabs.includes(w), w);
  assert.ok(!tabs.includes("'Sign out'") && !tabs.includes("'Check for updates'"), 'signing out is on the profile screen, updates are in Settings');
  assert.ok(!/\\u\{1F/.test(tabs), 'the corner menu has line icons, not emoji');
  assert.ok(tabs.includes("id !== 'create' || !account.isKid"), 'a child playing sees Home and the Store, not Create');
  assert.ok(!/Store<\/span>|Create<\/span>/.test(tabs), 'Store and Create are tabs now, not in the corner menu');
  assert.ok(!tabs.includes('places'), 'the menu has no Play / Discover / Create items: those are the tabs');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /go\('store'/); assert.match(main, /go\('create'/);
  assert.match(main, /const HOMEY = new Set\(\['menu', 'store', 'create', 'pro', 'who'\]\)/);
});

test('the title bar really goes in Big Picture: hidden beats its display:flex', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.titlebar\[hidden\]\{\s*display:none/);
});

test('light only: no dark theme left', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.ok(!css.includes('body.dark'));
  const menu = readFileSync(new URL('../src/ui/menu.js', import.meta.url), 'utf8');
  assert.ok(!menu.includes("row('Theme'"));
  assert.ok(!/color-scheme:\s*dark/.test(css), 'the browser\'s own controls drawn light');
  assert.ok(!css.includes('prefers-color-scheme'));
  const beta = readFileSync(new URL('../../server/src/beta.js', import.meta.url), 'utf8');
  assert.ok(!beta.includes('prefers-color-scheme: dark'), 'the beta page too');
});

test('Create: the app makes games in their own folders, and opens Claude Code there', () => {
  const main = readFileSync(new URL('../client/src-tauri/src/main.rs', import.meta.url), 'utf8');
  const rs = readFileSync(new URL('../client/src-tauri/src/creating.rs', import.meta.url), 'utf8');
  for (const c of ['games_list', 'game_make', 'game_write', 'game_read', 'game_show', 'claude_open']) assert.ok(main.includes(`creating::${c}`), c);
  assert.ok(rs.includes('join("Orlis Play").join("Games")'), 'in Documents\\Orlis Play\\Games');
  assert.ok(rs.includes('r.starts_with(".claude/") || r == ".orlis/preview.txt"'), 'after it\'s made, Orlis Play only rewrites its own part');
  assert.ok(rs.includes('.env("ORLIS_PROMPT"') && rs.includes('& $env:ORLIS_CLAUDE $env:ORLIS_PROMPT'), 'the idea is handed over, never written into the command');
});

test('a game waiting for the owner\'s OK is played before it can be approved: the app tells the server, after the same time it asks for', async () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const { TRY_SECS } = await import('../../server/src/submissions.js');
  assert.equal(+main.match(/const TRY_SECS = (\d+);/)[1], TRY_SECS);
  assert.ok(main.includes("/tried`"), 'it tells the server');
  assert.ok(readFileSync(new URL('../src/ui/store.js', import.meta.url), 'utf8').includes('game.trial = g.submission'), 'Try it marks the game');
});

test('one app, modes by install: Player has Play, Discover and Create; Creator has Create and Create Pro; unset is Player', async () => {
  const { MODES, appMode } = await import('../src/ui/mode.js');
  assert.deepEqual(MODES.player, ['home', 'store', 'create']);
  assert.deepEqual(MODES.creator, ['create', 'pro']);
  assert.equal(Object.keys(MODES).length, 2);
  assert.equal(appMode.get(), 'player', 'unset is the Player app');
  assert.equal(appMode.canSwitch(), true, 'a testing build (no mode told, no release label) can be switched');
  const tabs = readFileSync(new URL('../src/ui/tabs.js', import.meta.url), 'utf8');
  assert.ok(tabs.includes('appMode.tabs().includes(id)'), 'the tab bar follows the mode');
  const menu = readFileSync(new URL('../src/ui/menu.js', import.meta.url), 'utf8');
  assert.ok(menu.includes("row('Mode'") && menu.includes('appMode.canSwitch()'), 'testing builds can switch in Settings; a build told its mode cannot');
  const rust = readFileSync(new URL('../client/src-tauri/src/main.rs', import.meta.url), 'utf8');
  assert.ok(rust.includes('option_env!("ORLIS_MODE").unwrap_or("")') && rust.includes('window.ORLIS_MODE'), 'the build says which mode it is, if it was told');
});
