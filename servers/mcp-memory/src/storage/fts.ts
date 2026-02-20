/**
 * Build an FTS5-compatible query from a raw user string.
 * Strategy: tokenize → prefix-match each term → OR-join for broad recall.
 */
export function buildFtsQuery(raw: string): string {
  const tokens = raw
    .replace(/[^\w\s]/g, ' ') // strip punctuation
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => `"${t}"*`); // prefix-match each token

  if (tokens.length === 0) return '';
  return tokens.join(' OR ');
}
