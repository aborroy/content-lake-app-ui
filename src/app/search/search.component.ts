import { Component } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService, AlfrescoSession, NuxeoSession } from '../services/auth.service';
import { CompareResult } from '../permission-compare/permission-compare.component';
import { ContentSourceType, RagResult, RagService } from '../services/rag.service';

interface SearchContext {
  query: string;
  sourceFilter: ContentSourceType | '';
  alfrescoUser: string | null;
  nuxeoUser: string | null;
  resultCount: number;
  searchTimeMs: number;
}

@Component({
  selector: 'app-search',
  template: `
    <div class="page-container search-page">
      <section class="search-hero surface-card">
        <div class="hero-copy">
          <span class="eyebrow">Search workspace</span>
          <h1 class="section-heading">Find the right document faster, and see where it came from.</h1>
          <p class="section-copy">
            Search across Alfresco and Nuxeo with clearer ranking, stronger contrast, and persistent
            source cues so you can spot repository ownership at a glance.
          </p>

          <div class="hero-metrics">
            <span class="metric-chip">
              <mat-icon>visibility</mat-icon>
              Source-aware results
            </span>
            <span class="metric-chip">
              <mat-icon>lock</mat-icon>
              Permission-aware search
            </span>
            <span class="source-badge source-badge-alfresco">
              <mat-icon>storage</mat-icon>
              Alfresco
            </span>
            <span class="source-badge source-badge-nuxeo">
              <mat-icon>folder_open</mat-icon>
              Nuxeo
            </span>
          </div>
        </div>

        <div class="hero-panel">
          <div class="hero-panel-row">
            <span class="hero-panel-label">Repository sessions</span>
            <span class="hero-panel-value">{{ activeSessionCount }}/2 connected</span>
          </div>
          <div class="hero-session-grid">
            <div class="hero-session hero-session-alfresco" [class.connected]="alfrescoLoggedIn">
              <mat-icon>storage</mat-icon>
              <div>
                <strong>Alfresco</strong>
                <span>{{ alfrescoUserLabel }}</span>
              </div>
            </div>
            <div class="hero-session hero-session-nuxeo" [class.connected]="nuxeoLoggedIn">
              <mat-icon>folder_open</mat-icon>
              <div>
                <strong>Nuxeo</strong>
                <span>{{ nuxeoUserLabel }}</span>
              </div>
            </div>
          </div>
          <p class="hero-panel-note">
            Use filters below to narrow to one source, or keep both enabled to compare relevance.
          </p>
        </div>
      </section>

      <mat-card *ngIf="!anyLoggedIn" class="warning-banner">
        <mat-card-content>
          <mat-icon>warning</mat-icon>
          <span>No active sessions. <a routerLink="/login">Connect Alfresco, Nuxeo, or both</a> to search.</span>
        </mat-card-content>
      </mat-card>

      <section class="search-controls surface-card">
        <div class="search-header">
          <div>
            <span class="eyebrow">Query</span>
            <h2>Readable results, with explicit source identity</h2>
          </div>
          <span class="search-header-note">Choose a scope, search, then review permission differences below.</span>
        </div>

        <div class="search-bar">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search documents, snippets, or concepts</mat-label>
            <input matInput [(ngModel)]="query" (keyup.enter)="search()" [disabled]="loading" />
            <mat-icon matPrefix>search</mat-icon>
          </mat-form-field>

          <mat-button-toggle-group [(ngModel)]="sourceFilter" class="source-toggle">
            <mat-button-toggle value="">All sources</mat-button-toggle>
            <mat-button-toggle value="alfresco"
                               [disabled]="!alfrescoLoggedIn"
                               [matTooltip]="alfrescoLoggedIn ? 'Alfresco only' : 'Log in to Alfresco first'">
              <span class="toggle-label toggle-label-alfresco">
                <mat-icon>storage</mat-icon>
                Alfresco
              </span>
            </mat-button-toggle>
            <mat-button-toggle value="nuxeo"
                               [disabled]="!nuxeoLoggedIn"
                               [matTooltip]="nuxeoLoggedIn ? 'Nuxeo only' : 'Log in to Nuxeo first'">
              <span class="toggle-label toggle-label-nuxeo">
                <mat-icon>folder_open</mat-icon>
                Nuxeo
              </span>
            </mat-button-toggle>
          </mat-button-toggle-group>

          <button mat-raised-button color="primary"
                  class="search-action"
                  (click)="search()"
                  [disabled]="loading || !query.trim() || !anyLoggedIn">
            <mat-spinner *ngIf="loading" diameter="18"></mat-spinner>
            <span>{{ loading ? 'Searching...' : 'Run search' }}</span>
          </button>
        </div>
      </section>

      <div *ngIf="ctx" class="context-bar surface-card">
        <div class="context-group">
          <span class="context-label">Search context</span>
          <span *ngIf="ctx.alfrescoUser" class="ctx-user ctx-user-alfresco">
            <mat-icon>storage</mat-icon>
            {{ ctx.alfrescoUser }}
          </span>
          <span *ngIf="ctx.nuxeoUser" class="ctx-user ctx-user-nuxeo">
            <mat-icon>folder_open</mat-icon>
            {{ ctx.nuxeoUser }}
          </span>
          <span *ngIf="!ctx.alfrescoUser && !ctx.nuxeoUser" class="ctx-empty">(no session)</span>
        </div>

        <div class="context-stats">
          <span class="metric-chip">
            <mat-icon>filter_list</mat-icon>
            {{ ctx.resultCount }} result{{ ctx.resultCount !== 1 ? 's' : '' }}
          </span>
          <span class="metric-chip">
            <mat-icon>schedule</mat-icon>
            {{ ctx.searchTimeMs }}ms
          </span>
          <span *ngIf="ctx.sourceFilter"
                class="source-badge"
                [ngClass]="ctx.sourceFilter === 'alfresco' ? 'source-badge-alfresco' : 'source-badge-nuxeo'">
            <mat-icon>{{ ctx.sourceFilter === 'alfresco' ? 'storage' : 'folder_open' }}</mat-icon>
            {{ ctx.sourceFilter | titlecase }} only
          </span>
        </div>
      </div>

      <div *ngIf="ctx && results.length > 0" class="results-heading">
        <div>
          <span class="eyebrow">Results</span>
          <h2>Ranked document matches</h2>
        </div>
        <p class="section-copy">
          Repository colors stay attached to each card, badge, and action so provenance remains obvious while scanning.
        </p>
      </div>

      <app-results [results]="results" (select)="openLink($event)"></app-results>

      <div *ngIf="searched && !loading && results.length === 0" class="empty-state surface-card">
        <mat-icon>search_off</mat-icon>
        <p class="empty-title">No results for "{{ ctx?.query }}"</p>

        <ng-container *ngIf="lastCompareResult && lastCompareResult.count > 0">
          <div class="permission-callout">
            <mat-icon>shield</mat-icon>
            <div>
              <strong>Permission filtering confirmed</strong>
              <p>
                {{ lastCompareResult.username }} ({{ lastCompareResult.source | titlecase }}) found
                {{ lastCompareResult.count }} result{{ lastCompareResult.count !== 1 ? 's' : '' }} for the same query.
              </p>
            </div>
          </div>
        </ng-container>

        <ng-container *ngIf="!lastCompareResult">
          <p class="empty-copy">No indexed documents matched with your current credentials.</p>
          <p class="empty-copy muted">
            Use the Permission Comparison panel below to check whether documents exist for another identity.
          </p>
        </ng-container>
      </div>

      <div *ngIf="searched && !loading" class="compare-section">
        <app-permission-compare
          [query]="ctx?.query || ''"
          [sourceFilter]="ctx?.sourceFilter || ''"
          [mainResults]="results"
          [mainUsername]="ctx?.alfrescoUser || ctx?.nuxeoUser || ''"
          [mainSource]="ctx?.sourceFilter || ''"
          (compareComplete)="onCompareComplete($event)">
        </app-permission-compare>
      </div>
    </div>
  `,
  styles: [`
    .search-page {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .search-hero {
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) minmax(280px, 0.9fr);
      gap: 22px;
      padding: 28px;
      overflow: hidden;
      position: relative;
    }

    .search-hero::after {
      content: "";
      position: absolute;
      right: -80px;
      top: -80px;
      width: 220px;
      height: 220px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(47, 109, 246, 0.12), transparent 68%);
      pointer-events: none;
    }

    .eyebrow {
      display: inline-block;
      margin-bottom: 12px;
      color: var(--cl-text-soft);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    .hero-copy {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
    }

    .hero-metrics {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .hero-panel {
      padding: 22px;
      border-radius: 22px;
      background: linear-gradient(180deg, rgba(24, 58, 100, 0.05), rgba(255, 255, 255, 0.7));
      border: 1px solid rgba(24, 58, 100, 0.08);
      align-self: stretch;
    }

    .hero-panel-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 18px;
    }

    .hero-panel-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--cl-text-soft);
      text-transform: uppercase;
      letter-spacing: 0.14em;
    }

    .hero-panel-value {
      font-size: 18px;
      font-weight: 700;
      color: var(--cl-text);
    }

    .hero-session-grid {
      display: grid;
      gap: 12px;
    }

    .hero-session {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 18px;
      border: 1px solid var(--cl-border);
      background: rgba(255, 255, 255, 0.7);
      color: var(--cl-text-soft);
    }

    .hero-session.connected {
      color: var(--cl-text);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
    }

    .hero-session-alfresco.connected {
      border-color: rgba(118, 184, 42, 0.3);
      background: linear-gradient(135deg, rgba(118, 184, 42, 0.14), rgba(255, 255, 255, 0.8));
    }

    .hero-session-nuxeo.connected {
      border-color: rgba(47, 109, 246, 0.3);
      background: linear-gradient(135deg, rgba(47, 109, 246, 0.14), rgba(255, 255, 255, 0.8));
    }

    .hero-session mat-icon {
      width: 20px;
      height: 20px;
      font-size: 20px;
    }

    .hero-session strong,
    .hero-session span {
      display: block;
    }

    .hero-session strong {
      font-size: 14px;
      margin-bottom: 2px;
    }

    .hero-session span {
      font-size: 12px;
    }

    .hero-panel-note {
      margin: 16px 0 0;
      color: var(--cl-text-muted);
      font-size: 13px;
      line-height: 1.6;
    }

    .warning-banner mat-card-content {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 18px;
      color: var(--cl-warning);
      background: rgba(255, 248, 238, 0.85);
    }

    .search-controls {
      padding: 24px 26px 26px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .search-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-end;
      flex-wrap: wrap;
    }

    .search-header h2 {
      margin: 0;
      font-size: 24px;
      letter-spacing: -0.04em;
    }

    .search-header-note {
      color: var(--cl-text-muted);
      font-size: 13px;
      max-width: 360px;
      line-height: 1.6;
    }

    .search-bar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 14px;
      align-items: center;
    }

    .search-field {
      min-width: 0;
      margin-bottom: -1.25em;
    }

    .source-toggle {
      height: 48px;
      background: rgba(244, 247, 244, 0.9);
      border-radius: 16px;
    }

    .toggle-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }

    .toggle-label mat-icon {
      font-size: 16px;
      height: 16px;
      width: 16px;
    }

    .toggle-label-alfresco {
      color: var(--source-alfresco-strong);
    }

    .toggle-label-nuxeo {
      color: var(--source-nuxeo-strong);
    }

    .search-action {
      min-height: 48px;
      min-width: 150px;
      border-radius: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .context-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 20px;
      flex-wrap: wrap;
    }

    .context-group,
    .context-stats {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .context-label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--cl-text-soft);
    }

    .ctx-user {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
    }

    .ctx-user mat-icon {
      font-size: 14px;
      height: 14px;
      width: 14px;
    }

    .ctx-user-alfresco {
      background: var(--source-alfresco-soft);
      color: var(--source-alfresco-strong);
    }

    .ctx-user-nuxeo {
      background: var(--source-nuxeo-soft);
      color: var(--source-nuxeo-strong);
    }

    .ctx-empty {
      color: var(--cl-text-soft);
      font-style: italic;
      font-size: 13px;
    }

    .results-heading {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-end;
      flex-wrap: wrap;
      padding: 0 4px;
    }

    .results-heading h2 {
      margin: 4px 0 0;
      font-size: 26px;
      letter-spacing: -0.04em;
    }

    .results-heading p {
      max-width: 440px;
    }

    .empty-state {
      padding: 36px 28px;
      text-align: center;
      color: var(--cl-text-muted);
    }

    .empty-state > mat-icon {
      font-size: 54px;
      width: 54px;
      height: 54px;
      color: var(--cl-text-soft);
    }

    .empty-title {
      margin: 12px 0 10px;
      font-size: 20px;
      font-weight: 700;
      color: var(--cl-text);
    }

    .empty-copy {
      margin: 0;
      font-size: 14px;
      line-height: 1.7;
    }

    .empty-copy.muted {
      margin-top: 6px;
      color: var(--cl-text-soft);
    }

    .permission-callout {
      max-width: 560px;
      margin: 18px auto 0;
      padding: 18px;
      border-radius: 18px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: rgba(255, 248, 238, 0.92);
      border: 1px solid rgba(184, 107, 23, 0.2);
      text-align: left;
    }

    .permission-callout mat-icon {
      color: var(--cl-warning);
    }

    .permission-callout p {
      margin: 6px 0 0;
      font-size: 13px;
      line-height: 1.6;
      color: var(--cl-text-muted);
    }

    .compare-section {
      margin-top: 2px;
    }

    @media (max-width: 980px) {
      .search-hero {
        grid-template-columns: 1fr;
      }

      .search-bar {
        grid-template-columns: 1fr;
      }

      .search-action {
        width: 100%;
      }
    }
  `]
})
export class SearchComponent {
  query = '';
  sourceFilter: ContentSourceType | '' = '';
  results: RagResult[] = [];
  loading = false;
  searched = false;
  ctx: SearchContext | null = null;
  lastCompareResult: CompareResult | null = null;

