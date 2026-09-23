import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ConnectorService } from './connector.service';
import { environment } from '../../environments/environment';

describe('ConnectorService', () => {

  let service: ConnectorService;
  let httpMock: HttpTestingController;
  let originalUrl: string;

  beforeEach(() => {
    originalUrl = environment.connectorsUrl;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ConnectorService);
  });

  afterEach(() => {
    environment.connectorsUrl = originalUrl;
  });

  describe('when no connector host is configured', () => {

    beforeEach(() => { environment.connectorsUrl = ''; });

    it('reports itself unconfigured rather than failing', () => {
      expect(service.configured).toBe(false);
      expect(service.urls).toBeNull();
    });

    /**
     * Null, not an observable that errors. A deployment without the connector profile is a supported shape,
     * and the screens read this null to hide themselves; an erroring observable would make them render a
     * failure for a deployment that is working exactly as intended.
     */
    it('returns null from every call instead of issuing a request', () => {
      expect(service.listConnectors()).toBeNull();
      expect(service.schema()).toBeNull();
      expect(service.browseRoots()).toBeNull();
      expect(service.browseChildren('root')).toBeNull();
      expect(service.selection()).toBeNull();
      expect(service.saveSelection([])).toBeNull();
      expect(service.clearSelection()).toBeNull();
      expect(service.startSync('sharepoint')).toBeNull();
      expect(service.syncStatus('job-1', 'sharepoint')).toBeNull();
      expect(service.connectorStatus()).toBeNull();
      httpMock.verify();
    });
  });

  describe('when a connector host is configured', () => {

    beforeEach(() => { environment.connectorsUrl = '/api/connectors'; });

    it('reads the connector listing', () => {
      let received: unknown;
      service.listConnectors()!.subscribe(value => { received = value; });

      const request = httpMock.expectOne('/api/connectors');
      expect(request.request.method).toBe('GET');
      request.flush({ connectors: [{ sourceType: 'sharepoint' }], problems: ['bad.jar'] });

      expect(received).toEqual({ connectors: [{ sourceType: 'sharepoint' }], problems: ['bad.jar'] });
    });

    it('passes the node id as a query parameter, because node ids contain slashes', () => {
      // A path variable holding a slash needs encoded-slash handling that Tomcat rejects and a proxy mangles,
      // which is why the host takes it as a parameter.
      service.browseChildren('b!drive:f-public', 100, 50)!.subscribe();

      const request = httpMock.expectOne(r => r.url === '/api/browse/children');
      expect(request.request.params.get('nodeId')).toBe('b!drive:f-public');
      expect(request.request.params.get('skip')).toBe('100');
      expect(request.request.params.get('maxItems')).toBe('50');
      request.flush({ nodeId: 'b!drive:f-public', skip: 100, maxItems: 50, nextSkip: 150,
        endOfContainer: false, nodes: [] });
    });

    it('saves a selection as a PUT carrying the chosen roots', () => {
      service.saveSelection(['b!drive:f-orglink'])!.subscribe();

      const request = httpMock.expectOne('/api/selection');
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({ rootNodeIds: ['b!drive:f-orglink'] });
      request.flush({ sourceType: 'sharepoint', qualifiedSourceId: 'sharepoint:x',
        rootNodeIds: ['b!drive:f-orglink'], chosen: true });
    });

    /**
     * The proxy picks a backend from the source type, so a sync request without one reaches the default
     * ingester instead of the plugin host: a sync that appears to start and walks another repository.
     */
    it('carries the source type on a sync, which is what routes it to the right ingester', () => {
      service.startSync('sharepoint')!.subscribe();

      const request = httpMock.expectOne(r => r.url === '/api/sync/configured');
      expect(request.request.method).toBe('POST');
      expect(request.request.params.get('sourceType')).toBe('sharepoint');
      request.flush({ jobId: 'job-1', sourceType: 'sharepoint', status: 'RUNNING',
        discoveredCount: 0, syncedCount: 0, skippedCount: 0, failedCount: 0 });
    });

    it('carries the source type when polling a job too', () => {
      service.syncStatus('job 1/2', 'sharepoint')!.subscribe();

      const request = httpMock.expectOne(r => r.url.startsWith('/api/sync/status/'));
      // Encoded, because a job id is opaque and a raw slash would change the path.
      expect(request.request.url).toBe('/api/sync/status/job%201%2F2');
      expect(request.request.params.get('sourceType')).toBe('sharepoint');
      request.flush({ jobId: 'job 1/2', sourceType: 'sharepoint', status: 'COMPLETED',
        discoveredCount: 1, syncedCount: 1, skippedCount: 0, failedCount: 0 });
    });

    it('caches the schema, since it cannot change without a host restart', () => {
      let first: unknown;
      let second: unknown;
      service.schema()!.subscribe(value => { first = value; });
      httpMock.expectOne('/api/connectors/schema').flush([{ sourceType: 'sharepoint', fields: [] }]);

      service.schema()!.subscribe(value => { second = value; });

      // No second request, and the same answer: one jar, one schema, for the host's lifetime.
      httpMock.expectNone('/api/connectors/schema');
      expect(second).toBe(first);
      expect(first).toEqual([{ sourceType: 'sharepoint', fields: [] }]);
    });

    it('re-reads the schema after refresh(), for a host that was restarted', () => {
      service.schema()!.subscribe();
      httpMock.expectOne('/api/connectors/schema').flush([]);

      service.refresh();
      service.schema()!.subscribe();

      expect(httpMock.expectOne('/api/connectors/schema').request.method).toBe('GET');
    });

    it('degrades a failed schema read to an empty list rather than failing the screen', () => {
      // The schema is explanatory, not load-bearing: the tree and the sync still work without it.
      let received: unknown;
      service.schema()!.subscribe(value => { received = value; });
      httpMock.expectOne('/api/connectors/schema').flush('nope', { status: 500, statusText: 'Server Error' });

      expect(received).toEqual([]);
    });
  });
});
