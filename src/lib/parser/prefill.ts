// Builds the importer's text from share-target / deep-link params (?title=&text=&url=).

export interface PrefillParams {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}

/** Title becomes a "# title" line and the link a "Source: url" line around the shared text. */
export function buildPrefillText({ title, text, url }: PrefillParams): string {
  const heading = (title ?? "").trim();
  let body = (text ?? "").replace(/\r\n?/g, "\n").trim();
  let link = (url ?? "").trim();
  // Android share sheets often put the page link in `text` instead of `url`.
  if (!link && /^https?:\/\/\S+$/i.test(body)) {
    link = body;
    body = "";
  }
  const parts: string[] = [];
  const bodyStartsWithTitle = heading && body.replace(/^#+\s*/, "").toLowerCase().startsWith(heading.toLowerCase());
  if (heading && !bodyStartsWithTitle) parts.push(`# ${heading}`);
  if (body) parts.push(body);
  if (link && !body.includes(link)) parts.push(`Source: ${link}`);
  return parts.join("\n\n");
}

export function hasPrefill(params: PrefillParams): boolean {
  return Boolean(params.title?.trim() || params.text?.trim() || params.url?.trim());
}
