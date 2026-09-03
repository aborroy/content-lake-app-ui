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
