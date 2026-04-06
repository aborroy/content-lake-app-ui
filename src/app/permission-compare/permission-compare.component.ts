import { Component, Input, OnChanges, Output, EventEmitter } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService, AlfrescoSession, NuxeoSession } from '../services/auth.service';
import { RagService, RagResult, ContentSourceType } from '../services/rag.service';

export interface CompareResult {
  username: string;
  source: 'alfresco' | 'nuxeo';
  count: number;
  results: RagResult[];
}

/**
 * Permission comparison panel.
 *
 * Lets the user authenticate as a second identity and run the current query again,
 * surfacing the difference caused by permission filtering. This is the core
 * "permission-aware" demo feature: same query, different users → different results.
 */
@Component({
  selector: 'app-permission-compare',
  template: `
    <mat-expansion-panel [expanded]="autoExpand">
      <mat-expansion-panel-header>
        <mat-panel-title>
          <mat-icon style="margin-right:8px">compare_arrows</mat-icon>
          Permission Comparison
        </mat-panel-title>
        <mat-panel-description>
          Run the same query as a different user to verify permission filtering
        </mat-panel-description>
      </mat-expansion-panel-header>

      <!-- Credential form -->
      <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;padding:8px 0 4px">

        <mat-button-toggle-group [(ngModel)]="compareSource" style="align-self:center;height:40px">
          <mat-button-toggle value="alfresco">
            <mat-icon style="font-size:15px;margin-right:4px;color:#1565c0">storage</mat-icon>
            Alfresco
          </mat-button-toggle>
          <mat-button-toggle value="nuxeo">
            <mat-icon style="font-size:15px;margin-right:4px;color:#c62828">folder_open</mat-icon>
            Nuxeo
          </mat-button-toggle>
        </mat-button-toggle-group>

        <mat-form-field appearance="outline" style="flex:1;min-width:120px;margin-bottom:-1.25em">
          <mat-label>Username</mat-label>
          <input matInput [(ngModel)]="compareUser" [disabled]="comparing" />
        </mat-form-field>

        <mat-form-field appearance="outline" style="flex:1;min-width:120px;margin-bottom:-1.25em">
          <mat-label>Password</mat-label>
          <input matInput type="password" [(ngModel)]="comparePass"
                 [disabled]="comparing" (keyup.enter)="runComparison()" />
        </mat-form-field>

        <button mat-raised-button color="accent"
                [disabled]="!canCompare"
                (click)="runComparison()"
                style="align-self:center;height:40px">
          <mat-spinner *ngIf="comparing" diameter="16"
                       style="display:inline-block;margin-right:6px"></mat-spinner>
          {{ comparing ? 'Running…' : 'Compare' }}
        </button>
      </div>

      <p *ngIf="authError" style="color:#c62828;font-size:12px;margin:4px 0 0">
        <mat-icon style="font-size:14px;vertical-align:middle">error</mat-icon>
        {{ authError }}
      </p>

      <!-- Comparison result -->
      <div *ngIf="compareResult" style="margin-top:16px">
        <mat-divider style="margin-bottom:16px"></mat-divider>

        <!-- Score card -->
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px">

          <div class="score-card your-card">
            <div class="score-label">
              <mat-icon style="font-size:14px">person</mat-icon>
              Your results
              <span class="user-tag" [class.alfresco-tag]="mainSource==='alfresco'"
                    [class.nuxeo-tag]="mainSource==='nuxeo'">
                {{ mainUsername }}
              </span>
            </div>
            <div class="score-count">{{ mainCount }}</div>
          </div>

          <div class="score-card compare-card" [class.diff-detected]="diffDetected">
            <div class="score-label">
              <mat-icon style="font-size:14px">person_outline</mat-icon>
              Comparison results
              <span class="user-tag" [class.alfresco-tag]="compareResult.source==='alfresco'"
                    [class.nuxeo-tag]="compareResult.source==='nuxeo'">
                {{ compareResult.username }}
              </span>
            </div>
            <div class="score-count">{{ compareResult.count }}</div>
          </div>

          <!-- Verdict -->
          <div *ngIf="diffDetected" class="verdict-box">
            <mat-icon color="warn">security</mat-icon>
            <span>
              <strong>Permission filtering active</strong> —
              {{ compareResult.username }} sees {{ compareResult.count - mainCount }} more document(s).
            </span>
          </div>
          <div *ngIf="!diffDetected && compareResult" class="verdict-box verdict-equal">
            <mat-icon style="color:#2e7d32">check_circle</mat-icon>
            <span>Same result count — permissions are equivalent for this query.</span>
          </div>
        </div>

        <!-- Extra results visible to compare user but not to you -->
        <ng-container *ngIf="extraResults.length > 0">
          <p style="font-size:13px;color:#616161;margin:0 0 8px">
            Documents visible to <strong>{{ compareResult.username }}</strong> but not to you:
          </p>
          <app-results [results]="extraResults" (select)="openLink($event)"></app-results>
        </ng-container>

        <!-- Hidden results: visible to you but not to compare user -->
        <ng-container *ngIf="hiddenResults.length > 0">
          <p style="font-size:13px;color:#616161;margin:8px 0">
            Documents visible to <strong>you</strong> but not to
            <strong>{{ compareResult.username }}</strong>:
          </p>
          <app-results [results]="hiddenResults" (select)="openLink($event)"></app-results>
        </ng-container>

      </div>
    </mat-expansion-panel>
  `,
  styles: [`
    .score-card {
      padding: 12px 20px; border-radius: 8px; border: 1px solid #e0e0e0;
      min-width: 140px; background: #fafafa;
    }
    .your-card { border-color: #1565c0; }
    .compare-card { border-color: #9e9e9e; }
    .compare-card.diff-detected { border-color: #e65100; background: #fff3e0; }
    .score-label {
      font-size: 11px; color: #757575; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
    }
    .score-count { font-size: 32px; font-weight: 700; color: #212121; line-height: 1.2; }
    .user-tag {
      font-size: 10px; border-radius: 8px; padding: 1px 6px;
    }
    .alfresco-tag { background: #1565c0; color: white; }
    .nuxeo-tag    { background: #c62828; color: white; }
    .verdict-box {
      display: flex; align-items: center; gap: 8px; padding: 10px 14px;
      border-radius: 8px; background: #fff3e0; font-size: 13px; align-self: center;
    }
    .verdict-equal { background: #e8f5e9; }
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
    // Auto-expand when main results are 0 and a query has been run
    this.autoExpand = this.mainResults.length === 0 && this.query.length > 0;
    // Clear stale comparison when query changes
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

  /** Results the compare user can see that the main user cannot (ranked by compare). */
  get extraResults(): RagResult[] {
    if (!this.compareResult) return [];
    const mainIds = new Set(this.mainResults.map(r => r.openInSourceUrl ?? r.title));
    return this.compareResult.results.filter(r => !mainIds.has(r.openInSourceUrl ?? r.title));
  }

  /** Results the main user can see that the compare user cannot. */
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

  private buildHeaders(session: { username: string; ticket?: string; credentials?: string }): HttpHeaders {
    let headers = new HttpHeaders();
    if ('ticket' in session && session.ticket) {
      // Alfresco ticket
      headers = headers.set('Authorization', `Basic ${btoa(session.ticket + ':')}`);
    } else if ('credentials' in session && session.credentials) {
      // Nuxeo basic
      headers = headers.set('Authorization', `Basic ${session.credentials}`);
    }
    return headers;
  }
}
