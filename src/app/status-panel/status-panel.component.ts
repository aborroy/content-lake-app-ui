import { Component, OnDestroy, OnInit } from '@angular/core';
import { RagHealth, RagService } from '../services/rag.service';

@Component({
  selector: 'app-status-panel',
  template: `
    <mat-card class="status-card">
      <div class="status-shell">
        <div class="status-header">
          <div class="status-summary">
            <div class="status-icon" [style.color]="overallColor">
              <mat-icon>{{ overallIcon }}</mat-icon>
            </div>
            <div>
              <span class="status-label">RAG service status</span>
              <h2>{{ overallLabel }}</h2>
            </div>
          </div>

          <button mat-icon-button matTooltip="Refresh" (click)="refresh()" [disabled]="loading">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>

        <div *ngIf="loading" class="status-loading">
          <mat-spinner diameter="18"></mat-spinner>
          Checking current service health...
        </div>

        <div *ngIf="error && !loading" class="status-error">
          <mat-icon>error_outline</mat-icon>
          Cannot reach the RAG service.
        </div>

        <div *ngIf="health && !loading" class="status-grid">
          <div class="status-item" *ngFor="let c of components">
            <span class="status-dot" [style.background]="statusColor(c.status)"></span>
            <div>
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
    .status-card {
      overflow: hidden;
    }

    .status-shell {
      padding: 20px 22px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .status-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
    }

    .status-summary {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .status-icon {
      width: 48px;
      height: 48px;
      border-radius: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(24, 49, 38, 0.06);
    }

    .status-label {
      display: inline-block;
      margin-bottom: 4px;
      color: var(--cl-text-soft);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    h2 {
      margin: 0;
      font-size: 22px;
      letter-spacing: -0.04em;
    }

    .status-loading,
    .status-error {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--cl-text-muted);
      font-size: 13px;
    }

    .status-error {
      color: var(--cl-danger);
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 18px;
      border: 1px solid var(--cl-border);
      background: rgba(244, 247, 244, 0.7);
    }

    .status-item strong,
    .status-item span {
      display: block;
    }

    .status-item strong {
      color: var(--cl-text);
      font-size: 13px;
      margin-bottom: 2px;
    }

    .status-item span {
      color: var(--cl-text-soft);
      font-size: 12px;
    }

    .status-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
      box-shadow: 0 0 0 6px rgba(24, 49, 38, 0.04);
    }

    .status-detail {
      margin-left: auto;
      font-size: 12px;
      font-weight: 700;
      color: var(--cl-text-muted) !important;
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
      next: h => {
        this.health = h;
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      }
    });
  }

  get overallLabel(): string {
    if (this.error) return 'Unreachable';
    return this.health?.status ?? '-';
  }

  get overallIcon(): string {
    if (this.error || this.health?.status !== 'UP') return 'warning';
    return 'check_circle';
  }

  get overallColor(): string {
    if (this.error) return 'var(--cl-danger)';
    if (!this.health) return 'var(--cl-text-soft)';
    return this.health.status === 'UP' ? 'var(--cl-success)' : 'var(--cl-warning)';
  }

  statusColor(status: string | undefined): string {
    return status === 'UP' ? 'var(--cl-success)' : 'var(--cl-danger)';
  }

  get components(): { label: string; status: string; detail?: string }[] {
    if (!this.health) return [];
    const items: { label: string; status: string; detail?: string }[] = [];
    if (this.health.embedding) {
      items.push({
        label: 'Embedding',
        status: this.health.embedding.status,
        detail: this.health.embedding.model
      });
    }
    if (this.health.hxpr) {
      items.push({
        label: 'HXPR',
        status: this.health.hxpr.status,
        detail: this.health.hxpr.searchTimeMs != null
          ? `${this.health.hxpr.searchTimeMs}ms`
          : undefined
      });
    }
    if (this.health.llm) {
      items.push({ label: 'LLM', status: this.health.llm.status });
    }
    return items;
  }
}
