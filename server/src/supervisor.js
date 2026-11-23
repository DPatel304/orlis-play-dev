/* Orlis Server, running quietly: no window to keep open - just the Orlis
   icon by the clock (the system tray). Right-click it for the log, the
   data folder, Restart and Quit.

   When Orlis Server.exe is double-clicked, this part starts first. It
   puts the icon by the clock (double-click it, or right-click > Manage Orlis
   Server, for the management page - manage-page.js), and runs the server itself as a second copy
   of the exe (--worker), its words going to "server.log" in the data
   folder. If the server ever stops by itself, this starts it again (a
   few seconds later; after five stops in ten minutes it gives up and says
   so). When the server has updated itself, this starts the new exe and
   closes; when it's asked to finish a restore, it starts the server again.

   The icon is drawn by Windows' own PowerShell (it comes with Windows), so
   there's nothing extra to install. It starts with Windows (startup.js) -
   on by default, and switched off or on again from the icon's menu. */
import { spawn as spawnChild } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AFTER_UPDATE, UPDATED } from './update.js';
import { startup as startupOf } from './startup.js';

export const WORKER = '--worker';
export const RESTART = 76;                    /* the server's "start me again" (a restore) */
const LOG_MAX = 1024 * 1024;
const CRASHES = 5, CRASH_WINDOW = 10 * 60 * 1000, CRASH_WAIT = 3000;

/* the Orlis mark (the two squares, decision 0045), 32 pixels */
export const ICON = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAE80lEQVR4nK2XX2hcVR7HP79z7p2ZZCZN0n92Y7uiFLEVd30QBN3q4stuRdB9SEAU8UUqgvjvTdHZvC2CouCDTxYVVm18U4ssLKJWLeqyD9ZWaovVttDUNk2TTpLOved8fbgzbZImdSb6HQ6Xy5xzft/f95zfOd9rrBCSnJnFZf9HhvAXXkGX6991cIB6XU7S3yU9LelZSSOS/ixpcDlS7bFtJCsJbmZR0nXAmycPc9OJg+BTGNgApVVQ7Y+nJR0BDgD7gG+B78zsEIbmq2cryFzAeuDrz95i43/fbuSt9MCwcq/z/WtS1g0lXHEVrNsEq9ZBeSA2V//BfQU8Y2Yft0l0SyAxs1zSi4c/54nX/tlorhlypYsdIEYIuRQyYsiRonCJWaXq/NabK/ztIYIvc4+ZvS/Jd7UEreAO2L53d1TfgCUSaNHW8qlZkuLNADMkkCJ7dzfyxtlKMvyM3ynpWmDSLRFnuezbaq0/eypuOj2em0uxxcHbSqilRgwtgjIGN7hk3xdz+YkDrAW2m5k6JgC0+25uTrtqYzKPvsixYyiC9zB+BAFb5k/aCdrBtjQmIGsqWjej2yQElSoGTHdLoI0bTh9bwahWcOfNBjYAsB+WOgckq4PtH1tYojv+h1Hsg+tPHCkmkrojEAPqqTqfVGMEd/ASAsO75MfMwmhR1YsRUgfNGW0+eVQkKbZkr2VgBiGT1gyVrTbIOHB0IQHJxszC7TtVCau5liY9AApYxWGTc8RHtjE0fToOnfm5iU/pTgGDvInWb3SUezlkZrOSXAKyeh0bNYt/2aVHlfC4y7jGPIUOHqKBAhw6A3MJzDQiPVVbugQvp0CQNlwFtNYfcMnwLtzoiIVb39YL5X6ezM6B8qKU57OPTVAGcupK+sVYuwmAb9rvbmzEwra3dEupypPnJ8ljRsQAu/gTWCXFDp7Can909A0YIQfn6fg2kSBJcdU1CxRoHUSO+8wjBGaXlqaASgKHT8EXc8Y/HkyZnhKzM8VJh4FzBSFzhdzzYQYxSL2rEquuZpbilpxHADYptPJeBlFQK8Pze2DqhoQdz5XZfJ2jWoW8CeemxPREDDNTMWRzijFK1iIGMDkeszuGy1YbZLeZnZDkzSy2q+BXhRTgHZwP8PCHcP+Nntue8Axkwk2JmZNiasL7k8dg/CeYGG/SOJvHGESp17l7HqmV/rSd48BTrXtF0KUhkSD1xfPVL+H1FNbVjCv7jatXowdv4d83Ql+eseXcmWRjc7rUk81BeSBka6/kP8BjZvbjJYZk2zt6L+nlrqxBMLvg4y4Lb8WyZBGyHAWH/f/L81t5uXJgn1S6Hq4ArgZ6gcNm9n2RxEIv2bUlayO0SjF1UCoVluzOv5YHP3hJ3owc7Cit064dGGCxMV3JZbQAolAiCKZmCWYW6h/hJDlJvtUK+7WEK16xApfD/p87t+C/WYHfit+VgFx3LvsiATGHoe4u2EXBI1hkBmDrcOfzOIDo2GMeI3ZPQCJaCcXA8Tzhe5CNdpGIQzLLeCOb5nhSI5VoSoQOW44R0xrOHP/aO2Kzw7twYJ0TqIPtuc/OKONuZfxQ6qeU1vBpFX/huUwr9ZEkPSTNCV78dMReqdflxkYsdKNgsWnqcoxavH2nBrSKBwQ3E+grvmmX2ViO3CX8pPO8+8m99imSYZ1nfgnq9a6+ERaO1crH/gLHs3nAuFDjJQAAAABJRU5ErkJggg==';

