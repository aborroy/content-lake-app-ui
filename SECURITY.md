# Security Policy

## Reporting a Vulnerability

This is a Proof of Concept project intended for local development and evaluation. It is **not
designed for production use** and has not undergone a security audit.

If you discover a security vulnerability, please report it privately by opening a GitHub issue
marked **[security]** or by contacting the repository maintainer directly.

Do not open a public issue for active security vulnerabilities -- wait for acknowledgement before
public disclosure.

## Supported Versions

Only the current `main` branch is supported. No backported security patches are provided.

## Known Limitations

- Authentication is handled by the browser entering credentials directly into the demo UI -- no
  SSO or token-based auth is implemented. Do not use this app to access production systems.
- Runtime URL placeholders (`__ALFRESCO_URL__`, `__NUXEO_URL__`, `__RAG_URL__`) are substituted
  by the container entrypoint script at startup -- ensure those values are not leaked in logs.
