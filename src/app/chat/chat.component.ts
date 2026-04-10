import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { ChatSessionService, ChatSessionSummary } from '../services/chat-session.service';
import {
  ChatMessage,
  ContentSourceType,
  MergedDocument,
  PromptSource,
  RagPromptOptions,
  RagPromptResponse,
  RagService
} from '../services/rag.service';

let _nextId = 0;

@Component({
  selector: 'app-chat',
  template: `
    <div class="page-container chat-page">
      <div class="chat-layout surface-card">
        <aside class="chat-sidebar">
          <div class="sidebar-header">
            <div>
              <span class="eyebrow">Conversations</span>
              <h2>Session memory</h2>
            </div>
            <button mat-stroked-button type="button" class="sidebar-action" (click)="newConversation()" [disabled]="thinking">
              <mat-icon>add</mat-icon>
              New
            </button>
          </div>

          <div class="sidebar-legend">
            <span class="source-badge source-badge-alfresco">
              <mat-icon>storage</mat-icon>
              Alfresco
            </span>
            <span class="source-badge source-badge-nuxeo">
              <mat-icon>folder_open</mat-icon>
              Nuxeo
            </span>
          </div>

          <div class="session-list">
            <button *ngFor="let s of sessionSummaries; trackBy: trackSession"
                    type="button"
                    class="session-item"
                    [class.active]="s.sessionId === activeSessionId"
                    (click)="openConversation(s.sessionId)">
              <span class="session-title">{{ s.title }}</span>
              <span class="session-meta">{{ s.updatedAt | date:'short' }} · {{ s.messageCount }} msg</span>
            </button>
          </div>
        </aside>

        <section class="chat-main">
          <div class="chat-toolbar">
            <div class="toolbar-copy">
              <span class="eyebrow">RAG assistant</span>
              <h1>Ask across both repositories with explicit source provenance.</h1>
            </div>

            <div class="toolbar-controls">
              <span *ngIf="!anyLoggedIn" class="toolbar-warning">
                <mat-icon>warning</mat-icon>
                Not logged in. <a routerLink="/login">Connect a repository</a>.
              </span>

              <span *ngIf="anyLoggedIn" class="toolbar-status">
                <mat-icon>lock</mat-icon>
                Session-aware retrieval enabled
              </span>

              <mat-button-toggle-group [(ngModel)]="selectedSourceType"
                                       [disabled]="thinking"
                                       class="source-toggle">
                <mat-button-toggle value="">All</mat-button-toggle>
                <mat-button-toggle value="alfresco"
                                   [disabled]="!alfrescoLoggedIn"
                                   [matTooltip]="alfrescoLoggedIn ? 'Alfresco only' : 'Log in to Alfresco first'">
                  <span class="toggle-label toggle-label-alfresco">
                    <mat-icon>storage</mat-icon>
                    Alfresco
                  </span>
                </mat-button-toggle>
                <mat-button-toggle value="nuxeo"
                                   [disabled]="!nuxeoLoggedIn"
                                   [matTooltip]="nuxeoLoggedIn ? 'Nuxeo only' : 'Log in to Nuxeo first'">
                  <span class="toggle-label toggle-label-nuxeo">
                    <mat-icon>folder_open</mat-icon>
                    Nuxeo
                  </span>
                </mat-button-toggle>
              </mat-button-toggle-group>

              <button mat-stroked-button type="button"
                      class="sidebar-action"
                      (click)="newConversation()"
                      [disabled]="thinking">
                <mat-icon>restart_alt</mat-icon>
                Reset
              </button>
            </div>
          </div>

          <div class="messages-area" #messagesContainer (scroll)="onScroll()">
            <div *ngIf="messages.length === 0" class="welcome-state">
              <div class="welcome-card">
                <mat-icon>psychology</mat-icon>
                <h3>Grounded answers from your indexed content lake</h3>
                <p>
                  Ask a question, stream the answer, and expand source evidence below the response.
                </p>
                <div class="welcome-badges">
                  <span class="metric-chip">
                    <mat-icon>hub</mat-icon>
                    Cross-source retrieval
                  </span>
                  <span class="metric-chip">
                    <mat-icon>description</mat-icon>
                    Inline citations
                  </span>
                </div>
              </div>
            </div>

            <div *ngFor="let msg of messages"
                 class="bubble"
                 [class.bubble-user]="msg.role === 'user'"
                 [class.bubble-assistant]="msg.role === 'assistant'">
              <div *ngIf="msg.role === 'user'" class="user-text">{{ msg.content }}</div>

              <div *ngIf="msg.role === 'assistant'" class="assistant-bubble">
                <div *ngIf="msg.loading && !msg.content" class="loading-row">
                  <mat-spinner diameter="18"></mat-spinner>
                  <span>Thinking...</span>
                </div>

                <div *ngIf="msg.error" class="error-row">
                  <mat-icon>error_outline</mat-icon>
                  <span>{{ msg.error }}</span>
                </div>

                <div *ngIf="!msg.error && (msg.content || msg.loading)" class="answer-text">
                  {{ msg.content }}<span *ngIf="msg.loading" class="stream-cursor">|</span>
                </div>

                <div *ngIf="!msg.loading && !msg.error && (msg.model || msg.totalMs)" class="msg-meta">
                  <span *ngIf="msg.model" class="metric-chip">
                    <mat-icon>smart_toy</mat-icon>
                    {{ msg.model }}
                  </span>
                  <span *ngIf="msg.tokenCount !== undefined" class="metric-chip">
                    <mat-icon>code</mat-icon>
                    {{ msg.tokenCount }} tokens
                  </span>
                  <span *ngIf="msg.totalMs" class="metric-chip">
                    <mat-icon>schedule</mat-icon>
                    {{ msg.totalMs }}ms
                  </span>
                </div>

                <div *ngIf="!msg.loading && !msg.error && msg.sources && msg.sources.length > 0" class="sources-section">
                  <button mat-button type="button" class="sources-toggle" (click)="toggleSources(msg)">
                    <mat-icon>{{ msg['_showSources'] ? 'expand_less' : 'expand_more' }}</mat-icon>
                    {{ msg.sources.length }} source{{ msg.sources.length !== 1 ? 's' : '' }}
                  </button>

                  <div *ngIf="msg['_showSources']" class="sources-list">
                    <div *ngFor="let src of msg.sources"
                         class="source-item"
                         [ngClass]="sourceCardClass(src.sourceType)">
                      <div class="source-header">
                        <div class="source-title-group">
                          <span class="source-icon" [ngClass]="sourceBadgeClass(src.sourceType)">
                            <mat-icon>{{ sourceIcon(src.sourceType) }}</mat-icon>
                          </span>
                          <div>
                            <a *ngIf="src.openInSourceUrl"
                               [href]="src.openInSourceUrl"
                               target="_blank"
                               rel="noopener noreferrer"
                               class="source-name">{{ src.name }}</a>
                            <span *ngIf="!src.openInSourceUrl" class="source-name">{{ src.name }}</span>
                            <div *ngIf="src.path" class="source-path">{{ src.path }}</div>
                          </div>
                        </div>

                        <span *ngIf="src.sourceType"
                              class="source-badge"
                              [ngClass]="sourceBadgeClass(src.sourceType)">
                          <mat-icon>{{ sourceIcon(src.sourceType) }}</mat-icon>
                          {{ src.sourceType | titlecase }}
                        </span>
                      </div>

                      <div *ngFor="let chunk of src.chunks" class="source-chunk">
                        {{ chunk.text }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="input-row">
            <mat-form-field appearance="outline" class="question-field">
              <mat-label>Ask a question about your documents</mat-label>
              <input matInput
                     [(ngModel)]="currentQuestion"
                     (keyup.enter)="ask()"
                     [disabled]="thinking || !anyLoggedIn" />
            </mat-form-field>
            <button mat-raised-button color="primary"
                    class="send-button"
                    [disabled]="!currentQuestion.trim() || thinking || !anyLoggedIn"
                    (click)="ask()">
              <mat-icon>send</mat-icon>
              Send
            </button>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .chat-page {
      padding-top: 24px;
    }

    .chat-layout {
      display: grid;
      grid-template-columns: 300px minmax(0, 1fr);
      min-height: calc(100vh - 156px);
      overflow: hidden;
    }

    .eyebrow {
      display: inline-block;
      color: var(--cl-text-soft);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    .chat-sidebar {
      padding: 20px;
      border-right: 1px solid var(--cl-border);
      background: linear-gradient(180deg, rgba(244, 247, 244, 0.72), rgba(255, 255, 255, 0.8));
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .sidebar-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .sidebar-header h2 {
      margin: 6px 0 0;
      font-size: 24px;
      letter-spacing: -0.04em;
    }

    .sidebar-action {
      border-radius: 14px;
      min-height: 42px;
    }

    .sidebar-legend {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .session-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(24, 49, 38, 0.12) transparent;
    }

    .session-list::-webkit-scrollbar {
      width: 5px;
    }

    .session-list::-webkit-scrollbar-thumb {
      border-radius: 99px;
      background: rgba(24, 49, 38, 0.12);
    }

    .session-item {
      border: 1px solid var(--cl-border);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.72);
      padding: 14px 16px;
      text-align: left;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: 160ms ease;
      color: var(--cl-text);
    }

    .session-item:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 20px rgba(24, 49, 38, 0.08);
    }

    .session-item.active {
      border-color: rgba(24, 58, 100, 0.18);
      background: linear-gradient(135deg, rgba(24, 58, 100, 0.08), rgba(47, 109, 246, 0.08));
    }

    .session-title {
      font-size: 14px;
      font-weight: 700;
      line-height: 1.4;
    }

    .session-meta {
      color: var(--cl-text-soft);
      font-size: 11px;
    }

    .chat-main {
      display: flex;
      flex-direction: column;
      min-width: 0;
      background: rgba(255, 255, 255, 0.46);
    }

    .chat-toolbar {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      flex-wrap: wrap;
      padding: 22px 24px 18px;
      border-bottom: 1px solid var(--cl-border);
      background: rgba(255, 255, 255, 0.64);
    }

    .toolbar-copy h1 {
      margin: 6px 0 0;
      font-size: 28px;
      line-height: 1.08;
      letter-spacing: -0.05em;
      max-width: 540px;
    }

    .toolbar-controls {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .toolbar-warning,
    .toolbar-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 42px;
      padding: 0 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
    }

    .toolbar-warning {
      background: rgba(255, 248, 238, 0.92);
      color: var(--cl-warning);
    }

    .toolbar-status {
      background: rgba(236, 248, 236, 0.92);
      color: var(--cl-success);
    }

    .source-toggle {
      height: 44px;
      border-radius: 16px;
      background: rgba(244, 247, 244, 0.88);
    }

    .toggle-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
    }

    .toggle-label mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }

    .toggle-label-alfresco {
      color: var(--source-alfresco-strong);
    }

    .toggle-label-nuxeo {
      color: var(--source-nuxeo-strong);
    }

    .messages-area {
      flex: 1;
      overflow-y: auto;
      padding: 22px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      background:
        radial-gradient(circle at top right, rgba(47, 109, 246, 0.06), transparent 24%),
        linear-gradient(180deg, rgba(247, 250, 248, 0.56), rgba(244, 247, 244, 0.36));
      scrollbar-width: thin;
      scrollbar-color: rgba(24, 49, 38, 0.14) transparent;
    }

    .messages-area::-webkit-scrollbar {
      width: 6px;
    }

    .messages-area::-webkit-scrollbar-thumb {
      border-radius: 99px;
      background: rgba(24, 49, 38, 0.14);
    }


    .welcome-state {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 320px;
    }

    .welcome-card {
      max-width: 560px;
      padding: 30px;
      border-radius: 28px;
      background: rgba(255, 255, 255, 0.88);
      border: 1px solid var(--cl-border);
      box-shadow: var(--cl-shadow-soft);
      text-align: center;
    }

    .welcome-card > mat-icon {
      width: 56px;
      height: 56px;
      font-size: 56px;
      color: var(--cl-text-soft);
    }

    .welcome-card h3 {
      margin: 16px 0 10px;
      font-size: 28px;
      letter-spacing: -0.05em;
    }

    .welcome-card p {
      margin: 0;
      color: var(--cl-text-muted);
      line-height: 1.7;
    }

    .welcome-badges {
      display: flex;
      justify-content: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 18px;
    }

    .bubble {
      max-width: min(920px, 88%);
      display: flex;
    }

    .bubble-user {
      align-self: flex-end;
    }

    .bubble-assistant {
      align-self: flex-start;
      width: 100%;
      max-width: min(980px, 92%);
    }

    .user-text {
      background: linear-gradient(135deg, rgba(24, 58, 100, 0.95), rgba(47, 109, 246, 0.92));
      color: white;
      padding: 14px 18px;
      border-radius: 22px 22px 8px 22px;
      font-size: 14px;
      line-height: 1.7;
      white-space: pre-wrap;
      word-break: break-word;
      box-shadow: 0 14px 28px rgba(24, 58, 100, 0.18);
    }

    .assistant-bubble {
      background: rgba(255, 255, 255, 0.84);
      border: 1px solid var(--cl-border);
      border-radius: 8px 22px 22px 22px;
      padding: 18px;
      box-shadow: var(--cl-shadow-soft);
    }

    .loading-row,
    .error-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }

    .loading-row {
      color: var(--cl-text-muted);
    }

    .error-row {
      color: var(--cl-danger);
    }

    .answer-text {
      font-size: 15px;
      line-height: 1.8;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--cl-text);
    }

    .stream-cursor {
      display: inline-block;
      color: var(--source-nuxeo);
      animation: blink 0.8s step-end infinite;
      margin-left: 2px;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    .msg-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }

    .sources-section {
      margin-top: 14px;
    }

    .sources-toggle {
      padding: 0 6px;
      min-height: 34px;
      border-radius: 12px;
      color: var(--cl-primary);
      font-weight: 700;
    }

    .sources-list {
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .source-item {
      padding: 16px;
      border-radius: 20px;
      border: 1px solid var(--cl-border);
      background: rgba(247, 250, 248, 0.92);
    }

    .source-item.source-item-alfresco {
      border-color: rgba(118, 184, 42, 0.18);
      background: linear-gradient(180deg, rgba(239, 248, 223, 0.72), rgba(255, 255, 255, 0.88));
    }

    .source-item.source-item-nuxeo {
      border-color: rgba(47, 109, 246, 0.16);
      background: linear-gradient(180deg, rgba(235, 241, 255, 0.76), rgba(255, 255, 255, 0.88));
    }

    .source-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .source-title-group {
      display: flex;
      gap: 12px;
      min-width: 0;
      flex: 1;
    }

    .source-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 14px;
      background: rgba(24, 49, 38, 0.06);
      color: var(--cl-primary);
      flex-shrink: 0;
    }

    .source-name {
      display: inline-block;
      color: var(--cl-primary);
      font-weight: 700;
      text-decoration: none;
      margin-bottom: 4px;
    }

    .source-name:hover {
      text-decoration: underline;
    }

    .source-path {
      color: var(--cl-text-soft);
      font-size: 12px;
      line-height: 1.6;
      word-break: break-word;
    }

    .source-chunk {
      margin-top: 12px;
      padding: 12px 14px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.78);
      border-left: 4px solid rgba(24, 58, 100, 0.16);
      color: var(--cl-text);
      font-size: 13px;
      line-height: 1.7;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .source-item-alfresco .source-chunk {
      border-left-color: rgba(118, 184, 42, 0.45);
    }

    .source-item-nuxeo .source-chunk {
      border-left-color: rgba(47, 109, 246, 0.35);
    }

    .input-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 18px 24px 22px;
      border-top: 1px solid var(--cl-border);
      background: rgba(255, 255, 255, 0.72);
    }

    .question-field {
      flex: 1;
      margin-bottom: -1.25em;
    }

    .send-button {
      min-height: 50px;
      min-width: 132px;
      border-radius: 16px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    @media (max-width: 1040px) {
      .chat-layout {
        grid-template-columns: 1fr;
      }

      .chat-sidebar {
        border-right: 0;
        border-bottom: 1px solid var(--cl-border);
      }

      .bubble,
      .bubble-assistant {
        max-width: 100%;
      }
    }

    @media (max-width: 760px) {
      .toolbar-copy h1 {
        font-size: 24px;
      }

      .input-row {
        flex-direction: column;
        align-items: stretch;
      }

      .send-button {
        width: 100%;
      }
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

  get anyLoggedIn(): boolean { return this.auth.isAnyLoggedIn(); }
  get alfrescoLoggedIn(): boolean { return this.auth.isAlfrescoLoggedIn(); }
  get nuxeoLoggedIn(): boolean { return this.auth.isNuxeoLoggedIn(); }

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

  sourceIcon(source: ContentSourceType | undefined): string {
    if (source === 'alfresco') return 'storage';
    if (source === 'nuxeo') return 'folder_open';
    return 'description';
  }

  sourceBadgeClass(source: ContentSourceType | undefined): string {
    if (source === 'alfresco') return 'source-badge-alfresco';
    if (source === 'nuxeo') return 'source-badge-nuxeo';
    return '';
  }

  sourceCardClass(source: ContentSourceType | undefined): string {
    if (source === 'alfresco') return 'source-item-alfresco';
    if (source === 'nuxeo') return 'source-item-nuxeo';
    return '';
  }

  private fallbackToPrompt(
    question: string,
    sessionId: string,
    isFirstTurn: boolean,
    assistantMsg: ChatMessage,
    opts: RagPromptOptions
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
