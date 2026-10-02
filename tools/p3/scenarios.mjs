#!/usr/bin/env node
/** Run WP-6.11's Jest battery and print its contractual, count-bearing sentinel. */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const jestBin = join(root, 'node_modules', 'jest', 'bin', 'jest.js');
const suite = 'src/engines/__tests__/p3-scenarios.test.ts';
const result = spawnSync(process.execPath, [
  jestBin,
  '--config',
  join(root, 'jest.config.cjs'),
  '--selectProjects',
  'unit',
  '--runInBand',
  '--testPathPattern',
  suite,
], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
});

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
process.stdout.write(output);

const count = output.match(/Tests:\s+(?:\d+ failed,\s+)?(\d+) passed,\s+(\d+) total/);
const passed = Number(count?.[1] ?? 0);
const total = Number(count?.[2] ?? 0);
if (result.status === 0 && passed === 23 && total === 23) {
  console.log('\nSCENARIOS OK — 23 of 23');
} else {
  console.log(`\nSCENARIOS FAILED — ${passed} passed of ${total || 23}`);
  process.exitCode = 1;
}
