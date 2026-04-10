import { HttpHeaders } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService, AlfrescoSession, NuxeoSession } from '../services/auth.service';
import { ContentSourceType, RagResult, RagService } from '../services/rag.service';

export interface CompareResult {
  username: string;
  source: 'alfresco' | 'nuxeo';
  count: number;
  results: RagResult[];
}

@Component({
  selector: 'app-permission-compare',
  template: `
    <mat-expansion-panel [expanded]="autoExpand" class="compare-panel">
      <mat-expansion-panel-header>
        <mat-panel-title>
          <mat-icon>compare_arrows</mat-icon>
          Permission comparison
        </mat-panel-title>
        <mat-panel-description>
          Re-run this query as another user and inspect the difference.
        </mat-panel-description>
      </mat-expansion-panel-header>

      <div class="compare-shell">
        <div class="compare-form">
          <mat-button-toggle-group [(ngModel)]="compareSource" class="compare-toggle">
            <mat-button-toggle value="alfresco">
              <span class="toggle-label toggle-label-alfresco">
                <mat-icon>storage</mat-icon>
                Alfresco
              </span>
            </mat-button-toggle>
            <mat-button-toggle value="nuxeo">
              <span class="toggle-label toggle-label-nuxeo">
                <mat-icon>folder_open</mat-icon>
                Nuxeo
              </span>
            </mat-button-toggle>
          </mat-button-toggle-group>

          <mat-form-field appearance="outline" class="compare-field">
            <mat-label>Username</mat-label>
            <input matInput [(ngModel)]="compareUser" [disabled]="comparing" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="compare-field">
            <mat-label>Password</mat-label>
            <input matInput
                   type="password"
                   [(ngModel)]="comparePass"
                   [disabled]="comparing"
                   (keyup.enter)="runComparison()" />
          </mat-form-field>

          <button mat-raised-button color="primary"
                  type="button"
                  class="compare-action"
                  [disabled]="!canCompare"
                  (click)="runComparison()">
            <mat-spinner *ngIf="comparing" diameter="16"></mat-spinner>
            <span>{{ comparing ? 'Running...' : 'Compare access' }}</span>
          </button>
        </div>

        <p *ngIf="authError" class="auth-error">
          <mat-icon>error</mat-icon>
          {{ authError }}
        </p>

        <div *ngIf="compareResult" class="compare-results">
          <div class="score-grid">
            <div class="score-card score-card-main" [ngClass]="scoreClass(mainSource)">
              <span class="score-label">Current view</span>
              <strong>{{ mainCount }}</strong>
              <span class="user-tag" [ngClass]="mainSource === 'alfresco' ? 'user-tag-alfresco' : mainSource === 'nuxeo' ? 'user-tag-nuxeo' : ''">
                {{ mainUsername || 'Current session' }}
              </span>
            </div>

            <div class="score-card score-card-compare" [ngClass]="scoreClass(compareResult.source)">
              <span class="score-label">Comparison view</span>
              <strong>{{ compareResult.count }}</strong>
              <span class="user-tag" [ngClass]="compareResult.source === 'alfresco' ? 'user-tag-alfresco' : 'user-tag-nuxeo'">
                {{ compareResult.username }}
              </span>
            </div>

            <div class="verdict-box" [class.verdict-equal]="!diffDetected">
              <mat-icon>{{ diffDetected ? 'shield' : 'check_circle' }}</mat-icon>
              <div>
                <strong>{{ diffDetected ? 'Permission filtering detected' : 'Same visible result count' }}</strong>
                <p>
                  {{ diffDetected
                    ? (compareResult.username + ' sees ' + (compareResult.count - mainCount) + ' more document(s) for this query.')
                    : 'Both identities see the same number of results for this search.' }}
                </p>
              </div>
            </div>
          </div>

          <ng-container *ngIf="extraResults.length > 0">
            <div class="result-section">
              <div class="result-section-header">
                <span class="eyebrow">More visible to comparison user</span>
                <h3>{{ compareResult.username }} can access these documents and you cannot.</h3>
              </div>
              <app-results [results]="extraResults" (select)="openLink($event)"></app-results>
            </div>
          </ng-container>

          <ng-container *ngIf="hiddenResults.length > 0">
            <div class="result-section">
              <div class="result-section-header">
                <span class="eyebrow">More visible to current user</span>
                <h3>You can access these documents and {{ compareResult.username }} cannot.</h3>
              </div>
              <app-results [results]="hiddenResults" (select)="openLink($event)"></app-results>
            </div>
          </ng-container>
        </div>
      </div>
    </mat-expansion-panel>
  `,
  styles: [`
    .compare-panel {
      border-radius: 24px !important;
      overflow: hidden;
      border: 1px solid var(--cl-border);
      box-shadow: var(--cl-shadow-soft);
      background: rgba(255, 255, 255, 0.92);
    }

    .compare-shell {
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding-top: 4px;
    }

    .compare-form {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
    }

    .compare-toggle {
      height: 46px;
      border-radius: 16px;
      background: rgba(244, 247, 244, 0.88);
    }

    .toggle-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
    }

    .toggle-label mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }

    .toggle-label-alfresco {
      color: var(--source-alfresco-strong);
    }

    .toggle-label-nuxeo {
      color: var(--source-nuxeo-strong);
    }

    .compare-field {
      min-width: 0;
      margin-bottom: -1.25em;
    }

    .compare-action {
      min-height: 46px;
      border-radius: 15px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .auth-error {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      color: var(--cl-danger);
      font-size: 13px;
    }

    .compare-results {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .score-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(180px, 240px)) minmax(0, 1fr);
      gap: 14px;
      align-items: stretch;
    }

    .score-card {
      padding: 18px;
      border-radius: 20px;
      border: 1px solid var(--cl-border);
      background: rgba(244, 247, 244, 0.72);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .score-card-alfresco {
      border-color: rgba(118, 184, 42, 0.24);
      background: linear-gradient(180deg, rgba(239, 248, 223, 0.86), rgba(255, 255, 255, 0.86));
    }

    .score-card-nuxeo {
      border-color: rgba(47, 109, 246, 0.18);
      background: linear-gradient(180deg, rgba(235, 241, 255, 0.9), rgba(255, 255, 255, 0.86));
    }

    .score-label {
      color: var(--cl-text-soft);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .score-card strong {
      font-size: 40px;
      line-height: 1;
      letter-spacing: -0.05em;
      color: var(--cl-text);
    }

    .user-tag {
      display: inline-flex;
      width: fit-content;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      color: var(--cl-text-muted);
      background: rgba(24, 49, 38, 0.06);
    }

    .user-tag-alfresco {
      background: var(--source-alfresco-soft);
      color: var(--source-alfresco-strong);
    }

    .user-tag-nuxeo {
      background: var(--source-nuxeo-soft);
      color: var(--source-nuxeo-strong);
    }

    .verdict-box {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px;
      border-radius: 20px;
      background: rgba(255, 248, 238, 0.9);
      border: 1px solid rgba(184, 107, 23, 0.18);
      color: var(--cl-warning);
    }

    .verdict-box mat-icon {
      flex-shrink: 0;
    }

    .verdict-box strong {
      display: block;
      margin-bottom: 4px;
      color: var(--cl-text);
    }

    .verdict-box p {
      margin: 0;
      color: var(--cl-text-muted);
      font-size: 13px;
      line-height: 1.6;
    }

    .verdict-equal {
      background: rgba(236, 248, 236, 0.92);
      border-color: rgba(60, 139, 59, 0.18);
      color: var(--cl-success);
    }

    .result-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .result-section-header h3 {
      margin: 4px 0 0;
      font-size: 22px;
      letter-spacing: -0.04em;
      color: var(--cl-text);
    }

    .eyebrow {
      display: inline-block;
      color: var(--cl-text-soft);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    @media (max-width: 1080px) {
      .compare-form,
      .score-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class PermissionCompareComponent implements OnChanges {
  @Input() query = '';
  @Input() sourceFilter: ContentSourceType | '' = '';
  @Input() mainResults: RagResult[] = [];
  @Input() mainUsername = '';
  @Input() mainSource: ContentSourceType | '' = '';
  @Output() compareComplete = new EventEmitter<CompareResult>();

  compareSource: 'alfresco' | 'nuxeo' = 'alfresco';
  compareUser = '';
  comparePass = '';
  comparing = false;
  authError = '';
  compareResult: CompareResult | null = null;
  autoExpand = false;

  constructor(private auth: AuthService, private rag: RagService) {}

  ngOnChanges(): void {
    this.autoExpand = this.mainResults.length === 0 && this.query.length > 0;
    this.compareResult = null;
    this.authError = '';
  }

  get canCompare(): boolean {
    return !!this.compareUser.trim() && !!this.comparePass.trim() && !!this.query.trim() && !this.comparing;
  }

  get mainCount(): number { return this.mainResults.length; }

  get diffDetected(): boolean {
    return this.compareResult !== null && this.compareResult.count !== this.mainCount;
  }

  get extraResults(): RagResult[] {
    if (!this.compareResult) return [];
    const mainIds = new Set(this.mainResults.map(r => r.openInSourceUrl ?? r.title));
    return this.compareResult.results.filter(r => !mainIds.has(r.openInSourceUrl ?? r.title));
  }

  get hiddenResults(): RagResult[] {
    if (!this.compareResult) return [];
    const compareIds = new Set(this.compareResult.results.map(r => r.openInSourceUrl ?? r.title));
    return this.mainResults.filter(r => !compareIds.has(r.openInSourceUrl ?? r.title));
  }

  runComparison(): void {
    if (!this.canCompare) return;
    this.comparing = true;
    this.authError = '';
    this.compareResult = null;

    const authObs: Observable<AlfrescoSession | NuxeoSession> =
      this.compareSource === 'alfresco'
        ? this.auth.getTempAlfrescoSession(this.compareUser, this.comparePass)
        : this.auth.getTempNuxeoSession(this.compareUser, this.comparePass);

    authObs.subscribe({
      next: session => {
        const headers = this.buildHeaders(session);
        const sourceType = this.sourceFilter || undefined;

        this.rag.searchWithHeaders(this.query, headers, sourceType).subscribe({
          next: results => {
            this.compareResult = {
              username: session.username,
              source: this.compareSource,
              count: results.length,
              results
            };
            this.compareComplete.emit(this.compareResult);
            this.comparing = false;
          },
          error: err => {
            this.authError = `Search failed: ${err.status} ${err.statusText}`;
            this.comparing = false;
          }
        });
      },
      error: err => {
        this.authError = err?.status === 401
          ? 'Invalid credentials for comparison user.'
          : err?.message ?? 'Authentication failed.';
        this.comparing = false;
      }
    });
  }

  openLink(result: RagResult): void {
    const url = result.openInSourceUrl ?? result.url;
    if (url) window.open(url, '_blank');
  }

  scoreClass(source: ContentSourceType | '' | undefined): string {
    if (source === 'alfresco') return 'score-card-alfresco';
    if (source === 'nuxeo') return 'score-card-nuxeo';
    return '';
  }

  private buildHeaders(session: { username: string; ticket?: string; credentials?: string }): HttpHeaders {
    let headers = new HttpHeaders();
    if ('ticket' in session && session.ticket) {
      headers = headers.set('Authorization', `Basic ${btoa(session.ticket + ':')}`);
    } else if ('credentials' in session && session.credentials) {
      headers = headers.set('Authorization', `Basic ${session.credentials}`);
    }
    return headers;
  }
}
