import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SourcesComponent } from './sources.component';
import { AuthService } from '../services/auth.service';
import { ConnectorService } from '../services/connector.service';
import { environment } from '../../environments/environment';

/**
 * The Sources screen's behaviour, exercised through the component rather than the rendered DOM.
 *
 * What matters here is the request sequence and the state it produces: which calls go out, what the tree does
 * on expansion, and whether a saved selection reflects the backend's answer or the UI's own optimism. None of
 * that needs a template harness, and testing it through one would couple these assertions to markup.
 */
describe('SourcesComponent', () => {

  let component: SourcesComponent;
  let httpMock: HttpTestingController;
  let auth: AuthService;
  let originalUrl: string;

  const NODE = (id: string, folder = true, inScope = true) => ({
    nodeId: id, name: id, path: `/${id}`, folder, mimeType: null,
    modifiedAt: null, inScope, traversable: folder
  });

  beforeEach(() => {
    sessionStorage.clear();
    originalUrl = environment.connectorsUrl;
    environment.connectorsUrl = '/api/connectors';
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), SourcesComponent]
    });
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    component = TestBed.inject(SourcesComponent);
  });

  afterEach(() => {
    environment.connectorsUrl = originalUrl;
    sessionStorage.clear();
  });

  const AUTH_OK = {
    mode: 'device-code', supportedInProduction: false, identity: 'crawler@example.invalid',
    lastRefreshedAt: null, usable: true, remedy: null
  };

  /** Signs in so the screen is past its credential gate, and drains the load that follows. */
  function signInAndLoad(roots = [NODE('f-public'), NODE('f-orglink')], selected: string[] = [],
                         authState: unknown = AUTH_OK): void {
    void auth.loginIngester('svc', 'pw');
    httpMock.expectOne('/api/connectors').flush({ connectors: [], problems: [] });

    component.refresh();
    httpMock.expectOne('/api/connectors').flush({
      connectors: [{ sourceType: 'sharepoint', displayName: 'SharePoint Online connector' }], problems: []
    });
    httpMock.expectOne('/api/connector-status').flush({
      sourceType: 'sharepoint', state: 'IDLE', jobId: null, startedAt: null, completedAt: null,
      nodesDiscovered: 0, nodesIndexed: 0, nodesSkipped: 0, nodesFailed: 0, auth: authState
    });
    httpMock.expectOne('/api/connectors/schema').flush([]);
    httpMock.expectOne('/api/selection').flush({
      sourceType: 'sharepoint', qualifiedSourceId: 'sharepoint:x', rootNodeIds: selected,
      chosen: selected.length > 0
    });
    httpMock.expectOne('/api/browse/roots').flush({
      sourceType: 'sharepoint', resolvedFrom: selected.length > 0 ? 'selection' : 'connector',
      roots, problems: []
    });
  }

  describe('when no connector host is configured', () => {

    beforeEach(() => { environment.connectorsUrl = ''; });

    /** A deployment without the connector profile is supported, so the screen is inert rather than broken. */
    it('issues no request at all', () => {
      component.ngOnInit();

      expect(component.connectors.configured).toBe(false);
      expect(component.listing).toBeNull();
      expect(component.roots).toBeNull();
      httpMock.verify();
    });
  });

  describe('the credential gate', () => {

    it('asks for credentials before anything else, because every call would otherwise be a 401', () => {
      expect(component.needsCredentials).toBe(true);
    });

    /**
     * A 401 becomes the in-app form, not an error message. The browser raises its own password box on a Basic
     * challenge, which the proxy strips; what is left is for the screen to ask.
     */
    it('falls back to the form when the host rejects the request, rather than showing an error', () => {
      component.refresh();
      httpMock.expectOne('/api/connectors').flush('denied', { status: 401, statusText: 'Unauthorized' });

      expect(component.needsCredentials).toBe(true);
      expect(component.error).toBeNull();
    });

    it('reports a host that cannot be reached as an error, which is a different problem', () => {
      component.refresh();
      httpMock.expectOne('/api/connectors').flush('down', { status: 502, statusText: 'Bad Gateway' });

      expect(component.error).toBeTruthy();
    });
  });

  describe('the folder tree', () => {

    it('loads nothing until a node is expanded, then one request per expansion', () => {
      signInAndLoad();
      const first = component.roots![0];

      expect(first.children).toBeNull();

      component.toggle(first);
      httpMock.expectOne(r => r.url === '/api/browse/children' && r.params.get('nodeId') === 'f-public')
        .flush({ nodeId: 'f-public', skip: 0, maxItems: 100, nextSkip: 100, endOfContainer: false,
          nodes: [NODE('i-report', false)] });

      expect(first.children!.length).toBe(1);

      // Collapsing and re-expanding must not re-fetch: it is a display change, and a source request per
      // twisty click would be paid for nothing.
      component.toggle(first);
      component.toggle(first);
      httpMock.expectNone(r => r.url === '/api/browse/children');
    });

    it('appends a further page and only ends the container on an empty one', () => {
      signInAndLoad();
      const first = component.roots![0];
      component.toggle(first);
      httpMock.expectOne(r => r.url === '/api/browse/children')
        .flush({ nodeId: 'f-public', skip: 0, maxItems: 100, nextSkip: 100, endOfContainer: false,
          nodes: [NODE('a', false)] });

      // A short page does not mean exhaustion, because a connector may drop entries it cannot represent.
      expect(first.endOfContainer).toBe(false);

      component.loadMore(first);
      const next = httpMock.expectOne(r => r.url === '/api/browse/children');
      expect(next.request.params.get('skip')).toBe('100');
      next.flush({ nodeId: 'f-public', skip: 100, maxItems: 100, nextSkip: 200, endOfContainer: true,
        nodes: [] });

      expect(first.children!.length).toBe(1);
      expect(first.endOfContainer).toBe(true);
    });

    it('reports an unreadable folder on the node, not on the whole screen', () => {
      signInAndLoad();
      const first = component.roots![0];

      component.toggle(first);
      httpMock.expectOne(r => r.url === '/api/browse/children')
        .flush({ message: 'Source could not answer' }, { status: 502, statusText: 'Bad Gateway' });

      // One container the source could not list is not a broken tree.
      expect(first.error).toBe('Source could not answer');
      expect(component.error).toBeNull();
    });

    it('keeps an out-of-scope entry rather than filtering it out', () => {
      // The host returns it deliberately: an operator fixing a scope has to see what is excluded.
      signInAndLoad([NODE('f-public'), NODE('f-excluded', true, false)]);

      expect(component.roots!.map(r => r.node.nodeId)).toEqual(['f-public', 'f-excluded']);
      expect(component.roots![1].node.inScope).toBe(false);
    });
  });

  describe('the selection round trip', () => {

    it('starts from the saved selection, so a saved scope does not render as unticked', () => {
      signInAndLoad([NODE('f-public'), NODE('f-orglink')], ['f-orglink']);

      expect([...component.selected]).toEqual(['f-orglink']);
      expect(component.selectionChanged).toBe(false);
    });

    /**
     * The backend's answer is what is kept, not what was sent.
     *
     * Echoing local state would report success for a selection the host narrowed or rejected, which is exactly
     * the case where the operator most needs to be told.
     */
    it('takes the saved state from the response rather than from its own optimism', () => {
      signInAndLoad();
      component.toggleSelected(NODE('f-public'));
      component.toggleSelected(NODE('f-orglink'));
      expect(component.selectionChanged).toBe(true);

      component.saveSelection();
      const put = httpMock.expectOne('/api/selection');
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ rootNodeIds: ['f-public', 'f-orglink'] });
      // The host answers with only one of them, as it would if the other were unresolvable.
      put.flush({ sourceType: 'sharepoint', qualifiedSourceId: 'sharepoint:x',
        rootNodeIds: ['f-orglink'], chosen: true });
      httpMock.expectOne('/api/browse/roots').flush({
        sourceType: 'sharepoint', resolvedFrom: 'selection', roots: [NODE('f-orglink')], problems: []
      });

      expect([...component.selected]).toEqual(['f-orglink']);
      expect(component.selectionChanged).toBe(false);
      expect(component.saveMessage).toContain('no restart');
    });

    it('explains a deployment with no selection store instead of showing a bare failure', () => {
      signInAndLoad();
      component.toggleSelected(NODE('f-public'));

      component.saveSelection();
      httpMock.expectOne('/api/selection').flush('', { status: 501, statusText: 'Not Implemented' });

      expect(component.saveError).toContain('no selection store');
    });

    it('still shows the tree when the selection cannot be read, because browsing is read-only', () => {
      void auth.loginIngester('svc', 'pw');
      httpMock.expectOne('/api/connectors').flush({ connectors: [], problems: [] });

      component.refresh();
      httpMock.expectOne('/api/connectors').flush({ connectors: [], problems: [] });
      httpMock.expectOne('/api/connectors/schema').flush([]);
      httpMock.expectOne('/api/selection').flush('', { status: 501, statusText: 'Not Implemented' });
      httpMock.expectOne('/api/browse/roots').flush({
        sourceType: 'sharepoint', resolvedFrom: 'connector', roots: [NODE('f-public')], problems: []
      });

      expect(component.roots!.length).toBe(1);
      expect([...component.selected]).toEqual([]);
    });
  });

  describe('the authentication panel', () => {

    it('shows mode and identity for a connector that reports them', () => {
      signInAndLoad();

      expect(component.authState!.mode).toBe('device-code');
      expect(component.authState!.identity).toBe('crawler@example.invalid');
      expect(component.authState!.usable).toBe(true);
    });

    /**
     * Absent cleanly. A source whose credential is deployment configuration has no state that varies, so the
     * panel is simply not rendered rather than showing empty rows.
     */
    it('is absent for a connector that reports no auth state', () => {
      signInAndLoad([NODE('f-public')], [], null);

      expect(component.authState).toBeNull();
    });

    /**
     * The whole point of the issue: a lapsed credential has to be visible before a sync, not afterwards as a
     * failed job whose log talks about a token cache nobody has heard of.
     */
    it('carries the remedy when the credential cannot be used', () => {
      signInAndLoad([NODE('f-public')], [], {
        mode: 'device-code', supportedInProduction: false, identity: null, lastRefreshedAt: null,
        usable: false, remedy: 'Sign in again on the host with scripts/sharepoint-device-login.sh, then restart this service.'
      });

      expect(component.authState!.usable).toBe(false);
      expect(component.authState!.remedy).toContain('sharepoint-device-login.sh');
    });

    /**
     * Nothing rendered here may be a credential or point at one.
     *
     * The backend is what guarantees it, but asserting over the whole record means a field added there later
     * is covered by this test without anyone remembering to extend it -- and this screen is reachable from a
     * browser, so the cache path in particular must not arrive.
     */
    it('renders nothing that is or locates a credential', () => {
      signInAndLoad([NODE('f-public')], [], {
        mode: 'device-code', supportedInProduction: false, identity: null, lastRefreshedAt: null,
        usable: false, remedy: 'Sign in again on the host with scripts/sharepoint-device-login.sh, then restart this service.'
      });

      const rendered = JSON.stringify(component.authState);
      expect(rendered).not.toMatch(/msal|token-cache|\/var\/lib|refresh_token|client-secret/i);
    });

    it('drops the panel rather than failing the screen when the status cannot be read', () => {
      void auth.loginIngester('svc', 'pw');
      httpMock.expectOne('/api/connectors').flush({ connectors: [], problems: [] });

      component.refresh();
      httpMock.expectOne('/api/connectors').flush({ connectors: [], problems: [] });
      httpMock.expectOne('/api/connector-status').flush('', { status: 500, statusText: 'Server Error' });
      httpMock.expectOne('/api/connectors/schema').flush([]);
      httpMock.expectOne('/api/selection').flush({ sourceType: 'sharepoint', qualifiedSourceId: 'x',
        rootNodeIds: [], chosen: false });
      httpMock.expectOne('/api/browse/roots').flush({ sourceType: 'sharepoint', resolvedFrom: 'connector',
        roots: [NODE('f-public')], problems: [] });

      // Diagnostic information: not having it is a worse outcome on a screen that can still show the tree.
      expect(component.authState).toBeNull();
      expect(component.error).toBeNull();
      expect(component.roots!.length).toBe(1);
    });
  });

  describe('sync', () => {

    it('carries the source type, which is what routes the request to the plugin host', () => {
      signInAndLoad();

      component.startSync();
      const post = httpMock.expectOne(r => r.url === '/api/sync/configured');
      expect(post.request.params.get('sourceType')).toBe('sharepoint');
      post.flush({ jobId: 'job-1', sourceType: 'sharepoint', status: 'RUNNING',
        discoveredCount: 0, syncedCount: 0, skippedCount: 0, failedCount: 0 });

      expect(component.job!.jobId).toBe('job-1');
      expect(component.syncRunning).toBe(true);
    });

    it('treats a failed job as terminal, since a poll that only stopped on success would hang with it', () => {
      signInAndLoad();
      component.startSync();
      httpMock.expectOne(r => r.url === '/api/sync/configured')
        .flush({ jobId: 'job-1', sourceType: 'sharepoint', status: 'FAILED',
          discoveredCount: 3, syncedCount: 1, skippedCount: 0, failedCount: 2 });

      expect(component.jobClass).toBe('is-failed');
      expect(component.syncRunning).toBe(false);
    });
  });
});
