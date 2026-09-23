import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { AuthService } from '../services/auth.service';
import {
  BrowseNode,
  ConnectorInfo,
  ConnectorListing,
  ConnectorSchema,
  ConnectorService,
  SelectionView,
  SourceAuthState,
  SyncJob
} from '../services/connector.service';
import { sourceClass, sourceIcon, sourceTypeLabel } from '../utils/source-presentation';

/**
 * One node in the folder picker, plus the paging state its own expansion needs.
 *
 * Children are `null` until the node has been expanded once, which is how "not loaded" stays distinct from
 * "loaded and empty". The difference matters: an empty container should read as empty rather than as a
 * spinner that never resolves.
 */
interface TreeNode {
  node: BrowseNode;
  expanded: boolean;
  loading: boolean;
  children: TreeNode[] | null;
  nextSkip: number;
  endOfContainer: boolean;
  error: string | null;
}

/**
 * The operator half of a connector: what is loaded, which folders it syncs, and starting a sync.
 *
 * Rendered only when a connector host is configured. A deployment without the connector profile is a
 * supported shape rather than a broken one, so this screen and its nav entry are absent there instead of
 * present and failing.
 *
 * This is in the standalone demo UI and not in the repository extension on purpose: a content repository's
 * own interface is not where another system's ingestion gets configured.
 */
