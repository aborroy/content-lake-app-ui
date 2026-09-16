import { Component, OnInit } from '@angular/core';
import { ConnectorListing, RagService, StatusResponse } from '../services/rag.service';
import { environment } from '../../environments/environment';
import { sourceClass, sourceIcon, sourceTypeLabel, splitSourceKey } from '../utils/source-presentation';

/**
 * Operational status view (#6): renders the rag-service /api/status snapshot -
 * hxpr connectivity, indexed document counts (total and per source), and
 * embedding-model reachability.
 */
@Component({
  selector: 'app-status',
  template: `
    <div class="page-container-wide status-page">
      <div class="status-header">
        <div>
          <span class="eyebrow">Operations</span>
          <h1 class="display-2">AI Ready Content Hub status</h1>
        </div>
        <button mat-stroked-button type="button" (click)="refresh()" [disabled]="loading">
          <mat-icon>refresh</mat-icon>
          Refresh
        </button>
      </div>

      <div *ngIf="loading" class="status-loading">
        <mat-spinner diameter="24"></mat-spinner>
        <span>Loading status...</span>
      </div>

      <div *ngIf="error && !loading" class="status-error">
        <mat-icon>error_outline</mat-icon>
        <span>{{ error }}</span>
      </div>

      <ng-container *ngIf="status && !loading">
        <div class="status-tiles">
          <div class="status-tile">
            <span class="tile-label">hxpr</span>
            <span class="badge" [class.up]="isUp(status.hxprStatus)" [class.down]="!isUp(status.hxprStatus)">
              <mat-icon>{{ isUp(status.hxprStatus) ? 'check_circle' : 'error' }}</mat-icon>
              {{ status.hxprStatus }}
            </span>
          </div>
          <div class="status-tile">
            <span class="tile-label">Indexed documents</span>
            <span class="tile-value">{{ status.totalDocuments }}</span>
          </div>
          <div class="status-tile">
            <span class="tile-label">Embedding model</span>
            <span class="badge" [class.up]="isUp(status.embeddingModel.status)" [class.down]="!isUp(status.embeddingModel.status)">
              <mat-icon>{{ isUp(status.embeddingModel.status) ? 'check_circle' : 'error' }}</mat-icon>
              {{ status.embeddingModel.status }}
            </span>
            <span class="tile-sub" *ngIf="status.embeddingModel.url">{{ status.embeddingModel.url }}</span>
          </div>
        </div>

        <div *ngIf="sourceEntries.length > 0" class="status-sources surface-card">
          <h3>Documents per source</h3>
          <table class="status-table">
            <thead><tr><th>Source</th><th>Source id</th><th>Documents</th></tr></thead>
            <tbody>
              <tr *ngFor="let entry of sourceEntries">
                <td>
                  <span class="source-badge" [ngClass]="badgeClass(entry.sourceType)">
                    <mat-icon>{{ iconFor(entry.sourceType) }}</mat-icon>
                    {{ entry.label }}
                  </span>
                </td>
                <td class="mono">{{ entry.sourceId || '(none)' }}</td>
                <td>{{ entry.count }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ng-container>

      <!-- Loaded connectors (#9). Rendered only when a connectors URL is configured, because
           /api/connectors lives on an ingester rather than on rag-service and nothing proxies it. -->
      <div *ngIf="connectorsConfigured" class="status-sources surface-card">
        <h3>Loaded connectors</h3>

        <div *ngIf="connectorsLoading" class="status-loading">
          <mat-spinner diameter="20"></mat-spinner>
          <span>Loading connectors...</span>
        </div>

        <div *ngIf="connectorsError && !connectorsLoading" class="status-error">
          <mat-icon>error_outline</mat-icon>
          <span>{{ connectorsError }}</span>
        </div>

        <ng-container *ngIf="connectors && !connectorsLoading">
          <table *ngIf="connectors.connectors.length > 0" class="status-table">
            <thead>
              <tr><th>Source type</th><th>Name</th><th>Origin</th><th>Implementation</th><th>Settings</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of connectors.connectors">
                <td class="mono">{{ c.sourceType }}</td>
                <td>{{ c.displayName }}</td>
                <td class="mono">{{ c.origin }}</td>
                <td class="mono">{{ c.implementation }}</td>
                <td>{{ c.settings }}</td>
              </tr>
            </tbody>
          </table>

          <p *ngIf="connectors.connectors.length === 0" class="status-note">
            No connectors loaded.
          </p>

          <!-- A jar that failed to load is the question this panel exists to answer. -->
          <div *ngIf="connectors.problems.length > 0" class="connector-problems">
            <h4>
              <mat-icon>report_problem</mat-icon>
              Failed to load
            </h4>
            <ul>
              <li *ngFor="let problem of connectors.problems">{{ problem }}</li>
            </ul>
          </div>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    .status-page { padding-top: 24px; display: flex; flex-direction: column; gap: 18px; }

    .status-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .status-header h1 { margin: 6px 0 0; }

    .status-loading,
    .status-error {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }

    .status-error { color: var(--cl-danger); }

    .status-tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }

    .status-tile {
      border: 1px solid var(--cl-border);
      border-radius: var(--radius-md);
      background: var(--cl-surface);
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .tile-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: var(--cl-text-soft);
    }

    .tile-value {
      font-family: var(--cl-font-display);
      font-size: 30px;
      font-weight: 700;
      color: var(--cl-text);
    }

    .tile-sub { font-size: 11px; color: var(--cl-text-soft); word-break: break-all; }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      align-self: flex-start;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
    }

    .badge mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .badge.up { color: var(--cl-success); background: rgba(46, 125, 50, 0.1); }
    .badge.down { color: var(--cl-danger); background: rgba(211, 47, 47, 0.1); }

    .status-sources { padding: 18px 20px; border-radius: var(--radius-lg) !important; }
    .status-sources h3 { margin: 0 0 10px; }

    .status-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .status-table th, .status-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--cl-border); }
    .status-table th { color: var(--cl-text-soft); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }

    .mono {
      font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12.5px;
      word-break: break-all;
    }

    .status-note { margin: 0; font-size: 13px; color: var(--cl-text-muted); }

    .connector-problems { margin-top: 14px; }

    .connector-problems h4 {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 6px;
      font-size: 13px;
      color: var(--cl-danger);
    }

    .connector-problems h4 mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .connector-problems ul { margin: 0; padding-left: 20px; font-size: 12.5px; }
  `]
})
export class StatusComponent implements OnInit {
  status: StatusResponse | null = null;
  loading = false;
  error: string | null = null;

