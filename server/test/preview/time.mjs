/* Times the management page's lists against a running preview server (serve.mjs):

     node server/test/preview/time.mjs <folder> [port=47990]

   Each request is made 7 times; it prints the median and the slowest, in ms. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, port = '47990'] = process.argv.slice(2);
const key = readFileSync(join(dir, 'manage.key'), 'utf8').trim();
const get = async (path) => { const t = performance.now(); const r = await fetch(`http://127.0.0.1:${port}${path}`, { headers: { 'X-Orlis-Manage': key } }); const b = await r.text(); return [performance.now() - t, r.status, b.length]; };
const paths = [
  '/api/admin/overview',
  '/api/admin/families?per=25',
  '/api/admin/families?per=25&sort=plays&dir=desc&page=40',
  '/api/admin/families?per=25&sort=name&dir=asc',
  '/api/admin/families?per=25&status=inactive&sort=last',
  '/api/admin/families?per=25&q=patel',
  '/api/admin/families?per=25&q=sam',
  '/api/admin/families?per=25&q=example.com&status=active',
  '/api/admin/families/h000007',
  '/api/admin/families.csv?status=active',
  '/api/admin/games?per=25',
  '/api/admin/games?q=bubble&status=live&sort=title',
  '/api/admin/activity?limit=30',
  '/api/admin/activity?limit=30&type=joins',
  '/api/admin/activity?limit=30&q=example&before=15000',
  '/api/admin/queue'
];
for (const p of paths){
  const ms = []; let last;
  for (let i = 0; i < 7; i++){ last = await get(p); ms.push(last[0]); }
  ms.sort((a, b) => a - b);
  console.log(`${ms[3].toFixed(1).padStart(6)} median ${ms[6].toFixed(1).padStart(6)} max  ${last[1]}  ${String(last[2]).padStart(7)} B  ${p}`);
}
