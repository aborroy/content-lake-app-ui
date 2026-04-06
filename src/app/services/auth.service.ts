import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, map } from 'rxjs';
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
}
