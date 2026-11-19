/* Builds the creator kit into the app: the Orlis runtime as one script
   (kit/creator/runtime.js, bundled), and the files every new game's folder
   starts with (kit/creator/template/), with the checks' list
   (kit/creator/forbidden.json) put into the check hook. Orlis Play writes
   them out when Create makes a new game, and packs the runtime in front of
   the game's own code (src/ui/creator-kit.js).

     node kit/build-creator.mjs        -> src/ui/creator-kit.gen.js */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const kit = join(root, 'kit/creator');
export const OUT = join(root, 'src/ui/creator-kit.gen.js');

export async function generate(){
  /* (the words list goes into the runtime as character codes, not words:
     a game's file has none of them in it, so the checks can look at all of
     it) */
  const listed = JSON.parse(readFileSync(join(kit, 'words.json'), 'utf8'));
  const coded = { name: 'words-coded', setup(b){
    b.onResolve({ filter: /\/words\.json$/ }, a => ({ path: join(a.resolveDir, a.path), namespace: 'words' }));
    b.onLoad({ filter: /.*/, namespace: 'words' }, () => ({ loader: 'js',
      contents: `const d = new TextDecoder(); export default ${JSON.stringify(listed.map(w => [...Buffer.from(w)]))}.map(c => d.decode(new Uint8Array(c)));` }));
  } };
  const out = await build({ entryPoints: [join(kit, 'runtime.js')], bundle: true, format: 'iife', target: 'es2020', minify: true, write: false, legalComments: 'none', logLevel: 'warning', plugins: [coded] });
  const runtime = out.outputFiles[0].text.trim();
  const forbidden = JSON.parse(readFileSync(join(kit, 'forbidden.json'), 'utf8'));
  /* what a game made in Create never needs, because it draws with the asset library (the check, the hooks and the server all stop it) */
  const drawing = JSON.parse(readFileSync(join(kit, 'drawing.json'), 'utf8'));
  const files = {};
  const walk = (d) => {
    for (const f of readdirSync(d).sort()){
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      /* (line endings as one: Git on Windows checks files out with CRLF) */
      else files[relative(join(kit, 'template'), p).split('\\').join('/')] = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    }
  };
  walk(join(kit, 'template'));
  /* the asset library's catalogue, written into the skill so Claude Code only names pieces that exist */
  const { assets } = await import('../src/games/assets/index.js');
  const KINDS = [['scene', 'Backgrounds (scene)'], ['character', 'Cubo (draw)'], ['animal', 'Animals'], ['food', 'Food'], ['nature', 'Nature'], ['thing', 'Things, props and places'], ['effect', 'Effects']];
  const catalogue = KINDS.map(([k, title]) => {
    const rows = assets.list(k);
    return `**${title}:** ` + rows.map(r => r.id + (r.poses ? ` (poses: ${r.poses.join(', ')}; faces: ${r.faces.join(', ')})` : '')).join(', ');
  }).join('\n\n');
  /* ...and the vocabulary of games (games/play/), with the three example games, so the skill can never disagree with the engine */
  const V = await import('../src/games/play/vocabulary.js'), EX = await import('../src/games/play/examples.js');
  const list = (o) => Object.entries(o).map(([k, v]) => `- \`${k}\` - ${v.doc}`).join('\n');
  const vocab = `**The game** (the top of the description):\n\n${Object.entries(V.GAME_KEYS).map(([k, v]) => `- \`${k}\` - ${v}`).join('\n')}\n\n**A thing** (each one in \`things\`):\n\n${Object.entries(V.THING_KEYS).map(([k, v]) => `- \`${k}\` - ${v}`).join('\n')}\n\n**Movements** (\`"moves"\`):\n\n${list(V.MOVES)}\n\n**Triggers** (a rule's \`"when"\`):\n\n${list(V.TRIGGERS)}\n\n**Results** (a rule's \`"then"\` list - several, in order):\n\n${list(V.RESULTS)}\n\n**Move cards** (\`"card"\`): ${(await import('../src/games/figure.js')).POSE_NAMES.map(n => '`' + n + '`').join(', ')}.\n\n**Sounds:** ${V.SOUNDS.join(', ')}.\n\n**Places things appear from** (\`"from"\`): ${V.FROM.join(', ')}.\n\n**Colours:** ${Object.keys(V.COLORS).join(', ')} (or \`#rrggbb\`).`;
  const json = (o) => JSON.stringify(o, null, 2);
  for (const p of Object.keys(files)) if (p.endsWith('SKILL.md')) files[p] = files[p].replace('{{ASSETS}}', () => catalogue).replace('{{VOCAB}}', () => vocab).replace('{{CATCH}}', () => json(EX.CATCH)).replace('{{POP}}', () => json(EX.POP)).replace('{{KEEPUP}}', () => json(EX.KEEP_UP));
  const ps = [...forbidden, ...drawing].map(([w, why]) => `  @('${w.replace(/'/g, "''")}', '${why.replace(/'/g, "''")}')`).join(",\n");
  const words = JSON.parse(readFileSync(join(kit, 'words.json'), 'utf8'));
  const pw = words.map(w => `'${w}'`).join(', ');
  for (const [p, t] of Object.entries(files)) if (p.endsWith('.ps1')) files[p] = t.replace('{{FORBIDDEN}}', () => ps).replace('{{WORDS}}', () => pw);
  return `/* Made by kit/build-creator.mjs - don't edit; change kit/creator/ and run it again. */
export const RUNTIME = ${JSON.stringify(runtime)};
export const FORBIDDEN = ${JSON.stringify(forbidden)};
export const DRAWING = ${JSON.stringify(drawing)};
export const WORDS = ${JSON.stringify(words)};
export const TEMPLATE = ${JSON.stringify(files, null, 1)};
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]){
  writeFileSync(OUT, await generate());
  console.log(`wrote ${relative(root, OUT)}`);
}
