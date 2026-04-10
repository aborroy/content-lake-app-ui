import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-auth',
  template: `
    <div class="page-container auth-page">
      <section class="auth-hero surface-card">
        <div class="auth-hero-copy">
          <span class="eyebrow">Connections</span>
          <h1 class="section-heading">Connect repositories once, then keep source identity visible everywhere.</h1>
          <p class="section-copy">
            Alfresco uses green accents and Nuxeo uses blue accents throughout search and chat,
            so provenance stays readable even when both repositories contribute to the same session.
          </p>
          <div class="hero-badges">
            <span class="source-badge source-badge-alfresco">
              <mat-icon>storage</mat-icon>
              Alfresco green
            </span>
            <span class="source-badge source-badge-nuxeo">
              <mat-icon>folder_open</mat-icon>
              Nuxeo blue
            </span>
            <span class="metric-chip">
              <mat-icon>lock</mat-icon>
              Independent permissions
            </span>
          </div>
        </div>

        <div class="auth-hero-note">
          <div class="summary-row">
            <span>Active sessions</span>
            <strong>{{ activeSessionCount }}/2</strong>
          </div>
          <p>Search and chat automatically merge the active identities you establish here.</p>
        </div>
      </section>

      <app-status-panel></app-status-panel>

      <div class="auth-grid">
        <mat-card class="connect-card connect-card-alfresco">
          <div class="connect-card-shell">
            <div class="connect-header">
              <div class="connect-icon connect-icon-alfresco">
                <mat-icon>storage</mat-icon>
              </div>
              <div>
                <h2>Alfresco</h2>
                <p [class.connected-label]="alfrescoLoggedIn">
                  {{ alfrescoLoggedIn ? ('Connected as ' + alfrescoUser) : 'Not connected' }}
                </p>
              </div>
            </div>

            <mat-form-field appearance="outline" class="auth-field">
              <mat-label>Username</mat-label>
              <input matInput [(ngModel)]="alfrescoUsername" [disabled]="alfrescoLoading" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="auth-field">
              <mat-label>Password</mat-label>
              <input matInput
                     type="password"
                     [(ngModel)]="alfrescoPassword"
                     [disabled]="alfrescoLoading"
                     (keyup.enter)="loginAlfresco()" />
            </mat-form-field>

            <p *ngIf="alfrescoError" class="error-text">{{ alfrescoError }}</p>

            <div class="action-row">
              <button mat-raised-button color="primary"
                      class="connect-action"
                      (click)="loginAlfresco()"
                      [disabled]="alfrescoLoading">
                <mat-spinner *ngIf="alfrescoLoading" diameter="16"></mat-spinner>
                <span>{{ alfrescoLoggedIn ? 'Reconnect' : 'Connect' }}</span>
              </button>
              <button mat-button type="button" *ngIf="alfrescoLoggedIn" (click)="logoutAlfresco()">Logout</button>
            </div>
          </div>
        </mat-card>

        <mat-card class="connect-card connect-card-nuxeo">
          <div class="connect-card-shell">
            <div class="connect-header">
              <div class="connect-icon connect-icon-nuxeo">
                <mat-icon>folder_open</mat-icon>
              </div>
              <div>
                <h2>Nuxeo</h2>
                <p [class.connected-label]="nuxeoLoggedIn">
                  {{ nuxeoLoggedIn ? ('Connected as ' + nuxeoUser) : 'Not connected' }}
                </p>
              </div>
            </div>

            <mat-form-field appearance="outline" class="auth-field">
              <mat-label>Username</mat-label>
              <input matInput [(ngModel)]="nuxeoUsername" [disabled]="nuxeoLoading" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="auth-field">
              <mat-label>Password</mat-label>
              <input matInput
                     type="password"
                     [(ngModel)]="nuxeoPassword"
                     [disabled]="nuxeoLoading"
                     (keyup.enter)="loginNuxeo()" />
            </mat-form-field>

            <p *ngIf="nuxeoError" class="error-text">{{ nuxeoError }}</p>

            <div class="action-row">
              <button mat-raised-button
                      type="button"
                      class="connect-action connect-action-nuxeo"
                      (click)="loginNuxeo()"
                      [disabled]="nuxeoLoading">
                <mat-spinner *ngIf="nuxeoLoading" diameter="16"></mat-spinner>
                <span>{{ nuxeoLoggedIn ? 'Reconnect' : 'Connect' }}</span>
              </button>
              <button mat-button type="button" *ngIf="nuxeoLoggedIn" (click)="logoutNuxeo()">Logout</button>
            </div>
          </div>
        </mat-card>
      </div>

      <section class="proceed-card surface-card">
        <div>
          <span class="eyebrow">Next step</span>
          <h2>Move into search once at least one repository is available.</h2>
          <p class="section-copy">
            Both repositories are optional. The UI adapts to whichever sessions are active.
          </p>
        </div>

        <div class="proceed-actions">
          <button mat-raised-button color="primary"
                  class="proceed-button"
                  [disabled]="!anyLoggedIn"
                  (click)="proceed()">
            Proceed to search
            <mat-icon>arrow_forward</mat-icon>
          </button>
          <p *ngIf="!anyLoggedIn">Connect to at least one repository to continue.</p>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .auth-page {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .auth-hero {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(250px, 0.8fr);
      gap: 22px;
      padding: 28px;
    }

    .auth-hero-copy {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .eyebrow {
      display: inline-block;
      margin-bottom: 10px;
      color: var(--cl-text-soft);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    .hero-badges {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .auth-hero-note {
      border-radius: 22px;
      padding: 22px;
      background: linear-gradient(180deg, rgba(24, 58, 100, 0.05), rgba(255, 255, 255, 0.78));
      border: 1px solid rgba(24, 58, 100, 0.08);
      align-self: stretch;
    }

    .summary-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 12px;
      gap: 12px;
      color: var(--cl-text-muted);
    }

    .summary-row strong {
      font-size: 28px;
      color: var(--cl-text);
    }

    .auth-hero-note p {
      margin: 0;
      color: var(--cl-text-muted);
      line-height: 1.7;
      font-size: 14px;
    }

    .auth-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }

    .connect-card {
      overflow: hidden;
    }

    .connect-card::before {
      content: "";
      display: block;
      height: 5px;
      margin: -1px -1px 0;
    }

    .connect-card-alfresco {
      border-color: rgba(118, 184, 42, 0.22);
    }

    .connect-card-alfresco::before {
      background: linear-gradient(90deg, var(--source-alfresco), rgba(118, 184, 42, 0.3));
    }

    .connect-card-nuxeo {
      border-color: rgba(47, 109, 246, 0.22);
    }

    .connect-card-nuxeo::before {
      background: linear-gradient(90deg, var(--source-nuxeo), rgba(47, 109, 246, 0.3));
    }

    .connect-card-shell {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .connect-header {
      display: flex;
      gap: 14px;
      align-items: center;
    }

    .connect-icon {
      width: 52px;
      height: 52px;
      border-radius: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .connect-icon-alfresco {
      background: var(--source-alfresco-soft);
      color: var(--source-alfresco-strong);
    }

    .connect-icon-nuxeo {
      background: var(--source-nuxeo-soft);
      color: var(--source-nuxeo-strong);
    }

    .connect-header h2 {
      margin: 0 0 4px;
      font-size: 24px;
      letter-spacing: -0.04em;
    }

    .connect-header p {
      margin: 0;
      color: var(--cl-text-soft);
      font-size: 13px;
    }

    .connected-label {
      color: var(--cl-success) !important;
      font-weight: 700;
    }

    .auth-field {
      width: 100%;
      margin-bottom: -1.25em;
    }

    .error-text {
      margin: 0;
      color: var(--cl-danger);
      font-size: 12px;
    }

    .action-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 2px;
    }

    .connect-action {
      min-height: 46px;
      border-radius: 15px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .connect-action-nuxeo {
      background: var(--source-nuxeo) !important;
      color: white !important;
    }

    .proceed-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 18px;
      flex-wrap: wrap;
      padding: 24px 26px;
    }

    .proceed-card h2 {
      margin: 0 0 8px;
      font-size: 24px;
      letter-spacing: -0.04em;
    }

    .proceed-actions {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
    }

    .proceed-button {
      min-height: 48px;
      border-radius: 16px;
      min-width: 190px;
    }

    .proceed-actions p {
      margin: 0;
      color: var(--cl-text-soft);
      font-size: 12px;
    }

    @media (max-width: 980px) {
      .auth-hero,
      .auth-grid {
        grid-template-columns: 1fr;
      }

      .proceed-actions {
        align-items: stretch;
        width: 100%;
      }

      .proceed-button {
        width: 100%;
      }
    }
  `]
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
  get nuxeoLoggedIn(): boolean { return this.auth.isNuxeoLoggedIn(); }
  get anyLoggedIn(): boolean { return this.auth.isAnyLoggedIn(); }
  get alfrescoUser(): string { return this.auth.getAlfrescoSession()?.username ?? ''; }
  get nuxeoUser(): string { return this.auth.getNuxeoSession()?.username ?? ''; }

  get activeSessionCount(): number {
    return Number(this.alfrescoLoggedIn) + Number(this.nuxeoLoggedIn);
  }

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
