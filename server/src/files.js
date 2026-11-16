/* Where the server keeps its files - the Store's games, games sent in,
   requested-game drafts - behind one small interface, so the place can
   change without anything else changing. Today it's a folder (the data
   folder, on the laptop); in the cloud it'd be a bucket (Amazon S3), with
   the same four calls. Everything's async, and keys look like S3's:
   "games/pop-party.orlis".

     files.list(prefix)    [{ key, size, modified }]  (modified: ms)
     files.get(key)        the bytes (a Buffer), or null if there's none
     files.put(key, bytes)
     files.del(key)        true if there was one
     files.where(prefix)   where that is, in words (for the log)

   (Backups aren't here: on the laptop they're a copy of the data folder; in
   the cloud the database and the bucket keep their own.) */
import { mkdir, readdir, readFile, writeFile, unlink, stat, rename } from 'node:fs/promises';
import { join, dirname, sep, resolve } from 'node:path';

/* a key: a few plain parts, never anything that could step out of the store */
export function checkKey(key){
  if (typeof key !== 'string' || !key || key.length > 300 || key.startsWith('/') || key.includes('\\') || key.includes('\0')
    || key.split('/').some(p => !p || p === '.' || p === '..')) throw new Error(`not a file name the store keeps: ${String(key).slice(0, 60)}`);
  return key;
}

export function folderFiles(root){
  const base = resolve(root);
  const path = (key) => join(base, ...checkKey(key).split('/'));
  return {
    kind: 'folder',
    async list(prefix = ''){
      /* (a prefix is a folder, as S3 is used here: "games/") */
      const dir = prefix ? join(base, ...prefix.replace(/\/$/, '').split('/').map(p => checkKey(p))) : base;
      let names;
      try { names = await readdir(dir, { withFileTypes: true }); } catch { return []; }
      const out = [];
      for (const n of names){
        if (!n.isFile() || n.name.endsWith('.part')) continue;
        try { const st = await stat(join(dir, n.name)); out.push({ key: (prefix ? prefix.replace(/\/$/, '') + '/' : '') + n.name, size: st.size, modified: st.mtimeMs }); } catch {}
      }
      return out;
    },
    async get(key){ try { return await readFile(path(key)); } catch (e){ if (e.code === 'ENOENT') return null; throw e; } },
    /* (written whole, then swapped in: a reader never sees half a file) */
    async put(key, bytes){
      const p = path(key);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p + '.part', bytes);
      await rename(p + '.part', p);
    },
    async del(key){ try { await unlink(path(key)); return true; } catch (e){ if (e.code === 'ENOENT') return false; throw e; } },
    where(prefix = ''){ return prefix ? join(base, ...prefix.replace(/\/$/, '').split('/')) + sep : base; }
  };
}
