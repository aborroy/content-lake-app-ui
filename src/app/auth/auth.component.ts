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
              Alfresco
            </span>
            <span class="source-badge source-badge-nuxeo">
              <mat-icon>folder_open</mat-icon>
              Nuxeo
            </span>
            <span class="metric-chip">
              <mat-icon>lock</mat-icon>
              Independent permissions
            </span>
          </div>
        </div>

        <div class="auth-hero-stat">
          <div class="stat-row">
            <span class="stat-label">Active sessions</span>
            <strong class="stat-value">{{ activeSessionCount }}<span class="stat-of">/2</span></strong>
          </div>
          <p class="stat-note">Search and chat automatically merge the active identities you establish here.</p>
          <div class="stat-dots">
            <span class="stat-dot" [class.dot-alfresco]="alfrescoLoggedIn" [class.dot-inactive]="!alfrescoLoggedIn"></span>
            <span class="stat-dot" [class.dot-nuxeo]="nuxeoLoggedIn" [class.dot-inactive]="!nuxeoLoggedIn"></span>
          </div>
        </div>
      </section>

      <app-status-panel></app-status-panel>

      <div class="auth-grid">

        <mat-card class="connect-card connect-card-alfresco">
          <div class="card-accent card-accent-alfresco"></div>
          <div class="connect-card-shell">
            <div class="connect-header">
              <div class="connect-icon connect-icon-alfresco">
                <mat-icon>storage</mat-icon>
              </div>
              <div class="connect-identity">
                <h2>Alfresco</h2>
                <p class="connect-status" [class.connected-label]="alfrescoLoggedIn">
                  <mat-icon class="status-dot-icon">{{ alfrescoLoggedIn ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                  {{ alfrescoLoggedIn ? ('Connected as ' + alfrescoUser) : 'Not connected' }}
                </p>
              </div>
            </div>

            <mat-form-field appearance="outline" class="auth-field">
              <mat-label>Username</mat-label>
              <input matInput [(ngModel)]="alfrescoUsername" [disabled]="alfrescoLoading" autocomplete="username" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="auth-field">
              <mat-label>Password</mat-label>
              <input matInput
                     type="password"
                     [(ngModel)]="alfrescoPassword"
                     [disabled]="alfrescoLoading"
                     autocomplete="current-password"
                     (keyup.enter)="loginAlfresco()" />
            </mat-form-field>

            <p *ngIf="alfrescoError" class="error-text">
              <mat-icon>error_outline</mat-icon>
              {{ alfrescoError }}
            </p>

            <div class="action-row">
              <button mat-raised-button color="primary"
                      class="connect-action"
                      (click)="loginAlfresco()"
                      [disabled]="alfrescoLoading">
                <mat-spinner *ngIf="alfrescoLoading" diameter="16"></mat-spinner>
                <span>{{ alfrescoLoggedIn ? 'Reconnect' : 'Connect' }}</span>
              </button>
              <button mat-button type="button" class="logout-link" *ngIf="alfrescoLoggedIn" (click)="logoutAlfresco()">
                Disconnect
              </button>
            </div>
          </div>
        </mat-card>

        <mat-card class="connect-card connect-card-nuxeo">
          <div class="card-accent card-accent-nuxeo"></div>
          <div class="connect-card-shell">
            <div class="connect-header">
              <div class="connect-icon connect-icon-nuxeo">
                <mat-icon>folder_open</mat-icon>
              </div>
              <div class="connect-identity">
                <h2>Nuxeo</h2>
                <p class="connect-status" [class.connected-label]="nuxeoLoggedIn">
                  <mat-icon class="status-dot-icon">{{ nuxeoLoggedIn ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                  {{ nuxeoLoggedIn ? ('Connected as ' + nuxeoUser) : 'Not connected' }}
                </p>
              </div>
            </div>

            <mat-form-field appearance="outline" class="auth-field">
              <mat-label>Username</mat-label>
              <input matInput [(ngModel)]="nuxeoUsername" [disabled]="nuxeoLoading" autocomplete="username" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="auth-field">
              <mat-label>Password</mat-label>
              <input matInput
                     type="password"
                     [(ngModel)]="nuxeoPassword"
                     [disabled]="nuxeoLoading"
                     autocomplete="current-password"
                     (keyup.enter)="loginNuxeo()" />
            </mat-form-field>

            <p *ngIf="nuxeoError" class="error-text">
              <mat-icon>error_outline</mat-icon>
              {{ nuxeoError }}
            </p>

            <div class="action-row">
              <button mat-raised-button
                      type="button"
                      class="connect-action connect-action-nuxeo"
                      (click)="loginNuxeo()"
                      [disabled]="nuxeoLoading">
                <mat-spinner *ngIf="nuxeoLoading" diameter="16"></mat-spinner>
                <span>{{ nuxeoLoggedIn ? 'Reconnect' : 'Connect' }}</span>
              </button>
              <button mat-button type="button" class="logout-link" *ngIf="nuxeoLoggedIn" (click)="logoutNuxeo()">
                Disconnect
              </button>
            </div>
          </div>
        </mat-card>

      </div>

      <section class="proceed-card surface-card">
        <div class="proceed-copy">
          <span class="eyebrow">Next step</span>
          <h2>Move into search once at least one repository is available.</h2>
          <p class="section-copy">Both repositories are optional. The UI adapts to whichever sessions are active.</p>
        </div>

        <div class="proceed-actions">
          <button mat-raised-button color="primary"
                  class="proceed-button"
                  [disabled]="!anyLoggedIn"
                  (click)="proceed()">
            Proceed to search
            <mat-icon>arrow_forward</mat-icon>
          </button>
          <p *ngIf="!anyLoggedIn" class="proceed-hint">Connect to at least one repository to continue.</p>
        </div>
      </section>

    </div>
  `,
  styles: [`
    .auth-page {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* ---- Hero ---- */

    .auth-hero {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(220px, 0.7fr);
      gap: 24px;
      padding: 28px 28px 26px;
    }

    .auth-hero-copy {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .hero-badges {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 2px;
    }

    .auth-hero-stat {
      padding: 20px;
      border-radius: 8px;
      background: var(--hy-gray-50);
      border: 1px solid var(--cl-border);
      align-self: stretch;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .stat-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }

    .stat-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: var(--cl-text-soft);
    }

    .stat-value {
      font-size: 32px;
      font-weight: 300;
      letter-spacing: -0.04em;
      color: var(--cl-text);
      line-height: 1;
    }

    .stat-of {
      font-size: 18px;
      font-weight: 400;
      color: var(--cl-text-soft);
    }

    .stat-note {
      margin: 0;
      font-size: 13px;
      line-height: 1.6;
      color: var(--cl-text-muted);
    }

    .stat-dots {
      display: flex;
      gap: 6px;
      margin-top: auto;
    }

    .stat-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid var(--cl-border-strong);
    }

    .dot-alfresco {
      background: var(--source-alfresco);
      border-color: var(--source-alfresco-strong);
    }

    .dot-nuxeo {
      background: var(--source-nuxeo);
      border-color: var(--source-nuxeo-strong);
    }

    .dot-inactive {
      background: transparent;
    }

    /* ---- Connection cards ---- */

    .auth-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .connect-card {
      overflow: hidden;
      position: relative;
    }

    .card-accent {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
    }

    .card-accent-alfresco {
      background: linear-gradient(90deg, var(--source-alfresco) 0%, rgba(120, 190, 32, 0.2) 100%);
    }

    .card-accent-nuxeo {
      background: linear-gradient(90deg, var(--source-nuxeo) 0%, rgba(0, 163, 224, 0.2) 100%);
    }

    .connect-card-alfresco {
      border-top-color: rgba(120, 190, 32, 0.3) !important;
    }

    .connect-card-nuxeo {
      border-top-color: rgba(0, 163, 224, 0.3) !important;
    }

    .connect-card-shell {
      padding: 22px 22px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-top: 4px;
    }

    .connect-header {
      display: flex;
      gap: 14px;
      align-items: center;
    }

    .connect-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .connect-icon mat-icon {
      font-size: 22px;
      height: 22px;
      width: 22px;
    }

    .connect-icon-alfresco {
      background: var(--source-alfresco-soft);
      color: var(--source-alfresco-strong);
    }

    .connect-icon-nuxeo {
      background: var(--source-nuxeo-soft);
      color: var(--source-nuxeo-strong);
    }

    .connect-identity {
      min-width: 0;
    }

    .connect-identity h2 {
      margin: 0 0 4px;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .connect-status {
      margin: 0;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      color: var(--cl-text-soft);
    }

    .status-dot-icon {
      font-size: 14px !important;
      height: 14px !important;
      width: 14px !important;
    }

    .connect-status.connected-label {
      color: var(--cl-success);
      font-weight: 600;
    }

    .auth-field {
      width: 100%;
      margin-bottom: -1.25em;
    }

    .error-text {
      margin: 0;
      color: var(--cl-danger);
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .error-text mat-icon {
      font-size: 15px;
      height: 15px;
      width: 15px;
    }

    .action-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 4px;
    }

    .connect-action {
      min-height: 40px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }

    .connect-action-nuxeo {
      --mdc-protected-button-container-color: var(--source-nuxeo);
      --mdc-protected-button-label-text-color: #ffffff;
      --mdc-filled-button-container-color: var(--source-nuxeo);
      --mdc-filled-button-label-text-color: #ffffff;
    }

    .logout-link {
      color: var(--cl-text-muted);
      font-size: 12px;
    }

    /* ---- Proceed section ---- */

    .proceed-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      padding: 24px 26px;
    }

    .proceed-copy h2 {
      margin: 6px 0 8px;
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .proceed-actions {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      flex-shrink: 0;
    }

    .proceed-button {
      min-height: 44px;
      border-radius: 6px;
      min-width: 180px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .proceed-hint {
      margin: 0;
      color: var(--cl-text-soft);
      font-size: 12px;
    }

    /* ---- Responsive ---- */

    @media (max-width: 980px) {
      .auth-hero,
      .auth-grid {
        grid-template-columns: 1fr;
      }

      .proceed-actions {
        align-items: stretch;
        width: 100%;
      }

      .proceed-button { width: 100%; }
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
  get nuxeoLoggedIn(): boolean   { return this.auth.isNuxeoLoggedIn(); }
  get anyLoggedIn(): boolean     { return this.auth.isAnyLoggedIn(); }
  get alfrescoUser(): string     { return this.auth.getAlfrescoSession()?.username ?? ''; }
  get nuxeoUser(): string        { return this.auth.getNuxeoSession()?.username ?? ''; }

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
