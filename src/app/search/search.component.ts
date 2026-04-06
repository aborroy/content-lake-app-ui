import { Component } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService, AlfrescoSession, NuxeoSession } from '../services/auth.service';
import { RagService, RagResult, ContentSourceType } from '../services/rag.service';
import { CompareResult } from '../permission-compare/permission-compare.component';

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
    <div class="page-container">

      <!-- No-session banner -->
      <mat-card *ngIf="!anyLoggedIn" style="margin-bottom:16px;background:#fff3e0">
        <mat-card-content style="display:flex;align-items:center;gap:8px;padding:12px">
          <mat-icon color="warn">warning</mat-icon>
          <span>No active sessions. <a routerLink="/login">Log in</a> to Alfresco, Nuxeo, or both.</span>
        </mat-card-content>
      </mat-card>

      <!-- Search bar + source selector -->
      <mat-card style="margin-bottom:16px">
        <mat-card-content style="padding:16px">
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">

            <mat-form-field appearance="outline"
                            style="flex:1;min-width:200px;margin-bottom:-1.25em">
              <mat-label>Search documents…</mat-label>
              <input matInput [(ngModel)]="query"
                     (keyup.enter)="search()" [disabled]="loading" />
              <mat-icon matPrefix>search</mat-icon>
            </mat-form-field>

            <mat-button-toggle-group [(ngModel)]="sourceFilter" style="height:40px">
              <mat-button-toggle value="">
                <mat-icon style="font-size:16px;margin-right:4px">layers</mat-icon>All
              </mat-button-toggle>
              <mat-button-toggle value="alfresco" [disabled]="!alfrescoLoggedIn"
                [matTooltip]="alfrescoLoggedIn ? 'Alfresco only' : 'Log in to Alfresco first'">
                <mat-icon style="font-size:16px;margin-right:4px;color:#1565c0">storage</mat-icon>
                Alfresco
              </mat-button-toggle>
              <mat-button-toggle value="nuxeo" [disabled]="!nuxeoLoggedIn"
                [matTooltip]="nuxeoLoggedIn ? 'Nuxeo only' : 'Log in to Nuxeo first'">
                <mat-icon style="font-size:16px;margin-right:4px;color:#c62828">folder_open</mat-icon>
                Nuxeo
              </mat-button-toggle>
            </mat-button-toggle-group>

            <button mat-raised-button color="primary"
                    (click)="search()"
                    [disabled]="loading || !query.trim() || !anyLoggedIn">
              <mat-spinner *ngIf="loading" diameter="18"
                           style="display:inline-block;margin-right:6px"></mat-spinner>
              {{ loading ? 'Searching…' : 'Search' }}
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- ① Permission context bar — who ran this search -->
      <div *ngIf="ctx" class="context-bar">
        <mat-icon style="font-size:15px;opacity:0.7">lock</mat-icon>
        <span>Searched as:</span>
        <span *ngIf="ctx.alfrescoUser" class="ctx-user alfresco-user">
          <mat-icon style="font-size:12px">storage</mat-icon>
          {{ ctx.alfrescoUser }}
        </span>
        <span *ngIf="ctx.nuxeoUser" class="ctx-user nuxeo-user">
          <mat-icon style="font-size:12px">folder_open</mat-icon>
          {{ ctx.nuxeoUser }}
        </span>
        <span *ngIf="!ctx.alfrescoUser && !ctx.nuxeoUser" style="font-style:italic">
          (no session)
        </span>
        <span class="ctx-sep">·</span>
        <span>{{ ctx.resultCount }} result{{ ctx.resultCount !== 1 ? 's' : '' }}</span>
        <span class="ctx-sep">·</span>
        <span>{{ ctx.searchTimeMs }}ms</span>
        <span *ngIf="ctx.sourceFilter" class="ctx-sep">·</span>
        <span *ngIf="ctx.sourceFilter"
              [style.color]="ctx.sourceFilter === 'alfresco' ? '#1565c0' : '#c62828'">
          {{ ctx.sourceFilter | titlecase }} only
        </span>
      </div>

      <!-- Results list -->
      <app-results [results]="results" (select)="openLink($event)"></app-results>

      <!-- ② Empty state — distinguishes "nothing here" from "permission denied" -->
      <div *ngIf="searched && !loading && results.length === 0"
           style="text-align:center;padding:40px 16px;color:#9e9e9e">
        <mat-icon style="font-size:48px;height:48px;width:48px">search_off</mat-icon>
        <p style="font-size:15px;font-weight:500;color:#616161;margin:8px 0 4px">
          No results for <em>"{{ ctx?.query }}"</em>
        </p>

        <!-- If compare already ran and found something → permission denied confirmed -->
        <ng-container *ngIf="lastCompareResult && lastCompareResult.count > 0">
          <mat-card style="max-width:480px;margin:16px auto;text-align:left;background:#fff3e0;border:1px solid #ffb74d">
            <mat-card-content style="padding:16px;display:flex;gap:12px">
              <mat-icon color="warn" style="flex-shrink:0">shield</mat-icon>
              <div>
                <strong>Permission filtering confirmed</strong>
                <p style="margin:4px 0 0;font-size:13px;color:#616161">
                  <strong>{{ lastCompareResult.username }}</strong>
                  ({{ lastCompareResult.source | titlecase }}) found
                  <strong>{{ lastCompareResult.count }}</strong>
                  result{{ lastCompareResult.count !== 1 ? 's' : '' }} for the same query.
                  These documents exist but are not accessible with your current credentials.
                </p>
              </div>
            </mat-card-content>
          </mat-card>
        </ng-container>

        <!-- No compare yet → suggest using the panel -->
        <ng-container *ngIf="!lastCompareResult">
          <p style="font-size:13px">
            No documents matched with your current permissions.
          </p>
          <p style="font-size:12px;color:#bdbdbd">
            Use the <strong>Permission Comparison</strong> panel below to check whether documents
            exist for other users — this distinguishes "not indexed" from "restricted".
          </p>
        </ng-container>
      </div>

      <!-- ③ Permission comparison panel -->
      <div *ngIf="searched && !loading" style="margin-top:16px">
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
    .context-bar {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      font-size: 12px; color: #757575;
      padding: 6px 8px 10px;
    }
    .ctx-user {
      display: inline-flex; align-items: center; gap: 3px;
      border-radius: 10px; padding: 1px 8px;
      font-weight: 500; font-size: 11px;
    }
    .alfresco-user { background: #e3f2fd; color: #1565c0; }
    .nuxeo-user    { background: #ffebee; color: #c62828; }
    .ctx-sep { opacity: 0.4; }
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

  get anyLoggedIn(): boolean      { return this.auth.isAnyLoggedIn(); }
  get alfrescoLoggedIn(): boolean { return this.auth.isAlfrescoLoggedIn(); }
  get nuxeoLoggedIn(): boolean    { return this.auth.isNuxeoLoggedIn(); }

  search(): void {
    if (!this.query.trim() || !this.anyLoggedIn) return;
    this.loading = true;
    this.searched = false;
    this.results = [];
    this.ctx = null;
    this.lastCompareResult = null;

    const t0 = Date.now();
    const sourceType = this.sourceFilter || undefined;

    // Snapshot sessions AT SEARCH TIME — the user may change sessions after
    const alfSession: AlfrescoSession | null = this.auth.getAlfrescoSession();
    const nuxSession: NuxeoSession | null  = this.auth.getNuxeoSession();

    this.rag.search(this.query, sourceType).subscribe({
      next: results => {
        const elapsed = Date.now() - t0;
        this.results = results;
        this.ctx = {
          query: this.query,
          sourceFilter: this.sourceFilter,
          alfrescoUser: alfSession?.username ?? null,
          nuxeoUser:    nuxSession?.username ?? null,
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
          ? 'Authentication failed — please log in again.'
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
