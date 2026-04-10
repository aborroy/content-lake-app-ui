import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService, AlfrescoSession, NuxeoSession } from '../services/auth.service';

@Component({
  selector: 'app-navbar',
  template: `
    <mat-toolbar class="app-toolbar">
      <div class="toolbar-shell">
        <button class="brand-block" type="button" (click)="router.navigate(['/search'])">
          <span class="brand-mark">
            <mat-icon>hub</mat-icon>
          </span>
          <span class="brand-copy">
            <span class="brand-title">Content Lake</span>
            <span class="brand-subtitle">Readable multi-source search and RAG</span>
          </span>
        </button>

        <div class="toolbar-sessions">
          <div class="session-pill session-pill-alfresco" [class.connected]="(alfresco$ | async) !== null">
            <mat-icon>storage</mat-icon>
            <span class="session-label">
              <ng-container *ngIf="alfresco$ | async as alf; else alfDisconnected">
                Alfresco
                <strong>{{ alf.username }}</strong>
              </ng-container>
              <ng-template #alfDisconnected>Alfresco offline</ng-template>
            </span>
            <button *ngIf="(alfresco$ | async) !== null"
                    mat-icon-button
                    type="button"
                    matTooltip="Logout Alfresco"
                    (click)="logoutAlfresco($event)">
              <mat-icon>logout</mat-icon>
            </button>
          </div>

          <div class="session-pill session-pill-nuxeo" [class.connected]="(nuxeo$ | async) !== null">
            <mat-icon>folder_open</mat-icon>
            <span class="session-label">
              <ng-container *ngIf="nuxeo$ | async as nux; else nuxDisconnected">
                Nuxeo
                <strong>{{ nux.username }}</strong>
              </ng-container>
              <ng-template #nuxDisconnected>Nuxeo offline</ng-template>
            </span>
            <button *ngIf="(nuxeo$ | async) !== null"
                    mat-icon-button
                    type="button"
                    matTooltip="Logout Nuxeo"
                    (click)="logoutNuxeo($event)">
              <mat-icon>logout</mat-icon>
            </button>
          </div>
        </div>

        <div class="toolbar-nav">
          <button mat-button routerLink="/search" routerLinkActive="nav-active" class="nav-button">
            <mat-icon>search</mat-icon>
            Search
          </button>
          <button mat-button routerLink="/chat" routerLinkActive="nav-active" class="nav-button">
            <mat-icon>chat</mat-icon>
            Chat
          </button>
          <button mat-button routerLink="/login" routerLinkActive="nav-active" class="nav-button">
            <mat-icon>manage_accounts</mat-icon>
            Connections
          </button>
        </div>
      </div>
    </mat-toolbar>
  `,
  styles: [`
    .app-toolbar {
      position: sticky;
      top: 0;
      z-index: 20;
      height: auto;
      min-height: 88px;
      padding: 14px 20px;
      background:
        linear-gradient(135deg, rgba(17, 34, 58, 0.94), rgba(24, 49, 38, 0.92)),
        radial-gradient(circle at right, rgba(47, 109, 246, 0.22), transparent 30%),
        radial-gradient(circle at left, rgba(118, 184, 42, 0.14), transparent 28%);
      color: #f5fbf7;
      box-shadow: 0 14px 32px rgba(16, 31, 24, 0.18);
    }

    .toolbar-shell {
      width: 100%;
      max-width: 1280px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .brand-block {
      display: flex;
      align-items: center;
      gap: 14px;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      padding: 0;
      text-align: left;
    }

    .brand-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 50px;
      height: 50px;
      border-radius: 18px;
      background: linear-gradient(145deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.08));
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
    }

    .brand-mark mat-icon {
      font-size: 24px;
      height: 24px;
      width: 24px;
    }

    .brand-copy {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .brand-title {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.04em;
    }

    .brand-subtitle {
      font-size: 12px;
      color: rgba(245, 251, 247, 0.72);
      text-transform: uppercase;
      letter-spacing: 0.14em;
    }

    .toolbar-sessions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1 1 320px;
      flex-wrap: wrap;
    }

    .session-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 44px;
      padding: 6px 10px 6px 12px;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.08);
      color: rgba(245, 251, 247, 0.7);
      transition: 160ms ease;
    }

    .session-pill.connected {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.14);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    }

    .session-pill mat-icon:first-child {
      font-size: 18px;
      height: 18px;
      width: 18px;
    }

    .session-pill-alfresco.connected {
      border-color: rgba(118, 184, 42, 0.35);
      background: linear-gradient(135deg, rgba(118, 184, 42, 0.2), rgba(255, 255, 255, 0.12));
    }

    .session-pill-nuxeo.connected {
      border-color: rgba(47, 109, 246, 0.35);
      background: linear-gradient(135deg, rgba(47, 109, 246, 0.2), rgba(255, 255, 255, 0.12));
    }

    .session-label {
      display: flex;
      flex-direction: column;
      gap: 1px;
      font-size: 11px;
      line-height: 1.2;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .session-label strong {
      font-size: 13px;
      letter-spacing: normal;
      text-transform: none;
    }

    .toolbar-nav {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
      flex-wrap: wrap;
    }

    .nav-button {
      min-height: 42px;
      border-radius: 14px;
      color: rgba(245, 251, 247, 0.84);
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid transparent;
    }

    .nav-active {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.14);
      border-color: rgba(255, 255, 255, 0.16);
    }

    @media (max-width: 920px) {
      .app-toolbar {
        padding: 14px 16px;
      }

      .toolbar-shell {
        gap: 12px;
      }

      .toolbar-nav {
        margin-left: 0;
      }
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
