/** Escapes text for safe interpolation into HTML (e.g. printable reports). */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Neutralises spreadsheet formula injection: cells that a spreadsheet would
 * evaluate (=, +, -, @, tab, CR) are prefixed with an apostrophe.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

/** Only allow https URLs (and in-memory previews) to be used as image sources. */
export function safeImageUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  if (url.startsWith('blob:') || url.startsWith('data:image/')) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Removes **markdown bold** markers that the assistant sometimes emits. */
export function stripMarkdownEmphasis(text: string): string {
  return (text || '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '');
}

export function initials(name: string | undefined): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = Array.from(parts[0])[0] || '';
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] || '' : '';
  return (first + last).toUpperCase();
}
