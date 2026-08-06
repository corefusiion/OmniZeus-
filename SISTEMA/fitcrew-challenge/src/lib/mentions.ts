// Pure helpers used on both client and server.
export const MENTION_RE = /@([a-z0-9_]{3,20})/gi;

export function extractMentionUsernames(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(MENTION_RE)) found.add(m[1].toLowerCase());
  return [...found];
}
