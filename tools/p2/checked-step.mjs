#!/usr/bin/env node
/**
 * CHECKED-STEP — run a child command and print a POSITIVE sentinel only if it really passed.
 *
 * WHY THIS WRAPPER EXISTS. `tsc --noEmit` prints NOTHING on success. A step decided on the absence
 * of `/error TS[0-9]+/` therefore reads a successful compile and an OOM kill and a missing binary
 * identically — all three produce no error string. P1 shipped exactly that, and the same shape a
 * second time where a failed compile left the PREVIOUS build output in place and the ladder ran
 * stale harnesses against new source.
 *
 * So: this wrapper prints `<NAME> OK` itself, AFTER the child has exited 0, and `<NAME> FAILED`
 * otherwise. The sentinel cannot appear unless the step actually ran to completion, and a killed
 * process prints the failure marker rather than silence.
 *
 *   node tools/p2/checked-step.mjs --name TYPECHECK -- npx tsc --noEmit
 */
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const nameAt = argv.indexOf('--name');
const sepAt = argv.indexOf('--');
if (nameAt === -1 || sepAt === -1 || sepAt < nameAt) {
  console.log('CHECKED-STEP FAILED — usage: --name <NAME> -- <command> [args...]');
  process.exit(1);
}
const NAME = argv[nameAt + 1];
const cmd = argv[sepAt + 1];
const args = argv.slice(sepAt + 2);
if (!NAME || !cmd) {
  console.log('CHECKED-STEP FAILED — a name and a command are both required');
  process.exit(1);
}

const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });

if (r.error) {
  console.log(NAME + ' FAILED — could not start: ' + r.error.message);
  process.exit(1);
}
if (r.signal) {
  console.log(NAME + ' FAILED — killed by signal ' + r.signal + '. A killed process prints no error string, which is why this line exists.');
  process.exit(1);
}
if (r.status !== 0) {
  console.log(NAME + ' FAILED — exit ' + r.status);
  process.exit(1);
}
console.log(NAME + ' OK');
process.exit(0);
