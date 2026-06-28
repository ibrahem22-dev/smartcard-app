import * as fs from 'node:fs';
import * as path from 'node:path';

const RTL_COMPONENT_DIR = path.join(
  process.cwd(),
  'src',
  'components',
  'rtl',
);

function readComponent(fileName: string): string {
  return fs
    .readFileSync(path.join(RTL_COMPONENT_DIR, fileName), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('RTL container double-flip regression', () => {
  test('RtlRow owns row mirroring without emitting layout direction', () => {
    const source = readComponent('RtlRow.tsx');

    expect(source).toMatch(/flexDirection:\s*dir\.rowDirection/);
    expect(source).not.toMatch(/(?<!writing)direction\s*:/);
  });

  test.each(['RtlView.tsx', 'RtlScreen.tsx', 'RtlScrollView.tsx'])(
    '%s does not emit a cascading layout direction style',
    fileName => {
      expect(readComponent(fileName)).not.toMatch(/(?<!writing)direction\s*:/);
    },
  );
});
