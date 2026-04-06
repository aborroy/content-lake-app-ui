import { Injectable } from '@angular/core';
import { ChatMessage } from './rag.service';

interface ChatSessionRecord {
  sessionId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
}

interface StoredChatMessage extends Omit<ChatMessage, 'timestamp'> {
  timestamp: string;
}

interface StoredSessionRecord {
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredChatMessage[];
}

interface SessionState {
  activeSessionId: string | null;
  sessions: ChatSessionRecord[];
}

export interface ChatSessionSummary {
  sessionId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}

/**
 * Persists chat sessions in sessionStorage so state survives route changes
 * but is cleared when the browser tab is closed.
 */
@Injectable({ providedIn: 'root' })
export class ChatSessionService {

  private static readonly KEY = 'content-lake.chat.sessions.v1';
  private state: SessionState = this.load();

  ensureActiveSession(): string {
    const current = this.state.activeSessionId;
    if (current && this.find(current)) return current;
    if (this.state.sessions.length > 0) {
      this.state.activeSessionId = this.state.sessions[0].sessionId;
      this.persist();
      return this.state.activeSessionId;
    }
    return this.createSession();
  }

  createSession(): string {
    const now = new Date();
    const sessionId = this.generateId();
    this.state.sessions = [
      { sessionId, title: 'New conversation', createdAt: now, updatedAt: now, messages: [] },
      ...this.state.sessions
    ];
    this.state.activeSessionId = sessionId;
    this.persist();
    return sessionId;
  }

  activateSession(sessionId: string): void {
    if (!this.find(sessionId)) return;
    this.state.activeSessionId = sessionId;
    this.persist();
  }

  getActiveSessionId(): string | null { return this.state.activeSessionId; }

  listSessions(): ChatSessionSummary[] {
    return this.state.sessions.map(s => ({
      sessionId: s.sessionId,
      title: s.title,
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt),
      messageCount: s.messages.length
    }));
  }

  getMessages(sessionId: string): ChatMessage[] {
    return (this.find(sessionId)?.messages ?? []).map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
  }

  saveMessages(sessionId: string, messages: ChatMessage[]): void {
    const now = new Date();
    const normalized = messages.map(m => ({ ...m, timestamp: new Date(m.timestamp ?? now) }));
    const existing = this.find(sessionId);
    if (existing) {
      existing.messages = normalized;
      existing.updatedAt = this.latestTs(normalized, now);
      existing.title = this.resolveTitle(normalized);
    } else {
      this.state.sessions.push({
        sessionId,
        title: this.resolveTitle(normalized),
        createdAt: this.earliestTs(normalized, now),
        updatedAt: this.latestTs(normalized, now),
        messages: normalized
      });
    }
    this.state.sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    this.state.activeSessionId = sessionId;
    this.persist();
  }

  private find(sessionId: string): ChatSessionRecord | undefined {
    return this.state.sessions.find(s => s.sessionId === sessionId);
  }

  private resolveTitle(messages: ChatMessage[]): string {
    const first = messages.find(m => m.role === 'user' && m.content?.trim());
    if (!first) return 'New conversation';
    const t = first.content.trim();
    return t.length > 72 ? `${t.slice(0, 69)}…` : t;
  }

  private earliestTs(messages: ChatMessage[], fallback: Date): Date {
    return messages.reduce((min, m) => {
      const ts = new Date(m.timestamp);
      return ts < min ? ts : min;
    }, messages[0] ? new Date(messages[0].timestamp) : fallback);
  }

  private latestTs(messages: ChatMessage[], fallback: Date): Date {
    return messages.reduce((max, m) => {
      const ts = new Date(m.timestamp);
      return ts > max ? ts : max;
    }, messages[0] ? new Date(messages[0].timestamp) : fallback);
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `ui-${crypto.randomUUID()}`;
    }
    return `ui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private load(): SessionState {
    const empty: SessionState = { activeSessionId: null, sessions: [] };
    if (typeof sessionStorage === 'undefined') return empty;
    try {
      const raw = sessionStorage.getItem(ChatSessionService.KEY);
      if (!raw) return empty;
      const parsed = JSON.parse(raw) as { activeSessionId: string | null; sessions: StoredSessionRecord[] };
      const sessions = (Array.isArray(parsed.sessions) ? parsed.sessions : []).map(s => ({
        sessionId: s.sessionId,
        title: s.title || 'New conversation',
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
        messages: (s.messages ?? []).map(m => ({ ...m, timestamp: new Date(m.timestamp) }))
      }));
      sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return {
        activeSessionId: parsed.activeSessionId ?? sessions[0]?.sessionId ?? null,
        sessions
      };
    } catch { return empty; }
  }

  private persist(): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(ChatSessionService.KEY, JSON.stringify({
      activeSessionId: this.state.activeSessionId,
      sessions: this.state.sessions.map(s => ({
        sessionId: s.sessionId,
        title: s.title,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        messages: s.messages.map(m => ({ ...m, timestamp: m.timestamp.toISOString() }))
      }))
    }));
  }
}
