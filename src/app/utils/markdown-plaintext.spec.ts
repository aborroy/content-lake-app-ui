import { markdownToPlainText } from './markdown-plaintext';

describe('markdown-plaintext', () => {

  it('removesTheSyntaxThatReadsAsNoise', () => {
    const flattened = markdownToPlainText(
      '## LDAP setup\n**Define** _chain_ and [restart](https://example.com)\n- check properties'
    );

    expect(flattened).toBe('LDAP setup\nDefine chain and restart\n- check properties');
  });

  it('leavesAPartialFenceWithNoStrayBackticks', () => {
    // The reason this exists: a fence that has opened and not closed yet is what arrives mid-stream.
    expect(markdownToPlainText('Run this:\n```bash\nmvn test')).toBe('Run this:\nmvn test');
  });

  it('keepsListAndParagraphStructure', () => {
    const flattened = markdownToPlainText('1. first\n2. second\n\n\n\nA paragraph.');

    // Ordered-list numbering survives, and a run of blank lines collapses to one.
    expect(flattened).toBe('1. first\n2. second\n\nA paragraph.');
  });

  it('handlesTextWithNoMarkdownAtAll', () => {
    expect(markdownToPlainText('Just a sentence.')).toBe('Just a sentence.');
    expect(markdownToPlainText('')).toBe('');
  });
});