@Component({
  selector: 'app-sources',
  template: `
    <div class="page-container-wide sources-page">

      <div class="sources-header">
        <div>
          <span class="eyebrow">Operations</span>
          <h1 class="display-2">Sources</h1>
        </div>
        <button mat-stroked-button type="button" (click)="refresh()" [disabled]="loading">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
      </div>

      <!-- Not configured. Shown rather than redirecting, because an operator who navigated here deliberately
           deserves to be told why the screen is empty. -->
      <div *ngIf="!connectors.configured" class="surface-card sources-note">
        <mat-icon>info_outline</mat-icon>
        <div>
          <strong>No connector host is configured for this deployment.</strong>
          <p>
            This screen manages a source served by a connector plugin. It appears when the deployment runs the
            connector profile and points this application at its host.
          </p>
        </div>
      </div>

      <ng-container *ngIf="connectors.configured">

        <!-- Credentials first. Without them every request on this screen is a 401, and a screen that showed a
             raw error instead of asking would leave the operator nothing to do. -->
        <div *ngIf="needsCredentials" class="surface-card sources-auth">
          <h3><mat-icon>lock_outline</mat-icon> Sign in to manage sources</h3>
          <p class="sources-note-text">
            These endpoints use the ingester's sync-admin account. It is not a content-source login: it does
            not affect which documents anyone can search, and what it authorises is changing which folders get
            synced.
          </p>
          <form class="sources-auth-form" (ngSubmit)="signIn()">
            <mat-form-field appearance="outline">
              <mat-label>Username</mat-label>
              <input matInput name="ingesterUser" [(ngModel)]="credentialUser" autocomplete="username">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input matInput type="password" name="ingesterPass" [(ngModel)]="credentialPass"
                     autocomplete="current-password">
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit"
                    [disabled]="signingIn || !credentialUser || !credentialPass">
              {{ signingIn ? 'Checking...' : 'Sign in' }}
            </button>
          </form>
          <div *ngIf="credentialError" class="sources-error">
            <mat-icon>error_outline</mat-icon><span>{{ credentialError }}</span>
          </div>
        </div>

        <ng-container *ngIf="!needsCredentials">

          <div *ngIf="loading" class="sources-loading">
            <mat-spinner diameter="18"></mat-spinner><span>Loading sources...</span>
          </div>

          <div *ngIf="error && !loading" class="sources-error">
            <mat-icon>error_outline</mat-icon><span>{{ error }}</span>
          </div>

          <!-- Loaded connectors, promoted off the status screen where it was never visible. -->
          <div *ngIf="listing && !loading" class="surface-card sources-panel">
            <h3>Loaded connectors</h3>

            <table *ngIf="listing.connectors.length > 0" class="sources-table">
              <thead>
                <tr><th>Source</th><th>Name</th><th>Origin</th><th>Implementation</th><th>Settings</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let c of listing.connectors">
                  <td>
                    <span class="sources-type" [ngClass]="typeClass(c.sourceType)">
                      <mat-icon>{{ typeIcon(c.sourceType) }}</mat-icon>
                      {{ typeLabel(c.sourceType) }}
                    </span>
                  </td>
                  <td>{{ c.displayName || '--' }}</td>
                  <td class="sources-mono">{{ c.origin || '--' }}</td>
                  <td class="sources-mono">{{ c.implementation || '--' }}</td>
                  <td>{{ c.settingsCount ?? '--' }}</td>
                </tr>
              </tbody>
            </table>

            <p *ngIf="listing.connectors.length === 0" class="sources-note-text">No connectors loaded.</p>

            <!-- A jar that failed to load is the first thing to look at when a corpus is unexpected, so it is
                 reported here rather than left to a container log. -->
            <div *ngIf="listing.problems.length > 0" class="sources-problems">
              <h4><mat-icon>warning_amber</mat-icon> Not loaded</h4>
              <ul><li *ngFor="let problem of listing.problems">{{ problem }}</li></ul>
            </div>
          </div>

          <!-- How the connector is authenticating. Read-only, and there is deliberately no sign-in flow here:
               the interactive device-code exchange blocks for up to fifteen minutes and needs a human at a
               browser, so it runs on the host outside the container. -->
          <div *ngIf="authState && !loading" class="surface-card sources-panel">
            <h3>Authentication</h3>

            <!-- The state worth surfacing early, and the whole reason this panel exists: under a delegated
                 credential a sync stops working when the cached token lapses, and the only other symptom is a
                 failed job whose log talks about a token cache nobody has heard of. -->
            <div *ngIf="!authState.usable" class="sources-auth-warn">
              <mat-icon>error_outline</mat-icon>
              <div>
                <strong>This connector cannot authenticate, so a sync will fail.</strong>
                <p *ngIf="authState.remedy" class="sources-remedy">{{ authState.remedy }}</p>
              </div>
            </div>

            <!-- A development shortcut reaching production unremarked is what this flag prevents. -->
            <div *ngIf="authState.usable && !authState.supportedInProduction" class="sources-auth-note">
              <mat-icon>info_outline</mat-icon>
              <span>
                <strong>{{ authState.mode }}</strong> is a development mode and is not supported for an unattended
                deployment.
              </span>
            </div>

            <table class="sources-table sources-auth-table">
              <tbody>
                <tr>
                  <th>Mode</th>
                  <td class="sources-mono">{{ authState.mode }}</td>
                </tr>
                <tr>
                  <th>Signed in as</th>
                  <!-- Absent cleanly, and the two absences are different: a mode with no user has none to
                       report, which is not the same as one we could not determine. -->
                  <td>{{ authState.identity || 'no user identity for this mode' }}</td>
                </tr>
                <tr>
                  <th>Token last refreshed</th>
                  <td>{{ authState.lastRefreshedAt || 'not reported' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- The published settings schema, so what a connector needs is visible without reading a compose
               file. Descriptors only: this endpoint never returns a value, so nothing here can be a secret. -->
          <div *ngIf="schemas && schemas.length > 0 && !loading" class="surface-card sources-panel">
            <h3>Settings a connector declares</h3>
            <div *ngFor="let schema of schemas" class="sources-schema">
              <h4>{{ typeLabel(schema.sourceType) }}</h4>
              <table class="sources-table">
                <thead><tr><th>Setting</th><th>Type</th><th></th><th>Description</th></tr></thead>
                <tbody>
                  <tr *ngFor="let field of schema.fields">
                    <td class="sources-mono">{{ field.name }}</td>
                    <td>{{ field.type || '--' }}</td>
                    <td class="sources-flags">
                      <span *ngIf="field.required" class="sources-chip sources-chip-required">required</span>
                      <!-- Marked, never shown: the schema carries no values, and this flag is what tells an
                           operator the setting holds a credential. -->
                      <span *ngIf="field.secret" class="sources-chip sources-chip-secret">secret</span>
                    </td>
                    <td>{{ field.description || '--' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- The folder picker. -->
          <div *ngIf="!loading && roots" class="surface-card sources-panel">
            <h3>Folders to sync</h3>

            <p class="sources-note-text">
              <ng-container [ngSwitch]="resolvedFrom">
                <span *ngSwitchCase="'selection'">Syncing the folders chosen here.</span>
                <span *ngSwitchCase="'connector.roots'">
                  Syncing what the deployment configured. Choosing folders here overrides it.
                </span>
                <span *ngSwitchCase="'connector'">
                  Syncing everything the connector reports. Choosing folders here narrows it.
                </span>
                <span *ngSwitchCase="'none'">
                  Nothing names a root, so a sync would walk nothing. Choose at least one folder.
                </span>
              </ng-container>
            </p>

            <div *ngIf="rootProblems.length > 0" class="sources-problems">
              <h4><mat-icon>warning_amber</mat-icon> Unreadable roots</h4>
              <ul><li *ngFor="let problem of rootProblems">{{ problem }}</li></ul>
            </div>

            <ul class="sources-tree">
              <ng-container *ngTemplateOutlet="branch; context: { $implicit: roots }"></ng-container>
            </ul>

            <div class="sources-actions">
              <button mat-flat-button color="primary" type="button"
                      (click)="saveSelection()" [disabled]="saving || !selectionChanged">
                {{ saving ? 'Saving...' : 'Save selection' }}
              </button>
              <button mat-stroked-button type="button" (click)="clearSelection()"
                      [disabled]="saving || selected.size === 0">
                Clear
              </button>
              <span class="sources-selected-count">
                {{ selected.size }} folder{{ selected.size === 1 ? '' : 's' }} selected
              </span>
            </div>

            <div *ngIf="saveMessage" class="sources-saved">
              <mat-icon>check_circle</mat-icon><span>{{ saveMessage }}</span>
            </div>
            <div *ngIf="saveError" class="sources-error">
              <mat-icon>error_outline</mat-icon><span>{{ saveError }}</span>
            </div>
          </div>

          <!-- Sync. -->
          <div *ngIf="!loading && listing && listing.connectors.length > 0" class="surface-card sources-panel">
            <h3>Sync</h3>

            <!-- Repeated here rather than left on the panel above, because this is the point of decision: the
                 whole issue is that a lapsed credential should be visible *before* a sync, not afterwards in a
                 failed job. The button stays enabled: "usable" is answered from the cache rather than by
                 attempting a refresh, so it can be a false negative, and a screen that refuses an action on a
                 diagnostic it cannot fully trust is worse than one that says what will probably happen. -->
            <div *ngIf="authState && !authState.usable" class="sources-auth-warn">
              <mat-icon>error_outline</mat-icon>
              <div>
                <strong>A sync will fail: this connector cannot authenticate.</strong>
                <p *ngIf="authState.remedy" class="sources-remedy">{{ authState.remedy }}</p>
              </div>
            </div>

            <div class="sources-actions">
              <button mat-flat-button color="primary" type="button"
                      (click)="startSync()" [disabled]="syncRunning">
                <mat-icon>sync</mat-icon>
                {{ syncRunning ? 'Syncing...' : 'Sync now' }}
              </button>
              <span *ngIf="job" class="sources-job-state" [ngClass]="jobClass">{{ job.status }}</span>
            </div>

            <table *ngIf="job" class="sources-table sources-job">
              <thead><tr><th>Discovered</th><th>Indexed</th><th>Skipped</th><th>Failed</th></tr></thead>
              <tbody>
                <tr>
                  <td>{{ job.discoveredCount }}</td>
                  <td>{{ job.syncedCount }}</td>
                  <td>{{ job.skippedCount }}</td>
                  <td [class.sources-failed]="job.failedCount > 0">{{ job.failedCount }}</td>
                </tr>
              </tbody>
            </table>

            <div *ngIf="syncError" class="sources-error">
              <mat-icon>error_outline</mat-icon><span>{{ syncError }}</span>
            </div>
          </div>

        </ng-container>
      </ng-container>

      <!-- Recursive branch. One <li> per node; children render only once loaded. -->
      <ng-template #branch let-nodes>
        <li *ngFor="let entry of nodes" class="sources-tree-node">
          <div class="sources-tree-row">
            <button mat-icon-button type="button" class="sources-twisty"
                    *ngIf="entry.node.folder" (click)="toggle(entry)"
                    [attr.aria-label]="entry.expanded ? 'Collapse' : 'Expand'">
              <mat-icon>{{ entry.expanded ? 'expand_more' : 'chevron_right' }}</mat-icon>
            </button>
            <span *ngIf="!entry.node.folder" class="sources-twisty-spacer"></span>

            <label class="sources-tree-label">
              <input type="checkbox" *ngIf="entry.node.folder"
                     [checked]="selected.has(entry.node.nodeId)"
                     (change)="toggleSelected(entry.node)">
              <mat-icon class="sources-node-icon">
                {{ entry.node.folder ? 'folder' : 'description' }}
              </mat-icon>
              <span [class.sources-out-of-scope]="!entry.node.inScope">{{ entry.node.name }}</span>
              <!-- Shown and marked rather than hidden: the host returns an out-of-scope entry deliberately,
                   because an operator fixing a scope has to be able to see what is currently excluded. -->
              <span *ngIf="!entry.node.inScope" class="sources-chip sources-chip-excluded">excluded</span>
            </label>
          </div>

          <div *ngIf="entry.loading" class="sources-tree-loading">
            <mat-spinner diameter="14"></mat-spinner><span>Loading...</span>
          </div>
          <div *ngIf="entry.error" class="sources-error sources-tree-error">
            <mat-icon>error_outline</mat-icon><span>{{ entry.error }}</span>
          </div>

          <ul *ngIf="entry.expanded && entry.children">
            <ng-container *ngTemplateOutlet="branch; context: { $implicit: entry.children }"></ng-container>
            <li *ngIf="entry.children.length === 0 && !entry.loading" class="sources-tree-empty">
              Empty
            </li>
            <!-- A short page does not mean the end, so "load more" is offered until an empty one comes back. -->
            <li *ngIf="!entry.endOfContainer && entry.children.length > 0" class="sources-tree-more">
              <button mat-button type="button" (click)="loadMore(entry)" [disabled]="entry.loading">
                Load more
              </button>
            </li>
          </ul>
        </li>
      </ng-template>
    </div>
  `,
  styles: [`
    .sources-page { padding-top: 24px; display: flex; flex-direction: column; gap: 18px; }

    .sources-header {
      display: flex; align-items: flex-end; justify-content: space-between;
      gap: 16px; flex-wrap: wrap;
    }
    .sources-header h1 { margin: 6px 0 0; }

    .sources-panel { padding: 18px 20px; }
    .sources-panel h3 { margin: 0 0 12px; font-size: 15px; }
    .sources-panel h4 { margin: 14px 0 6px; font-size: 13px; }

    .sources-note { display: flex; gap: 12px; padding: 18px 20px; align-items: flex-start; }
    .sources-note p { margin: 6px 0 0; font-size: 13.5px; }
    .sources-note-text { margin: 0 0 12px; font-size: 13px; color: var(--cl-muted, #6b7280); }

    .sources-loading, .sources-error, .sources-saved {
      display: flex; align-items: center; gap: 8px; font-size: 14px;
    }
    .sources-error { color: var(--cl-danger); }
    .sources-saved { color: var(--cl-success, #15803d); margin-top: 10px; }

    .sources-auth { padding: 18px 20px; }
    .sources-auth h3 { display: flex; align-items: center; gap: 8px; }
    .sources-auth-form { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
    .sources-auth-form mat-form-field { width: 220px; }

    .sources-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .sources-table th {
      text-align: left; font-weight: 600; padding: 6px 10px 6px 0;
      border-bottom: 1px solid var(--cl-border, #e5e7eb);
    }
    .sources-table td { padding: 6px 10px 6px 0; border-bottom: 1px solid var(--cl-border-soft, #f1f2f4); }
    .sources-mono { font-family: var(--cl-mono, monospace); font-size: 12px; word-break: break-all; }

    .sources-type { display: inline-flex; align-items: center; gap: 6px; }
    .sources-type mat-icon { font-size: 17px; width: 17px; height: 17px; }

    .sources-flags { white-space: nowrap; }
    .sources-chip {
      display: inline-block; padding: 1px 7px; border-radius: 10px;
      font-size: 11px; margin-right: 4px;
    }
    .sources-chip-required { background: var(--cl-chip-bg, #eef2ff); }
    .sources-chip-secret { background: var(--cl-warn-bg, #fef3c7); }
    .sources-chip-excluded { background: var(--cl-border-soft, #f1f2f4); color: var(--cl-muted, #6b7280); }

    .sources-problems { margin-top: 14px; }
    .sources-problems h4 { display: flex; align-items: center; gap: 6px; color: var(--cl-danger); }
    .sources-problems h4 mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .sources-problems ul { margin: 0; padding-left: 20px; font-size: 12.5px; }

    .sources-tree, .sources-tree ul { list-style: none; margin: 0; padding-left: 18px; }
    .sources-tree { padding-left: 0; }
    .sources-tree-row { display: flex; align-items: center; gap: 2px; }
    .sources-twisty { width: 28px; height: 28px; line-height: 28px; }
    .sources-twisty mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .sources-twisty-spacer { display: inline-block; width: 28px; }
    .sources-tree-label { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; cursor: pointer; }
    .sources-node-icon { font-size: 17px; width: 17px; height: 17px; color: var(--cl-muted, #6b7280); }
    .sources-out-of-scope { color: var(--cl-muted, #6b7280); }
    .sources-tree-loading, .sources-tree-error { padding-left: 46px; font-size: 12.5px; }
    .sources-tree-empty, .sources-tree-more { font-size: 12.5px; color: var(--cl-muted, #6b7280); }

    .sources-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
    .sources-selected-count { font-size: 12.5px; color: var(--cl-muted, #6b7280); }

    .sources-auth-table { max-width: 460px; }
    .sources-auth-table th { width: 170px; font-weight: 500; color: var(--cl-muted, #6b7280); }

    .sources-auth-warn, .sources-auth-note {
      display: flex; gap: 10px; align-items: flex-start;
      padding: 10px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 13px;
    }
    .sources-auth-warn { background: var(--cl-danger-bg, #fee2e2); color: var(--cl-danger); }
    .sources-auth-note { background: var(--cl-warn-bg, #fef3c7); }
    .sources-remedy { margin: 4px 0 0; font-family: var(--cl-mono, monospace); font-size: 12px; }

    .sources-job { margin-top: 12px; max-width: 420px; }
    .sources-job-state { font-size: 12px; padding: 2px 9px; border-radius: 10px; background: var(--cl-chip-bg, #eef2ff); }
    .sources-job-state.is-failed { background: var(--cl-danger-bg, #fee2e2); color: var(--cl-danger); }
    .sources-job-state.is-done { background: var(--cl-success-bg, #dcfce7); color: var(--cl-success, #15803d); }
    .sources-failed { color: var(--cl-danger); font-weight: 600; }
  `]
})
export class SourcesComponent implements OnInit, OnDestroy {

