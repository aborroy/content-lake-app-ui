export const environment = {
  production: false,
  // Relative URLs — the Angular dev server proxy (proxy.conf.json) forwards
  // these paths to the deployment stack.  No CORS issues, no port hardcoding.
  alfrescoUrl: '',       // auth endpoint becomes /alfresco/api/...
  nuxeoUrl: '/nuxeo',   // auth endpoint becomes /nuxeo/api/v1/me
  ragUrl: '/api/rag',   // search/chat endpoints become /api/rag/...
  // Loaded-connector listing (#9), off unless pointed at an ingester. /api/connectors is not a
  // rag-service route and nothing proxies it, so there is no same-origin path to default to. For a
  // local stack: 'http://localhost:9090/api/connectors' (Alfresco batch ingester), or ':9096' for
  // connector-batch-ingester.
  connectorsUrl: ''
};
