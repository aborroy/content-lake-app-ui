import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RagResult } from '../services/rag.service';

@Component({
  selector: 'app-results',
  template: `
    <mat-card *ngFor="let r of results" class="result-card">
      <mat-card-header>
        <!-- Source icon -->
        <mat-icon mat-card-avatar
                  [style.color]="r.source === 'alfresco' ? '#1565c0' : r.source === 'nuxeo' ? '#c62828' : '#757575'">
          {{ r.source === 'alfresco' ? 'storage' : r.source === 'nuxeo' ? 'folder_open' : 'insert_drive_file' }}
        </mat-icon>

        <!-- Title -->
        <mat-card-title style="font-size:15px;line-height:1.3">
          {{ r.title || '(untitled)' }}
        </mat-card-title>

        <!-- Source badge + path -->
        <mat-card-subtitle>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:2px">
            <mat-chip *ngIf="r.source"
                      [class]="r.source === 'alfresco' ? 'badge-alfresco' : 'badge-nuxeo'"
                      style="font-size:11px;min-height:20px;padding:0 8px">
              {{ r.source | titlecase }}
              <span *ngIf="r.sourceId" style="opacity:0.8"> · {{ r.sourceId }}</span>
            </mat-chip>
            <span *ngIf="r.path" style="font-size:11px;color:#9e9e9e" [matTooltip]="r.path">
              {{ truncatePath(r.path) }}
            </span>
          </div>
        </mat-card-subtitle>
      </mat-card-header>

      <!-- Chunk text -->
      <mat-card-content style="padding:4px 16px 8px">
        <p style="font-size:13px;color:#424242;margin:0;line-height:1.6">
          {{ r.snippet }}
        </p>
      </mat-card-content>

      <!-- Score + Open link -->
      <mat-card-actions style="display:flex;align-items:center;padding:0 8px 4px">
        <span style="font-size:11px;color:#9e9e9e;margin-left:8px">
          #{{ r.rank }} · score {{ r.score | number:'1.2-2' }}
        </span>
        <span style="flex:1"></span>
        <button mat-button color="primary"
                *ngIf="r.openInSourceUrl || r.url"
                (click)="select.emit(r)"
                matTooltip="Open in source repository">
          <mat-icon>open_in_new</mat-icon> Open
        </button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`.result-card { margin-bottom: 12px; }`]
})
export class ResultsComponent {
  @Input() results: RagResult[] = [];
  @Output() select = new EventEmitter<RagResult>();

  truncatePath(path: string): string {
    if (!path || path.length <= 40) return path;
    const parts = path.split('/').filter(Boolean);
    if (parts.length <= 2) return path;
    return `/${parts[0]}/…/${parts[parts.length - 1]}`;
  }
}
