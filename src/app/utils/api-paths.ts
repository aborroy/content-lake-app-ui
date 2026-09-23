import { environment } from '../../environments/environment';

/**
 * Resolves the operational status endpoint from the configured RAG base URL.
 *
 * `/api/status` is a *sibling* of `/api/rag`, not a child of it, so it does not match a
 * "starts with the RAG base path" test. Both the caller and the auth interceptor have to agree on
 * where it lives; deriving it in each of them independently is what left the status request without
 * an Authorization header and answering 401 for a signed-in user.
 */
export function resolveStatusUrl(ragUrl: string = environment.ragUrl): string {
  return /\/api\/rag\/?$/.test(ragUrl)
    ? ragUrl.replace(/\/api\/rag\/?$/, '/api/status')
    : `${ragUrl}/../status`;
}

/**
 * The plugin host's endpoints, derived from the one URL a deployment configures.
 *
 * Only `connectorsUrl` is configured, and the rest are its siblings: the host serves `/api/connectors`,
 * `/api/browse`, `/api/selection`, `/api/sync` and its own status under one origin. Deriving them here rather
 * than adding four more settings keeps a deployment from being able to point them at different places, which
 * would be a configuration with no valid use.
 *
 * The same reasoning as {@link resolveStatusUrl}, and the same trap: the auth interceptor has to agree with
 * these, because a path it does not recognise gets no credential and comes back 401.
 */
export function resolveConnectorUrls(connectorsUrl: string = environment.connectorsUrl): ConnectorUrls | null {
  const configured = (connectorsUrl ?? '').trim();
  if (!configured) {
    return null;
  }
  // Tolerates a trailing slash and a configured value that already omits the path, so an operator who sets
  // the host's origin rather than the full endpoint gets something that works instead of a 404.
  const base = configured.replace(/\/+$/, '').replace(/\/api\/connectors$/, '');
  return {
    connectors: `${base}/api/connectors`,
    schema: `${base}/api/connectors/schema`,
    browseRoots: `${base}/api/browse/roots`,
    browseChildren: `${base}/api/browse/children`,
    selection: `${base}/api/selection`,
    sync: `${base}/api/sync`,
    // Not /api/status: that path belongs to rag-service, and the proxy exposes the host's own summary here
    // precisely so the two do not collide.
    connectorStatus: `${base}/api/connector-status`
  };
}

/** Every path a connector request can go to, for the interceptor's membership test. */
export function connectorPathPrefixes(urls: ConnectorUrls | null): string[] {
  if (!urls) {
    return [];
  }
  return [urls.connectors, urls.browseRoots, urls.browseChildren, urls.selection, urls.sync,
    urls.connectorStatus]
    .map(toPath)
    // /api/connectors covers /api/connectors/schema, and browse/roots and browse/children share a parent.
    // Deduplicating keeps the interceptor's loop short and its debugging legible.
    .filter((path, index, all) => path !== null && all.indexOf(path) === index) as string[];
}

function toPath(url: string): string | null {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return null;
  }
}

export interface ConnectorUrls {
  connectors: string;
  schema: string;
  browseRoots: string;
  browseChildren: string;
  selection: string;
  sync: string;
  connectorStatus: string;
}
