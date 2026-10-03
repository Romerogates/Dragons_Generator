/**
 * Scanne le code pour les IDs Iconify utilisés, télécharge les SVG une fois
 * depuis l’API Iconify, et écrit un JSON offline consommé au boot.
 *
 * Usage: node scripts/build-iconify-bundle.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(webRoot, 'src');
const outFile = path.join(webRoot, 'public', 'assets', 'iconify', 'dg-icons.json');

const ICON_RE = /(?:fluent-emoji|mdi|fluent):[a-z0-9-]+/g;

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(ts|html)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

function collectIconIds() {
  const set = new Set();
  for (const file of walk(srcRoot)) {
    const text = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = ICON_RE.exec(text))) set.add(m[0]);
  }
  return [...set].sort();
}

function groupByPrefix(ids) {
  /** @type {Record<string, string[]>} */
  const groups = {};
  for (const id of ids) {
    const [prefix, name] = id.split(':');
    if (!prefix || !name) continue;
    (groups[prefix] ??= []).push(name);
  }
  return groups;
}

async function fetchPrefix(prefix, names) {
  const chunkSize = 40;
  /** @type {Record<string, unknown>} */
  const icons = {};
  let width;
  let height;
  for (let i = 0; i < names.length; i += chunkSize) {
    const chunk = names.slice(i, i + chunkSize);
    const url = `https://api.iconify.design/${prefix}.json?icons=${chunk.join(',')}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Iconify ${prefix} HTTP ${res.status} (${chunk.length} icons)`);
    }
    const data = await res.json();
    if (data.width != null) width = data.width;
    if (data.height != null) height = data.height;
    Object.assign(icons, data.icons ?? {});
    const missing = data.not_found ?? [];
    if (missing.length) {
      console.warn(`[iconify-bundle] missing ${prefix}: ${missing.join(', ')}`);
    }
  }
  return {
    prefix,
    icons,
    ...(width != null ? { width } : {}),
    ...(height != null ? { height } : {}),
  };
}

async function main() {
  const ids = collectIconIds();
  const groups = groupByPrefix(ids);
  console.log(
    `[iconify-bundle] ${ids.length} icons —`,
    Object.entries(groups)
      .map(([p, n]) => `${p}:${n.length}`)
      .join(', '),
  );

  const collections = [];
  for (const [prefix, names] of Object.entries(groups)) {
    collections.push(await fetchPrefix(prefix, names));
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(collections) + '\n', 'utf8');
  const kb = (fs.statSync(outFile).size / 1024).toFixed(1);
  console.log(`[iconify-bundle] wrote ${outFile} (${kb} KiB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
