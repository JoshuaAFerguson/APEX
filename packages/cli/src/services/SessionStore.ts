import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Represents a single message within an APEX session
 * @interface SessionMessage
 */
export interface SessionMessage {
  /** Unique identifier for the message */
  id: string;
  /** Sequential index of the message within the session */
  index: number;
  /** Role of the message sender */
  role: 'user' | 'assistant' | 'system' | 'tool';
  /** Content of the message */
  content: string;
  /** Timestamp of when the message was created */
  timestamp: Date;
  /** Optional agent responsible for the message */
  agent?: string;
  /** Optional stage of the workflow */
  stage?: string;
  /** Optional task identifier associated with the message */
  taskId?: string;
  /** Optional token usage for the message */
  tokens?: { input: number; output: number };
  /** Optional tool call records associated with the message */
  toolCalls?: ToolCallRecord[];
}

/**
 * Represents a record of a tool call within a session
 * @interface ToolCallRecord
 */
export interface ToolCallRecord {
  /** Unique identifier for the tool call */
  id: string;
  /** Name of the tool that was called */
  name: string;
  /** Arguments passed to the tool */
  arguments: Record<string, unknown>;
  /** Optional result of the tool call */
  result?: unknown;
  /** Optional error message if the tool call failed */
  error?: string;
  /** Timestamp of when the tool call was made */
  timestamp: Date;
}

/**
 * Represents the state of an APEX session
 * @interface SessionState
 */
export interface SessionState {
  /** Total token usage across input and output */
  totalTokens: { input: number; output: number };
  /** Total cost of the session */
  totalCost: number;
  /** List of tasks created during the session */
  tasksCreated: string[];
  /** List of tasks completed during the session */
  tasksCompleted: string[];
  /** Current active task identifier */
  currentTaskId?: string;
  /** Last Git branch worked on during the session */
  lastGitBranch?: string;
}

/**
 * Represents a complete APEX session
 * @interface Session
 */
export interface Session {
  /** Unique identifier for the session */
  id: string;
  /** Optional name for the session */
  name?: string;
  /** Path to the project associated with the session */
  projectPath: string;
  /** Timestamp of session creation */
  createdAt: Date;
  /** Timestamp of last update */
  updatedAt: Date;
  /** Timestamp of last access */
  lastAccessedAt: Date;
  /** List of messages in the session */
  messages: SessionMessage[];
  /** History of user inputs */
  inputHistory: string[];
  /** Current state of the session */
  state: SessionState;
  /** Optional parent session identifier for branched sessions */
  parentSessionId?: string;
  /** Optional index where the session was branched from its parent */
  branchPoint?: number;
  /** List of child session identifiers */
  childSessionIds: string[];
  /** Tags associated with the session */
  tags: string[];
}

/**
 * Represents an index of all sessions
 * @interface SessionIndex
 */
export interface SessionIndex {
  /** Version of the session index */
  version: number;
  /** List of session summaries */
  sessions: SessionSummary[];
  /** Timestamp of last index update */
  lastUpdated: Date;
}

/**
 * Provides a summary of a session
 * @interface SessionSummary
 */
export interface SessionSummary {
  /** Unique identifier for the session */
  id: string;
  /** Optional name of the session */
  name?: string;
  /** Total number of messages in the session */
  messageCount: number;
  /** Total cost of the session */
  totalCost: number;
  /** Timestamp of session creation */
  createdAt: Date;
  /** Timestamp of last update */
  updatedAt: Date;
  /** Tags associated with the session */
  tags: string[];
  /** Whether the session is archived */
  isArchived: boolean;
}

export class SessionStore {
  private projectPath: string;
  private sessionsDir: string;
  private archiveDir: string;
  private indexPath: string;
  private activePath: string;
  private index: SessionIndex | null = null;

