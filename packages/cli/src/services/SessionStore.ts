import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface SessionMessage {
  id: string;
  index: number;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  agent?: string;
  stage?: string;
  taskId?: string;
  tokens?: { input: number; output: number };
  toolCalls?: ToolCallRecord[];
}

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  timestamp: Date;
}

export interface SessionState {
  totalTokens: { input: number; output: number };
  totalCost: number;
  tasksCreated: string[];
  tasksCompleted: string[];
  currentTaskId?: string;
  lastGitBranch?: string;
}

export interface Session {
  id: string;
  name?: string;
  projectPath: string;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  messages: SessionMessage[];
  inputHistory: string[];
  state: SessionState;
  parentSessionId?: string;
  branchPoint?: number;
  childSessionIds: string[];
  tags: string[];
}

export interface SessionIndex {
  version: number;
  sessions: SessionSummary[];
  lastUpdated: Date;
}

export interface SessionSummary {
  id: string;
  name?: string;
  messageCount: number;
  totalCost: number;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  isArchived: boolean;
}

export class SessionStore {
  private sessionsDir: string;
  private archiveDir: string;
  private indexPath: string;
  private activePath: string;
  private index: SessionIndex | null = null;

  constructor(projectPath: string) {
    this.sessionsDir = path.join(projectPath, '.apex', 'sessions');
    this.archiveDir = path.join(this.sessionsDir, 'archive');
    this.indexPath = path.join(this.sessionsDir, 'index.json');
    this.activePath = path.join(this.sessionsDir, 'active.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.sessionsDir, { recursive: true });
    await fs.mkdir(this.archiveDir, { recursive: true });
    await this.loadIndex();
  }

  async createSession(name?: string): Promise<Session> {
    const id = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const session: Session = {
      id,
      name,
      projectPath: path.dirname(this.sessionsDir),
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      messages: [],
      inputHistory: [],
      state: {
        totalTokens: { input: 0, output: 0 },
        totalCost: 0,
        tasksCreated: [],
        tasksCompleted: [],
      },
      childSessionIds: [],
      tags: [],
    };

    await this.saveSession(session);
    await this.setActiveSession(id);
    await this.updateIndex(session, 'create');

    return session;
  }

  async getSession(id: string): Promise<Session | null> {
    const sessionPath = path.join(this.sessionsDir, `${id}.json`);
    try {
      const data = await fs.readFile(sessionPath, 'utf-8');
      const session = JSON.parse(data);
      // Restore Date objects
      session.createdAt = new Date(session.createdAt);
      session.updatedAt = new Date(session.updatedAt);
      session.lastAccessedAt = new Date(session.lastAccessedAt);
      session.messages.forEach((m: SessionMessage) => {
        m.timestamp = new Date(m.timestamp);
        if (m.toolCalls) {
          m.toolCalls.forEach((tc: ToolCallRecord) => {
            tc.timestamp = new Date(tc.timestamp);
          });
        }
      });
      return session;
    } catch {
      // Try archived sessions
      return this.getArchivedSession(id);
    }
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<void> {
    const session = await this.getSession(id);
    if (!session) throw new Error(`Session not found: ${id}`);

    const updated = { ...session, ...updates, updatedAt: new Date() };
    await this.saveSession(updated);
    await this.updateIndex(updated, 'update');
  }

  async deleteSession(id: string): Promise<void> {
    const sessionPath = path.join(this.sessionsDir, `${id}.json`);
    try {
      await fs.unlink(sessionPath);
      await this.updateIndex({ id } as Session, 'delete');
    } catch {
      // Session might be archived
      const archivePath = path.join(this.archiveDir, `${id}.json.gz`);
      await fs.unlink(archivePath);
    }
  }

  async listSessions(options?: {
    all?: boolean;
    search?: string;
    tags?: string[];
    limit?: number;
  }): Promise<SessionSummary[]> {
    await this.loadIndex();
    if (!this.index) return [];

    let sessions = this.index.sessions;

    if (!options?.all) {
      sessions = sessions.filter(s => !s.isArchived);
    }

    if (options?.search) {
      const query = options.search.toLowerCase();
      sessions = sessions.filter(s =>
        s.name?.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query)
      );
    }

    if (options?.tags && options.tags.length > 0) {
      sessions = sessions.filter(s =>
        options.tags!.some(tag => s.tags.includes(tag))
      );
    }

    sessions = sessions.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return options?.limit ? sessions.slice(0, options.limit) : sessions;
  }

  async branchSession(
    id: string,
    fromIndex: number,
    name?: string
  ): Promise<Session> {
    const parent = await this.getSession(id);
    if (!parent) throw new Error(`Session not found: ${id}`);

    const branchedMessages = parent.messages.slice(0, fromIndex + 1);
    const now = new Date();

    const branched: Session = {
      ...parent,
      id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name || `Branch of ${parent.name || parent.id}`,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      messages: branchedMessages,
      parentSessionId: id,
      branchPoint: fromIndex,
      childSessionIds: [],
      state: {
        ...parent.state,
        // Recalculate state up to branch point
        totalTokens: this.calculateTokens(branchedMessages),
        totalCost: this.calculateCost(branchedMessages),
      },
    };

    await this.saveSession(branched);
    await this.updateIndex(branched, 'create');

    // Update parent's childSessionIds
    parent.childSessionIds.push(branched.id);
    await this.updateSession(id, { childSessionIds: parent.childSessionIds });

    return branched;
  }

  async exportSession(
    id: string,
    format: 'md' | 'json' | 'html' = 'md'
  ): Promise<string> {
    const session = await this.getSession(id);
    if (!session) throw new Error(`Session not found: ${id}`);

    switch (format) {
      case 'json':
        return JSON.stringify(session, null, 2);
      case 'html':
        return this.exportToHtml(session);
      case 'md':
      default:
        return this.exportToMarkdown(session);
    }
  }

  async archiveSession(id: string): Promise<void> {
    const session = await this.getSession(id);
    if (!session) throw new Error(`Session not found: ${id}`);

    const compressed = await gzip(JSON.stringify(session));
    const archivePath = path.join(this.archiveDir, `${id}.json.gz`);
    await fs.writeFile(archivePath, compressed);

    const sessionPath = path.join(this.sessionsDir, `${id}.json`);
    await fs.unlink(sessionPath);

    await this.updateIndex({ ...session, isArchived: true } as any, 'archive');
  }

  async getActiveSessionId(): Promise<string | null> {
    try {
      const data = await fs.readFile(this.activePath, 'utf-8');
      return JSON.parse(data).sessionId;
    } catch {
      return null;
    }
  }

  async setActiveSession(id: string): Promise<void> {
    await fs.writeFile(this.activePath, JSON.stringify({ sessionId: id }));
  }

  // Private helpers

  private async saveSession(session: Session): Promise<void> {
    const sessionPath = path.join(this.sessionsDir, `${session.id}.json`);
    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));
  }

  private async loadIndex(): Promise<void> {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      this.index = JSON.parse(data);
    } catch {
      this.index = { version: 1, sessions: [], lastUpdated: new Date() };
    }
  }

  private async updateIndex(
    session: Session,
    action: 'create' | 'update' | 'delete' | 'archive'
  ): Promise<void> {
    await this.loadIndex();
    if (!this.index) return;

    if (action === 'delete') {
      this.index.sessions = this.index.sessions.filter(s => s.id !== session.id);
    } else {
      const summary: SessionSummary = {
        id: session.id,
        name: session.name,
        messageCount: session.messages?.length || 0,
        totalCost: session.state?.totalCost || 0,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        tags: session.tags || [],
        isArchived: action === 'archive',
      };

      const existingIndex = this.index.sessions.findIndex(s => s.id === session.id);
      if (existingIndex >= 0) {
        this.index.sessions[existingIndex] = summary;
      } else {
        this.index.sessions.push(summary);
      }
    }

    this.index.lastUpdated = new Date();
    await fs.writeFile(this.indexPath, JSON.stringify(this.index, null, 2));
  }

  private async getArchivedSession(id: string): Promise<Session | null> {
    try {
      const archivePath = path.join(this.archiveDir, `${id}.json.gz`);
      const compressed = await fs.readFile(archivePath);
      const data = await gunzip(compressed);
      const session = JSON.parse(data.toString());
      // Restore Date objects
      session.createdAt = new Date(session.createdAt);
      session.updatedAt = new Date(session.updatedAt);
      session.lastAccessedAt = new Date(session.lastAccessedAt);
      session.messages.forEach((m: SessionMessage) => {
        m.timestamp = new Date(m.timestamp);
      });
      return session;
    } catch {
      return null;
    }
  }

  private exportToMarkdown(session: Session): string {
    const lines: string[] = [
      `# APEX Session: ${session.name || session.id}`,
      ``,
      `**Created:** ${session.createdAt.toISOString()}`,
      `**Last Updated:** ${session.updatedAt.toISOString()}`,
      `**Total Messages:** ${session.messages.length}`,
      `**Total Cost:** $${session.state.totalCost.toFixed(4)}`,
      ``,
      `---`,
      ``,
    ];

    for (const msg of session.messages) {
      const roleLabel = msg.role === 'user' ? '**User**' :
                       msg.role === 'assistant' ? `**Assistant${msg.agent ? ` (${msg.agent})` : ''}**` :
                       msg.role === 'system' ? '*System*' : '*Tool*';

      lines.push(`### ${roleLabel}`);
      lines.push(``);
      lines.push(msg.content);
      lines.push(``);
    }

    lines.push(`---`);
    lines.push(`*Exported from APEX on ${new Date().toISOString()}*`);

    return lines.join('\n');
  }

  private exportToHtml(session: Session): string {
    // Basic HTML export
    return `<!DOCTYPE html>
<html>
<head>
  <title>APEX Session: ${session.name || session.id}</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 0 auto; padding: 20px; }
    .message { margin: 20px 0; padding: 10px; border-radius: 8px; }
    .user { background: #e3f2fd; }
    .assistant { background: #f5f5f5; }
    .system { background: #fff3e0; font-style: italic; }
    pre { background: #263238; color: #fff; padding: 10px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>APEX Session: ${session.name || session.id}</h1>
  <p>Created: ${session.createdAt.toISOString()}</p>
  ${session.messages.map(m => `
    <div class="message ${m.role}">
      <strong>${m.role}${m.agent ? ` (${m.agent})` : ''}</strong>
      <p>${m.content.replace(/\n/g, '<br>')}</p>
    </div>
  `).join('')}
</body>
</html>`;
  }

  private calculateTokens(messages: SessionMessage[]): { input: number; output: number } {
    return messages.reduce(
      (acc, m) => ({
        input: acc.input + (m.tokens?.input || 0),
        output: acc.output + (m.tokens?.output || 0),
      }),
      { input: 0, output: 0 }
    );
  }

  private calculateCost(messages: SessionMessage[]): number {
    const tokens = this.calculateTokens(messages);
    // Approximate cost calculation (adjust rates as needed)
    const inputRate = 0.003 / 1000; // $3 per 1M input tokens
    const outputRate = 0.015 / 1000; // $15 per 1M output tokens
    return tokens.input * inputRate + tokens.output * outputRate;
  }
}