  connectors: ConnectorListing | null = null;
  connectorsLoading = false;
  connectorsError: string | null = null;

  constructor(private rag: RagService) {}

  ngOnInit(): void {
    this.refresh();
  }

  get connectorsConfigured(): boolean {
    return !!(environment.connectorsUrl ?? '').trim();
  }

  refresh(): void {
    this.loading = true;
    this.error = null;
    this.rag.getStatus().subscribe({
      next: (status) => {
        this.status = status;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || err?.message || 'Failed to load status';
        this.loading = false;
      }
    });
    this.refreshConnectors();
  }

  /** One row per source, labelled rather than showing the raw `<sourceType>:<sourceId>` key. */
  get sourceEntries(): SourceRow[] {
    if (!this.status?.sourceCounts) {
      return [];
    }
    return Object.entries(this.status.sourceCounts)
      .map(([key, count]) => {
        const { sourceType, sourceId } = splitSourceKey(key);
        return { key, sourceType, sourceId, label: sourceTypeLabel(sourceType), count };
      })
      .sort((a, b) => b.count - a.count);
  }

  iconFor(sourceType?: string): string { return sourceIcon(sourceType); }

  badgeClass(sourceType?: string): string { return sourceClass('source-badge', sourceType); }

  isUp(value?: string): boolean {
    return (value ?? '').toUpperCase() === 'UP';
  }

  /**
   * Reads the connector listing when one is configured. A failure is reported on this panel alone: the
   * URL points at a service the rest of the page does not depend on, so it must not fail the page.
   */
  private refreshConnectors(): void {
    const request = this.rag.getConnectors();
    if (!request) {
      this.connectors = null;
      return;
    }
    this.connectorsLoading = true;
    this.connectorsError = null;
    request.subscribe({
      next: (listing) => {
        this.connectors = {
          connectors: listing?.connectors ?? [],
          problems: listing?.problems ?? []
        };
        this.connectorsLoading = false;
      },
      error: (err) => {
        this.connectorsError = err?.status === 0
          ? 'Cannot reach the configured connectors URL.'
          : err?.error?.message || err?.message || 'Failed to load connectors';
        this.connectorsLoading = false;
      }
    });
  }
}

interface SourceRow {
  key: string;
  sourceType: string;
  sourceId: string;
  label: string;
  count: number;
}
