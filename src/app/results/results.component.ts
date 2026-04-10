import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RagResult } from '../services/rag.service';

@Component({
  selector: 'app-results',
  template: `
    <mat-card *ngFor="let r of results" class="result-card" [ngClass]="cardClass(r.source)">
      <div class="result-accent"></div>
      <div class="result-shell">
        <div class="result-header">
          <div class="result-icon" [ngClass]="iconClass(r.source)">
            <mat-icon>{{ sourceIcon(r.source) }}</mat-icon>
          </div>

          <div class="result-copy">
            <div class="result-topline">
              <span class="source-badge"
                    [ngClass]="r.source === 'alfresco' ? 'source-badge-alfresco' : r.source === 'nuxeo' ? 'source-badge-nuxeo' : ''">
                <mat-icon>{{ sourceIcon(r.source) }}</mat-icon>
                {{ r.source ? (r.source | titlecase) : 'Unknown' }}
                <span *ngIf="r.sourceId" class="source-id">{{ r.sourceId }}</span>
              </span>

              <span class="rank-pill">#{{ r.rank }}</span>
            </div>

            <h3>{{ r.title || '(untitled)' }}</h3>

            <div class="path-row" *ngIf="r.path">
              <mat-icon>route</mat-icon>
              <span [matTooltip]="r.path">{{ truncatePath(r.path) }}</span>
            </div>
          </div>
        </div>

        <div class="snippet">{{ r.snippet }}</div>

        <div class="result-footer">
          <div class="footer-meta">
            <span class="metric-chip">
              <mat-icon>insights</mat-icon>
              score {{ r.score | number:'1.2-2' }}
            </span>
            <span *ngIf="r.url || r.openInSourceUrl" class="footer-hint">Open the original item in its source repository.</span>
          </div>

          <button mat-stroked-button
                  type="button"
                  class="open-button"
                  [ngClass]="buttonClass(r.source)"
                  *ngIf="r.openInSourceUrl || r.url"
                  (click)="select.emit(r)"
                  matTooltip="Open in source repository">
            <mat-icon>open_in_new</mat-icon>
            Open source
          </button>
        </div>
      </div>
    </mat-card>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .result-card {
      position: relative;
      overflow: hidden;
    }

    .result-accent {
      position: absolute;
      inset: 0 auto 0 0;
      width: 6px;
      background: linear-gradient(180deg, rgba(24, 58, 100, 0.35), rgba(24, 58, 100, 0.08));
    }

    .result-card.result-alfresco .result-accent {
      background: linear-gradient(180deg, var(--source-alfresco), rgba(118, 184, 42, 0.18));
    }

    .result-card.result-nuxeo .result-accent {
      background: linear-gradient(180deg, var(--source-nuxeo), rgba(47, 109, 246, 0.18));
    }

    .result-shell {
      padding: 22px 22px 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .result-header {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }

    .result-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 16px;
      background: rgba(24, 58, 100, 0.08);
      color: var(--cl-primary);
      flex-shrink: 0;
    }

    .result-icon-alfresco {
      background: var(--source-alfresco-soft);
      color: var(--source-alfresco-strong);
    }

    .result-icon-nuxeo {
      background: var(--source-nuxeo-soft);
      color: var(--source-nuxeo-strong);
    }

    .result-copy {
      min-width: 0;
      flex: 1;
    }

    .result-topline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }

    .source-id {
      opacity: 0.72;
      font-weight: 600;
    }

    h3 {
      margin: 0 0 10px;
      font-size: 21px;
      line-height: 1.22;
      letter-spacing: -0.03em;
      color: var(--cl-text);
    }

    .path-row {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--cl-text-soft);
      font-size: 12px;
      max-width: 100%;
    }

    .path-row mat-icon {
      width: 15px;
      height: 15px;
      font-size: 15px;
      flex-shrink: 0;
    }

    .rank-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 46px;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(24, 49, 38, 0.06);
      color: var(--cl-text-muted);
      font-size: 12px;
      font-weight: 700;
    }

    .snippet {
      padding: 18px;
      border-radius: 18px;
      background: rgba(244, 247, 244, 0.92);
      border-left: 3px solid transparent;
      color: var(--cl-text);
      font-size: 14px;
      line-height: 1.72;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .result-alfresco .snippet {
      border-left-color: rgba(118, 184, 42, 0.4);
    }

    .result-nuxeo .snippet {
      border-left-color: rgba(47, 109, 246, 0.3);
    }

    .result-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .footer-meta {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .footer-hint {
      color: var(--cl-text-soft);
      font-size: 12px;
    }

    .open-button {
      min-height: 42px;
      border-radius: 14px;
      font-weight: 700;
    }

    .open-button-alfresco {
      color: var(--source-alfresco-strong);
      border-color: rgba(118, 184, 42, 0.28);
      background: rgba(239, 248, 223, 0.8);
    }

    .open-button-nuxeo {
      color: var(--source-nuxeo-strong);
      border-color: rgba(47, 109, 246, 0.22);
      background: rgba(235, 241, 255, 0.82);
    }
  `]
})
export class ResultsComponent {
  @Input() results: RagResult[] = [];
  @Output() select = new EventEmitter<RagResult>();

  truncatePath(path: string): string {
    if (!path || path.length <= 56) return path;
    const parts = path.split('/').filter(Boolean);
    if (parts.length <= 2) return path;
    return `/${parts[0]}/.../${parts[parts.length - 1]}`;
  }

  sourceIcon(source: string | undefined): string {
    if (source === 'alfresco') return 'storage';
    if (source === 'nuxeo') return 'folder_open';
    return 'insert_drive_file';
  }

  cardClass(source: string | undefined): string {
    if (source === 'alfresco') return 'result-alfresco';
    if (source === 'nuxeo') return 'result-nuxeo';
    return 'result-generic';
  }

  iconClass(source: string | undefined): string {
    if (source === 'alfresco') return 'result-icon-alfresco';
    if (source === 'nuxeo') return 'result-icon-nuxeo';
    return '';
  }

  buttonClass(source: string | undefined): string {
    if (source === 'alfresco') return 'open-button-alfresco';
    if (source === 'nuxeo') return 'open-button-nuxeo';
    return '';
  }
}
