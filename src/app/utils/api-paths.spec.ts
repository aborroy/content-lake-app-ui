import { connectorPathPrefixes, resolveConnectorUrls, resolveStatusUrl } from './api-paths';

describe('resolveStatusUrl', () => {
  it('puts the status endpoint beside the RAG base rather than under it', () => {
    expect(resolveStatusUrl('/api/rag')).toBe('/api/status');
    expect(resolveStatusUrl('/api/rag/')).toBe('/api/status');
  });
});

describe('resolveConnectorUrls', () => {
  it('is null when no connector host is configured, which is how the screens hide themselves', () => {
    expect(resolveConnectorUrls('')).toBeNull();
    expect(resolveConnectorUrls('   ')).toBeNull();
  });

  it('derives every sibling endpoint from the one configured value', () => {
    const urls = resolveConnectorUrls('/api/connectors')!;

    expect(urls.connectors).toBe('/api/connectors');
    expect(urls.schema).toBe('/api/connectors/schema');
    expect(urls.browseRoots).toBe('/api/browse/roots');
    expect(urls.browseChildren).toBe('/api/browse/children');
    expect(urls.selection).toBe('/api/selection');
    expect(urls.sync).toBe('/api/sync');
  });

  it('keeps the host status off /api/status, which belongs to rag-service', () => {
    // The demo UI compares the rag-service status path by exact equality, so a collision here would break
    // the status screen and the interceptor's credential attachment together.
    const urls = resolveConnectorUrls('/api/connectors')!;

    expect(urls.connectorStatus).toBe('/api/connector-status');
    expect(urls.connectorStatus).not.toBe('/api/status');
  });

  it('accepts an absolute origin, for a host reached on its own published port', () => {
    const urls = resolveConnectorUrls('http://localhost:9096/api/connectors')!;

    expect(urls.browseRoots).toBe('http://localhost:9096/api/browse/roots');
    expect(urls.selection).toBe('http://localhost:9096/api/selection');
  });

  it('tolerates a trailing slash and a value that omits the path', () => {
    // An operator who sets the host's origin rather than the full endpoint should get something that works.
    expect(resolveConnectorUrls('/api/connectors/')!.selection).toBe('/api/selection');
    expect(resolveConnectorUrls('http://localhost:9096')!.connectors)
      .toBe('http://localhost:9096/api/connectors');
  });
});

describe('connectorPathPrefixes', () => {
  it('is empty when nothing is configured, so the interceptor matches nothing', () => {
    expect(connectorPathPrefixes(null)).toEqual([]);
  });

  it('covers every connector path and deduplicates the shared parents', () => {
    const prefixes = connectorPathPrefixes(resolveConnectorUrls('/api/connectors'));

    expect(prefixes).toContain('/api/connectors');
    expect(prefixes).toContain('/api/browse/roots');
    expect(prefixes).toContain('/api/selection');
    expect(prefixes).toContain('/api/sync');
    expect(prefixes).toContain('/api/connector-status');
    // /api/connectors/schema collapses into /api/connectors, which the interceptor matches by prefix.
    expect(prefixes).not.toContain('/api/connectors/schema');
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it('reduces an absolute URL to its path, since the interceptor compares paths', () => {
    const prefixes = connectorPathPrefixes(resolveConnectorUrls('http://localhost:9096/api/connectors'));

    expect(prefixes).toContain('/api/connectors');
    expect(prefixes.every(p => p.startsWith('/'))).toBe(true);
  });
});
