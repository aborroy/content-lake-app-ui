# Satori Adoption Status

This app targets Hyland's [Satori adoption checklist](https://hyland.atlassian.net/wiki/spaces/HDF/pages/3076359112/Satori+adoption+requirements+and+roadmap).

## Current Status

| Level | Status | Notes |
|---|---|---|
| **Platform baseline** | Angular 18 / Material 18 | Upgraded from 17 |
| **Level 1 -- Tokens & Theme** | M3 `define-theme` in `styles.scss` | Ready for Satori token swap |
| **Level 2 -- Primitives** | Pure Angular Material | No ADF, no Hyland UI |
| **Level 3 -- App Chrome** | Placeholder | Custom navbar; swap for Satori chrome when available |
| **Devkit -- Translation** | Not wired | `ngx-translate` was configured and consumed by nothing, so it was removed. Add it back with the first screen that needs a second language |
| **Devkit -- Auth** | Custom auth service | Evaluate Satori OIDC when available |
| **Quality gates** | `npm run lint:mat-overrides`, run by hand | Greps for `.mat-`, `.mdc-` and `.cdk-` selector overrides. Nothing runs it automatically: `.github/workflows/` is empty. It does **not** check `!important`, and `src/` currently holds 15 of them, four of which are a legitimate `prefers-reduced-motion` block |

## Remaining Steps

1. Install Satori UI packages once access is available:
   ```bash
   npm install @hylandsoftware/satori-ui
   ```
2. Replace the placeholder palette in `src/styles.scss` with Satori tokens.
3. Replace the custom navbar with the Satori Application Chrome component.
4. Integrate Satori Devkit auth service (OIDC).

## Notes

- `.npmrc` is pre-configured for the Satori package registry.
- The CI quality gates workflow (`.github/workflows/`) is a placeholder pending Satori package access.
