import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

// ---- API response types (match backend SemanticSearchResponse) ----

export type ContentSourceType = 'alfresco' | 'nuxeo';

interface SemanticSearchRequest {
  query: string;
  topK?: number;
  minScore?: number;
  sourceType?: ContentSourceType;
}

interface SearchResultSourceDocument {
  documentId: string;
  nodeId: string;
  sourceId?: string;
  sourceType?: ContentSourceType;
  name: string;
  path: string;
  mimeType?: string;
  openInSourceUrl?: string;
}

interface SearchResultItem {
  rank: number;
  score: number;
  chunkText: string;
  sourceDocument: SearchResultSourceDocument;
}

interface SemanticSearchResponse {
  query: string;
  model: string;
  vectorDimension: number;
  resultCount: number;
  totalCount: number;
  searchTimeMs: number;
  results: SearchResultItem[];
}

// ---- RAG Prompt (Q&A) ----

export interface RagPromptRequest {
  question: string;
  sessionId?: string;
  resetSession?: boolean;
  topK?: number;
  minScore?: number;
  filter?: string;
  sourceType?: ContentSourceType;
  embeddingType?: string;
  systemPrompt?: string;
  includeContext?: boolean;
}

export interface RagPromptOptions {
  sessionId?: string;
  resetSession?: boolean;
  topK?: number;
  minScore?: number;
  filter?: string;
  sourceType?: ContentSourceType;
  systemPrompt?: string;
  includeContext?: boolean;
}

export interface PromptSource {
  documentId: string;
  nodeId: string;
  sourceId?: string;
  sourceType?: ContentSourceType;
  name: string;
  path: string;
  chunkText: string;
  score: number;
  openInSourceUrl?: string;
}

export interface RagPromptResponse {
  answer: string;
  question: string;
  sessionId?: string;
  retrievalQuery?: string;
  historyTurnsUsed?: number;
  model: string;
  tokenCount?: number;
  searchTimeMs: number;
  generationTimeMs: number;
  totalTimeMs: number;
  sourcesUsed: number;
  sources: PromptSource[];
}

export type RagPromptStreamEvent =
  | { type: 'token'; token: string }
  | { type: 'metadata'; response: RagPromptResponse }
  | { type: 'done' };

// ---- Chat UI view models ----

export interface ChunkSnippet { text: string; score: number; }

export interface MergedDocument {
  nodeId: string;
  sourceId?: string;
  sourceType?: ContentSourceType;
  name: string;
  path: string;
  score: number;
  chunks: ChunkSnippet[];
  openInSourceUrl?: string;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: Date;
  model?: string;
  tokenCount?: number;
  totalMs?: number;
  searchTimeMs?: number;
  generationTimeMs?: number;
  sources?: MergedDocument[];
  loading?: boolean;
  error?: string;
}

// ---- Health ----

export interface RagComponentHealth {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  model?: string;
  vectorDimension?: number;
  searchTimeMs?: number;
  error?: string;
}

export interface RagHealth {
  status: 'UP' | 'DEGRADED' | 'DOWN';
  embedding?: RagComponentHealth;
  hxpr?: RagComponentHealth;
  llm?: RagComponentHealth;
}

// ---- View model used by the UI ----

export interface RagResult {
  rank: number;
  score: number;
  title: string;
  snippet: string;
  source?: ContentSourceType;
  sourceId?: string;
  path?: string;
  openInSourceUrl?: string;
  /** Kept for ResultsComponent backward compat */
  url?: string;
}

@Injectable({ providedIn: 'root' })
export class RagService {

  constructor(private http: HttpClient, private auth: AuthService) {}

  search(query: string, sourceType?: ContentSourceType): Observable<RagResult[]> {
    const body: SemanticSearchRequest = { query, topK: 10 };
    if (sourceType) body.sourceType = sourceType;

    return this.http
      .post<SemanticSearchResponse>(`${environment.ragUrl}/search/semantic`, body)
      .pipe(map(resp => this.mapResults(resp)));
  }

