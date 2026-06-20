import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('CustomTabBar narrow layout contract', () => {
  const source = readFileSync(join(__dirname, '..', 'CustomTabBar.tsx'), 'utf8');

  it('keeps labels distributed and unclipped in source styles', () => {
    expect(source).toContain('paddingLeft: insets.left + 12');
    expect(source).toContain('paddingRight: insets.right + 12');
    expect(source).toContain("justifyContent: 'space-around'");
    expect(source).toContain('numberOfLines={1}');
    expect(source).toContain("textAlign: 'center'");
    expect(source).toContain("overflow: 'visible'");
  });
});
