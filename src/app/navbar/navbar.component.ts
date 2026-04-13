import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService, AlfrescoSession, NuxeoSession } from '../services/auth.service';

// Satori App Chrome integration point:
// When Satori's Application Shell header component is available, replace this
// custom toolbar with the platform-provided chrome (Level 3 adoption).
// https://hyland.atlassian.net/wiki/spaces/HDF/pages/2566653230
// https://hyland.atlassian.net/wiki/spaces/HDF/pages/3076359112
@Component({
  selector: 'app-navbar',
  template: `
    <mat-toolbar class="app-toolbar">
      <div class="toolbar-shell">

        <!-- Brand block: official Hyland horizontal logo + product name -->
        <button class="brand-block" type="button" (click)="router.navigate(['/search'])">
          <!--
            hyland-logo.svg = official horizontal logo (mark + wordmark, coloured variant).
            Geometry from the Adobe Illustrator brand asset; polygons unchanged.
          -->
          <img src="assets/hyland-logo.svg" class="hy-logo" alt="Hyland" />
          <span class="brand-divider" aria-hidden="true"></span>
          <span class="brand-copy">
            <span class="brand-title">Content Lake</span>
            <span class="brand-subtitle">Multi-source search &amp; RAG</span>
          </span>
        </button>

        <!-- Primary navigation -->
        <nav class="toolbar-nav" aria-label="Main navigation">
          <a mat-button routerLink="/search" routerLinkActive="nav-active" class="nav-button">
            <mat-icon>search</mat-icon>
            Search
          </a>
          <a mat-button routerLink="/chat" routerLinkActive="nav-active" class="nav-button">
            <mat-icon>chat</mat-icon>
            Chat
          </a>
          <a mat-button routerLink="/login" routerLinkActive="nav-active" class="nav-button">
            <mat-icon>manage_accounts</mat-icon>
            Connections
          </a>
        </nav>

        <!-- Repository session status indicators -->
        <div class="toolbar-sessions" role="status" aria-label="Repository sessions">

          <div class="session-pill session-pill-alfresco"
               [class.connected]="(alfresco$ | async) !== null">
            <mat-icon class="session-icon">storage</mat-icon>
            <span class="session-label">
              <span class="session-source">Alfresco</span>
              <ng-container *ngIf="alfresco$ | async as alf; else alfOff">
                <strong class="session-user">{{ alf.username }}</strong>
              </ng-container>
              <ng-template #alfOff>
                <span class="session-offline">offline</span>
              </ng-template>
            </span>
            <button *ngIf="(alfresco$ | async) !== null"
                    mat-icon-button type="button"
                    class="session-logout"
                    matTooltip="Disconnect Alfresco"
                    (click)="logoutAlfresco($event)">
              <mat-icon>logout</mat-icon>
            </button>
          </div>

          <div class="session-pill session-pill-nuxeo"
               [class.connected]="(nuxeo$ | async) !== null">
            <mat-icon class="session-icon">folder_open</mat-icon>
            <span class="session-label">
              <span class="session-source">Nuxeo</span>
              <ng-container *ngIf="nuxeo$ | async as nux; else nuxOff">
                <strong class="session-user">{{ nux.username }}</strong>
              </ng-container>
              <ng-template #nuxOff>
                <span class="session-offline">offline</span>
              </ng-template>
            </span>
            <button *ngIf="(nuxeo$ | async) !== null"
                    mat-icon-button type="button"
                    class="session-logout"
                    matTooltip="Disconnect Nuxeo"
                    (click)="logoutNuxeo($event)">
              <mat-icon>logout</mat-icon>
            </button>
          </div>

        </div>
      </div>

      <!--
        4-colour accent stripe — mirrors the logo's mark colours in order.
        Will be replaced by Satori App Shell chrome when @hyland/ui-shell is integrated.
      -->
      <div class="toolbar-accent" aria-hidden="true"></div>
    </mat-toolbar>
  `,
  styles: [`
    /* Override Material toolbar background for white Hyland chrome */
    :host {
      --mat-toolbar-container-color: #ffffff;
    }

    .app-toolbar {
      position: sticky;
      top: 0;
      z-index: 20;
      height: auto;
      min-height: 64px;
      padding: 0 20px;
      /* White background — matches hyland.com header */
      background: #ffffff;
      color: var(--hy-navy);
      border-bottom: 1px solid var(--hy-gray-200);
      box-shadow: 0 1px 6px rgba(0, 0, 0, 0.07);
      overflow: hidden;
    }

    .toolbar-shell {
      width: 100%;
      max-width: 1280px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 4px;
      min-height: 60px;
    }

    /* ── Brand block ─────────────────────────────────── */

    .brand-block {
      display: flex;
      align-items: center;
      gap: 10px;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      padding: 6px 8px 6px 0;
      text-align: left;
      border-radius: 6px;
      transition: background 120ms ease;
      flex-shrink: 0;
    }

    .brand-block:hover {
      background: var(--hy-gray-50);
    }

    /*
     * Official horizontal logo (mark + "HYLAND" wordmark vector).
     * viewBox 1200×248.3 → aspect ratio 4.83:1.
     * At height 30px the rendered width is ~145px, which fits the navbar.
     */
    .hy-logo {
      height: 30px;
      width: auto;
      display: block;
      /* Prevent blurry sub-pixel rendering on retina */
      image-rendering: crisp-edges;
    }

    .brand-divider {
      width: 1px;
      height: 28px;
      background: var(--hy-gray-200);
      flex-shrink: 0;
      margin: 0 2px;
    }

    .brand-copy {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .brand-title {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--hy-navy);
      line-height: 1.2;
    }

    .brand-subtitle {
      font-size: 10px;
      color: var(--cl-text-soft);
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-weight: 500;
      line-height: 1.2;
    }

    /* ── Navigation ──────────────────────────────────── */

    .toolbar-nav {
      display: flex;
      align-items: center;
      gap: 2px;
      margin-left: 16px;
    }

    .nav-button {
      height: 36px;
      border-radius: 6px;
      color: var(--hy-gray-500);
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.01em;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 0 12px;
      text-decoration: none;
      border: 1px solid transparent;
      transition: all 120ms ease;
    }

    .nav-button mat-icon {
      font-size: 17px;
      height: 17px;
      width: 17px;
    }

    .nav-button:hover {
      color: var(--hy-navy);
      background: var(--hy-gray-50);
      text-decoration: none;
    }

    .nav-active {
      color: var(--hy-navy) !important;
      background: var(--hy-gray-100) !important;
      border-color: var(--hy-gray-200) !important;
    }

    /* ── Session pills ───────────────────────────────── */

    .toolbar-sessions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
      flex-shrink: 0;
      flex-wrap: wrap;
    }

    .session-pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 5px 8px 5px 10px;
      border-radius: 6px;
      border: 1px solid var(--hy-gray-200);
      background: var(--hy-gray-50);
      color: var(--hy-gray-400);
      font-size: 12px;
      transition: all 140ms ease;
    }

    .session-pill.connected {
      color: var(--hy-navy);
      background: #ffffff;
      border-color: var(--hy-gray-300);
    }

    .session-icon {
      font-size: 16px;
      height: 16px;
      width: 16px;
      flex-shrink: 0;
      color: var(--hy-gray-300);
    }

    .connected .session-icon { color: var(--hy-gray-500); }

    .session-pill-alfresco.connected .session-icon { color: var(--source-alfresco-strong); }
    .session-pill-nuxeo.connected   .session-icon { color: var(--source-nuxeo-strong); }

    .session-pill-alfresco.connected {
      border-color: rgba(120, 190, 32, 0.35);
      background: rgba(239, 248, 223, 0.6);
    }

    .session-pill-nuxeo.connected {
      border-color: rgba(0, 163, 224, 0.3);
      background: rgba(229, 246, 252, 0.6);
    }

    .session-label {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }

    .session-source {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-weight: 700;
      color: var(--hy-gray-400);
      line-height: 1.1;
    }

    .connected .session-source { color: var(--cl-text-muted); }

    .session-user {
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 110px;
      line-height: 1.2;
      color: var(--hy-navy);
    }

    .session-offline {
      font-size: 11px;
      color: var(--hy-gray-300);
      font-style: italic;
    }

    .session-logout {
      width: 26px;
      height: 26px;
      line-height: 26px;
      color: var(--hy-gray-400);
      flex-shrink: 0;
    }

    .session-logout mat-icon { font-size: 14px; }
    .session-logout:hover { color: var(--hy-navy); }

    /* ── 4-colour brand accent stripe ───────────────── */
    /*
     * Mirrors the logo mark's four colours in left-to-right order.
     * Hard stops (no blur) — each band maps to one parallelogram.
     */
    .toolbar-accent {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg,
        var(--hy-mark-yellow)  0%,
        var(--hy-mark-yellow) 25%,
        var(--hy-mark-purple) 25%,
        var(--hy-mark-purple) 50%,
        var(--hy-mark-blue)   50%,
        var(--hy-mark-blue)   75%,
        var(--hy-mark-teal)   75%,
        var(--hy-mark-teal)  100%
      );
    }

    /* ── Responsive ──────────────────────────────────── */

    @media (max-width: 960px) {
      .toolbar-shell {
        flex-wrap: wrap;
        padding: 6px 0;
        min-height: 0;
        gap: 8px;
      }
      .toolbar-nav   { margin-left: 8px; }
      .toolbar-sessions { margin-left: auto; }
    }

    @media (max-width: 700px) {
      .brand-subtitle { display: none; }
      .hy-wordmark    { display: none; }
      .session-user   { max-width: 72px; }
    }
  `]
})
export class NavbarComponent {
  alfresco$: Observable<AlfrescoSession | null>;
  nuxeo$: Observable<NuxeoSession | null>;

  constructor(public router: Router, private auth: AuthService) {
    this.alfresco$ = auth.alfrescoSession$;
    this.nuxeo$ = auth.nuxeoSession$;
  }

  logoutAlfresco(event: Event): void {
    event.stopPropagation();
    this.auth.logoutAlfresco();
  }

  logoutNuxeo(event: Event): void {
    event.stopPropagation();
    this.auth.logoutNuxeo();
  }
}