  /**
   * Runs a search with explicit auth headers, bypassing the stored session interceptor.
   * Used by the permission comparison panel to search as a different user without
   * touching the active session.
   */
  searchWithHeaders(
    query: string,
    authHeaders: HttpHeaders,
    sourceType?: ContentSourceType
  ): Observable<RagResult[]> {
    const body: SemanticSearchRequest = { query, topK: 10 };
    if (sourceType) body.sourceType = sourceType;

    return this.http
      .post<SemanticSearchResponse>(`${environment.ragUrl}/search/semantic`, body, { headers: authHeaders })
      .pipe(map(resp => this.mapResults(resp)));
  }

  prompt(question: string, options: RagPromptOptions = {}): Observable<RagPromptResponse> {
    const body: RagPromptRequest = { question, ...options };
    return this.http.post<RagPromptResponse>(`${environment.ragUrl}/prompt`, body);
  }

  streamPrompt(question: string, options: RagPromptOptions = {}): Observable<RagPromptStreamEvent> {
    const body: RagPromptRequest = { question, ...options };
    const url = `${environment.ragUrl}/chat/stream`;

    return new Observable<RagPromptStreamEvent>((observer) => {
      const controller = new AbortController();
      let cancelled = false;

      const run = async (attempt: number): Promise<void> => {
        let gotDone = false;
        try {
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Accept': 'text/event-stream', 'Content-Type': 'application/json',
                       ...this.streamAuthHeaders() },
            body: JSON.stringify(body),
            signal: controller.signal,
            cache: 'no-store'
          });

          if (!resp.ok || !resp.body) {
            throw new StreamHttpError(resp.status, resp.statusText || 'HTTP error');
          }

          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';

          while (!cancelled) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            buf = this.consumeSse(buf, (type, data) => {
              if (type === 'done') gotDone = true;
              this.forwardSse(observer, type, data);
            });
          }

          if (!cancelled) {
            buf += decoder.decode();
            this.consumeSse(buf, (type, data) => {
              if (type === 'done') gotDone = true;
              this.forwardSse(observer, type, data);
            }, true);
            if (!gotDone) observer.next({ type: 'done' });
            observer.complete();
          }
        } catch (err) {
          if (cancelled) return;
          if (attempt === 0 && this.isTransient(err)) {
            await new Promise(r => setTimeout(r, 250));
            await run(1);
            return;
          }
          observer.error(err instanceof Error ? err : new Error('Stream failed'));
        }
      };

      void run(0);
      return () => { cancelled = true; controller.abort(); };
    });
  }

  getHealth(): Observable<RagHealth> {
    return this.http.get<RagHealth>(`${environment.ragUrl}/health`);
  }

  private streamAuthHeaders(): Record<string, string> {
    const alf = this.auth.getAlfrescoSession();
    const nux = this.auth.getNuxeoSession();
    if (alf && nux) {
      return {
        Authorization: `Basic ${btoa(alf.ticket + ':')}`,
        'X-Nuxeo-Authorization': `Basic ${nux.credentials}`
      };
    }
    if (alf) return { Authorization: `Basic ${btoa(alf.ticket + ':')}` };
    if (nux) return { Authorization: `Basic ${nux.credentials}` };
    return {};
  }

  private consumeSse(
    buf: string,
    onEvent: (type: string, data: string) => void,
    flush = false
  ): string {
    let rest = buf;
    let idx = this.sseBoundary(rest);
    while (idx >= 0) {
      const raw = rest.slice(0, idx).trim();
      if (raw) this.parseSse(raw, onEvent);
      rest = rest.slice(idx + (rest.startsWith('\r\n\r\n', idx) ? 4 : 2));
      idx = this.sseBoundary(rest);
    }
    if (flush && rest.trim()) this.parseSse(rest.trim(), onEvent);
    return flush ? '' : rest;
  }

  private sseBoundary(buf: string): number {
    const lf = buf.indexOf('\n\n'), crlf = buf.indexOf('\r\n\r\n');
    if (lf < 0) return crlf;
    if (crlf < 0) return lf;
    return Math.min(lf, crlf);
  }

  private parseSse(raw: string, onEvent: (type: string, data: string) => void): void {
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    let type = 'message';
    const data: string[] = [];
    for (const line of lines) {
      if (line.startsWith('event:')) type = line.slice(6).trim() || 'message';
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    onEvent(type, data.join('\n'));
  }

  private forwardSse(
    obs: { next: (v: RagPromptStreamEvent) => void; error: (e: any) => void },
    type: string, data: string
  ): void {
    const t = type.toLowerCase();
    const payload = data ? (() => { try { return JSON.parse(data); } catch { return null; } })() : null;

    if (t === 'error') {
      const msg = (payload as any)?.message ?? (payload as any)?.error ?? data ?? 'Stream failed';
      obs.error(new Error(String(msg)));
      return;
    }
    if (t === 'done' || t === 'complete') { obs.next({ type: 'done' }); return; }

    // metadata / final event
    if (t === 'metadata' || t === 'final' || t === 'result' ||
        (payload && typeof payload === 'object' &&
         (typeof (payload as any).answer === 'string' || Array.isArray((payload as any).sources)))) {
      const r = this.normalizePromptResponse(payload, data);
      if (r) { obs.next({ type: 'metadata', response: r }); } else { obs.next({ type: 'done' }); }
      return;
    }

    const token = payload && typeof payload === 'object'
      ? ((payload as any).token ?? (payload as any).delta ?? (payload as any).text ?? (payload as any).content ?? null)
      : null;
    if (typeof token === 'string') { obs.next({ type: 'token', token }); return; }
    if (data) obs.next({ type: 'token', token: data });
  }

  private normalizePromptResponse(payload: unknown, fallback: string): RagPromptResponse | null {
    const c: any = (payload && typeof payload === 'object' && (payload as any).response)
      ? (payload as any).response : payload;
    if (!c || typeof c !== 'object') {
      return fallback ? { answer: fallback, question: '', model: 'unknown',
        searchTimeMs: 0, generationTimeMs: 0, totalTimeMs: 0, sourcesUsed: 0, sources: [] } : null;
    }
    return {
      answer: typeof c.answer === 'string' ? c.answer : (fallback || ''),
      question: typeof c.question === 'string' ? c.question : '',
      sessionId: typeof c.sessionId === 'string' ? c.sessionId : undefined,
      retrievalQuery: typeof c.retrievalQuery === 'string' ? c.retrievalQuery : undefined,
      historyTurnsUsed: typeof c.historyTurnsUsed === 'number' ? c.historyTurnsUsed : undefined,
      model: typeof c.model === 'string' ? c.model : 'unknown',
      tokenCount: typeof c.tokenCount === 'number' ? c.tokenCount : undefined,
      searchTimeMs: typeof c.searchTimeMs === 'number' ? c.searchTimeMs : 0,
      generationTimeMs: typeof c.generationTimeMs === 'number' ? c.generationTimeMs : 0,
      totalTimeMs: typeof c.totalTimeMs === 'number' ? c.totalTimeMs : 0,
      sourcesUsed: typeof c.sourcesUsed === 'number' ? c.sourcesUsed : (Array.isArray(c.sources) ? c.sources.length : 0),
      sources: Array.isArray(c.sources) ? c.sources : []
    };
  }

  private isTransient(err: unknown): boolean {
    if (err instanceof StreamHttpError) return err.status >= 500;
    if (err instanceof DOMException) return err.name !== 'AbortError';
    return err instanceof TypeError;
  }

  private mapResults(resp: SemanticSearchResponse): RagResult[] {
    return (resp.results ?? []).map(item => ({
      rank: item.rank,
      score: item.score,
      title: item.sourceDocument?.name ?? '(untitled)',
      snippet: item.chunkText ?? '',
      source: item.sourceDocument?.sourceType,
      sourceId: item.sourceDocument?.sourceId,
      path: item.sourceDocument?.path,
      openInSourceUrl: item.sourceDocument?.openInSourceUrl,
      url: item.sourceDocument?.openInSourceUrl,
    }));
  }
}

class StreamHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(`Stream request failed (${status}): ${message}`);
  }
}