  constructor(
    private rag: RagService,
    private snackBar: MatSnackBar,
    private auth: AuthService
  ) {}

  get anyLoggedIn(): boolean { return this.auth.isAnyLoggedIn(); }
  get alfrescoLoggedIn(): boolean { return this.auth.isAlfrescoLoggedIn(); }
  get nuxeoLoggedIn(): boolean { return this.auth.isNuxeoLoggedIn(); }

  get activeSessionCount(): number {
    return Number(this.alfrescoLoggedIn) + Number(this.nuxeoLoggedIn);
  }

  get alfrescoUserLabel(): string {
    return this.auth.getAlfrescoSession()?.username ?? 'Not connected';
  }

  get nuxeoUserLabel(): string {
    return this.auth.getNuxeoSession()?.username ?? 'Not connected';
  }

  search(): void {
    if (!this.query.trim() || !this.anyLoggedIn) return;
    this.loading = true;
    this.searched = false;
    this.results = [];
    this.ctx = null;
    this.lastCompareResult = null;

    const t0 = Date.now();
    const sourceType = this.sourceFilter || undefined;

    // Snapshot sessions at search time because the active identities may change afterwards.
    const alfSession: AlfrescoSession | null = this.auth.getAlfrescoSession();
    const nuxSession: NuxeoSession | null = this.auth.getNuxeoSession();

    this.rag.search(this.query, sourceType).subscribe({
      next: results => {
        const elapsed = Date.now() - t0;
        this.results = results;
        this.ctx = {
          query: this.query,
          sourceFilter: this.sourceFilter,
          alfrescoUser: alfSession?.username ?? null,
          nuxeoUser: nuxSession?.username ?? null,
          resultCount: results.length,
          searchTimeMs: elapsed
        };
        this.searched = true;
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.searched = true;
        const msg = err.status === 401
          ? 'Authentication failed. Log in again.'
          : err.status === 0
            ? 'Cannot reach the RAG service.'
            : `Search error: ${err.status} ${err.statusText}`;
        this.snackBar.open(msg, 'Dismiss', { duration: 6000 });
      }
    });
  }

  openLink(result: RagResult): void {
    const url = result.openInSourceUrl ?? result.url;
    if (url) window.open(url, '_blank');
  }

  onCompareComplete(result: CompareResult): void {
    this.lastCompareResult = result;
  }
}
