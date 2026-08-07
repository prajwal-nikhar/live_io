import * as sanitizeHtml from "sanitize-html";

export function sanitizeInput(input: string | undefined | null): string {
  if (!input) return "";
  return sanitizeHtml(input, {
    allowedTags: [], // Strip all HTML tags
    allowedAttributes: {},
  }).trim();
}
