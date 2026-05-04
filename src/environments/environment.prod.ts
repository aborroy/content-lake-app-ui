import { resolveRuntimeUrl } from './runtime-url';

export const environment = {
  production: true,
  // Fall back to same-origin proxy routes when runtime substitution is missing
  // or still points at localhost on a non-local deployment host.
  alfrescoUrl: resolveRuntimeUrl('__ALFRESCO_URL__', ''),
  nuxeoUrl: resolveRuntimeUrl('__NUXEO_URL__', '/nuxeo'),
  ragUrl: resolveRuntimeUrl('__RAG_URL__', '/api/rag')
};
