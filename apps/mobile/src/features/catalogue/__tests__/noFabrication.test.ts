import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN =
  /\b(generate|fake|hash|fabricate|derive)(Director|Cast|Rating|Score|Runtime|Maturity)\b/i;

describe('catalogue/display.ts fabrication guard', () => {
  it('does not export hash/fake/fabricate helpers for trust metadata', () => {
    const source = readFileSync(join(__dirname, '..', 'display.ts'), 'utf8');
    const offenders = source
      .split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => FORBIDDEN.test(line));
    expect(offenders).toEqual([]);
  });
});
