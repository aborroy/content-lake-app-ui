import { Component, OnInit } from '@angular/core';
import { RagService, StatusResponse } from '../services/rag.service';

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
          <h1 class="display-2">Content Lake status</h1>
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
            <thead><tr><th>Source</th><th>Documents</th></tr></thead>
            <tbody>
              <tr *ngFor="let entry of sourceEntries">
                <td>{{ entry.key }}</td>
                <td>{{ entry.count }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ng-container>
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
  `]
})
export class StatusComponent implements OnInit {
  status: StatusResponse | null = null;
  loading = false;
  error: string | null = null;

  constructor(private rag: RagService) {}

  ngOnInit(): void {
    this.refresh();
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
  }

  get sourceEntries(): { key: string; count: number }[] {
    if (!this.status?.sourceCounts) {
      return [];
    }
    return Object.entries(this.status.sourceCounts)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  }

  isUp(value?: string): boolean {
    return (value ?? '').toUpperCase() === 'UP';
  }
}
