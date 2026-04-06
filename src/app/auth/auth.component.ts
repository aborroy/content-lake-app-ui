import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-auth',
  template: `
    <div class="page-container" style="max-width:900px">
      <h2 style="margin-bottom:4px">Connect Repositories</h2>
      <p style="color:#616161;margin-top:0;margin-bottom:16px">
        Log in to one or both repositories. Active sessions are combined — results
        and permissions are resolved independently for each source.
      </p>

      <!-- Status panel -->
      <app-status-panel></app-status-panel>

      <!-- Side-by-side login cards -->
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:24px">

        <!-- Alfresco -->
        <mat-card style="flex:1;min-width:280px">
          <mat-card-header>
            <mat-icon mat-card-avatar style="color:#1565c0">storage</mat-icon>
            <mat-card-title>Alfresco</mat-card-title>
            <mat-card-subtitle>
              <span *ngIf="alfrescoLoggedIn" style="color:#2e7d32;font-weight:500">
                ✓ Connected as {{ alfrescoUser }}
              </span>
              <span *ngIf="!alfrescoLoggedIn" style="color:#9e9e9e">Not connected</span>
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content style="padding-top:8px">
            <mat-form-field appearance="outline" style="width:100%;margin-bottom:-8px">
              <mat-label>Username</mat-label>
              <input matInput [(ngModel)]="alfrescoUsername" [disabled]="alfrescoLoading" />
            </mat-form-field>
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Password</mat-label>
              <input matInput type="password" [(ngModel)]="alfrescoPassword"
                     [disabled]="alfrescoLoading" (keyup.enter)="loginAlfresco()" />
            </mat-form-field>
            <p *ngIf="alfrescoError" style="color:#c62828;font-size:12px;margin:0">
              {{ alfrescoError }}
            </p>
          </mat-card-content>
          <mat-card-actions>
            <button mat-raised-button color="primary"
                    (click)="loginAlfresco()" [disabled]="alfrescoLoading">
              <mat-spinner *ngIf="alfrescoLoading" diameter="16"
                           style="display:inline-block;margin-right:6px"></mat-spinner>
              {{ alfrescoLoggedIn ? 'Re-login' : 'Login' }}
            </button>
            <button mat-button *ngIf="alfrescoLoggedIn" (click)="logoutAlfresco()">Logout</button>
          </mat-card-actions>
        </mat-card>

        <!-- Nuxeo -->
        <mat-card style="flex:1;min-width:280px">
          <mat-card-header>
            <mat-icon mat-card-avatar style="color:#c62828">folder_open</mat-icon>
            <mat-card-title>Nuxeo</mat-card-title>
            <mat-card-subtitle>
              <span *ngIf="nuxeoLoggedIn" style="color:#2e7d32;font-weight:500">
                ✓ Connected as {{ nuxeoUser }}
              </span>
              <span *ngIf="!nuxeoLoggedIn" style="color:#9e9e9e">Not connected</span>
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content style="padding-top:8px">
            <mat-form-field appearance="outline" style="width:100%;margin-bottom:-8px">
              <mat-label>Username</mat-label>
              <input matInput [(ngModel)]="nuxeoUsername" [disabled]="nuxeoLoading" />
            </mat-form-field>
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Password</mat-label>
              <input matInput type="password" [(ngModel)]="nuxeoPassword"
                     [disabled]="nuxeoLoading" (keyup.enter)="loginNuxeo()" />
            </mat-form-field>
            <p *ngIf="nuxeoError" style="color:#c62828;font-size:12px;margin:0">
              {{ nuxeoError }}
            </p>
          </mat-card-content>
          <mat-card-actions>
            <button mat-raised-button
                    style="background:#c62828;color:white"
                    (click)="loginNuxeo()" [disabled]="nuxeoLoading">
              <mat-spinner *ngIf="nuxeoLoading" diameter="16"
                           style="display:inline-block;margin-right:6px"></mat-spinner>
              {{ nuxeoLoggedIn ? 'Re-login' : 'Login' }}
            </button>
            <button mat-button *ngIf="nuxeoLoggedIn" (click)="logoutNuxeo()">Logout</button>
          </mat-card-actions>
        </mat-card>

      </div>

      <!-- Proceed -->
      <button mat-raised-button color="primary"
              [disabled]="!anyLoggedIn"
              (click)="proceed()"
              style="min-width:200px;height:44px;font-size:15px">
        Proceed to Search
        <mat-icon>arrow_forward</mat-icon>
      </button>
      <p *ngIf="!anyLoggedIn" style="font-size:12px;color:#9e9e9e;margin-top:8px">
        Log in to at least one repository to continue.
      </p>
    </div>
  `
})
export class AuthComponent {

  alfrescoUsername = '';
  alfrescoPassword = '';
  alfrescoLoading = false;
  alfrescoError = '';

  nuxeoUsername = '';
  nuxeoPassword = '';
  nuxeoLoading = false;
  nuxeoError = '';

  constructor(private auth: AuthService, private router: Router) {}

  get alfrescoLoggedIn(): boolean { return this.auth.isAlfrescoLoggedIn(); }
  get nuxeoLoggedIn(): boolean    { return this.auth.isNuxeoLoggedIn(); }
  get anyLoggedIn(): boolean      { return this.auth.isAnyLoggedIn(); }
  get alfrescoUser(): string      { return this.auth.getAlfrescoSession()?.username ?? ''; }
  get nuxeoUser(): string         { return this.auth.getNuxeoSession()?.username ?? ''; }

  loginAlfresco(): void {
    if (!this.alfrescoUsername || !this.alfrescoPassword) return;
    this.alfrescoLoading = true;
    this.alfrescoError = '';
    this.auth.loginAlfresco(this.alfrescoUsername, this.alfrescoPassword)
      .then(() => { this.alfrescoPassword = ''; })
      .catch(err => {
        this.alfrescoError = err?.error?.error?.briefSummary
          ?? err?.message
          ?? 'Login failed. Check credentials.';
      })
      .finally(() => { this.alfrescoLoading = false; });
  }

  logoutAlfresco(): void { this.auth.logoutAlfresco(); }

  loginNuxeo(): void {
    if (!this.nuxeoUsername || !this.nuxeoPassword) return;
    this.nuxeoLoading = true;
    this.nuxeoError = '';
    this.auth.loginNuxeo(this.nuxeoUsername, this.nuxeoPassword)
      .then(() => { this.nuxeoPassword = ''; })
      .catch(err => {
        this.nuxeoError = err?.status === 401
          ? 'Invalid credentials.'
          : err?.message ?? 'Login failed. Check credentials.';
      })
      .finally(() => { this.nuxeoLoading = false; });
  }

  logoutNuxeo(): void { this.auth.logoutNuxeo(); }

  proceed(): void { this.router.navigate(['/search']); }
}
