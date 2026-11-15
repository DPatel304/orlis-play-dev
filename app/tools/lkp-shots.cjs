// Frames from Last Known Position, scene by scene, for looking at the art.
//   NODE_PATH=$(npm root -g) node tools/lkp-shots.cjs http://localhost:5191/ <out-prefix> [every-seconds] [until-seconds]
const { chromium } = require('playwright');
const [url, out, every = '6', until = '900'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  pg.on('pageerror', e => console.log('ERR', e.message));
  await pg.goto(url + 'tools/lkp-shots.html'); await pg.waitForFunction(() => window.__ready, null, { timeout: 30000 });
  await pg.evaluate(() => window.__start(2));
  for (let s = +every; s <= +until; s += +every){
    const r = await pg.evaluate((s) => window.__to(s), s);
    const name = `${out}-${String(s).padStart(4, '0')}.jpg`;
    await (await pg.$('canvas')).screenshot({ path: name, type: 'jpeg', quality: 70 });
    console.log(name, JSON.stringify(r));
    if (r.over) break;
  }
  await b.close();
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
