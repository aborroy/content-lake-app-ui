import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, forkJoin, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface AlfrescoSession {
  username: string;
  ticket: string;   // TICKET_xxx string
}

export interface NuxeoSession {
  username: string;
  credentials: string;  // base64(user:pass), sent as X-Nuxeo-Authorization: Basic <credentials>
}

/**
 * Holds the two repository sessions this demo UI can establish.
 *
 * The two sources are treated asymmetrically on purpose. An Alfresco ticket is revocable and
 * scoped, so it survives a reload in `sessionStorage`. A Nuxeo session is a reusable
 * base64(user:pass) credential that rag-service requires on the wire for dual-source queries, and
 * nothing can revoke it short of changing the password, so it is held in memory only and a reload
 * ends it.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {

  private static readonly NUXEO_SESSION_KEY = 'nuxeoSession';

  private alfresco$ = new BehaviorSubject<AlfrescoSession | null>(null);
  private nuxeo$ = new BehaviorSubject<NuxeoSession | null>(null);

  readonly alfrescoSession$ = this.alfresco$.asObservable();
  readonly nuxeoSession$ = this.nuxeo$.asObservable();

  constructor(private http: HttpClient) {
    const alf = sessionStorage.getItem('alfrescoSession');
    if (alf) this.alfresco$.next(JSON.parse(alf));

    // The Nuxeo session is deliberately not rehydrated, because it is never written. Clearing the
    // key here drops one left behind by an older build of this UI that did persist it.
    sessionStorage.removeItem(AuthService.NUXEO_SESSION_KEY);

    // Deferred to a microtask on purpose: validation goes over HTTP, which builds the interceptor
    // chain, and the auth interceptor needs this instance. Firing it from the constructor makes that
    // resolution re-enter a half-built AuthService.
    Promise.resolve().then(() => this.validateSessions());
  }

  // ---- Alfresco ----

  /**
   * Authenticates against Alfresco and stores the returned ticket.
   * Uses the Alfresco REST API tickets endpoint.
   */
  loginAlfresco(username: string, password: string): Promise<void> {
    const url = `${environment.alfrescoUrl}/alfresco/api/-default-/public/authentication/versions/1/tickets`;
    return this.http
      .post<{ entry: { id: string } }>(url, { userId: username, password })
      .toPromise()
      .then(resp => {
        const ticket = resp?.entry?.id;
        if (!ticket) throw new Error('No ticket in Alfresco response');
        const session: AlfrescoSession = { username, ticket };
        this.alfresco$.next(session);
        sessionStorage.setItem('alfrescoSession', JSON.stringify(session));
      });
  }

  logoutAlfresco(): void {
    this.alfresco$.next(null);
    sessionStorage.removeItem('alfrescoSession');
  }

  getAlfrescoSession(): AlfrescoSession | null {
    return this.alfresco$.getValue();
  }

  /** @deprecated Use getAlfrescoSession().ticket, kept for backward compat with rag.service.ts */
  getAlfrescoToken(): string | undefined {
    return this.alfresco$.getValue()?.ticket;
  }

  // ---- Nuxeo ----

  /**
   * Validates Nuxeo credentials by calling /api/v1/me with Basic auth.
   *
   * The resulting base64(user:pass) is kept in memory for the lifetime of the page, because
   * rag-service's dual-source path requires it on every request as X-Nuxeo-Authorization. It is
   * never written to web storage, so a reload ends the Nuxeo half of the session.
   */
  loginNuxeo(username: string, password: string): Promise<void> {
    const credentials = btoa(`${username}:${password}`);
    const headers = new HttpHeaders({ Authorization: `Basic ${credentials}` });
    const url = `${environment.nuxeoUrl}/api/v1/me`;
    return this.http
      .get<{ id?: string; username?: string }>(url, { headers })
      .toPromise()
      .then(resp => {
        const resolvedUsername = resp?.id ?? resp?.username ?? username;
        this.nuxeo$.next({ username: resolvedUsername, credentials });
      });
  }

  logoutNuxeo(): void {
    this.nuxeo$.next(null);
  }

  getNuxeoSession(): NuxeoSession | null {
    return this.nuxeo$.getValue();
  }

  /** @deprecated Use getNuxeoSession().credentials, kept for backward compat with rag.service.ts */
  getNuxeoToken(): string | undefined {
    return this.nuxeo$.getValue()?.credentials;
  }

  // ---- Temporary auth (comparison mode, does NOT store to session) ----

  /**
   * Authenticates against Alfresco and returns the ticket + resolved username
   * without touching the stored session. Used by the permission comparison panel.
   */
  getTempAlfrescoSession(username: string, password: string): Observable<AlfrescoSession> {
    const url = `${environment.alfrescoUrl}/alfresco/api/-default-/public/authentication/versions/1/tickets`;
    return this.http
      .post<{ entry: { id: string } }>(url, { userId: username, password })
      .pipe(map(resp => {
        const ticket = resp?.entry?.id;
        if (!ticket) throw new Error('No ticket in Alfresco response');
        return { username, ticket };
      }));
  }

  /**
   * Validates Nuxeo Basic credentials and returns the session without storing it.
   */
  getTempNuxeoSession(username: string, password: string): Observable<NuxeoSession> {
    const credentials = btoa(`${username}:${password}`);
    const headers = new HttpHeaders({ Authorization: `Basic ${credentials}` });
    return this.http
      .get<{ id?: string; username?: string }>(`${environment.nuxeoUrl}/api/v1/me`, { headers })
      .pipe(map(resp => ({
        username: resp?.id ?? resp?.username ?? username,
        credentials
      })));
  }

  // ---- Status ----

  isAlfrescoLoggedIn(): boolean {
    return this.alfresco$.getValue() !== null;
  }

  isNuxeoLoggedIn(): boolean {
    return this.nuxeo$.getValue() !== null;
  }

  isAnyLoggedIn(): boolean {
    return this.isAlfrescoLoggedIn() || this.isNuxeoLoggedIn();
  }

  // ---- Session Validation ----

  /**
   * Validates an Alfresco session by attempting to retrieve current user info.
   * Returns true if the session is valid, false otherwise.
   */
  private validateAlfrescoSession(session: AlfrescoSession): Observable<boolean> {
    const headers = new HttpHeaders({
      Authorization: `Basic ${btoa(session.ticket + ':')}`
    });
    const url = `${environment.alfrescoUrl}/alfresco/api/-default-/public/alfresco/versions/1/people/-me-`;

    return this.http.get(url, { headers }).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Validates a Nuxeo session by calling the /me endpoint.
   * Returns true if the session is valid, false otherwise.
   */
  private validateNuxeoSession(session: NuxeoSession): Observable<boolean> {
    const headers = new HttpHeaders({
      Authorization: `Basic ${session.credentials}`
    });
    const url = `${environment.nuxeoUrl}/api/v1/me`;

    return this.http.get(url, { headers }).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Validates all restored sessions on page load.
   * Automatically logs out invalid sessions.
   */
  validateSessions(): Promise<void> {
    const alfSession = this.alfresco$.getValue();
    const nuxSession = this.nuxeo$.getValue();

    const checks: Observable<any>[] = [];

    if (alfSession) {
      checks.push(
        this.validateAlfrescoSession(alfSession).pipe(
          tap(valid => {
            if (!valid) {
              console.warn('Alfresco session invalid, logging out');
              this.logoutAlfresco();
            }
          })
        )
      );
    }

    if (nuxSession) {
      checks.push(
        this.validateNuxeoSession(nuxSession).pipe(
          tap(valid => {
            if (!valid) {
              console.warn('Nuxeo session invalid, logging out');
              this.logoutNuxeo();
            }
          })
        )
      );
    }

    if (checks.length === 0) {
      return Promise.resolve();
    }

    return forkJoin(checks).toPromise().then(() => {});
  }
}
