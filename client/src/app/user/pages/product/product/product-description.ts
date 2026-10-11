/** Build display-only bullets without changing the stored product content. */
export function filterProductDescriptionBullets(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const bullets: string[] = [];
  for (const line of value) {
    if (typeof line !== 'string') continue;
    const key = line.normalize('NFC').trim().replace(/\s+/gu, ' ');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    bullets.push(line);
  }
  return bullets;
}