  /** How often the sync poll asks. The host updates counters per document, so this is a display cadence. */
  private static readonly POLL_MS = 2000;

  listing: ConnectorListing | null = null;
  schemas: ConnectorSchema[] | null = null;

  /**
   * How the connector is authenticating, or `null` when it reports nothing.
   *
   * `null` is the ordinary case and not a gap: a source whose credential is deployment configuration has no
   * state that varies -- it works, or the container failed to start. The panel is absent for those rather than
   * showing empty rows.
   */
  authState: SourceAuthState | null = null;
  roots: TreeNode[] | null = null;
  rootProblems: string[] = [];
  resolvedFrom = 'connector';

  loading = false;
  error: string | null = null;

  /** Chosen folder node ids. A Set because the tree checks membership on every rendered row. */
  selected = new Set<string>();
  private savedSelection = new Set<string>();
  saving = false;
  saveMessage: string | null = null;
  saveError: string | null = null;

  job: SyncJob | null = null;
  syncError: string | null = null;
  private poll?: Subscription;

  credentialUser = '';
  credentialPass = '';
  credentialError: string | null = null;
  signingIn = false;

  /** Set when a request came back 401, so the form appears instead of an error nobody can act on. */
  private unauthenticated = false;

  constructor(public connectors: ConnectorService, private auth: AuthService) {}