  /**
   * Constructs a SessionStore for a specific project path
   * @param {string} projectPath - The base path of the project
   */
  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.sessionsDir = path.join(projectPath, '.apex', 'sessions');
    this.archiveDir = path.join(this.sessionsDir, 'archive');
    this.indexPath = path.join(this.sessionsDir, 'index.json');
    this.activePath = path.join(this.sessionsDir, 'active.json');
  }

  /**
   * Initializes the session storage directories
   * @returns {Promise<void>} - A promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.sessionsDir, { recursive: true });
    await fs.mkdir(this.archiveDir, { recursive: true });
    await this.loadIndex();
  }

  /**
   * Creates a new session
   * @param {string} [name] - Optional name for the session
   * @returns {Promise<Session>} - The newly created session
   */
  async createSession(name?: string): Promise<Session> {
    const id = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const session: Session = {
      id,
      name,
      projectPath: this.projectPath,
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

  /**
   * Retrieves a session by its ID
   * @param {string} id - The unique identifier of the session
   * @returns {Promise<Session | null>} - The session or null if not found
   */
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

  /**
   * Updates an existing session with new data
   * @param {string} id - The unique identifier of the session
   * @param {Partial<Session>} updates - Partial update data for the session
   * @returns {Promise<void>}
   * @throws {Error} If the session is not found and cannot be updated
   */
  async updateSession(id: string, updates: Partial<Session>): Promise<void> {
    const session = await this.getSession(id);
    if (!session) {
      if (this.isFullSession(updates)) {
        const updated = { ...updates, updatedAt: new Date() };
        await this.saveSession(updated);
        await this.updateIndex(updated, 'update');
        return;
      }
      throw new Error(`Session not found: ${id}`);
    }

    const updated = { ...session, ...updates, updatedAt: new Date() };
    await this.saveSession(updated);
    await this.updateIndex(updated, 'update');
  }

  /**
   * Deletes a session permanently
   * @param {string} id - The unique identifier of the session to delete
   * @returns {Promise<void>}
   */
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

  /**
   * Lists sessions with optional filtering and pagination
   * @param {Object} [options] - Optional filtering and pagination parameters
   * @param {boolean} [options.all] - Include archived sessions
   * @param {string} [options.search] - Search query for session name or ID
   * @param {string[]} [options.tags] - Filter by tags
   * @param {number} [options.limit] - Limit the number of returned sessions
   * @returns {Promise<SessionSummary[]>} - List of session summaries
   */
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

    return options?.limit !== undefined ? sessions.slice(0, options.limit) : sessions;
  }

  /**
   * Creates a new session branched from an existing session at a specific point
   * @param {string} id - The ID of the parent session
   * @param {number} fromIndex - The index point to branch from
   * @param {string} [name] - Optional name for the new branched session
   * @returns {Promise<Session>} - The newly created branched session
   * @throws {Error} If the parent session is not found
   */
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
      name: name || `Branch from ${parent.name || parent.id}`,
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

  /**
   * Exports a session in a specified format
   * @param {string} id - The ID of the session to export
   * @param {'md' | 'json' | 'html'} [format='md'] - The export format
   * @param {string} [outputPath] - Optional output file path
   * @returns {Promise<string>} - The exported session content
   * @throws {Error} If the session is not found
   */
  async exportSession(
    id: string,
    format: 'md' | 'json' | 'html' = 'md',
    outputPath?: string
  ): Promise<string> {
    const session = await this.getSession(id);
    if (!session) throw new Error(`Session not found: ${id}`);

    let exported: string;
    switch (format) {
      case 'json':
        exported = this.exportToJson(session);
        break;
      case 'html':
        exported = this.exportToHtml(session);
        break;
      case 'md':
      default:
        exported = this.exportToMarkdown(session);
        break;
    }

    if (outputPath) {
      await fs.writeFile(outputPath, exported, 'utf-8');
    }

    return exported;
  }

  /**
   * Archives a session by compressing and moving it to the archive directory
   * @param {string} id - The ID of the session to archive
   * @returns {Promise<void>}
   * @throws {Error} If the session is not found
   */
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

  /**
   * Retrieves the ID of the currently active session
   * @returns {Promise<string | null>} - The active session ID or null
   */
  async getActiveSessionId(): Promise<string | null> {
    try {
      const data = await fs.readFile(this.activePath, 'utf-8');
      return JSON.parse(data).sessionId;
    } catch {
      return null;
    }
  }

  /**
   * Sets the currently active session
   * @param {string} id - The ID of the session to set as active
   * @returns {Promise<void>}
   */
  async setActiveSession(id: string): Promise<void> {
    await fs.mkdir(this.sessionsDir, { recursive: true });
    await fs.writeFile(this.activePath, JSON.stringify({ sessionId: id }));
  }

  // Private helpers

  private async saveSession(session: Session): Promise<void> {
    const sessionPath = path.join(this.sessionsDir, `${session.id}.json`);
    await fs.mkdir(this.sessionsDir, { recursive: true });
    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));
  }

  private isFullSession(updates: Partial<Session>): updates is Session {
    return Boolean(
      updates &&
      updates.id &&
      updates.projectPath &&
      updates.createdAt &&
      updates.updatedAt &&
      updates.lastAccessedAt &&
      updates.messages &&
      updates.inputHistory &&
      updates.state &&
      updates.childSessionIds &&
      updates.tags
    );
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
    const formatNumber = (value: number): string => value.toLocaleString('en-US');
    const formatTimestamp = (value: Date): string =>
      value.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
    const totalTokens = session.state.totalTokens.input + session.state.totalTokens.output;

    const lines: string[] = [
      `# APEX Session: ${session.name || session.id}`,
      ``,
      `**Created:** ${session.createdAt.toISOString()}`,
      `**Last Updated:** ${session.updatedAt.toISOString()}`,
      `**Total Messages:** ${session.messages.length}`,
      `**Total Cost:** $${session.state.totalCost.toFixed(4)}`,
      `**Tokens:** ${formatNumber(totalTokens)} (input: ${formatNumber(session.state.totalTokens.input)} | output: ${formatNumber(session.state.totalTokens.output)})`,
      ``,
      `---`,
      ``,
    ];

    for (const msg of session.messages) {
      const roleLabel = msg.role === 'user' ? '**User**' :
                       msg.role === 'assistant' ? `**Assistant${msg.agent ? ` (${msg.agent})` : ''}**` :
                       msg.role === 'system' ? '*System*' : '*Tool*';

      lines.push(`### ${roleLabel} *(${formatTimestamp(msg.timestamp)})*`);
      if (msg.agent || msg.stage || msg.tokens) {
        const tokenTotal = (msg.tokens?.input || 0) + (msg.tokens?.output || 0);
        const messageCost = tokenTotal * 0.001 / 1000;
        const metaParts = [
          msg.agent ? `Agent: ${msg.agent}` : null,
          msg.stage ? `Stage: ${msg.stage}` : null,
          msg.tokens ? `Tokens: ${formatNumber(tokenTotal)}` : null,
          msg.tokens ? `Cost: $${messageCost.toFixed(4)}` : null,
        ].filter(Boolean);
        lines.push(`[${metaParts.join(' | ')}]`);
      }
      lines.push(``);
      lines.push(msg.content);
      lines.push(``);
    }

    lines.push(`---`);
    lines.push(`*Exported from APEX on ${new Date().toISOString()}*`);

    return lines.join('\n');
  }

  private exportToJson(session: Session): string {
    const formatMessage = (message: SessionMessage) => {
      const tokenTotal = (message.tokens?.input || 0) + (message.tokens?.output || 0);
      const messageCost = message.tokens ? Number((tokenTotal * 0.001 / 1000).toFixed(4)) : undefined;
      const metadata = {
        agent: message.agent,
        stage: message.stage,
        tokens: message.tokens,
        cost: messageCost,
      };

      return {
        id: message.id,
        index: message.index,
        timestamp: message.timestamp.toISOString(),
        role: message.role,
        content: message.content,
        metadata: Object.values(metadata).some(value => value !== undefined) ? metadata : undefined,
      };
    };

    const exportData = {
      id: session.id,
      name: session.name,
      created: session.createdAt.toISOString(),
      lastUpdated: session.updatedAt.toISOString(),
      metadata: {
        tags: session.tags,
        parentSessionId: session.parentSessionId ?? null,
        branchCount: session.childSessionIds.length,
      },
      messages: session.messages.map(formatMessage),
      state: {
        totalTokens: session.state.totalTokens,
        totalCost: session.state.totalCost,
      },
    };

    return JSON.stringify(exportData, null, 2);
  }

  private exportToHtml(session: Session): string {
    const formatNumber = (value: number): string => value.toLocaleString('en-US');
    const formatDate = (value: Date): string =>
      value.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const totalTokens = session.state.totalTokens.input + session.state.totalTokens.output;

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
    .metadata { color: #555; font-size: 0.9em; margin: 4px 0 0; }
    pre { background: #263238; color: #fff; padding: 10px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>APEX Session: ${session.name || session.id}</h1>
  <div class="metadata">
    <p><strong>Created:</strong> ${formatDate(session.createdAt)}</p>
    <p><strong>Messages:</strong> ${session.messages.length}</p>
    <p><strong>Cost:</strong> $${session.state.totalCost.toFixed(4)}</p>
    <p><strong>Tokens:</strong> ${formatNumber(totalTokens)} (input: ${formatNumber(session.state.totalTokens.input)} | output: ${formatNumber(session.state.totalTokens.output)})</p>
  </div>
  ${session.messages.map(m => `
    <div class="message ${m.role}">
      <strong>${m.role}${m.agent ? ` (${m.agent})` : ''}</strong>
      ${m.agent || m.stage || m.tokens ? `<div class="metadata">` +
        [
          m.agent ? `Agent: ${m.agent}` : null,
          m.stage ? `Stage: ${m.stage}` : null,
          m.tokens ? `Tokens: ${formatNumber((m.tokens.input || 0) + (m.tokens.output || 0))}` : null,
          m.tokens ? `Cost: $${(((m.tokens.input || 0) + (m.tokens.output || 0)) * 0.001 / 1000).toFixed(4)}` : null,
        ].filter(Boolean).join(' | ')
      + `</div>` : ''}
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
