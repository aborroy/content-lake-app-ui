# content-lake-app-ui

Demo Angular application for the Content Lake project. It provides a unified search and chat UI that talks to the RAG service and opens source documents in Alfresco ACA or Nuxeo Web UI.

## Satori adoption status

This app follows Hyland's [Satori adoption checklist](https://hyland.atlassian.net/wiki/spaces/HDF/pages/3076359112/Satori+adoption+requirements+and+roadmap):

| Level | Status | Notes |
|---|---|---|
| **Platform baseline** | Angular 18 / Material 18 | Upgraded from 17 |
| **Level 1 — Tokens & Theme** | M3 `define-theme` in `styles.scss` | Ready for Satori token swap |
| **Level 2 — Primitives** | Pure Angular Material | No ADF, no Hyland UI |
| **Level 3 — App Chrome** | Placeholder | Custom navbar; swap for Satori chrome when available |
| **Devkit — Translation** | `ngx-translate` wired | Strings extracted to `src/assets/i18n/en.json` |
| **Devkit — Auth** | Custom auth service | Evaluate Satori OIDC when available |
| **Quality gates** | CI workflow | Blocks `.mat-*` overrides and `!important` |

### To complete Satori integration

1. Install Satori UI packages once access is available:
   ```bash
   npm install @hylandsoftware/satori-ui
   ```
2. Replace the placeholder palette in `src/styles.scss` with Satori tokens.
3. Replace the custom navbar with Satori Application Chrome component.
4. Integrate Satori Devkit auth service (OIDC).

## Features
- Alfresco and Nuxeo authentication inputs for demo use.
- Mixed Alfresco and Nuxeo search results from the RAG service.
- Chat UI backed by the RAG streaming endpoint.
- Deep links that open documents in ACA or Nuxeo Web UI.
- Docker image with runtime URL substitution for deployment environments.

## Setup
```bash
npm install
npm start
```

The dev server uses `proxy.conf.json`, so it expects the deployment stack to be reachable on `http://localhost`.

## Build

```bash
npm run build
```

Production builds use `src/environments/environment.prod.ts`, and the container runtime replaces the `__ALFRESCO_URL__`, `__NUXEO_URL__`, and `__RAG_URL__` placeholders in the compiled bundle at startup.

## Docker

The included Dockerfile builds the Angular app and serves it with nginx. The runtime container proxies `/api/rag`, `/alfresco`, and `/nuxeo` so the browser stays same-origin.

For local deployment via `content-lake-app-deployment`, this repo is expected at the sibling path `../content-lake-app-ui` unless `CONTENT_LAKE_APP_UI_CONTEXT` is overridden.

## Project structure
- `src/` – Angular source code.
- `src/app/` – Application modules, services, components.
- `src/assets/i18n/` – Translation files (`ngx-translate`).
- `src/environments/` – Environment variables.
- `src/styles.scss` – Material 3 theme (Satori-ready) + app design tokens.
- `angular.json` – Project config (application builder).
- `tsconfig.json` – TypeScript config.
- `package.json` – Dependencies.
- `.npmrc` – Satori package registry config.
- `.github/workflows/satori-quality-gates.yml` – CI quality gates.
