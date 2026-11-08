// Keeps `npm run emulators` alive until Ctrl+C.
console.log('Emulators running (Auth :9099, Firestore :8085). Press Ctrl+C to stop.');
setInterval(() => {}, 1 << 30);
