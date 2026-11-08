/**
 * Browser-side image preparation: validates user-selected files and
 * downscales them before upload/AI analysis so payloads stay small.
 */

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024;

export class ImageValidationError extends Error {}

export function validateImageFile(file: File | Blob | null | undefined): void {
  if (!file) throw new ImageValidationError('Choose a photo first.');
  // Some phone cameras report HEIC; browsers cannot decode it reliably.
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new ImageValidationError('Please choose a JPG, PNG or WebP photo.');
  }
  if (file.size === 0) throw new ImageValidationError('That file is empty.');
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new ImageValidationError('That photo is too large (max 15 MB).');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageValidationError('This photo could not be read. Try another one.'));
    img.src = src;
  });
}

/** Re-encodes an image as JPEG no larger than `maxDimension` on its longest side. */
export async function downscaleImage(file: Blob, maxDimension = 1600, quality = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageValidationError('Your browser could not process this photo.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new ImageValidationError('Your browser could not process this photo.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new ImageValidationError('This photo could not be read.'));
    reader.readAsDataURL(blob);
  });
}

/** Validates, downscales and base64-encodes a photo for the AI endpoints. */
export async function prepareImageForAI(file: File | Blob): Promise<{ image: string; mimeType: 'image/jpeg' }> {
  validateImageFile(file);
  const scaled = await downscaleImage(file, 1600, 0.85);
  return { image: await blobToBase64(scaled), mimeType: 'image/jpeg' };
}
