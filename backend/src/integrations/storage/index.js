// @ts-check
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

/**
 * File storage (docs/BACKEND_RUNBOOK.md, section 2.3): proofs, and later logos, artwork and photos.
 * The fake keeps files on disk under `STORAGE_DIR` with the same interface R2 will have; links to
 * files are signed by lib/signedUrl.js and served by the API either way. config.js refuses
 * STORAGE_MODE=live until the R2 client exists (step B5).
 *
 * @typedef {object} Storage
 * @property {'fake' | 'live'} mode
 * @property {(key: string, body: Buffer | string, type: string) => Promise<void>} put
 * @property {(key: string) => Promise<{ body: Buffer; type: string } | null>} get
 */

const KEY = /^[a-z0-9][a-z0-9/_.-]{0,200}$/i;

/**
 * @param {{ dir: string }} o
 * @returns {Storage}
 */
export function createStorage({ dir }) {
  const root = resolve(dir);
  /** A key's path, never outside the folder. */
  const pathOf = (/** @type {string} */ key) => {
    if (!KEY.test(key) || key.includes('..')) throw new Error(`bad storage key: ${key}`);
    const p = resolve(join(root, key));
    if (!p.startsWith(root + sep)) throw new Error(`bad storage key: ${key}`);
    return p;
  };
  return {
    mode: 'fake',
    async put(key, body, type) {
      const p = pathOf(key);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, body);
      await writeFile(`${p}.type`, type);
    },
    async get(key) {
      try {
        const p = pathOf(key);
        const [body, type] = await Promise.all([readFile(p), readFile(`${p}.type`, 'utf8')]);
        return { body, type };
      } catch {
        return null;
      }
    },
  };
}