/* The tray icon, in PowerShell. It reads lines from this side ("status
   ...", "say title|text", "exit") and writes back what was picked ("log",
   "folder", "restart", "quit"). With ORLIS_TRAY_TEST set it builds
   everything and exits at once (a check that it works on a machine). */
export function trayScript(){
  return String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$png = [Convert]::FromBase64String('${ICON}')
$ms = New-Object System.IO.MemoryStream(,$png)
$bmp = [System.Drawing.Bitmap]::FromStream($ms)
$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
$out = [Console]::Out
function Send([string]$what){ $out.WriteLine($what); $out.Flush() }
$ni = New-Object System.Windows.Forms.NotifyIcon
$ni.Icon = $icon
$ni.Text = 'Orlis Server'
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$title = $menu.Items.Add('Orlis Server')
$title.Enabled = $false
[void]$menu.Items.Add('-')
$manage = $menu.Items.Add('Manage Orlis Server')
$manage.Font = New-Object System.Drawing.Font($manage.Font, [System.Drawing.FontStyle]::Bold)
$manage.add_Click({ Send 'manage' })
$menu.Items.Add('Show the log').add_Click({ Send 'log' })
$menu.Items.Add('Open the data folder').add_Click({ Send 'folder' })
$menu.Items.Add('Restart').add_Click({ Send 'restart' })
[void]$menu.Items.Add('-')
$boot = $menu.Items.Add('Start with Windows')
$boot.add_Click({ Send 'startup' })
[void]$menu.Items.Add('-')
$menu.Items.Add('Quit Orlis Server').add_Click({ Send 'quit' })
$ni.ContextMenuStrip = $menu
$ni.add_DoubleClick({ Send 'manage' })
if ($env:ORLIS_TRAY_TEST) { $ni.Dispose(); 'tray ok'; exit 0 }
$ni.Visible = $true
$stdin = New-Object System.IO.StreamReader([Console]::OpenStandardInput())
$script:next = $stdin.ReadLineAsync()
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 250
$timer.add_Tick({
  while ($script:next.IsCompleted) {
    $line = $script:next.Result
    if ($line -eq $null -or $line -eq 'exit') { $timer.Stop(); $ni.Visible = $false; [System.Windows.Forms.Application]::Exit(); return }
    if ($line.StartsWith('status ')) { $t = $line.Substring(7); $title.Text = $t; $ni.Text = $t.Substring(0, [Math]::Min(63, $t.Length)) }
    elseif ($line.StartsWith('startup ')) { $boot.Checked = ($line.Substring(8) -eq 'on') }
    elseif ($line.StartsWith('say ')) { $p = $line.Substring(4).Split('|', 2); $ni.ShowBalloonTip(6000, $p[0], $p[1], 'Info') }
    $script:next = $stdin.ReadLineAsync()
  }
})
$timer.Start()
[System.Windows.Forms.Application]::Run()
$ni.Dispose()
`;
}
const encoded = (script) => Buffer.from(script, 'utf16le').toString('base64');

/* supervise({ exe, dataDir, version, afterUpdate }) */
export function supervise({ exe, dataDir, version, afterUpdate = false, spawn = spawnChild, exit = (c) => process.exit(c),
  port = 47871, fetchImpl = fetch, now = () => Date.now(), crashWait = CRASH_WAIT, finishWait = 400, startup = null }){
  mkdirSync(dataDir, { recursive: true });
  const logFile = join(dataDir, 'server.log');
  function log(text){
    try {
      if (existsSync(logFile) && statSync(logFile).size > LOG_MAX) renameSync(logFile, join(dataDir, 'server.old.log'));
      appendFileSync(logFile, String(text).replace(/\r?\n$/, '') + '\n');
    } catch {}
  }

  /* the icon */
  let tray = null;
  const tell = (line) => { try { tray && tray.stdin.write(line.replace(/[\r\n]+/g, ' ') + '\n'); } catch {} };
  function startTray(){
    try {
      tray = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-EncodedCommand', encoded(trayScript())],
        { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
      tray.on('error', (e) => { log(`(the icon by the clock couldn't start: ${e.message})`); tray = null; });
      let buf = '';
      tray.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0){ picked(buf.slice(0, i).trim()); buf = buf.slice(i + 1); } });
      tray.on('exit', () => { tray = null; });
    } catch (e){ log(`(the icon by the clock couldn't start: ${e.message})`); }
  }
  const open = (cmd, args) => { try { spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref?.(); } catch {} };
  function picked(what){
    if (what === 'manage') manage();
    else if (what === 'log') open('notepad.exe', [logFile]);
    else if (what === 'folder') open('explorer.exe', [dataDir]);
    else if (what === 'startup') toggleStartup();
    else if (what === 'restart'){ log('-- restarting (asked from the icon) --'); restarting = true; stopWorker(); }
    else if (what === 'quit'){ log('-- quitting (asked from the icon) --'); quitting = true; stopWorker(); if (!worker) finish(0); }
  }

  /* Starting with Windows: on the first run it's switched on; the menu
     item shows it, ticked, and switches it. */
  const boot = startup || startupOf({ exe, dataDir });
  let booting = false;
  async function settleStartup(){
    try { booting = await boot.settle(); } catch (e){ log(`(couldn't set it to start with Windows: ${e.message})`); booting = false; }
    tell('startup ' + (booting ? 'on' : 'off'));
  }
  async function toggleStartup(){
    const want = !booting;
    try {
      const ok = await boot.set(want);
      booting = want && ok;
      log(`-- start with Windows: ${booting ? 'on' : 'off'} --`);
      tell('startup ' + (booting ? 'on' : 'off'));
      if (want && !ok) tell("say Couldn't set that|Windows didn't let Orlis Server add itself to the startup list.");
    } catch (e){ log(`(couldn't change starting with Windows: ${e.message})`); }
  }

  /* the management page, in the browser, with its key (it's only ever
     opened from here, on this laptop) */
  function manage(){
    let key = '';
    try { key = readFileSync(join(dataDir, 'manage.key'), 'utf8').trim(); } catch {}
    if (!key){ tell("say Orlis Server is starting|Try Manage again in a moment."); return; }
    /* (Windows' own "open this link in the browser" - Explorer would take
       an address for a folder) */
    open('rundll32.exe', ['url.dll,FileProtocolHandler', `http://127.0.0.1:${port}/manage?k=${key}`]);
  }

  /* the server */
  let worker = null, quitting = false, restarting = false, first = true;
  const stops = [];
  function startWorker(){
    const args = [WORKER]; if (first && afterUpdate) args.push(AFTER_UPDATE);
    first = false;
    worker = spawn(exe, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: { ...process.env, ORLIS_SUPERVISED: '1' } });
    /* (a line "@@say title|text" from the server: a note by the clock - a new game request, say) */
    worker.stdout?.on('data', (d) => { const t = d.toString(); for (const l of t.split(/\r?\n/)) if (l.startsWith('@@say ')) tell('say ' + l.slice(6)); log(t); });
    worker.stderr?.on('data', (d) => log(d.toString()));
    worker.on('error', (e) => log(`(the server couldn't start: ${e.message})`));
    worker.on('exit', (code) => {
      worker = null;
      if (quitting) return finish(0);
      if (code === UPDATED){
        log('-- updated: starting the new Orlis Server --');
        open(exe, [AFTER_UPDATE]);
        return finish(0);
      }
      if (code === RESTART || restarting){ restarting = false; tell('status Orlis Server ' + version + ' - running'); return startWorker(); }
      stops.push(now());
      while (stops.length && now() - stops[0] > CRASH_WINDOW) stops.shift();
      log(`-- the server stopped (${code}) --`);
      if (stops.length >= CRASHES){
        tell('status Orlis Server - stopped (see the log)');
        tell("say Orlis Server stopped|It stopped a few times in a row, so it's resting. Right-click the icon to see the log, or Restart.");
        restarting = false;
        return;
      }
      setTimeout(startWorker, crashWait);
    });
  }
  function stopWorker(){
    if (!worker){ if (restarting){ restarting = false; stops.length = 0; startWorker(); } return; }
    try { worker.stdin.end(); } catch {}
    const w = worker;
    setTimeout(() => { if (worker === w) try { w.kill(); } catch {} }, 5000);
  }
  function finish(code){
    tell('exit');
    setTimeout(() => exit(code), finishWait);
  }

  async function begin(){
    /* already running? then say so, and leave it be */
    try {
      const c = new AbortController(); setTimeout(() => c.abort(), 1500);
      const r = await fetchImpl(`http://127.0.0.1:${port}/api/hello`, { signal: c.signal });
      const h = await r.json();
      if (h && h.app === 'orlis'){
        startTray();
        tell('status Orlis Server - already running');
        tell("say Orlis Server is already running|Look for the Orlis icon by the clock - there's only ever one.");
        log('-- already running: this one closes --');
        setTimeout(() => finish(0), 7000);
        return;
      }
    } catch {}
    log(`-- Orlis Server ${version} starting --`);
    startTray();
    tell('status Orlis Server ' + version + ' - running');
    settleStartup();
    /* (quietly: no note as it starts, or after an update - only when
       something needs saying: already running, or it keeps stopping) */
    startWorker();
  }
  begin();
  return { picked, log, get worker(){ return worker; } };
}
