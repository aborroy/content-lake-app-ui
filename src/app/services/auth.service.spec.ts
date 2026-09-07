import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthService } from './auth.service';

const ALFRESCO_ME_URL = '/alfresco/api/-default-/public/alfresco/versions/1/people/-me-';
const NUXEO_ME_URL = '/nuxeo/api/v1/me';

/** Lets the constructor's deferred validateSessions() run before assertions. */
function settle(): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}

describe('AuthService', () => {

  let httpMock: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('keepsTheNuxeoCredentialInMemoryAndOutOfSessionStorage', async () => {
    const service = TestBed.inject(AuthService);
    await settle();

    const login = service.loginNuxeo('jdoe', 'secret');
    const request = httpMock.expectOne(NUXEO_ME_URL);
    expect(request.request.headers.get('Authorization')).toBe(`Basic ${btoa('jdoe:secret')}`);
    request.flush({ id: 'jdoe' });
    await login;

    // The credential has to stay reachable: rag-service's dual-source path needs it on every request.
    expect(service.getNuxeoSession()).toEqual({ username: 'jdoe', credentials: btoa('jdoe:secret') });
    expect(service.isNuxeoLoggedIn()).toBeTrue();

    // ...but it must never reach web storage, where any script on the origin could read it back.
    expect(sessionStorage.getItem('nuxeoSession')).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it('dropsAStaleNuxeoSessionKeyLeftByAnEarlierBuild', async () => {
    sessionStorage.setItem(
      'nuxeoSession',
      JSON.stringify({ username: 'jdoe', credentials: btoa('jdoe:secret') })
    );

    const service = TestBed.inject(AuthService);

    expect(sessionStorage.getItem('nuxeoSession')).toBeNull();
    expect(service.getNuxeoSession()).toBeNull();
    expect(service.isNuxeoLoggedIn()).toBeFalse();

    await settle();
    httpMock.verify();
  });

  it('stillRehydratesTheAlfrescoTicketFromSessionStorage', async () => {
    sessionStorage.setItem(
      'alfrescoSession',
      JSON.stringify({ username: 'admin', ticket: 'TICKET_STORED' })
    );

    const service = TestBed.inject(AuthService);

    expect(service.getAlfrescoSession()).toEqual({ username: 'admin', ticket: 'TICKET_STORED' });
    expect(service.isAlfrescoLoggedIn()).toBeTrue();

    await settle();
    const validation = httpMock.expectOne(ALFRESCO_ME_URL);
    expect(validation.request.headers.get('Authorization')).toBe(`Basic ${btoa('TICKET_STORED:')}`);
    validation.flush({ entry: { id: 'admin' } });

    expect(service.isAlfrescoLoggedIn()).toBeTrue();
    expect(sessionStorage.getItem('alfrescoSession')).not.toBeNull();
  });

  it('logsOutNuxeoWithoutTouchingTheAlfrescoSession', async () => {
    const service = TestBed.inject(AuthService);
    await settle();

    const login = service.loginNuxeo('jdoe', 'secret');
    httpMock.expectOne(NUXEO_ME_URL).flush({ id: 'jdoe' });
    await login;

    const alfrescoLogin = service.loginAlfresco('admin', 'admin');
    httpMock.expectOne(r => r.url.endsWith('/tickets')).flush({ entry: { id: 'TICKET_NEW' } });
    await alfrescoLogin;

    service.logoutNuxeo();

    expect(service.getNuxeoSession()).toBeNull();
    expect(service.getAlfrescoSession()?.ticket).toBe('TICKET_NEW');
    expect(sessionStorage.getItem('alfrescoSession')).not.toBeNull();
  });
});
