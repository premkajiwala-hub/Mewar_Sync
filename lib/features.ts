/**
 * Feature switches read at build time. Voice entry is hidden by default for
 * now; set VITE_ENABLE_VOICE=true in .env to show the microphone controls.
 */
export const VOICE_ENABLED = import.meta.env.VITE_ENABLE_VOICE === 'true';
