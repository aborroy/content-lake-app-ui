/**
 * Markdown flattened to readable text.
 *
 * Used for one thing only: showing an answer while it is still streaming. A half-arrived answer is not
 * valid markdown -- an unclosed fence, a table with one row so far, an emphasis marker with no partner --
 * and rendering that produces a mess which then reflows on every token. So the stream is shown flattened
 * and the markdown is rendered once the answer is whole.
 *
 * Not a markdown parser and not a sanitiser. It removes syntax so the text reads as prose; anything it
 * misses shows through as literal markdown, which is the same thing the reader saw before and no worse.
 */
export function markdownToPlainText(value: string): string {
  const text = value
    .replace(/\r\n?/g, '\n')
    .replace(/```[^\n]*\n?/g, '')
    .replace(/```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '- ')
    .replace(/^\s*(\d+)\.\s+/gm, '$1. ')
    .replace(/(\*\*|__)([^*_]+)\1/g, '$2')
    .replace(/(\*|_)([^*_]+)\1/g, '$2')
    .replace(/~~([^~]+)~~/g, '$1');

  return text
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
