/** Waits until both Firebase emulators accept requests before any test runs. */
export default async function globalSetup() {
  const targets = ['http://127.0.0.1:9099/', 'http://127.0.0.1:8085/'];
  const deadline = Date.now() + 90_000;
  for (const url of targets) {
    for (;;) {
      try {
        const res = await fetch(url);
        if (res.status < 500) break;
      } catch {
        /* not up yet */
      }
      if (Date.now() > deadline) throw new Error(`Emulator at ${url} did not start in time`);
      await new Promise(r => setTimeout(r, 500));
    }
  }
}
