import { Injectable } from '@angular/core';
import {
  HttpEvent, HttpHandler, HttpInterceptor, HttpRequest
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

/**
 * Attaches authentication headers to all outbound RAG service requests.
 *
 * Header strategy:
 * - Both sessions active  → Authorization (Alfresco ticket) + X-Nuxeo-Authorization (Nuxeo Basic)
 *   The backend DualSourceAuthenticationFilter handles this and builds a merged permission filter.
 * - Alfresco only         → Authorization: Basic base64(TICKET_...:)
 * - Nuxeo only            → Authorization: Basic base64(user:pass)
 *   The backend MultiSourceAuthenticationProvider tries Alfresco (fails) then falls back to Nuxeo.
 *
 * Requests not targeting the RAG service are passed through unchanged.
 */
@Injectable()
export class AuthHttpInterceptor implements HttpInterceptor {

  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.isRagRequest(req.url)) {
      return next.handle(req);
    }

    // Comparison-mode requests carry explicit auth headers — don't overwrite them
    if (req.headers.has('Authorization')) {
      return next.handle(req);
    }

    const alfSession = this.auth.getAlfrescoSession();
    const nuxSession = this.auth.getNuxeoSession();

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

    return next.handle(req.clone({ headers }));
  }

  // Match by URL path so that stripped default ports (e.g. :80) don't break
  // the comparison when ragUrl contains an explicit port.
  private isRagRequest(url: string): boolean {
    try {
      const ragPath = new URL(environment.ragUrl, window.location.origin).pathname;
      const reqPath = new URL(url, window.location.origin).pathname;
      return reqPath.startsWith(ragPath);
    } catch {
      return url.startsWith(environment.ragUrl);
    }
  }
}