  ngOnInit(): void {
    if (this.connectors.configured) {
      this.refresh();
    }
  }

  ngOnDestroy(): void {
    this.poll?.unsubscribe();
  }

  /**
   * Whether to ask for the sync-admin credential.
   *
   * Either nothing has been entered, or something was and the host rejected it. Both land on the same form,
   * because the operator's next action is identical.
   */
  get needsCredentials(): boolean {
    return !this.auth.isIngesterLoggedIn() || this.unauthenticated;
  }

  get selectionChanged(): boolean {
    if (this.selected.size !== this.savedSelection.size) {
      return true;
    }
    for (const id of this.selected) {
      if (!this.savedSelection.has(id)) {
        return true;
      }
    }
    return false;
  }

  get syncRunning(): boolean {
    return this.job?.status === 'RUNNING';
  }

  get jobClass(): string {
    if (this.job?.status === 'FAILED') return 'is-failed';
    if (this.job?.status === 'COMPLETED') return 'is-done';
    return '';
  }

  signIn(): void {
    this.signingIn = true;
    this.credentialError = null;
    this.auth.loginIngester(this.credentialUser, this.credentialPass)
      .then(() => {
        this.signingIn = false;
        this.credentialPass = '';
        this.unauthenticated = false;
        this.refresh();
      })
      .catch((err) => {
        this.signingIn = false;
        this.credentialError = err?.status === 401
          ? 'That account was rejected by the ingester.'
          : this.messageOf(err, 'Could not reach the connector host.');
      });
  }

