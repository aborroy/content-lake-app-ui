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
    <!-- Editorial hero --------------------------------------------------- -->
    <section class="search-hero">
      <div class="hero-glow hero-glow-blue"></div>
      <div class="hero-glow hero-glow-teal"></div>

      <div class="hero-shell">
        <div class="hero-copy">
          <span class="eyebrow">Search workspace</span>
          <h1 class="display-1">
            Find the right document faster —
            <span class="accent-teal">and see where it came from.</span>
          </h1>
          <p class="hero-lede">
            Search across Alfresco and Nuxeo with clearer ranking, stronger contrast, and persistent
            source cues so you can spot repository ownership at a glance.
          </p>

          <div class="hero-chips">
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

        <aside class="hero-panel">
          <div class="hero-panel-header">
            <span class="stat-label">Repository sessions</span>
            <span class="hero-panel-count">{{ activeSessionCount }}/2</span>
          </div>

          <div class="hero-session-list">
            <div class="hero-session hero-session-alfresco" [class.connected]="alfrescoLoggedIn">
              <div class="session-indicator" [class.active]="alfrescoLoggedIn"></div>
              <mat-icon class="session-src-icon">storage</mat-icon>
              <div class="session-info">
                <strong>Alfresco</strong>
                <span>{{ alfrescoUserLabel }}</span>
              </div>
            </div>
            <div class="hero-session hero-session-nuxeo" [class.connected]="nuxeoLoggedIn">
              <div class="session-indicator" [class.active]="nuxeoLoggedIn"></div>
              <mat-icon class="session-src-icon">folder_open</mat-icon>
              <div class="session-info">
                <strong>Nuxeo</strong>
                <span>{{ nuxeoUserLabel }}</span>
              </div>
            </div>
          </div>

          <p class="hero-panel-note">
            Use the source filter below to narrow to one repository, or keep both to compare relevance.
          </p>
        </aside>
      </div>
    </section>

    <div class="page-container-wide search-body">

      <div *ngIf="!anyLoggedIn" class="warning-banner editorial-surface">
        <div class="warning-accent" aria-hidden="true"></div>
        <mat-icon>warning_amber</mat-icon>
        <span>No active sessions. <a routerLink="/login">Connect Alfresco, Nuxeo, or both</a> to search.</span>
      </div>

      <!-- Search controls ------------------------------------------------ -->
      <section class="search-controls editorial-surface">
        <div class="search-header">
          <div>
            <span class="eyebrow">Query</span>
            <h2 class="display-2">Readable results, with explicit source identity.</h2>
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
            <span>{{ loading ? 'Searching…' : 'Run search' }}</span>
            <mat-icon *ngIf="!loading">arrow_forward</mat-icon>
          </button>
        </div>
      </section>

      <div *ngIf="ctx" class="context-bar surface-card">
        <div class="context-group">
          <span class="context-label">Context</span>
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
          <h2 class="display-2">Ranked document matches.</h2>
        </div>
        <p class="section-copy">
          Repository colors stay attached to each card, badge, and action so provenance remains obvious while scanning.
        </p>
      </div>

      <app-results [results]="results" (select)="openLink($event)"></app-results>

      <div *ngIf="searched && !loading && results.length === 0" class="empty-state surface-card">
        <div class="empty-icon">
          <mat-icon>search_off</mat-icon>
        </div>
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
    :host { display: block; }

    /* ── Hero (light editorial) ─────────────────────────────── */

    .search-hero {
      position: relative;
      overflow: hidden;
      background:
        radial-gradient(80% 120% at 80% -10%, rgba(75, 189, 224, 0.14) 0%, transparent 60%),
        radial-gradient(60% 80% at 8% 110%, rgba(107, 98, 178, 0.1) 0%, transparent 65%),
        linear-gradient(180deg, #F8FAFE 0%, var(--cl-bg) 100%);
      padding: clamp(44px, 6vw, 72px) 0 clamp(56px, 6vw, 80px);
      border-bottom: 1px solid var(--cl-border);
    }

    .hero-glow {
      position: absolute;
      pointer-events: none;
      border-radius: 50%;
      filter: blur(80px);
    }
    .hero-glow-blue {
      width: 380px; height: 380px;
      top: -40px; right: 6%;
      background: var(--hy-mark-blue);
      opacity: 0.18;
    }
    .hero-glow-teal {
      width: 320px; height: 320px;
      bottom: -60px; left: 20%;
      background: var(--hy-mark-teal);
      opacity: 0.14;
    }

    .hero-shell {
      position: relative;
      max-width: var(--container-wide);
      margin: 0 auto;
      padding: 0 24px;
      display: grid;
      grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.9fr);
      gap: clamp(28px, 4vw, 56px);
      align-items: end;
    }

    .hero-copy {
      display: flex;
      flex-direction: column;
      gap: 18px;
      min-width: 0;
    }

    .accent-teal {
      background: linear-gradient(90deg, var(--hy-teal-dark), var(--hy-mark-teal));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .hero-lede {
      margin: 0;
      font-size: clamp(15px, 1.15vw, 17px);
      line-height: 1.7;
      color: var(--cl-text-muted);
      max-width: 58ch;
    }

    .hero-chips {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 4px;
    }

    /* ── Hero panel ────────────────────────────────────────── */

    .hero-panel {
      justify-self: end;
      width: 100%;
      max-width: 340px;
      padding: 22px;
      border-radius: var(--radius-lg);
      background: var(--cl-surface);
      border: 1px solid var(--cl-border);
      box-shadow: var(--cl-shadow);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .hero-panel-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }

    .stat-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--cl-text-soft);
      text-transform: uppercase;
      letter-spacing: 0.2em;
    }

    .hero-panel-count {
      font-family: var(--cl-font-display);
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: var(--cl-text);
    }

    .hero-session-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .hero-session {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 13px;
      border-radius: var(--radius-md);
      border: 1px solid var(--cl-border);
      background: var(--hy-gray-50);
      color: var(--cl-text-soft);
      transition: all 180ms var(--ease-out);
    }

    .hero-session.connected {
      color: var(--cl-text);
      background: var(--cl-surface);
    }

    .hero-session-alfresco.connected {
      border-color: rgba(120, 190, 32, 0.35);
      background: linear-gradient(135deg, rgba(120, 190, 32, 0.08), var(--cl-surface));
    }

    .hero-session-nuxeo.connected {
      border-color: rgba(0, 163, 224, 0.3);
      background: linear-gradient(135deg, rgba(0, 163, 224, 0.08), var(--cl-surface));
    }

    .session-indicator {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--cl-border-strong);
      flex-shrink: 0;
    }

    .session-indicator.active {
      background: var(--cl-success);
      box-shadow: 0 0 0 4px rgba(46, 125, 50, 0.15);
    }

    .hero-session-alfresco .session-indicator.active {
      background: var(--source-alfresco);
      box-shadow: 0 0 0 4px rgba(120, 190, 32, 0.2);
    }

    .hero-session-nuxeo .session-indicator.active {
      background: var(--source-nuxeo);
      box-shadow: 0 0 0 4px rgba(0, 163, 224, 0.2);
    }

    .session-src-icon {
      font-size: 20px;
      height: 20px;
      width: 20px;
      flex-shrink: 0;
      opacity: 0.5;
    }

    .connected .session-src-icon { opacity: 1; }

    .hero-session-alfresco.connected .session-src-icon { color: var(--source-alfresco-strong); }
    .hero-session-nuxeo.connected .session-src-icon { color: var(--source-nuxeo-strong); }

    .session-info strong,
    .session-info span {
      display: block;
      line-height: 1.25;
    }

    .session-info strong {
      font-size: 13px;
      font-weight: 600;
    }

    .session-info span {
      font-size: 11px;
      color: var(--cl-text-soft);
    }

    .hero-panel-note {
      margin: 0;
      font-size: 12px;
      line-height: 1.6;
      color: var(--cl-text-muted);
    }

    /* ── Body ─────────────────────────────────────────────── */

    .search-body {
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin-top: clamp(-40px, -3vw, -28px);
      position: relative;
      z-index: 2;
    }

    .warning-banner {
      position: relative;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      color: var(--cl-warning);
      background: rgba(255, 248, 238, 0.92);
      border-color: rgba(196, 85, 0, 0.18);
      font-size: 13px;
      font-weight: 500;
      overflow: hidden;
    }

    .warning-accent {
      position: absolute;
      inset: 0 auto 0 0;
      width: 4px;
      background: var(--hy-mark-yellow);
    }

    /* ── Search controls ──────────────────────────────────── */

    .search-controls {
      padding: 28px 32px 28px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .search-header {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-end;
      flex-wrap: wrap;
    }

    .search-header h2 {
      margin: 8px 0 0;
    }

    .search-header-note {
      color: var(--cl-text-muted);
      font-size: 13px;
      max-width: 360px;
      line-height: 1.65;
    }

    .search-bar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 12px;
      align-items: center;
    }

    .search-field {
      min-width: 0;
      margin-bottom: -1.25em;
    }

    .source-toggle {
      height: 46px;
      background: var(--hy-gray-50);
      border-radius: var(--radius-sm);
    }

    .toggle-label {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-weight: 600;
      font-size: 12px;
    }

    .toggle-label mat-icon {
      font-size: 15px;
      height: 15px;
      width: 15px;
    }

    .toggle-label-alfresco { color: var(--source-alfresco-strong); }
    .toggle-label-nuxeo    { color: var(--source-nuxeo-strong); }

    .search-action {
      min-height: 48px;
      min-width: 154px;
      padding: 0 22px;
      border-radius: var(--radius-sm);
      font-family: var(--cl-font-display);
      font-weight: 600;
      font-size: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .search-action mat-icon {
      font-size: 18px;
      height: 18px;
      width: 18px;
      transition: transform 220ms var(--ease-out);
    }

    .search-action:not([disabled]):hover mat-icon { transform: translateX(3px); }

    /* ── Context bar ──────────────────────────────────────── */

    .context-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 14px 20px;
      flex-wrap: wrap;
      border-radius: var(--radius-lg) !important;
    }

    .context-group,
    .context-stats {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .context-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--cl-text-soft);
    }

    .ctx-user {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 9px;
      border-radius: var(--radius-xs);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .ctx-user mat-icon {
      font-size: 13px;
      height: 13px;
      width: 13px;
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
      font-size: 12px;
    }

    /* ── Results heading ──────────────────────────────────── */

    .results-heading {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: flex-end;
      flex-wrap: wrap;
      padding: 12px 4px 0;
    }

    .results-heading h2 {
      margin: 8px 0 0;
    }

    .results-heading p { max-width: 460px; }

    /* ── Empty state ──────────────────────────────────────── */

    .empty-state {
      padding: 44px 32px;
      text-align: center;
      color: var(--cl-text-muted);
      border-radius: var(--radius-lg) !important;
    }

    .empty-icon {
      width: 64px;
      height: 64px;
      border-radius: var(--radius-lg);
      background: var(--hy-gray-100);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 14px;
    }

    .empty-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: var(--cl-text-soft);
    }

    .empty-title {
      margin: 4px 0 10px;
      font-family: var(--cl-font-display);
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: var(--cl-text);
    }

    .empty-copy {
      margin: 0;
      font-size: 13px;
      line-height: 1.7;
    }

    .empty-copy.muted {
      margin-top: 6px;
      color: var(--cl-text-soft);
    }

    .permission-callout {
      max-width: 560px;
      margin: 18px auto 0;
      padding: 16px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: rgba(255, 248, 238, 0.92);
      border: 1px solid rgba(184, 107, 23, 0.2);
      text-align: left;
    }

    .permission-callout mat-icon { color: var(--cl-warning); }

    .permission-callout p {
      margin: 4px 0 0;
      font-size: 13px;
      line-height: 1.6;
      color: var(--cl-text-muted);
    }

    .compare-section { margin-top: 2px; }

    /* ── Responsive ───────────────────────────────────────── */

    @media (max-width: 980px) {
      .hero-shell { grid-template-columns: 1fr; }
      .hero-panel { justify-self: stretch; max-width: none; }
      .search-bar { grid-template-columns: 1fr; }
      .search-action { width: 100%; }
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

  get anyLoggedIn(): boolean     { return this.auth.isAnyLoggedIn(); }
  get alfrescoLoggedIn(): boolean { return this.auth.isAlfrescoLoggedIn(); }
  get nuxeoLoggedIn(): boolean   { return this.auth.isNuxeoLoggedIn(); }

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
