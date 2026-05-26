# content-lake-app-ui

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Angular](https://img.shields.io/badge/Angular-18-DD0031.svg)](https://angular.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue.svg)](https://docs.docker.com/compose/)
[![Status](https://img.shields.io/badge/Status-PoC-yellow.svg)]()

Demo Angular application for the Content Lake project. It provides a unified search and chat UI that talks to the RAG service and opens source documents in Alfresco ACA or Nuxeo Web UI.

## Content Lake Ecosystem

Part of the **Content Lake** ecosystem -- a PoC for ingesting Alfresco and Nuxeo content into [hxpr](https://github.com/HylandSoftware/hxpr) for hybrid semantic search and RAG.

| Repo | Role |
|---|---|
| [content-lake-app](https://github.com/aborroy/content-lake-app) | Java ingestion pipeline and RAG service |
| [content-lake-app-deployment](https://github.com/aborroy/content-lake-app-deployment) | Docker Compose stack that wires everything together |
| [alfresco-content-lake-ui](https://github.com/aborroy/alfresco-content-lake-ui) | ACA/ADW extension: semantic search + RAG chat sidebar |
| **[content-lake-app-ui](https://github.com/aborroy/content-lake-app-ui)** | Standalone demo UI (Alfresco + Nuxeo dual auth) (this repo) |
| [nuxeo-deployment](https://github.com/aborroy/nuxeo-deployment) | Local Nuxeo + PostgreSQL stack (required for Nuxeo profiles) |

## Features
- Alfresco and Nuxeo authentication inputs for demo use.
- Mixed Alfresco and Nuxeo search results from the RAG service.
- Chat UI backed by the RAG streaming endpoint.
- Deep links that open documents in ACA or Nuxeo Web UI.
- Docker image with runtime URL substitution for deployment environments.

## Quick Start

```bash
npm install
npm start
```

The dev server uses `proxy.conf.json` and proxies `/api/rag`, `/alfresco`, and `/nuxeo` to
`http://localhost` by default. The full deployment stack must be running locally (see
[content-lake-app-deployment](https://github.com/aborroy/content-lake-app-deployment)).

### Environment variables

The Docker image substitutes three placeholders at container startup:

| Placeholder | Purpose | Default (fallback) |
|---|---|---|
| `__ALFRESCO_URL__` | Alfresco Repository base URL | same-origin (`/alfresco`) |
| `__NUXEO_URL__` | Nuxeo base URL | same-origin (`/nuxeo`) |
| `__RAG_URL__` | RAG service base URL | same-origin (`/api/rag`) |

If a placeholder is unset or points at `localhost` while the browser is on a remote host, the app
falls back to same-origin proxy paths automatically.

## Build

```bash
npm run build
```

Production builds use `src/environments/environment.prod.ts`, and the container runtime replaces the `__ALFRESCO_URL__`, `__NUXEO_URL__`, and `__RAG_URL__` placeholders in the compiled bundle at startup. If those values are missing, or still point at `localhost` while the browser is on a remote host, the app falls back to same-origin proxy paths (`/alfresco`, `/nuxeo`, `/api/rag`).

## Docker

The included Dockerfile builds the Angular app and serves it with nginx. The runtime container proxies `/api/rag`, `/alfresco`, and `/nuxeo` so the browser stays same-origin.

For local deployment via `content-lake-app-deployment`, this repo is expected at the sibling path `../content-lake-app-ui` unless `CONTENT_LAKE_APP_UI_CONTEXT` is overridden.

## Project structure
- `src/` -- Angular source code.
- `src/app/` -- Application modules, services, components.
- `src/assets/i18n/` -- Translation files (`ngx-translate`).
- `src/environments/` -- Environment variables.
- `src/styles.scss` -- Material 3 theme (Satori-ready) + app design tokens.
- `angular.json` -- Project config (application builder).
- `tsconfig.json` -- TypeScript config.
- `package.json` -- Dependencies.
- `.npmrc` -- Satori package registry config.
- `.github/workflows/` -- CI quality gates placeholder (pending Satori package access).

## Satori adoption

See [docs/satori.md](docs/satori.md) for current status and remaining integration steps.
