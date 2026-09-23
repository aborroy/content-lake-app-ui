import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { ConnectorUrls, resolveConnectorUrls } from '../utils/api-paths';

/**
 * The plugin host's operator endpoints: what is loaded, what it could sync, and what it will.
 *
 * Separate from {@link RagService} because it talks to a different service with a different credential. The
 * host is an ingester, default-deny, authenticated with a sync-admin account; rag-service is the query path
 * authenticated with a content-source session. Folding them together would mean one service whose methods
 * need different credentials, which is how the connector panel on the status screen ended up unable to
 * authenticate at all.
 *
 * Every method returns `null` when no connector host is configured, rather than an observable that fails. A
 * deployment without the connector profile is a supported shape, not an error, and the screens read that
 * `null` to hide themselves.
 */
@Injectable({ providedIn: 'root' })
export class ConnectorService {

  /**
   * A ceiling on one browse request. The host caps it at 500 anyway; asking for more would be a request it
   * silently narrows, which makes a paging bug look like a source that lost entries.
   */
  static readonly PAGE_SIZE = 100;

  private schemaCache?: Observable<ConnectorSchema[]>;

  constructor(private http: HttpClient) {}

  /** Where the endpoints are, or `null` when this deployment has no connector host. */
  get urls(): ConnectorUrls | null {
    return resolveConnectorUrls();
  }

  get configured(): boolean {
    return this.urls !== null;
  }

  /** Connectors the host loaded, and anything it could not load. */
  listConnectors(): Observable<ConnectorListing> | null {
    const urls = this.urls;
    return urls ? this.http.get<ConnectorListing>(urls.connectors) : null;
  }

