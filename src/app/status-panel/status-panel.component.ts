import { Component, OnInit, OnDestroy } from '@angular/core';
import { RagService, RagHealth, RagComponentHealth } from '../services/rag.service';

@Component({
  selector: 'app-status-panel',
  template: `
    <mat-card style="margin-bottom:16px">
      <mat-card-header>
        <mat-icon mat-card-avatar [style.color]="overallColor">
          {{ overallIcon }}
        </mat-icon>
        <mat-card-title style="font-size:14px">RAG Service Status</mat-card-title>
        <mat-card-subtitle>
          <span [style.color]="overallColor" style="font-weight:500">{{ overallLabel }}</span>
        </mat-card-subtitle>
      </mat-card-header>

      <mat-card-content style="padding:8px 16px 4px">
        <div *ngIf="loading" style="display:flex;align-items:center;gap:8px;color:#9e9e9e;font-size:13px">
          <mat-spinner diameter="16"></mat-spinner> Checking…
        </div>
        <div *ngIf="error && !loading" style="color:#c62828;font-size:13px">
          <mat-icon style="font-size:14px;vertical-align:middle">error_outline</mat-icon>
          Cannot reach RAG service
        </div>
        <div *ngIf="health && !loading" style="display:flex;gap:16px;flex-wrap:wrap">
          <div class="status-item" *ngFor="let c of components">
            <mat-icon class="status-dot" [style.color]="statusColor(c.status)">
              {{ c.status === 'UP' ? 'check_circle' : 'cancel' }}
            </mat-icon>
            <span class="status-label">{{ c.label }}</span>
            <span *ngIf="c.detail" class="status-detail">{{ c.detail }}</span>
          </div>
        </div>
      </mat-card-content>

      <mat-card-actions align="end" style="padding:0 8px 4px">
        <button mat-icon-button matTooltip="Refresh" (click)="refresh()" [disabled]="loading">
          <mat-icon style="font-size:18px">refresh</mat-icon>
        </button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`
    .status-item {
      display: flex; align-items: center; gap: 4px; font-size: 12px;
    }
    .status-dot { font-size: 14px; height: 14px; width: 14px; }
    .status-label { font-weight: 500; }
    .status-detail { color: #9e9e9e; }
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
    return this.health?.status ?? '—';
  }

  get overallIcon(): string {
    if (this.error || this.health?.status !== 'UP') return 'warning';
    return 'check_circle';
  }

  get overallColor(): string {
    if (this.error) return '#c62828';
    if (!this.health) return '#9e9e9e';
    return this.health.status === 'UP' ? '#2e7d32' : '#e65100';
  }

  statusColor(status: string | undefined): string {
    return status === 'UP' ? '#2e7d32' : '#c62828';
  }

  get components(): { label: string; status: string; detail?: string }[] {
    if (!this.health) return [];
    const items = [];
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
