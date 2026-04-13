import { Component, OnDestroy, OnInit } from '@angular/core';
import { RagHealth, RagService } from '../services/rag.service';

@Component({
  selector: 'app-status-panel',
  template: `
    <mat-card class="status-card">
      <div class="status-shell">
        <div class="status-header">
          <div class="status-summary">
            <div class="status-icon" [style.background]="overallBg">
              <mat-icon [style.color]="overallColor">{{ overallIcon }}</mat-icon>
            </div>
            <div>
              <span class="status-label">RAG service</span>
              <h2 [style.color]="overallColor">{{ overallLabel }}</h2>
            </div>
          </div>

          <button mat-icon-button matTooltip="Refresh" class="refresh-button" (click)="refresh()" [disabled]="loading">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>

        <div *ngIf="loading" class="status-loading">
          <mat-spinner diameter="16"></mat-spinner>
          <span>Checking service health…</span>
        </div>

        <div *ngIf="error && !loading" class="status-error">
          <mat-icon>error_outline</mat-icon>
          Cannot reach the RAG service.
        </div>

        <div *ngIf="health && !loading" class="status-grid">
          <div class="status-item" *ngFor="let c of components">
            <span class="status-dot" [style.background]="statusColor(c.status)"></span>
            <div class="status-item-body">
              <strong>{{ c.label }}</strong>
              <span>{{ c.status }}</span>
            </div>
            <span *ngIf="c.detail" class="status-detail">{{ c.detail }}</span>
          </div>
        </div>
      </div>
    </mat-card>
  `,
  styles: [`
    .status-card { overflow: hidden; }

    .status-shell {
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .status-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .status-summary {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .status-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .status-icon mat-icon {
      font-size: 20px;
      height: 20px;
      width: 20px;
    }

    .status-label {
      display: inline-block;
      margin-bottom: 2px;
      color: var(--cl-text-soft);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .refresh-button {
      color: var(--cl-text-soft);
    }

    .status-loading,
    .status-error {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--cl-text-muted);
      font-size: 12px;
    }

    .status-error { color: var(--cl-danger); }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 10px;
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 8px;
      border: 1px solid var(--cl-border);
      background: var(--hy-gray-50);
    }

    .status-item-body strong,
    .status-item-body span {
      display: block;
      line-height: 1.25;
    }

    .status-item-body strong {
      color: var(--cl-text);
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 1px;
    }

    .status-item-body span {
      color: var(--cl-text-soft);
      font-size: 11px;
    }

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .status-detail {
      margin-left: auto;
      font-size: 11px;
      font-weight: 600;
      color: var(--cl-text-muted);
      white-space: nowrap;
    }
  `]
})
export class StatusPanelComponent implements OnInit, OnDestroy {
  health: RagHealth | null = null;
  loading = false;
  error = false;

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private rag: RagService) {}

  ngOnInit(): void {
    this.refresh();
    this.timer = setInterval(() => this.refresh(), 30_000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  refresh(): void {
    this.loading = true;
    this.error = false;
    this.rag.getHealth().subscribe({
      next: h => { this.health = h; this.loading = false; },
      error: () => { this.error = true; this.loading = false; }
    });
  }

  get overallLabel(): string {
    if (this.error) return 'Unreachable';
    return this.health?.status ?? '–';
  }

  get overallIcon(): string {
    if (this.error || this.health?.status !== 'UP') return 'warning_amber';
    return 'check_circle';
  }

  get overallColor(): string {
    if (this.error) return 'var(--cl-danger)';
    if (!this.health) return 'var(--cl-text-soft)';
    return this.health.status === 'UP' ? 'var(--cl-success)' : 'var(--cl-warning)';
  }

  get overallBg(): string {
    if (this.error) return 'rgba(198, 40, 40, 0.08)';
    if (!this.health) return 'var(--hy-gray-100)';
    return this.health.status === 'UP'
      ? 'rgba(46, 125, 50, 0.08)'
      : 'rgba(196, 85, 0, 0.08)';
  }

  statusColor(status: string | undefined): string {
    return status === 'UP' ? 'var(--cl-success)' : 'var(--cl-danger)';
  }

  get components(): { label: string; status: string; detail?: string }[] {
    if (!this.health) return [];
    const items: { label: string; status: string; detail?: string }[] = [];
    if (this.health.embedding) {
      items.push({ label: 'Embedding', status: this.health.embedding.status, detail: this.health.embedding.model });
    }
    if (this.health.hxpr) {
      items.push({
        label: 'HXPR',
        status: this.health.hxpr.status,
        detail: this.health.hxpr.searchTimeMs != null ? `${this.health.hxpr.searchTimeMs}ms` : undefined
      });
    }
    if (this.health.llm) {
      items.push({ label: 'LLM', status: this.health.llm.status });
    }
    return items;
  }
}