  /**
   * The settings each connector declares, so an operator can see what one needs without reading a compose
   * file.
   *
   * Cached for the app's lifetime: a schema is compiled into a jar and cannot change without a restart, and
   * both the connector table and the settings panel ask for it. Descriptors only -- this endpoint never
   * returns a value, so it cannot carry a credential and neither can anything rendered from it.
   */
  schema(): Observable<ConnectorSchema[]> | null {
    const urls = this.urls;
    if (!urls) {
      return null;
    }
    if (!this.schemaCache) {
      this.schemaCache = this.http.get<ConnectorSchema[]>(urls.schema).pipe(
        catchError(() => of([] as ConnectorSchema[])),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.schemaCache;
  }

  /** The host's own last-run summary, including how it is authenticating. */
  connectorStatus(): Observable<ConnectorHostStatus> | null {
    const urls = this.urls;
    return urls ? this.http.get<ConnectorHostStatus>(urls.connectorStatus) : null;
  }

  /** Where a tree starts, and which layer of the precedence chain decided that. */
  browseRoots(): Observable<BrowseRoots> | null {
    const urls = this.urls;
    return urls ? this.http.get<BrowseRoots>(urls.browseRoots) : null;
  }

  /**
   * One page of a container's children.
   *
   * `nodeId` goes in a query parameter because that is what the host accepts: node ids carry slashes, colons
   * and exclamation marks depending on the source, and a path variable holding a slash needs encoded-slash
   * handling that Tomcat rejects and a proxy mangles.
   */
  browseChildren(nodeId: string, skip = 0, maxItems = ConnectorService.PAGE_SIZE): Observable<BrowsePage> | null {
    const urls = this.urls;
    if (!urls) {
      return null;
    }
    const params = new HttpParams()
      .set('nodeId', nodeId)
      .set('skip', String(skip))
      .set('maxItems', String(maxItems));
    return this.http.get<BrowsePage>(urls.browseChildren, { params });
  }

  /** What a pass would walk, and where that came from. */
  selection(): Observable<SelectionView> | null {
    const urls = this.urls;
    return urls ? this.http.get<SelectionView>(urls.selection) : null;
  }

  /** Records which roots the next pass should walk. Takes effect without a restart. */
  saveSelection(rootNodeIds: string[]): Observable<SelectionView> | null {
    const urls = this.urls;
    return urls ? this.http.put<SelectionView>(urls.selection, { rootNodeIds }) : null;
  }

  /** Drops the selection, so roots fall back to configuration and then to the connector. */
  clearSelection(): Observable<unknown> | null {
    const urls = this.urls;
    return urls ? this.http.delete(urls.selection) : null;
  }

  /**
   * Starts a sync, carrying the source type.
   *
   * The source type is not optional. The deployment proxy picks a backend from it, so a request without one
   * reaches the default ingester instead of the plugin host -- a sync that appears to start and then walks
   * somebody else's repository.
   */
  startSync(sourceType: string): Observable<SyncJob> | null {
    const urls = this.urls;
    if (!urls) {
      return null;
    }
    const params = new HttpParams().set('sourceType', sourceType);
    return this.http.post<SyncJob>(`${urls.sync}/configured`, null, { params });
  }

  /** One job's progress, for the poll that follows a sync. */
  syncStatus(jobId: string, sourceType: string): Observable<SyncJob> | null {
    const urls = this.urls;
    if (!urls) {
      return null;
    }
    const params = new HttpParams().set('sourceType', sourceType);
    return this.http.get<SyncJob>(`${urls.sync}/status/${encodeURIComponent(jobId)}`, { params });
  }

  /** Drops the schema cache, for a screen that wants to re-read after a host restart. */
  refresh(): void {
    this.schemaCache = undefined;
  }
}

/** One connector the host has loaded. `origin` is the jar it came from, or `in-tree`. */
export interface ConnectorInfo {
  sourceType: string;
  displayName?: string;
  origin?: string;
  implementation?: string;
  settingsCount?: number;
}

export interface ConnectorListing {
  connectors: ConnectorInfo[];
  problems: string[];
}

/** A setting a connector declares. Never carries a value, only a descriptor. */
export interface ConnectorSchemaField {
  name: string;
  type?: string;
  description?: string;
  required?: boolean;
  secret?: boolean;
  allowedValues?: string[];
}

export interface ConnectorSchema {
  sourceType: string;
  fields: ConnectorSchemaField[];
}

/**
 * How the connector is authenticating.
 *
 * Carries no token, no secret and no path to a file holding either; `remedy` names an action instead. See the
 * SPI's `SourceAuthState` for why the cache path in particular is absent.
 */
export interface SourceAuthState {
  mode: string;
  supportedInProduction: boolean;
  identity: string | null;
  lastRefreshedAt: string | null;
  usable: boolean;
  remedy: string | null;
}

export interface ConnectorHostStatus {
  sourceType: string;
  connectorName?: string;
  connectorOrigin?: string;
  state: string;
  jobId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  nodesDiscovered: number;
  nodesIndexed: number;
  nodesSkipped: number;
  nodesFailed: number;
  auth: SourceAuthState | null;
}

/**
 * One node in the tree.
 *
 * `inScope` and `traversable` are advisory annotations, not a filter the caller should apply: the host returns
 * an out-of-scope entry deliberately so an operator can see what their exclusion did. They are also not the
 * same question -- a walk descends into a folder an include pattern does not match, so a matching descendant
 * stays reachable.
 */
export interface BrowseNode {
  nodeId: string;
  name: string;
  path: string | null;
  folder: boolean;
  mimeType: string | null;
  modifiedAt: string | null;
  inScope: boolean;
  traversable: boolean;
}

export interface BrowseRoots {
  sourceType: string;
  /** `selection`, `connector.roots`, `connector`, or `none`. */
  resolvedFrom: string;
  roots: BrowseNode[];
  problems: string[];
}

/**
 * One page of children.
 *
 * `endOfContainer` is set only on an *empty* page, and `nextSkip` advances by the page size that was asked
 * for rather than by the number of entries returned. Both follow from the host's contract that a short page
 * does not mean exhaustion, because a connector may drop entries it cannot represent. Advancing by what came
 * back would re-read dropped entries or shift every later window.
 */
export interface BrowsePage {
  nodeId: string;
  skip: number;
  maxItems: number;
  nextSkip: number;
  endOfContainer: boolean;
  nodes: BrowseNode[];
}

export interface SelectionView {
  sourceType: string;
  qualifiedSourceId: string;
  rootNodeIds: string[];
  chosen: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface SyncJob {
  jobId: string;
  sourceType: string;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  discoveredCount: number;
  syncedCount: number;
  skippedCount: number;
  failedCount: number;
  deletedCount?: number;
}