  refresh(): void {
    const listing = this.connectors.listConnectors();
    if (!listing) {
      return;
    }
    this.loading = true;
    this.error = null;
    this.saveMessage = null;
    this.saveError = null;

    listing.subscribe({
      next: (value) => {
        this.listing = value;
        this.loading = false;
        this.unauthenticated = false;
        this.loadAuthState();
        this.loadSchemas();
        this.loadSelectionThenRoots();
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 401) {
          // Not an error to render: the operator has to supply a credential, and the form does that.
          this.unauthenticated = true;
          return;
        }
        this.error = this.messageOf(err, 'Could not load the connector listing.');
      }
    });
  }

  /**
   * Reads the host's own summary for the connector's authentication state.
   *
   * A failure drops the panel rather than failing the screen. This is diagnostic information: not being able
   * to read it is a worse outcome on a screen that can still show the tree and start a sync, and the sync's
   * own failure would report the credential problem anyway. Exactly the degradation the host itself applies
   * when a connector cannot describe its own credential.
   */
  private loadAuthState(): void {
    this.connectors.connectorStatus()?.subscribe({
      next: (status) => { this.authState = status.auth ?? null; },
      error: () => { this.authState = null; }
    });
  }

  private loadSchemas(): void {
    this.connectors.schema()?.subscribe({
      next: (value) => { this.schemas = value; },
      // The schema is explanatory rather than load-bearing, so a failure leaves the panel out instead of
      // failing the screen that can still show the tree.
      error: () => { this.schemas = null; }
    });
  }

  /**
   * Reads the saved selection first, then the roots.
   *
   * In that order because the tree's checkboxes come from the selection: rendering roots first would show
   * every box unticked for a moment on a source that has a saved scope, which reads as "nothing is selected".
   */
  private loadSelectionThenRoots(): void {
    const selection = this.connectors.selection();
    if (!selection) {
      this.loadRoots();
      return;
    }
    selection.subscribe({
      next: (view: SelectionView) => {
        this.applySelection(view.rootNodeIds ?? []);
        this.loadRoots();
      },
      error: () => {
        // 501 when no selection store is configured, which is a deployment that cannot save a scope. The tree
        // is still worth showing: browsing is read-only and works either way.
        this.applySelection([]);
        this.loadRoots();
      }
    });
  }

  private applySelection(ids: string[]): void {
    this.selected = new Set(ids);
    this.savedSelection = new Set(ids);
  }

  private loadRoots(): void {
    this.connectors.browseRoots()?.subscribe({
      next: (value) => {
        this.roots = (value.roots ?? []).map(node => this.treeNode(node));
        this.rootProblems = value.problems ?? [];
        this.resolvedFrom = value.resolvedFrom ?? 'connector';
      },
      error: (err) => {
        if (err?.status === 401) {
          this.unauthenticated = true;
          return;
        }
        this.error = this.messageOf(err, 'Could not read the source tree.');
      }
    });
  }

  toggle(entry: TreeNode): void {
    entry.expanded = !entry.expanded;
    // Loaded once and kept: collapsing is a display change, and re-fetching on every twisty would spend a
    // source request per click.
    if (entry.expanded && entry.children === null) {
      this.fetchChildren(entry, 0);
    }
  }

  loadMore(entry: TreeNode): void {
    this.fetchChildren(entry, entry.nextSkip);
  }

  private fetchChildren(entry: TreeNode, skip: number): void {
    const request = this.connectors.browseChildren(entry.node.nodeId, skip);
    if (!request) {
      return;
    }
    entry.loading = true;
    entry.error = null;
    request.subscribe({
      next: (page) => {
        entry.loading = false;
        const loaded = (page.nodes ?? []).map(node => this.treeNode(node));
        entry.children = entry.children === null ? loaded : [...entry.children, ...loaded];
        // Both from the host's contract: a short page is not the end, so only an empty one ends the container,
        // and the next window advances by the size asked for rather than the count received.
        entry.nextSkip = page.nextSkip;
        entry.endOfContainer = page.endOfContainer;
      },
      error: (err) => {
        entry.loading = false;
        if (err?.status === 401) {
          this.unauthenticated = true;
          return;
        }
        // On the node rather than on the screen: one unreadable container is not a broken tree, and the host
        // answers 502 for a source that could not be asked.
        entry.error = this.messageOf(err, 'This folder could not be read.');
      }
    });
  }

  toggleSelected(node: BrowseNode): void {
    if (this.selected.has(node.nodeId)) {
      this.selected.delete(node.nodeId);
    } else {
      this.selected.add(node.nodeId);
    }
    this.saveMessage = null;
  }

  saveSelection(): void {
    const request = this.connectors.saveSelection([...this.selected]);
    if (!request) {
      return;
    }
    this.saving = true;
    this.saveError = null;
    this.saveMessage = null;
    request.subscribe({
      next: (view) => {
        this.saving = false;
        // From the response, not from what was sent: the backend is what decides the scope, and echoing local
        // state would report success for a selection the host narrowed or rejected.
        this.applySelection(view.rootNodeIds ?? []);
        this.saveMessage = 'Saved. The next sync walks this selection; no restart is needed.';
        this.loadRoots();
      },
      error: (err) => {
        this.saving = false;
        if (err?.status === 401) {
          this.unauthenticated = true;
          return;
        }
        this.saveError = err?.status === 501
          ? 'This deployment has no selection store configured, so a scope cannot be saved.'
          : this.messageOf(err, 'Could not save the selection.');
      }
    });
  }

  clearSelection(): void {
    const request = this.connectors.clearSelection();
    if (!request) {
      return;
    }
    this.saving = true;
    this.saveError = null;
    request.subscribe({
      next: () => {
        this.saving = false;
        this.applySelection([]);
        this.saveMessage = 'Cleared. Roots fall back to the deployment configuration.';
        this.loadRoots();
      },
      error: (err) => {
        this.saving = false;
        this.saveError = this.messageOf(err, 'Could not clear the selection.');
      }
    });
  }

  startSync(): void {
    const sourceType = this.listing?.connectors[0]?.sourceType;
    if (!sourceType) {
      return;
    }
    const request = this.connectors.startSync(sourceType);
    if (!request) {
      return;
    }
    this.syncError = null;
    this.job = null;
    request.subscribe({
      next: (job) => {
        this.job = job;
        this.pollJob(job.jobId, sourceType);
      },
      error: (err) => {
        if (err?.status === 401) {
          this.unauthenticated = true;
          return;
        }
        this.syncError = this.messageOf(err, 'Could not start a sync.');
      }
    });
  }

  /**
   * Polls until the job reaches a terminal state.
   *
   * Stops on FAILED as well as COMPLETED, which matters because a failed job is a terminal state a caller has
   * to be able to see: the host used to be able to leave one RUNNING for ever, and a poll that only stopped
   * on success would hang with it.
   */
  private pollJob(jobId: string, sourceType: string): void {
    this.poll?.unsubscribe();
    this.poll = timer(SourcesComponent.POLL_MS, SourcesComponent.POLL_MS).subscribe(() => {
      this.connectors.syncStatus(jobId, sourceType)?.subscribe({
        next: (job) => {
          this.job = job;
          if (job.status === 'COMPLETED' || job.status === 'FAILED') {
            this.poll?.unsubscribe();
          }
        },
        error: (err) => {
          this.poll?.unsubscribe();
          this.syncError = this.messageOf(err, 'Lost track of the sync job.');
        }
      });
    });
  }

  typeLabel(sourceType?: string): string {
    return sourceTypeLabel(sourceType);
  }

  typeIcon(sourceType?: string): string {
    return sourceIcon(sourceType);
  }

  typeClass(sourceType?: string): string {
    return sourceClass('sources-type', sourceType);
  }

  private treeNode(node: BrowseNode): TreeNode {
    return {
      node,
      expanded: false,
      loading: false,
      children: null,
      nextSkip: 0,
      endOfContainer: false,
      error: null
    };
  }

  /**
   * A message for a screen, never the raw error.
   *
   * A connector's own message is passed through when it has one, because it is the only thing that names what
   * failed in the source; anything else gets the caller's fallback. No URL and no status code, which would
   * tell an operator where the host is without telling them anything they can act on.
   */
  private messageOf(err: unknown, fallback: string): string {
    const body = (err as { error?: { message?: string } } | null)?.error;
    return body?.message?.trim() || fallback;
  }
}
