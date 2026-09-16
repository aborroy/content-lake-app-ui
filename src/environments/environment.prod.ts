import { resolveRuntimeUrl } from './runtime-url';

export const environment = {
  production: true,
  // Fall back to same-origin proxy routes when runtime substitution is missing
  // or still points at localhost on a non-local deployment host.
  alfrescoUrl: resolveRuntimeUrl('__ALFRESCO_URL__', ''),
  nuxeoUrl: resolveRuntimeUrl('__NUXEO_URL__', '/nuxeo'),
  ragUrl: resolveRuntimeUrl('__RAG_URL__', '/api/rag'),
  // Loaded-connector listing (#9). Empty means the status page omits that panel, which is the default:
  // /api/connectors lives on an ingester rather than on rag-service, and nothing proxies it, so an
  // operator has to point this at a reachable ingester. A loopback URL on a remote host resolves back to
  // the empty fallback, which turns the panel off rather than leaving it failing.
  connectorsUrl: resolveRuntimeUrl('__CONNECTORS_URL__', '')
};
