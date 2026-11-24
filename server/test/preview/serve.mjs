/* Runs the server on a folder made by seed.mjs, with a stand-in for email and a public address, to look at the management page:

     node server/test/preview/serve.mjs <folder> [port=47990]

   Prints the page's address (it has the manage key in it). */
import { start } from '../../src/app.js';

const [dir, port] = process.argv.slice(2);
if (!dir){ console.error('usage: node serve.mjs <folder> [port]'); process.exit(1); }
const sent = [];
const mail = { ready: true, settings: () => ({ user: 'you@gmail.com', from: 'you@gmail.com', host: 'smtp.gmail.com' }), save(){}, send: async (m) => { sent.push(m); } };
const s = await start({ dataDir: dir, port: Number(port) || 47990, discoveryPort: false, name: 'Orlis', internetPort: 0, publicUrl: 'https://orlis.example-name.ts.net', mail, approveJoins: true, tailscaleJoin: false, notify: () => {},
  status: { update: { state: 'up to date' } }, restart: null });
await mail.send({ to: 'you@gmail.com', subject: 'x', text: 'y' });
s.backups.make('daily', s.db);
console.log(`ready: ${s.manageUrl}`);
