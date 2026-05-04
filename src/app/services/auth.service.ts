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
  credentials: string;  // base64(user:pass) — sent as X-Nuxeo-Authorization: Basic <credentials>
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private alfresco$ = new BehaviorSubject<AlfrescoSession | null>(null);
  private nuxeo$ = new BehaviorSubject<NuxeoSession | null>(null);

  readonly alfrescoSession$ = this.alfresco$.asObservable();
  readonly nuxeoSession$ = this.nuxeo$.asObservable();

  constructor(private http: HttpClient) {
    const alf = localStorage.getItem('alfrescoSession');
    if (alf) this.alfresco$.next(JSON.parse(alf));
    const nux = localStorage.getItem('nuxeoSession');
    if (nux) this.nuxeo$.next(JSON.parse(nux));

    // Validate restored sessions asynchronously
    this.validateSessions();
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
        localStorage.setItem('alfrescoSession', JSON.stringify(session));
      });
  }

  logoutAlfresco(): void {
    this.alfresco$.next(null);
    localStorage.removeItem('alfrescoSession');
  }

  getAlfrescoSession(): AlfrescoSession | null {
    return this.alfresco$.getValue();
  }

  /** @deprecated Use getAlfrescoSession().ticket — kept for backward compat with rag.service.ts */
  getAlfrescoToken(): string | undefined {
    return this.alfresco$.getValue()?.ticket;
  }

  // ---- Nuxeo ----

  /**
   * Validates Nuxeo credentials by calling /api/v1/me with Basic auth.
   * Stores the base64(user:pass) for use in X-Nuxeo-Authorization headers.
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
        const session: NuxeoSession = { username: resolvedUsername, credentials };
        this.nuxeo$.next(session);
        localStorage.setItem('nuxeoSession', JSON.stringify(session));
      });
  }

  logoutNuxeo(): void {
    this.nuxeo$.next(null);
    localStorage.removeItem('nuxeoSession');
  }

  getNuxeoSession(): NuxeoSession | null {
    return this.nuxeo$.getValue();
  }

  /** @deprecated Use getNuxeoSession().credentials — kept for backward compat with rag.service.ts */
  getNuxeoToken(): string | undefined {
    return this.nuxeo$.getValue()?.credentials;
  }

  // ---- Temporary auth (comparison mode — does NOT store to session) ----

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
