import { Component, OnInit, AfterViewChecked, ViewChild, ElementRef } from '@angular/core';
import { AuthService } from '../services/auth.service';
import {
  RagService, RagPromptOptions, RagPromptResponse,
  MergedDocument, PromptSource, ChatMessage, ContentSourceType
} from '../services/rag.service';
import { ChatSessionService, ChatSessionSummary } from '../services/chat-session.service';

let _nextId = 0;

@Component({
  selector: 'app-chat',
  template: `
    <div class="chat-layout">

      <!-- Session sidebar -->
      <aside class="chat-sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">Conversations</span>
          <button mat-stroked-button type="button"
                  (click)="newConversation()" [disabled]="thinking"
                  style="font-size:12px;line-height:28px;padding:0 10px">
            <mat-icon style="font-size:16px;vertical-align:middle">add</mat-icon> New
          </button>
        </div>

        <div class="session-list">
          <div *ngFor="let s of sessionSummaries; trackBy: trackSession"
               class="session-item"
               [class.active]="s.sessionId === activeSessionId"
               (click)="openConversation(s.sessionId)">
            <div class="session-title">{{ s.title }}</div>
            <div class="session-meta">
              {{ s.updatedAt | date:'short' }} · {{ s.messageCount }} msg
            </div>
          </div>
        </div>
      </aside>

      <!-- Main chat panel -->
      <div class="chat-main">

        <!-- Toolbar -->
        <div class="chat-toolbar">
          <!-- No-session warning -->
          <span *ngIf="!anyLoggedIn" style="font-size:12px;color:#e65100;display:flex;align-items:center;gap:4px">
            <mat-icon style="font-size:15px">warning</mat-icon>
            Not logged in — <a routerLink="/login">log in first</a>
          </span>

          <span *ngIf="anyLoggedIn" style="font-size:12px;color:#757575">
            <mat-icon style="font-size:14px;vertical-align:middle">lock</mat-icon>
            Session-aware RAG
          </span>

          <div style="flex:1"></div>

          <mat-button-toggle-group [(ngModel)]="selectedSourceType"
                                   [disabled]="thinking"
                                   style="height:32px">
            <mat-button-toggle value="" style="font-size:12px">All</mat-button-toggle>
            <mat-button-toggle value="alfresco"
                               [disabled]="!alfrescoLoggedIn"
                               [matTooltip]="alfrescoLoggedIn ? 'Alfresco only' : 'Log in to Alfresco first'"
                               style="font-size:12px">
              <mat-icon style="font-size:13px;margin-right:3px;color:#1565c0">storage</mat-icon>
              Alfresco
            </mat-button-toggle>
            <mat-button-toggle value="nuxeo"
                               [disabled]="!nuxeoLoggedIn"
                               [matTooltip]="nuxeoLoggedIn ? 'Nuxeo only' : 'Log in to Nuxeo first'"
                               style="font-size:12px">
              <mat-icon style="font-size:13px;margin-right:3px;color:#c62828">folder_open</mat-icon>
              Nuxeo
            </mat-button-toggle>
          </mat-button-toggle-group>

          <button mat-stroked-button type="button"
                  (click)="newConversation()" [disabled]="thinking"
                  style="margin-left:8px;height:32px;font-size:12px;line-height:30px">
            <mat-icon style="font-size:15px;vertical-align:middle">restart_alt</mat-icon>
            New conversation
          </button>
        </div>

        <!-- Messages area -->
        <div class="messages-area" #messagesContainer (scroll)="onScroll()">

          <!-- Welcome state -->
          <div *ngIf="messages.length === 0" class="welcome-state">
            <mat-icon style="font-size:56px;height:56px;width:56px;color:#9e9e9e">psychology</mat-icon>
            <h3 style="margin:12px 0 4px;color:#616161">RAG Assistant</h3>
            <p style="color:#9e9e9e;font-size:14px;max-width:400px;text-align:center">
              Ask a question about your content lake.
              Answers are grounded in your indexed documents from Alfresco and Nuxeo.
            </p>
          </div>

          <div *ngFor="let msg of messages"
               class="bubble"
               [class.bubble-user]="msg.role === 'user'"
               [class.bubble-assistant]="msg.role === 'assistant'">

            <!-- User bubble -->
            <div *ngIf="msg.role === 'user'" class="user-text">{{ msg.content }}</div>

            <!-- Assistant bubble -->
            <div *ngIf="msg.role === 'assistant'" class="assistant-bubble">

              <!-- Loading spinner (no content yet) -->
              <div *ngIf="msg.loading && !msg.content" class="loading-row">
                <mat-spinner diameter="18" style="display:inline-block"></mat-spinner>
                <span style="margin-left:8px;font-size:13px;color:#757575">Thinking…</span>
              </div>

              <!-- Error -->
              <div *ngIf="msg.error" class="error-row">
                <mat-icon style="font-size:16px;color:#c62828">error_outline</mat-icon>
                <span style="font-size:13px;color:#c62828;margin-left:6px">{{ msg.error }}</span>
              </div>

              <!-- Answer text -->
              <div *ngIf="!msg.error && (msg.content || msg.loading)" class="answer-text">
                {{ msg.content }}<span *ngIf="msg.loading" class="stream-cursor">▋</span>
              </div>

              <!-- Timing / model metadata -->
              <div *ngIf="!msg.loading && !msg.error && (msg.model || msg.totalMs)"
                   class="msg-meta">
                <span *ngIf="msg.model" class="meta-chip">
                  <mat-icon style="font-size:12px">smart_toy</mat-icon> {{ msg.model }}
                </span>
                <span *ngIf="msg.tokenCount !== undefined" class="meta-chip">
                  {{ msg.tokenCount }} tokens
                </span>
                <span *ngIf="msg.totalMs" class="meta-chip">
                  {{ msg.totalMs }}ms
                  <span style="opacity:0.6">
                    (retrieval {{ msg.searchTimeMs }}ms · gen {{ msg.generationTimeMs }}ms)
                  </span>
                </span>
              </div>

              <!-- Sources -->
              <div *ngIf="!msg.loading && !msg.error && msg.sources && msg.sources.length > 0"
                   class="sources-section">
                <button mat-button type="button"
                        (click)="toggleSources(msg)"
                        style="font-size:12px;padding:0 6px;height:28px">
                  <mat-icon style="font-size:15px">
                    {{ msg['_showSources'] ? 'expand_less' : 'expand_more' }}
                  </mat-icon>
                  {{ msg.sources.length }} source{{ msg.sources.length !== 1 ? 's' : '' }}
                </button>

                <div *ngIf="msg['_showSources']" class="sources-list">
                  <div *ngFor="let src of msg.sources" class="source-item">
                    <div class="source-header">
                      <mat-icon style="font-size:15px;flex-shrink:0">insert_drive_file</mat-icon>
                      <a *ngIf="src.openInSourceUrl"
                         [href]="src.openInSourceUrl" target="_blank" rel="noopener noreferrer"
                         class="source-name">{{ src.name }}</a>
                      <span *ngIf="!src.openInSourceUrl" class="source-name">{{ src.name }}</span>
                      <span *ngIf="src.sourceType"
                            class="src-badge"
                            [class.alfresco-badge]="src.sourceType === 'alfresco'"
                            [class.nuxeo-badge]="src.sourceType === 'nuxeo'">
                        {{ src.sourceType }}
                      </span>
                    </div>
                    <div *ngIf="src.path" class="source-path">{{ src.path }}</div>
                    <div *ngFor="let chunk of src.chunks" class="source-chunk">
                      {{ chunk.text }}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div><!-- /messages-area -->

        <!-- Input row -->
        <div class="input-row">
          <mat-form-field appearance="outline"
                          style="flex:1;margin-bottom:-1.25em">
            <input matInput
                   [(ngModel)]="currentQuestion"
                   (keyup.enter)="ask()"
                   placeholder="Ask a question about your documents…"
                   [disabled]="thinking || !anyLoggedIn" />
          </mat-form-field>
          <button mat-icon-button color="primary"
                  [disabled]="!currentQuestion.trim() || thinking || !anyLoggedIn"
                  (click)="ask()"
                  matTooltip="Send">
            <mat-icon>send</mat-icon>
          </button>
        </div>

      </div><!-- /chat-main -->
    </div>
  `,
  styles: [`
    .chat-layout {
      display: flex;
      height: calc(100vh - 64px);
      overflow: hidden;
    }

    /* Sidebar */
    .chat-sidebar {
      width: 220px;
      min-width: 220px;
      border-right: 1px solid #e0e0e0;
      display: flex;
      flex-direction: column;
      background: #fafafa;
    }
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
    }
    .sidebar-title { font-size: 13px; font-weight: 600; color: #424242; }
    .session-list { flex: 1; overflow-y: auto; }
    .session-item {
      padding: 10px 12px;
      cursor: pointer;
      border-bottom: 1px solid #f0f0f0;
      transition: background 0.15s;
    }
    .session-item:hover { background: #eeeeee; }
    .session-item.active { background: #e3f2fd; border-left: 3px solid #1565c0; }
    .session-title { font-size: 12px; font-weight: 500; color: #212121; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .session-meta { font-size: 10px; color: #9e9e9e; margin-top: 2px; }

    /* Main */
    .chat-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .chat-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-bottom: 1px solid #e0e0e0;
      background: #fff;
      flex-wrap: wrap;
    }

    /* Messages */
    .messages-area {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .welcome-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 16px;
    }

    .bubble { max-width: 80%; }
    .bubble-user { align-self: flex-end; }
    .bubble-assistant { align-self: flex-start; width: 100%; max-width: 90%; }

    .user-text {
      background: #1565c0;
      color: white;
      padding: 10px 14px;
      border-radius: 18px 18px 4px 18px;
      font-size: 14px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .assistant-bubble {
      background: #f5f5f5;
      border: 1px solid #e0e0e0;
      border-radius: 4px 18px 18px 18px;
      padding: 12px 14px;
    }

    .loading-row { display: flex; align-items: center; }
    .error-row { display: flex; align-items: center; }

    .answer-text {
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      color: #212121;
    }
    .stream-cursor {
      display: inline-block;
      animation: blink 0.7s step-end infinite;
      color: #1565c0;
    }
    @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }

    .msg-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    .meta-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      color: #757575;
      background: #eeeeee;
      border-radius: 10px;
      padding: 2px 8px;
    }

    .sources-section { margin-top: 8px; }
    .sources-list { margin-top: 4px; display: flex; flex-direction: column; gap: 8px; }
    .source-item {
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 8px 10px;
      background: #fff;
      font-size: 12px;
    }
    .source-header { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .source-name { font-weight: 500; color: #1565c0; }
    .source-path { color: #9e9e9e; font-size: 11px; margin-top: 2px; }
    .source-chunk {
      margin-top: 6px;
      padding: 6px 8px;
      background: #f5f5f5;
      border-left: 3px solid #e0e0e0;
      border-radius: 0 4px 4px 0;
      font-size: 12px;
      color: #424242;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .src-badge {
      font-size: 10px;
      border-radius: 8px;
      padding: 1px 6px;
      font-weight: 500;
    }
    .alfresco-badge { background: #e3f2fd; color: #1565c0; }
    .nuxeo-badge    { background: #ffebee; color: #c62828; }

    /* Input row */
    .input-row {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 8px 16px 8px;
      border-top: 1px solid #e0e0e0;
      background: #fff;
    }
  `]
})
export class ChatComponent implements OnInit, AfterViewChecked {

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  messages: ChatMessage[] = [];
  sessionSummaries: ChatSessionSummary[] = [];
  currentQuestion = '';
  selectedSourceType: ContentSourceType | '' = '';
  thinking = false;
  activeSessionId: string | null = null;

