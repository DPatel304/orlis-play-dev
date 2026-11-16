/* The maker: on the owner's laptop, it takes the next "make this game"
   job from the server's queue (requests.js), makes the game with the
   owner's own Claude Code, and hands the game file back - where it waits for
   the owner's OK like any game sent in.

   Each job gets a game folder of its own (in "making" in the data folder),
   set up exactly as Create sets one up: the creator kit - its rules for
   Claude, the locked-down settings and the guard (Claude can only change
   the game's two files). Claude Code runs in it with no window
   ("claude -p", the prompt the owner OK'd); then Orlis Play's own checks
   run, and if something's wrong Claude is asked once more to fix just that.

   It talks to the server over its web address with the owner's key, like
   any other part - so the server can move (to the cloud) and the maker
   stays here, where Claude Code is.

     maker({ base, key, dataDir, status, run, fetchImpl, every })   .stop() */
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { newGame, check, pack, unpack, nextVersion } from '../../app/src/ui/creator-kit.js';

const MINUTES = 20;                      /* the longest Claude may take on one game */

/* Where Claude Code is on this laptop: on the PATH, or where its installers
   put it. (null: not here - requests wait until it is.) */
export function findClaude(){
  const win = process.platform === 'win32';
  try {
    const out = execFileSync(win ? 'where.exe' : 'which', ['claude'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    const all = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const pick = all.find(p => /\.(exe|cmd)$/i.test(p)) || all[0];
    if (pick) return pick;
  } catch {}
  const home = process.env.USERPROFILE || process.env.HOME || '', appdata = process.env.APPDATA || '';
  for (const p of [join(home, '.local', 'bin', win ? 'claude.exe' : 'claude'), join(appdata, 'npm', 'claude.cmd')]) if (p && existsSync(p)) return p;
  return null;
}

/* Claude Code, in a game's folder, with no window: the prompt in, until it's
   done (or the time's up). again: carry on from last time (a fix). */
export function runClaude(claude, dir, prompt, { again = false, minutes = MINUTES } = {}){
  return new Promise((resolve, reject) => {
    const args = ['-p', '--output-format', 'text', ...(again ? ['--continue'] : [])];
    /* (a .cmd needs the shell to start it; nothing typed by anyone is ever
       in the command - the prompt goes in on its own, after) */
    const p = spawn(claude, args, { cwd: dir, windowsHide: true, shell: /\.cmd$/i.test(claude), stdio: ['pipe', 'pipe', 'pipe'] });
    let said = '', err = '';
    const timer = setTimeout(() => { try { p.kill(); } catch {} reject(new Error(`Claude Code took more than ${minutes} minutes`)); }, minutes * 60e3);
    p.stdout.on('data', d => { said += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('error', e => { clearTimeout(timer); reject(new Error(`Claude Code couldn't start: ${e.message}`)); });
    p.on('close', code => { clearTimeout(timer); code === 0 ? resolve(said.slice(-4000)) : reject(new Error(`Claude Code stopped (${code}): ${(err || said).trim().slice(-300) || 'no reason given'}`)); });
    p.stdin.end(prompt);
  });
}

/* The folder for a job: the creator kit, and the game it starts from. */
export function setUp(dir, job){
  const from = job.from;
  let files;
  if (job.change && from){
    /* a change to their game: the kit around it, its own id, its own code */
    files = newGame({ name: from.name, idea: job.sentence }).files;
    const m = JSON.parse(from.manifest);
    for (const k of ['format', 'kit', 'by', 'starter', 'sha256', 'bytes']) delete m[k];
    files['orlis.json'] = JSON.stringify(m, null, 2) + '\n';
    const own = unpack(from.code);
    if (own == null) throw new Error(`${from.name} wasn't made in Create, so it can't be changed this way`);
    files['game.js'] = own.endsWith('\n') ? own : own + '\n';
  } else {
    const own = from ? unpack(from.code) : null;
    files = newGame({ name: job.name || (from ? `${from.name} remix` : 'New game'), idea: job.sentence, from: own != null ? { name: from.name, game: own, manifest: from.manifest } : null }).files;
  }
  rmSync(dir, { recursive: true, force: true });
  for (const [path, text] of Object.entries(files)){
    const at = join(dir, ...path.split('/'));
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, text);
  }
}

/* One job, start to finish: the game file (bytes), or it throws why not. */
export async function make(job, dir, run){
  setUp(dir, job);
  await run(dir, job.prompt);
  const read = () => ({ game: readFileSync(join(dir, 'game.js'), 'utf8'), manifest: readFileSync(join(dir, 'orlis.json'), 'utf8') });
  let now = read(), wrong = check(now);
  if (wrong.length){
    /* once more, to fix just what the checks found */
    await run(dir, `Orlis Play's check found these problems with the game - fix just these, nothing else:\n${wrong.map(w => '- ' + w).join('\n')}`, { again: true });
    now = read(); wrong = check(now);
    if (wrong.length) throw new Error(`it didn't pass the checks: ${wrong.join(' ')}`);
  }
  /* a change: the next version of their game, so families are offered it */
  if (job.change && job.from){
    const m = JSON.parse(now.manifest);
    m.id = JSON.parse(job.from.manifest).id;
    m.version = nextVersion(job.from.version);
    now.manifest = JSON.stringify(m, null, 2);
  }
  return (await pack(now)).bytes;
}

export function maker({ base, key, dataDir, status = {}, claude = findClaude(), run = null, fetchImpl = fetch, every = 15000, log = console.log }){
  const call = (method, path, body, raw) => fetchImpl(base + path, {
    method, headers: { 'X-Orlis-Manage': key, ...(raw ? { 'Content-Type': 'application/octet-stream' } : { 'Content-Type': 'application/json' }) },
    body: raw || (body ? JSON.stringify(body) : undefined)
  }).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || `the server said ${r.status}`); return d; });
  const go = run || ((dir, prompt, opts) => runClaude(claude, dir, prompt, opts));
  status.maker = { state: claude || run ? 'ready' : 'no-claude' };
  let timer = null, busy = false, stopped = false;
  async function tick(){
    if (busy || stopped) return;
    busy = true;
    try {
      if (!claude && !run){ status.maker = { state: 'no-claude' }; return; }
      const { job } = await call('POST', '/api/jobs/next');
      if (!job) return;
      status.maker = { state: 'making', sentence: job.sentence, since: new Date().toISOString() };
      log(`-- making a requested game: ${job.sentence}`);
      const dir = join(dataDir, 'making', job.id);
      try {
        const bytes = await make(job, dir, go);
        await call('POST', `/api/jobs/${job.id}/done`, null, bytes);
        log('-- made it: waiting for your OK');
        rmSync(dir, { recursive: true, force: true });
      } catch (e){
        log(`-- couldn't make it: ${e.message}`);
        await call('POST', `/api/jobs/${job.id}/failed`, { error: e.message }).catch(() => {});
      }
    } catch (e){ log(`(the maker couldn't reach the server: ${e.message})`); }
    finally { busy = false; if (!stopped && status.maker.state === 'making') status.maker = { state: 'ready' }; }
  }
  timer = setInterval(tick, every);
  setTimeout(tick, 1000);
  return { tick, stop(){ stopped = true; clearInterval(timer); } };
}
