#!/usr/bin/env node
/**
 * Runs a command inside the Firebase emulators (demo project, no real data):
 *   node scripts/with-emulators.mjs <auth,firestore> "<command>"
 *
 * Works around two Windows issues: the Firestore emulator JVM failing to open
 * its loopback pipe when %TEMP% is a short (8.3) path, and the emulator JVM
 * outliving `emulators:exec`.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [only = 'auth,firestore', command] = process.argv.slice(2);
if (!command) {
  console.error('usage: node scripts/with-emulators.mjs <emulators> "<command>"');
  process.exit(2);
}

const env = { ...process.env };
if (process.platform === 'win32' && !/unixdomain\.tmpdir/.test(env.JAVA_TOOL_OPTIONS || '')) {
  const tmp = path.resolve('.emulator-tmp');
  fs.mkdirSync(tmp, { recursive: true });
  env.JAVA_TOOL_OPTIONS = `${env.JAVA_TOOL_OPTIONS || ''} -Djdk.net.unixdomain.tmpdir=${tmp}`.trim();
}

const PORTS = [8085, 9099, 4400, 4500, 9150];

function freePorts() {
  if (process.platform !== 'win32') return;
  const ps = `foreach ($p in ${PORTS.join(',')}) { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }`;
  spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore' });
}

freePorts();
if (/["\r\n]/.test(command) || !/^[\w,]+$/.test(only)) {
  console.error('Refusing to run: the command must not contain double quotes or newlines.');
  process.exit(2);
}
const child = spawn(`npx firebase emulators:exec --only ${only} --project demo-mewar-sync "${command}"`, {
  stdio: 'inherit',
  shell: true,
  env,
});
child.on('exit', code => {
  freePorts();
  process.exit(code ?? 1);
});