  private shouldScroll = false;
  private autoScrollEnabled = true;
  private streamBuffers = new Map<string, string>();

  constructor(
    private auth: AuthService,
    private rag: RagService,
    private sessions: ChatSessionService
  ) {}

  ngOnInit(): void {
    this.activeSessionId = this.sessions.ensureActiveSession();
    this.messages = this.sessions.getMessages(this.activeSessionId);
    this.refreshSummaries();
    this.shouldScroll = true;
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  get anyLoggedIn(): boolean      { return this.auth.isAnyLoggedIn(); }
  get alfrescoLoggedIn(): boolean { return this.auth.isAlfrescoLoggedIn(); }
  get nuxeoLoggedIn(): boolean    { return this.auth.isNuxeoLoggedIn(); }

  ask(): void {
    const q = this.currentQuestion.trim();
    if (!q || this.thinking || !this.anyLoggedIn) return;

    const sessionId = this.activeSessionId ?? this.sessions.ensureActiveSession();
    const isFirstTurn = this.messages.length === 0;
    this.activeSessionId = sessionId;

    const userMsg: ChatMessage = {
      id: `msg-${_nextId++}`, role: 'user', content: q, timestamp: new Date()
    };
    const assistantMsg: ChatMessage = {
      id: `msg-${_nextId++}`, role: 'assistant', content: '', timestamp: new Date(), loading: true
    };

    this.messages.push(userMsg, assistantMsg);
    this.currentQuestion = '';
    this.thinking = true;
    this.shouldScroll = true;
    this.persist();

    const opts: RagPromptOptions = {
      sessionId,
      resetSession: isFirstTurn,
      ...(this.selectedSourceType ? { sourceType: this.selectedSourceType } : {})
    };

    this.rag.streamPrompt(q, opts).subscribe({
      next: event => {
        if (event.type === 'token') {
          const buf = (this.streamBuffers.get(assistantMsg.id) ?? '') + event.token;
          this.streamBuffers.set(assistantMsg.id, buf);
          assistantMsg.content = buf;
          this.shouldScroll = this.autoScrollEnabled;
          this.persist();
          return;
        }
        if (event.type === 'metadata') {
          this.applyResponse(assistantMsg, event.response);
          this.finishMessage(assistantMsg);
          this.persist();
          return;
        }
        this.finishMessage(assistantMsg);
        this.persist();
      },
      error: err => {
        if (this.isUnavailable(err)) {
          this.fallbackToPrompt(q, sessionId, isFirstTurn, assistantMsg, opts);
          return;
        }
        this.streamBuffers.delete(assistantMsg.id);
        assistantMsg.loading = false;
        assistantMsg.error = err?.message ?? 'Request failed';
        this.thinking = false;
        this.shouldScroll = this.autoScrollEnabled;
        this.persist();
      }
    });
  }

  newConversation(): void {
    if (this.thinking) return;
    this.activeSessionId = this.sessions.createSession();
    this.messages = [];
    this.currentQuestion = '';
    this.autoScrollEnabled = true;
    this.refreshSummaries();
    this.shouldScroll = true;
  }

  openConversation(sessionId: string): void {
    if (this.thinking || sessionId === this.activeSessionId) return;
    this.activeSessionId = sessionId;
    this.sessions.activateSession(sessionId);
    this.messages = this.sessions.getMessages(sessionId);
    this.autoScrollEnabled = true;
    this.refreshSummaries();
    this.shouldScroll = true;
  }

  onScroll(): void {
    const el = this.messagesContainer?.nativeElement as HTMLElement;
    if (el) this.autoScrollEnabled = (el.scrollTop + el.clientHeight) >= (el.scrollHeight - 96);
  }

  toggleSources(msg: ChatMessage): void {
    (msg as any)['_showSources'] = !(msg as any)['_showSources'];
  }

  trackSession(_i: number, s: ChatSessionSummary): string { return s.sessionId; }

  private fallbackToPrompt(
    question: string, sessionId: string, isFirstTurn: boolean,
    assistantMsg: ChatMessage, opts: RagPromptOptions
  ): void {
    this.rag.prompt(question, { ...opts, sessionId, resetSession: isFirstTurn }).subscribe({
      next: response => {
        this.applyResponse(assistantMsg, response);
        this.finishMessage(assistantMsg);
        this.persist();
      },
      error: err => {
        this.streamBuffers.delete(assistantMsg.id);
        assistantMsg.loading = false;
        assistantMsg.error = err?.error?.message ?? err?.message ?? 'Request failed';
        this.thinking = false;
        this.persist();
      }
    });
  }

  private applyResponse(msg: ChatMessage, response: RagPromptResponse): void {
    if (response.sessionId) this.activeSessionId = response.sessionId;
    if (response.answer) {
      msg.content = response.answer;
      this.streamBuffers.delete(msg.id);
    }
    msg.model = response.model;
    msg.tokenCount = response.tokenCount;
    msg.totalMs = response.totalTimeMs;
    msg.searchTimeMs = response.searchTimeMs;
    msg.generationTimeMs = response.generationTimeMs;
    msg.sources = this.mergeSources(response.sources ?? []);
    msg.error = undefined;
  }

  private finishMessage(msg: ChatMessage): void {
    this.streamBuffers.delete(msg.id);
    msg.loading = false;
    this.thinking = false;
    this.shouldScroll = this.autoScrollEnabled;
  }

  private mergeSources(sources: PromptSource[]): MergedDocument[] {
    const map = new Map<string, MergedDocument>();
    for (const s of sources) {
      const key = `${s.sourceId ?? ''}::${s.nodeId}`;
      const existing = map.get(key);
      if (existing) {
        existing.chunks.push({ text: s.chunkText, score: s.score });
      } else {
        map.set(key, {
          nodeId: s.nodeId,
          sourceId: s.sourceId,
          sourceType: s.sourceType,
          name: s.name,
          path: s.path,
          score: s.score,
          chunks: [{ text: s.chunkText, score: s.score }],
          openInSourceUrl: s.openInSourceUrl
        });
      }
    }
    return Array.from(map.values());
  }

  private persist(): void {
    if (this.activeSessionId) {
      this.sessions.saveMessages(this.activeSessionId, this.messages);
      this.refreshSummaries();
    }
  }

  private refreshSummaries(): void {
    this.sessionSummaries = this.sessions.listSessions();
  }

  private scrollToBottom(): void {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch (_) {}
  }

  private isUnavailable(err: any): boolean {
    const m = String(err?.message ?? '').toLowerCase();
    return m.includes('stream request failed (404)') || m.includes('stream request failed (405)');
  }
}
