#!/usr/bin/env node
/** Starts the API server (with --watch) and the Vite dev server together. */
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';

for (const file of ['.env.local', '.env']) if (fs.existsSync(file)) process.loadEnvFile(file);
const apiPort = Number(process.env.PORT || 8787);

const inUse = await new Promise(resolve => {
  const probe = net.createServer().once('error', () => resolve(true)).once('listening', () => probe.close(() => resolve(false)));
  probe.listen(apiPort, '127.0.0.1');
});
if (inUse) {
  console.error(`Port ${apiPort} is already in use. Another API server (possibly configured for a different Firebase project) would receive /api requests and reject sign-ins. Stop it, or set PORT in .env.`);
  process.exit(1);
}

const procs = [
  spawn(process.execPath, ['--watch', 'server/index.ts'], { stdio: 'inherit', env: { ...process.env, SERVE_STATIC: 'false' } }),
  spawn('npx vite', { stdio: 'inherit', shell: true, env: { ...process.env, API_PORT: String(apiPort) } }),
];

const stop = () => {
  for (const p of procs) p.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', code => {
  if (code && code !== 0) {
    console.error(`A dev process exited with code ${code}; stopping.`);
    stop();
  }
});
