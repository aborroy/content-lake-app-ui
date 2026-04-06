export const environment = {
  production: false,
  // Relative URLs — the Angular dev server proxy (proxy.conf.json) forwards
  // these paths to the deployment stack.  No CORS issues, no port hardcoding.
  alfrescoUrl: '',       // auth endpoint becomes /alfresco/api/...
  nuxeoUrl: '/nuxeo',   // auth endpoint becomes /nuxeo/api/v1/me
  ragUrl: '/api/rag'    // search/chat endpoints become /api/rag/...
};
