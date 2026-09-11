/** Segments de texte pour afficher des liens cliquables dans le chat. */
export type ChatBodySegment =
  | { type: 'text'; value: string }
  | { type: 'url'; href: string; label: string }
  | { type: 'join'; token: string };

const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;

export function extractJoinTokenFromUrl(url: string): string | null {
  const m = url.trim().match(/\/join\/([A-Za-z0-9_-]{8,})/i);
  return m?.[1] ?? null;
}

/** Découpe un message en texte / URL / invitation /join. */
export function parseChatBodySegments(body: string): ChatBodySegment[] {
  if (!body) return [];
  const segments: ChatBodySegment[] = [];
  let last = 0;
  const re = new RegExp(URL_RE.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'text', value: body.slice(last, match.index) });
    }
    let href = match[0];
    // Trim trailing punctuation often glued to URLs.
    href = href.replace(/[),.;!?]+$/g, '');
    const token = extractJoinTokenFromUrl(href);
    if (token) {
      segments.push({ type: 'join', token });
    } else {
      segments.push({ type: 'url', href, label: href });
    }
    last = match.index + match[0].length;
    // If we stripped punctuation, keep it as text.
    if (href.length < match[0].length) {
      segments.push({ type: 'text', value: match[0].slice(href.length) });
    }
  }
  if (last < body.length) {
    segments.push({ type: 'text', value: body.slice(last) });
  }
  return segments.length ? segments : [{ type: 'text', value: body }];
}
