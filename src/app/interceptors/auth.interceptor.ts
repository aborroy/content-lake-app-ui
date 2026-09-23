import { Injectable, Injector } from '@angular/core';
import {
  HttpEvent, HttpHandler, HttpInterceptor, HttpRequest
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { connectorPathPrefixes, resolveConnectorUrls, resolveStatusUrl } from '../utils/api-paths';

/**
 * Attaches authentication headers to outbound requests that need them.
 *
 * Two independent credential paths, because they authenticate against different things.
 *
 * **The RAG service and the status endpoint** carry a content-source session, which is what decides the
 * documents a caller may read:
 * - Both sessions active  → Authorization (Alfresco ticket) + X-Nuxeo-Authorization (Nuxeo Basic)
 *   The backend DualSourceAuthenticationFilter handles this and builds a merged permission filter.
 * - Alfresco only         → Authorization: Basic base64(TICKET_...:)
 * - Nuxeo only            → Authorization: Basic base64(user:pass)
 *   The backend MultiSourceAuthenticationProvider tries Alfresco (fails) then falls back to Nuxeo.
 *
 * **The plugin host's connector endpoints** carry the ingester's sync-admin credential instead. That one
 * authorises reading a connector's settings schema and changing which folders sync; it has nothing to do with
 * document permissions, and sending a repository session to those paths would simply 401.
 *
 * Requests matching neither are passed through unchanged.
 */
@Injectable()
export class AuthHttpInterceptor implements HttpInterceptor {

  constructor(private injector: Injector) {}

  /**
   * Resolved per request instead of injected.
   *
   * AuthService validates restored sessions over HTTP from its own constructor, so the first
   * request of the app's life can be issued while AuthService is still being built. Injecting it
   * here makes this singleton capture that half-built instance and keep it forever, and every later
   * request then dies on it with "getAlfrescoSession is not a function" before it is even sent.
   */
  private get auth(): AuthService {
    return this.injector.get(AuthService);
  }

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (this.isConnectorRequest(req.url)) {
      return this.handleConnectorRequest(req, next);
    }
    if (!this.isRagRequest(req.url)) {
      return next.handle(req);
    }

    // Comparison-mode requests carry explicit auth headers — don't overwrite them
    if (req.headers.has('Authorization')) {
      return next.handle(req);
    }

    const alfSession = this.auth.getAlfrescoSession();
    const nuxSession = this.auth.getNuxeoSession();

    const handle401 = (source: Observable<HttpEvent<unknown>>) =>
      source.pipe(
        catchError(err => {
          if (err.status === 401) {
            this.auth.validateSessions();
          }
          return throwError(() => err);
        })
      );

    if (!alfSession && !nuxSession) {
      return next.handle(req);
    }

    let headers = req.headers;

    if (alfSession && nuxSession) {
      // Dual auth: send both credential sets so the backend builds merged permission filters
      headers = headers.set('Authorization', `Basic ${btoa(alfSession.ticket + ':')}`);
      headers = headers.set('X-Nuxeo-Authorization', `Basic ${nuxSession.credentials}`);
    } else if (alfSession) {
      headers = headers.set('Authorization', `Basic ${btoa(alfSession.ticket + ':')}`);
    } else if (nuxSession) {
      // Single Nuxeo: standard Basic header — backend falls through to Nuxeo auth
      headers = headers.set('Authorization', `Basic ${nuxSession.credentials}`);
    }

    return handle401(next.handle(req.clone({ headers })));
  }

  /**
   * A connector request, carrying the sync-admin credential when one has been entered.
   *
   * A request with no credential is still sent rather than short-circuited, deliberately: the 401 it comes
   * back with is what tells the screen to prompt, and it distinguishes "no credential yet" from "the host is
   * not there", which a 502 would report instead. Short-circuiting here would make those look the same.
   *
   * A 401 drops the stored credential. Without that, a password changed underneath the app would leave every
   * later request retrying the same rejected header, and the screen would show an error it could not explain.
   */
  private handleConnectorRequest(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (req.headers.has('Authorization')) {
      return next.handle(req);
    }
    const session = this.auth.getIngesterSession();
    const outbound = session
      ? req.clone({ headers: req.headers.set('Authorization', `Basic ${session.credentials}`) })
      : req;

    return next.handle(outbound).pipe(
      catchError(err => {
        if (err.status === 401 && session) {
          this.auth.logoutIngester();
        }
        return throwError(() => err);
      })
    );
  }

  /**
   * Whether this URL is one of the plugin host's endpoints.
   *
   * Compared by path prefix against the set derived from the one configured connectors URL, so the
   * interceptor and the callers cannot disagree about where those endpoints live. Getting that wrong is not a
   * subtle failure: a path this misses gets no credential, comes back 401 with a Basic challenge, and the
   * browser puts its own password box over the application.
   */
  private isConnectorRequest(url: string): boolean {
    const prefixes = connectorPathPrefixes(resolveConnectorUrls());
    if (prefixes.length === 0) {
      return false;
    }
    const reqPath = this.pathOf(url);
    return reqPath !== null && prefixes.some(prefix => reqPath === prefix || reqPath.startsWith(`${prefix}/`));
  }

  // Match by URL path so that stripped default ports (e.g. :80) don't break
  // the comparison when ragUrl contains an explicit port. /api/status is authenticated like the
  // rest of the API but is a sibling of /api/rag, so a prefix test alone misses it.
  private isRagRequest(url: string): boolean {
    try {
      const ragPath = new URL(environment.ragUrl, window.location.origin).pathname;
      const statusPath = new URL(resolveStatusUrl(), window.location.origin).pathname;
      const reqPath = new URL(url, window.location.origin).pathname;
      return reqPath.startsWith(ragPath) || reqPath === statusPath;
    } catch {
      return url.startsWith(environment.ragUrl) || url === resolveStatusUrl();
    }
  }

  private pathOf(url: string): string | null {
    try {
      return new URL(url, window.location.origin).pathname;
    } catch {
      return null;
    }
  }
}
