import { SessionStore, Session, SessionMessage, SessionState } from './SessionStore.js';

export interface AutoSaveOptions {
  enabled: boolean;
  intervalMs: number;
  maxUnsavedMessages: number;
}

export class SessionAutoSaver {
  private store: SessionStore;
  private options: AutoSaveOptions;
  private currentSession: Session | null = null;
  private unsavedChanges = 0;
  private timer: NodeJS.Timeout | null = null;
  private onSave?: (session: Session) => void;

  constructor(store: SessionStore, options: Partial<AutoSaveOptions> = {}) {
    this.store = store;
    this.options = {
      enabled: true,
      intervalMs: 30000, // 30 seconds
      maxUnsavedMessages: 5,
      ...options,
    };
  }

  async start(sessionId?: string): Promise<Session> {
    let resolvedSessionId = sessionId;
    if (!resolvedSessionId) {
      resolvedSessionId = await this.store.getActiveSessionId() || undefined;
    }

    if (resolvedSessionId) {
      this.currentSession = await this.store.getSession(resolvedSessionId);
    }

    if (!this.currentSession) {
      this.currentSession = await this.store.createSession();
    }

    if (this.options.enabled) {
      this.startTimer();
    }

    return this.currentSession;
  }

  async stop(): Promise<void> {
    this.stopTimer();
    await this.save();
  }

  async addMessage(message: Omit<SessionMessage, 'id' | 'index' | 'timestamp'>): Promise<void> {
    if (!this.currentSession) return;

    const fullMessage: SessionMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      index: this.currentSession.messages.length,
      timestamp: new Date(),
    };

    this.currentSession.messages.push(fullMessage);
    this.unsavedChanges++;

    if (this.unsavedChanges >= this.options.maxUnsavedMessages) {
      await this.save();
    }
  }

  async updateState(updates: Partial<SessionState>): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.state = { ...this.currentSession.state, ...updates };
    this.unsavedChanges++;
  }

  async updateSessionInfo(updates: Partial<Pick<Session, 'name' | 'tags'>>): Promise<void> {
    if (!this.currentSession) return;

    Object.assign(this.currentSession, updates);
    this.unsavedChanges++;
  }

  async addInputToHistory(input: string): Promise<void> {
    if (!this.currentSession) return;

    // Avoid duplicates
    const lastInput = this.currentSession.inputHistory[this.currentSession.inputHistory.length - 1];
    if (lastInput !== input) {
      this.currentSession.inputHistory.push(input);
      this.unsavedChanges++;

      // Keep history manageable (last 1000 entries)
      if (this.currentSession.inputHistory.length > 1000) {
        this.currentSession.inputHistory = this.currentSession.inputHistory.slice(-1000);
      }
    }
  }

  async save(): Promise<void> {
    if (!this.currentSession || this.unsavedChanges === 0) return;

    this.currentSession.updatedAt = new Date();
    this.currentSession.lastAccessedAt = new Date();

    await this.store.updateSession(this.currentSession.id, this.currentSession);
    this.unsavedChanges = 0;

    if (this.onSave) {
      this.onSave(this.currentSession);
    }
  }

  getSession(): Session | null {
    return this.currentSession;
  }

  hasUnsavedChanges(): boolean {
    return this.unsavedChanges > 0;
  }

  getUnsavedChangesCount(): number {
    return this.unsavedChanges;
  }

  onAutoSave(callback: (session: Session) => void): void {
    this.onSave = callback;
  }

  updateOptions(options: Partial<AutoSaveOptions>): void {
    const wasEnabled = this.options.enabled;
    this.options = { ...this.options, ...options };

    if (wasEnabled !== this.options.enabled) {
      if (this.options.enabled && this.currentSession) {
        this.startTimer();
      } else {
        this.stopTimer();
      }
    }
  }

  private startTimer(): void {
    this.stopTimer(); // Clear any existing timer
    this.timer = setInterval(() => {
      this.save().catch(console.error);
    }, this.options.intervalMs);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
