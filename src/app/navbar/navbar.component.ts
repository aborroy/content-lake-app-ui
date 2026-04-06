import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, AlfrescoSession, NuxeoSession } from '../services/auth.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-navbar',
  template: `
    <mat-toolbar color="primary">
      <span class="app-title" (click)="router.navigate(['/search'])" style="cursor:pointer">
        <mat-icon style="vertical-align:middle;margin-right:6px">hub</mat-icon>
        Content Lake Demo
      </span>

      <span class="spacer"></span>

      <!-- Alfresco session pill -->
      <div class="session-pill" [class.connected]="(alfresco$ | async) !== null">
        <mat-icon class="pill-icon">storage</mat-icon>
        <span class="pill-label">
          <ng-container *ngIf="alfresco$ | async as alf; else alfDisconnected">
            Alfresco · {{ alf.username }}
          </ng-container>
          <ng-template #alfDisconnected>Alfresco</ng-template>
        </span>
        <button *ngIf="(alfresco$ | async) !== null"
                mat-icon-button
                matTooltip="Logout Alfresco"
                (click)="logoutAlfresco($event)">
          <mat-icon style="font-size:16px">logout</mat-icon>
        </button>
      </div>

      <!-- Nuxeo session pill -->
      <div class="session-pill" [class.connected]="(nuxeo$ | async) !== null" style="margin-left:8px">
        <mat-icon class="pill-icon">folder_open</mat-icon>
        <span class="pill-label">
          <ng-container *ngIf="nuxeo$ | async as nux; else nuxDisconnected">
            Nuxeo · {{ nux.username }}
          </ng-container>
          <ng-template #nuxDisconnected>Nuxeo</ng-template>
        </span>
        <button *ngIf="(nuxeo$ | async) !== null"
                mat-icon-button
                matTooltip="Logout Nuxeo"
                (click)="logoutNuxeo($event)">
          <mat-icon style="font-size:16px">logout</mat-icon>
        </button>
      </div>

      <!-- Nav links -->
      <button mat-button routerLink="/search" routerLinkActive="nav-active" style="margin-left:16px">
        <mat-icon>search</mat-icon> Search
      </button>
      <button mat-button routerLink="/chat" routerLinkActive="nav-active">
        <mat-icon>chat</mat-icon> Chat
      </button>
      <button mat-button routerLink="/login">
        <mat-icon>manage_accounts</mat-icon>
      </button>
    </mat-toolbar>
  `,
  styles: [`
    .app-title { font-size: 18px; font-weight: 500; display: flex; align-items: center; }
    .spacer { flex: 1 1 auto; }

    .session-pill {
      display: flex; align-items: center; gap: 4px;
      background: rgba(255,255,255,0.15);
      border-radius: 16px; padding: 2px 10px 2px 8px;
      font-size: 13px; opacity: 0.6;
    }
    .session-pill.connected { opacity: 1; background: rgba(255,255,255,0.25); }
    .pill-icon { font-size: 16px; height: 16px; width: 16px; }
    .nav-active { background: rgba(255,255,255,0.15); border-radius: 4px; }
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
