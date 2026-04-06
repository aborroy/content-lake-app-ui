# content-lake-app-ui

Demo Angular application for the Content Lake project. It provides a unified search and chat UI that talks to the RAG service and opens source documents in Alfresco ACA or Nuxeo Web UI.

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

The included [Dockerfile](/Users/angel.fernandoborroy/Downloads/zz-hxpr/dev/content-lake-app-ui/Dockerfile) builds the Angular app and serves it with nginx. The runtime container proxies `/api/rag`, `/alfresco`, and `/nuxeo` so the browser stays same-origin.

For local deployment via `content-lake-app-deployment`, this repo is expected at the sibling path `../content-lake-app-ui` unless `CONTENT_LAKE_APP_UI_CONTEXT` is overridden.

## GitHub Prep

Before pushing:
- Initialize the repository with `git init -b main`
- Add your GitHub remote
- Review the generated files excluded by `.gitignore`
- Decide whether you want to add a license file for the new repository

## Project structure
- `src/` – Angular source code.
- `src/app/` – Application modules, services, components.
- `src/environments/` – Environment variables.
- `angular.json` – Project config.
- `tsconfig.json` – TypeScript config.
- `package.json` – Dependencies.

## Development
Use `ng generate` commands to add components, services, etc.

## Known gaps
- No automated unit or e2e tests yet.
- No lint task is configured yet.
- The app still uses Google-hosted fonts at runtime; production builds no longer inline those fonts so CI and Docker builds do not require outbound internet.
- A repository license is not included yet because that is usually a product or legal choice.

---

Enjoy!
