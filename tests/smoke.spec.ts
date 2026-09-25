/**
 * X-02 smoke tests — catch dead placeholder links and broken CTA sections
 * before they reach production.
 * Run: npm test (vitest)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const PAGES_DIR = resolve(__dirname, '../client/src/pages');
const COMPONENTS_DIR = resolve(__dirname, '../client/src/components');

// ── 1. No placeholder href="#" in page/component source ───────────────────
describe('no dead placeholder links', () => {
  function getFiles(dir: string, ext = '.tsx'): string[] {
    try {
      return readdirSync(dir)
        .filter(f => f.endsWith(ext))
        .map(f => join(dir, f));
    } catch {
      return [];
    }
  }

  const DEAD_HREF = /href=["'](#)["']/g;

  [...getFiles(PAGES_DIR), ...getFiles(COMPONENTS_DIR)].forEach(file => {
    const name = file.split(/[\\/]/).pop()!;
    it(`${name} has no href="#" placeholders`, () => {
      const src = readFileSync(file, 'utf8');
      const matches = [...src.matchAll(DEAD_HREF)];
      expect(
        matches.map(m => `  ~line ${src.slice(0, m.index!).split('\n').length}: ${m[0]}`),
        `Dead placeholder links found in ${name}`,
      ).toHaveLength(0);
    });
  });
});

// ── 2. Critical page files exist ──────────────────────────────────────────
describe('critical page files exist', () => {
  const REQUIRED_PAGES = ['landing.tsx', 'auth-login.tsx'];

  REQUIRED_PAGES.forEach(page => {
    it(`${page} exists`, () => {
      let exists = false;
      try { readFileSync(join(PAGES_DIR, page)); exists = true; } catch { /* */ }
      expect(exists, `Missing critical page: ${page}`).toBe(true);
    });
  });
});

// ── 3. Final CTA section has at least one action ──────────────────────────
describe('landing page conversion completeness', () => {
  it('landing.tsx final CTA section contains a button or link', () => {
    const src = readFileSync(join(PAGES_DIR, 'landing.tsx'), 'utf8');
    const finalSection = src.slice(src.indexOf('Your Records. Your Control.'));
    const hasAction = /<Button|<button|<a\s/.test(finalSection.slice(0, 800));
    expect(hasAction, 'Final CTA section ("Your Records. Your Control.") has no button or link — dead end for visitors').toBe(true);
  });

  it('hero section has no more than 2 primary action buttons', () => {
    const src = readFileSync(join(PAGES_DIR, 'landing.tsx'), 'utf8');
    const heroStart = src.indexOf('data-testid="text-hero-description"');
    const heroChunk = src.slice(Math.max(0, heroStart - 600), heroStart + 200);
    const buttonCount = (heroChunk.match(/<Button/g) || []).length;
    expect(buttonCount, `Hero has ${buttonCount} buttons — more than 2 dilutes the primary CTA`).toBeLessThanOrEqual(2);
  });
});
