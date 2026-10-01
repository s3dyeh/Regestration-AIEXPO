import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = join(process.cwd(), 'src/app/features/git-learning');
const read = (lang: string): Record<string, string> =>
  JSON.parse(readFileSync(join(root, 'i18n', `${lang}.json`), 'utf8'));

test('English and Arabic catalogs cover the same keys and interpolation parameters', () => {
  const ar = read('ar'),
    en = read('en');
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ar).sort());
  const parameters = (text: string) =>
    [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]).sort();
  for (const key of Object.keys(ar)) {
    assert.ok(en[key].trim(), key);
    assert.ok(ar[key].trim(), key);
    assert.deepEqual(parameters(en[key]), parameters(ar[key]), key);
    assert.doesNotMatch(en[key], /[\u0600-\u06ff]/, key);
  }
});

test('UI and domain message keys resolve in both bundled catalogs', () => {
  const ar = read('ar'),
    en = read('en');
  const prefixes = [...new Set(Object.keys(ar).map((key) => key.split('.')[0]))].join('|');
  const pattern = new RegExp(`['"]((?:${prefixes})\\.[a-zA-Z][a-zA-Z0-9_.]*)['"]`, 'g');
  function visit(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(path);
        continue;
      }
      if (!/\.(ts|html)$/.test(path) || path.endsWith('.spec.ts')) continue;
      for (const match of readFileSync(path, 'utf8').matchAll(pattern)) {
        assert.ok(Object.hasOwn(ar, match[1]), `${path}: ${match[1]} missing in Arabic`);
        assert.ok(Object.hasOwn(en, match[1]), `${path}: ${match[1]} missing in English`);
      }
    }
  }
  visit(root);
});
