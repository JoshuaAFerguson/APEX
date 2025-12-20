# ADR-008: v0.3.0 Comprehensive Technical Design - Architecture Stage Output

## Status
**Implemented** (v0.3.0 Complete - December 2024)

_Previously: Accepted (Architecture Stage)_

## Executive Summary

This document provides the comprehensive technical design for APEX v0.3.0 "Claude Code-like Interactive Experience". It consolidates all previous ADRs (001-007), analyzes current implementation status, and provides detailed technical specifications for remaining features.

**Goal**: Transform APEX into a world-class AI coding assistant CLI on par with Claude Code, Codex CLI, and Gemini CLI, while maintaining APEX's unique multi-agent orchestration capabilities.

---

## 1. Implementation Status Assessment

### 1.1 Completed Components

| Component | Status | File Location |
|-----------|--------|---------------|
| Theme System | ✅ Complete | `cli/src/types/theme.ts`, `cli/src/ui/themes/` |
| Theme Context | ✅ Complete | `cli/src/ui/context/ThemeContext.tsx` |
| Streaming Text | ✅ Complete | `cli/src/ui/components/StreamingText.tsx` |
| Markdown Renderer | ✅ Complete | `cli/src/ui/components/MarkdownRenderer.tsx` |
| Diff Viewer | ✅ Complete | `cli/src/ui/components/DiffViewer.tsx` |
| Syntax Highlighter | ✅ Complete | `cli/src/ui/components/SyntaxHighlighter.tsx` |
| Progress Indicators | ✅ Complete | `cli/src/ui/components/ProgressIndicators.tsx` |
| Activity Log | ✅ Complete | `cli/src/ui/components/ActivityLog.tsx` |
| Error Display | ✅ Complete | `cli/src/ui/components/ErrorDisplay.tsx` |
| Success Celebration | ✅ Complete | `cli/src/ui/components/SuccessCelebration.tsx` |
| Intent Detector | ✅ Complete | `cli/src/ui/components/IntentDetector.tsx` |
| Advanced Input | ✅ Complete | `cli/src/ui/components/AdvancedInput.tsx` |
| Basic StatusBar | ✅ Complete | `cli/src/ui/components/StatusBar.tsx` |
| Status Components | ✅ Complete | `cli/src/ui/components/status/` |
| Ink-based REPL | ✅ Complete | `cli/src/repl.tsx`, `cli/src/ui/App.tsx` |

### 1.2 Partially Implemented Features

| Feature | Current State | Remaining Work |
|---------|---------------|----------------|
| StatusBar | Basic implementation | Add session timer, subtask progress, responsive layout |
| Tab Completion | Basic in AdvancedInput | Need full CompletionEngine with file/agent/workflow providers |
| Session Management | Not implemented | Full SessionStore, commands, auto-save |
| Multi-line Input | Partial in AdvancedInput | Need heredoc support, visual indicators |
| History Search | Basic up/down | Need Ctrl+R reverse incremental search |
| Keyboard Shortcuts | Partial (Ctrl+C, Ctrl+D) | Need full ShortcutManager with context awareness |
| Agent Visualization | Basic status | Need AgentPanel, handoff animation, parallel view |
| Conversation Manager | Not implemented | Context tracking, clarification flows |

### 1.3 Not Yet Implemented Features

| Feature | Priority | Estimated Effort |
|---------|----------|------------------|
| Session Persistence | High | 3-4 days |
| Session Commands | High | 2-3 days |
| Full CompletionEngine | High | 2-3 days |
| ShortcutManager | Medium | 2 days |
| ConversationManager | Medium | 2-3 days |
| AgentPanel & ParallelView | Medium | 2-3 days |
| SubtaskTree | Low | 1-2 days |
| Session Branching | Low | 1-2 days |
| Session Export | Low | 1 day |

---

## 2. Remaining Features Technical Design

### 2.1 Session Management System

#### 2.1.1 Session Store Architecture

**File**: `packages/cli/src/services/SessionStore.ts`

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

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

export interface SessionState {
  totalTokens: { input: number; output: number };
  totalCost: number;
  tasksCreated: string[];
  tasksCompleted: string[];
  currentTaskId?: string;
  lastGitBranch?: string;
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
      return JSON.parse(data.toString());
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
```

#### 2.1.2 Session Auto-Saver

**File**: `packages/cli/src/services/SessionAutoSaver.ts`

```typescript
import { SessionStore, Session } from './SessionStore.js';

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
    if (sessionId) {
      this.currentSession = await this.store.getSession(sessionId);
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

    const fullMessage = {
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

  onAutoSave(callback: (session: Session) => void): void {
    this.onSave = callback;
  }

  private startTimer(): void {
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
```

#### 2.1.3 Session Commands

Add to `packages/cli/src/repl.tsx`:

```typescript
// Session command handler
async function handleSession(args: string[]): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case 'list':
      await handleSessionList(args.slice(1));
      break;
    case 'load':
      await handleSessionLoad(args[1]);
      break;
    case 'save':
      await handleSessionSave(args.slice(1));
      break;
    case 'branch':
      await handleSessionBranch(args.slice(1));
      break;
    case 'export':
      await handleSessionExport(args.slice(1));
      break;
    case 'delete':
      await handleSessionDelete(args[1]);
      break;
    case 'info':
      await handleSessionInfo();
      break;
    default:
      ctx.app?.addMessage({
        type: 'error',
        content: `Unknown session command: ${subcommand}\n\nUsage:\n  /session list [--all] [--search <query>]\n  /session load <id|name>\n  /session save <name> [--tags <tags>]\n  /session branch [<name>] [--from <index>]\n  /session export [--format md|json|html] [--output <file>]\n  /session delete <id>\n  /session info`,
      });
  }
}

async function handleSessionList(args: string[]): Promise<void> {
  const all = args.includes('--all');
  const searchIndex = args.indexOf('--search');
  const search = searchIndex >= 0 ? args[searchIndex + 1] : undefined;

  const sessions = await sessionStore.listSessions({ all, search, limit: 20 });

  if (sessions.length === 0) {
    ctx.app?.addMessage({
      type: 'system',
      content: 'No sessions found.',
    });
    return;
  }

  const lines = ['**Sessions:**\n'];
  for (const session of sessions) {
    const name = session.name || 'Unnamed';
    const date = new Date(session.updatedAt).toLocaleDateString();
    const archived = session.isArchived ? ' (archived)' : '';
    lines.push(`  ${session.id.slice(0, 12)} │ ${name.padEnd(20)} │ ${session.messageCount} msgs │ $${session.totalCost.toFixed(2)} │ ${date}${archived}`);
  }

  ctx.app?.addMessage({
    type: 'assistant',
    content: lines.join('\n'),
  });
}
```

### 2.2 Completion Engine

**File**: `packages/cli/src/services/CompletionEngine.ts`

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import Fuse from 'fuse.js';

export interface CompletionProvider {
  type: 'command' | 'path' | 'agent' | 'workflow' | 'task';
  trigger: RegExp;
  priority: number;
  getSuggestions: (
    input: string,
    cursorPos: number,
    context: CompletionContext
  ) => Promise<CompletionSuggestion[]>;
}

export interface CompletionSuggestion {
  value: string;
  displayValue?: string;
  description?: string;
  type: string;
  score: number;
  icon?: string;
}

export interface CompletionContext {
  projectPath: string;
  agents: string[];
  workflows: string[];
  recentTasks: Array<{ id: string; description: string }>;
  inputHistory: string[];
}

export class CompletionEngine {
  private providers: CompletionProvider[] = [];
  private fuse: Fuse<string> | null = null;

  constructor() {
    this.registerDefaultProviders();
  }

  registerProvider(provider: CompletionProvider): void {
    this.providers.push(provider);
    this.providers.sort((a, b) => b.priority - a.priority);
  }

  async getCompletions(
    input: string,
    cursorPos: number,
    context: CompletionContext
  ): Promise<CompletionSuggestion[]> {
    const results: CompletionSuggestion[] = [];
    const inputBeforeCursor = input.slice(0, cursorPos);

    for (const provider of this.providers) {
      if (provider.trigger.test(inputBeforeCursor)) {
        try {
          const suggestions = await provider.getSuggestions(
            inputBeforeCursor,
            cursorPos,
            context
          );
          results.push(...suggestions);
        } catch (error) {
          console.error(`Completion provider ${provider.type} failed:`, error);
        }
      }
    }

    // Deduplicate and sort by score
    const seen = new Set<string>();
    return results
      .filter(s => {
        if (seen.has(s.value)) return false;
        seen.add(s.value);
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
  }

  private registerDefaultProviders(): void {
    // Command completion
    this.registerProvider({
      type: 'command',
      trigger: /^\//,
      priority: 100,
      async getSuggestions(input) {
        const commands = [
          { name: '/help', desc: 'Show help', icon: '?' },
          { name: '/status', desc: 'Task status', icon: '📊' },
          { name: '/agents', desc: 'List agents', icon: '🤖' },
          { name: '/workflows', desc: 'List workflows', icon: '⚙️' },
          { name: '/config', desc: 'Configuration', icon: '🔧' },
          { name: '/session', desc: 'Session management', icon: '💾' },
          { name: '/logs', desc: 'Task logs', icon: '📝' },
          { name: '/cancel', desc: 'Cancel task', icon: '❌' },
          { name: '/retry', desc: 'Retry task', icon: '🔄' },
          { name: '/serve', desc: 'Start API', icon: '🌐' },
          { name: '/web', desc: 'Start Web UI', icon: '🖥️' },
          { name: '/clear', desc: 'Clear screen', icon: '🧹' },
          { name: '/exit', desc: 'Exit APEX', icon: '👋' },
          { name: '/theme', desc: 'Change theme', icon: '🎨' },
          { name: '/compact', desc: 'Toggle compact mode', icon: '📦' },
          { name: '/verbose', desc: 'Toggle verbose mode', icon: '📢' },
        ];

        const query = input.toLowerCase();
        return commands
          .filter(c => c.name.toLowerCase().startsWith(query))
          .map(c => ({
            value: c.name,
            displayValue: c.name,
            description: c.desc,
            type: 'command',
            score: c.name === input ? 100 : 80,
            icon: c.icon,
          }));
      },
    });

    // File path completion
    this.registerProvider({
      type: 'path',
      trigger: /(\s|^)(\.\/|\/|~\/|\.\.\/|\w+\/)/,
      priority: 80,
      async getSuggestions(input, cursorPos, context) {
        const match = input.match(/([\w.\/~-]+)$/);
        if (!match) return [];

        const prefix = match[1];
        let dir = path.dirname(prefix);
        const base = path.basename(prefix);

        // Resolve path
        if (dir.startsWith('~')) {
          dir = dir.replace('~', os.homedir());
        } else if (!path.isAbsolute(dir)) {
          dir = path.resolve(context.projectPath, dir);
        }

        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });

          return entries
            .filter(e => e.name.startsWith(base) && !e.name.startsWith('.'))
            .map(e => {
              const isDir = e.isDirectory();
              const fullPath = path.join(
                prefix.startsWith('~') ? '~' : prefix.startsWith('/') ? '/' : '',
                path.dirname(prefix.replace(/^[~\/]/, '')),
                e.name
              );

              return {
                value: fullPath + (isDir ? '/' : ''),
                displayValue: e.name + (isDir ? '/' : ''),
                description: isDir ? 'Directory' : 'File',
                type: isDir ? 'directory' : 'file',
                score: e.name === base ? 100 : 70,
                icon: isDir ? '📁' : '📄',
              };
            })
            .slice(0, 20);
        } catch {
          return [];
        }
      },
    });

    // Agent completion (@agent)
    this.registerProvider({
      type: 'agent',
      trigger: /@\w*/,
      priority: 90,
      async getSuggestions(input, cursorPos, context) {
        const match = input.match(/@(\w*)$/);
        if (!match) return [];

        const prefix = match[1].toLowerCase();
        const agentInfo: Record<string, string> = {
          planner: 'Creates implementation plans',
          architect: 'Designs system architecture',
          developer: 'Writes production code',
          reviewer: 'Reviews code quality',
          tester: 'Creates and runs tests',
          devops: 'Handles infrastructure',
        };

        return context.agents
          .filter(a => a.toLowerCase().startsWith(prefix))
          .map(a => ({
            value: `@${a}`,
            displayValue: `@${a}`,
            description: agentInfo[a] || `Agent: ${a}`,
            type: 'agent',
            score: a.toLowerCase() === prefix ? 100 : 85,
            icon: '🤖',
          }));
      },
    });

    // Workflow completion (--workflow)
    this.registerProvider({
      type: 'workflow',
      trigger: /--workflow\s+\w*/,
      priority: 85,
      async getSuggestions(input, cursorPos, context) {
        const match = input.match(/--workflow\s+(\w*)$/);
        if (!match) return [];

        const prefix = match[1].toLowerCase();
        const workflowInfo: Record<string, string> = {
          feature: 'Full feature implementation',
          bugfix: 'Bug investigation and fix',
          refactor: 'Code refactoring',
        };

        return context.workflows
          .filter(w => w.toLowerCase().startsWith(prefix))
          .map(w => ({
            value: w,
            displayValue: w,
            description: workflowInfo[w] || `Workflow: ${w}`,
            type: 'workflow',
            score: w.toLowerCase() === prefix ? 100 : 85,
            icon: '⚙️',
          }));
      },
    });

    // Task ID completion
    this.registerProvider({
      type: 'task',
      trigger: /task_\w*/,
      priority: 75,
      async getSuggestions(input, cursorPos, context) {
        const match = input.match(/(task_[\w]*)$/);
        if (!match) return [];

        const prefix = match[1].toLowerCase();

        return context.recentTasks
          .filter(t => t.id.toLowerCase().startsWith(prefix))
          .map(t => ({
            value: t.id,
            displayValue: t.id.slice(0, 16),
            description: t.description.slice(0, 50),
            type: 'task',
            score: 75,
            icon: '📋',
          }))
          .slice(0, 10);
      },
    });
  }
}
```

### 2.3 Shortcut Manager

**File**: `packages/cli/src/services/ShortcutManager.ts`

```typescript
export interface KeyCombination {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export interface KeyboardShortcut {
  id: string;
  description: string;
  keys: KeyCombination;
  action: ShortcutAction;
  context?: ShortcutContext;
  enabled?: () => boolean;
}

export type ShortcutAction =
  | { type: 'command'; command: string }
  | { type: 'function'; handler: () => void | Promise<void> }
  | { type: 'emit'; event: string; payload?: unknown };

export type ShortcutContext =
  | 'global'
  | 'input'
  | 'processing'
  | 'idle'
  | 'suggestions'
  | 'history'
  | 'modal';

export interface ShortcutEvent {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export class ShortcutManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private contextStack: ShortcutContext[] = ['global'];
  private eventHandlers: Map<string, Set<(payload?: unknown) => void>> = new Map();

  constructor() {
    this.registerDefaultShortcuts();
  }

  register(shortcut: KeyboardShortcut): void {
    this.shortcuts.set(shortcut.id, shortcut);
  }

  unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  pushContext(ctx: ShortcutContext): void {
    this.contextStack.push(ctx);
  }

  popContext(): ShortcutContext | undefined {
    if (this.contextStack.length > 1) {
      return this.contextStack.pop();
    }
    return undefined;
  }

  getCurrentContext(): ShortcutContext {
    return this.contextStack[this.contextStack.length - 1] || 'global';
  }

  handleKey(event: ShortcutEvent): boolean {
    const currentContext = this.getCurrentContext();

    for (const shortcut of this.shortcuts.values()) {
      // Check if enabled
      if (shortcut.enabled && !shortcut.enabled()) continue;

      // Check context
      if (shortcut.context &&
          shortcut.context !== 'global' &&
          shortcut.context !== currentContext) {
        continue;
      }

      // Check key combination
      if (this.matchesKey(event, shortcut.keys)) {
        this.executeAction(shortcut.action);
        return true;
      }
    }

    return false;
  }

  on(event: string, handler: (payload?: unknown) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: (payload?: unknown) => void): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  getShortcutsForContext(ctx: ShortcutContext): KeyboardShortcut[] {
    return this.getShortcuts().filter(
      s => !s.context || s.context === 'global' || s.context === ctx
    );
  }

  formatKey(keys: KeyCombination): string {
    const parts: string[] = [];
    if (keys.ctrl) parts.push('Ctrl');
    if (keys.alt) parts.push('Alt');
    if (keys.shift) parts.push('Shift');
    if (keys.meta) parts.push('Cmd');
    parts.push(keys.key.toUpperCase());
    return parts.join('+');
  }

  private matchesKey(event: ShortcutEvent, keys: KeyCombination): boolean {
    return (
      event.key.toLowerCase() === keys.key.toLowerCase() &&
      !!event.ctrl === !!keys.ctrl &&
      !!event.alt === !!keys.alt &&
      !!event.shift === !!keys.shift &&
      !!event.meta === !!keys.meta
    );
  }

  private executeAction(action: ShortcutAction): void {
    switch (action.type) {
      case 'function':
        action.handler();
        break;
      case 'emit':
        this.emit(action.event, action.payload);
        break;
      case 'command':
        this.emit('command', action.command);
        break;
    }
  }

  private emit(event: string, payload?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(payload);
      }
    }
  }

  private registerDefaultShortcuts(): void {
    const defaults: KeyboardShortcut[] = [
      {
        id: 'cancel',
        description: 'Cancel current operation',
        keys: { key: 'c', ctrl: true },
        action: { type: 'emit', event: 'cancel' },
        context: 'processing',
      },
      {
        id: 'exit',
        description: 'Exit APEX',
        keys: { key: 'd', ctrl: true },
        action: { type: 'emit', event: 'exit' },
        context: 'global',
      },
      {
        id: 'clear',
        description: 'Clear screen',
        keys: { key: 'l', ctrl: true },
        action: { type: 'emit', event: 'clear' },
        context: 'global',
      },
      {
        id: 'clearLine',
        description: 'Clear current line',
        keys: { key: 'u', ctrl: true },
        action: { type: 'emit', event: 'clearLine' },
        context: 'input',
      },
      {
        id: 'deleteWord',
        description: 'Delete word',
        keys: { key: 'w', ctrl: true },
        action: { type: 'emit', event: 'deleteWord' },
        context: 'input',
      },
      {
        id: 'historySearch',
        description: 'Search history',
        keys: { key: 'r', ctrl: true },
        action: { type: 'emit', event: 'historySearch' },
        context: 'input',
      },
      {
        id: 'previousHistory',
        description: 'Previous history entry',
        keys: { key: 'p', ctrl: true },
        action: { type: 'emit', event: 'historyPrev' },
        context: 'input',
      },
      {
        id: 'nextHistory',
        description: 'Next history entry',
        keys: { key: 'n', ctrl: true },
        action: { type: 'emit', event: 'historyNext' },
        context: 'input',
      },
      {
        id: 'complete',
        description: 'Complete suggestion',
        keys: { key: 'Tab' },
        action: { type: 'emit', event: 'complete' },
        context: 'input',
      },
      {
        id: 'dismiss',
        description: 'Dismiss suggestions/modal',
        keys: { key: 'Escape' },
        action: { type: 'emit', event: 'dismiss' },
        context: 'global',
      },
      {
        id: 'newline',
        description: 'Insert newline (multi-line mode)',
        keys: { key: 'Enter', shift: true },
        action: { type: 'emit', event: 'newline' },
        context: 'input',
      },
      {
        id: 'submit',
        description: 'Submit input',
        keys: { key: 'Enter' },
        action: { type: 'emit', event: 'submit' },
        context: 'input',
      },
      {
        id: 'beginningOfLine',
        description: 'Move to beginning of line',
        keys: { key: 'a', ctrl: true },
        action: { type: 'emit', event: 'moveCursor', payload: 'home' },
        context: 'input',
      },
      {
        id: 'endOfLine',
        description: 'Move to end of line',
        keys: { key: 'e', ctrl: true },
        action: { type: 'emit', event: 'moveCursor', payload: 'end' },
        context: 'input',
      },
    ];

    for (const shortcut of defaults) {
      this.register(shortcut);
    }
  }
}
```

### 2.4 Conversation Manager

**File**: `packages/cli/src/services/ConversationManager.ts`

```typescript
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ConversationContext {
  messages: ConversationMessage[];
  pendingClarification?: {
    question: string;
    options?: string[];
    type: 'confirm' | 'choice' | 'freeform';
  };
  currentTaskId?: string;
  activeAgent?: string;
  workflowStage?: string;
}

export interface ClarificationRequest {
  question: string;
  options?: string[];
  type: 'confirm' | 'choice' | 'freeform';
}

export class ConversationManager {
  private context: ConversationContext = { messages: [] };
  private maxContextMessages = 100;
  private maxContextTokens = 50000; // Approximate limit

  addMessage(message: Omit<ConversationMessage, 'timestamp'>): void {
    this.context.messages.push({
      ...message,
      timestamp: new Date(),
    });

    // Prune if necessary
    this.pruneContext();
  }

  getContext(): ConversationContext {
    return { ...this.context };
  }

  getRecentMessages(count: number = 10): ConversationMessage[] {
    return this.context.messages.slice(-count);
  }

  setTask(taskId: string): void {
    this.context.currentTaskId = taskId;
  }

  clearTask(): void {
    this.context.currentTaskId = undefined;
  }

  setAgent(agent: string): void {
    this.context.activeAgent = agent;
  }

  clearAgent(): void {
    this.context.activeAgent = undefined;
  }

  setWorkflowStage(stage: string): void {
    this.context.workflowStage = stage;
  }

  requestClarification(request: ClarificationRequest): void {
    this.context.pendingClarification = request;
    this.addMessage({
      role: 'system',
      content: this.formatClarificationRequest(request),
    });
  }

  provideClarification(response: string): {
    matched: boolean;
    value?: string | boolean;
    index?: number;
  } {
    const pending = this.context.pendingClarification;
    if (!pending) return { matched: false };

    this.context.pendingClarification = undefined;
    this.addMessage({ role: 'user', content: response });

    const normalized = response.toLowerCase().trim();

    if (pending.type === 'confirm') {
      const affirmative = ['yes', 'y', 'yeah', 'yep', 'sure', 'ok', 'okay', 'true', '1'];
      const negative = ['no', 'n', 'nope', 'nah', 'cancel', 'abort', 'false', '0'];

      if (affirmative.includes(normalized)) {
        return { matched: true, value: true };
      }
      if (negative.includes(normalized)) {
        return { matched: true, value: false };
      }
      return { matched: false };
    }

    if (pending.type === 'choice' && pending.options) {
      // Try to match by number
      const num = parseInt(normalized, 10);
      if (!isNaN(num) && num >= 1 && num <= pending.options.length) {
        return { matched: true, value: pending.options[num - 1], index: num - 1 };
      }

      // Try to match by text
      const matchIndex = pending.options.findIndex(
        opt => opt.toLowerCase() === normalized
      );
      if (matchIndex >= 0) {
        return { matched: true, value: pending.options[matchIndex], index: matchIndex };
      }

      // Fuzzy match
      const fuzzyIndex = pending.options.findIndex(
        opt => opt.toLowerCase().includes(normalized) || normalized.includes(opt.toLowerCase())
      );
      if (fuzzyIndex >= 0) {
        return { matched: true, value: pending.options[fuzzyIndex], index: fuzzyIndex };
      }

      return { matched: false };
    }

    // Freeform - always matches
    return { matched: true, value: response };
  }

  hasPendingClarification(): boolean {
    return this.context.pendingClarification !== undefined;
  }

  clearContext(): void {
    this.context = { messages: [] };
  }

  summarizeContext(): string {
    if (this.context.messages.length === 0) {
      return 'No conversation history.';
    }

    const recentMessages = this.getRecentMessages(5);
    const summary = recentMessages
      .map(m => `${m.role}: ${m.content.slice(0, 100)}...`)
      .join('\n');

    return `Recent conversation (${this.context.messages.length} total messages):\n${summary}`;
  }

  private formatClarificationRequest(request: ClarificationRequest): string {
    let message = request.question;

    if (request.type === 'confirm') {
      message += '\n(yes/no)';
    } else if (request.type === 'choice' && request.options) {
      message += '\n' + request.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
    }

    return message;
  }

  private pruneContext(): void {
    // Remove oldest messages if over limit
    while (this.context.messages.length > this.maxContextMessages) {
      this.context.messages.shift();
    }

    // Estimate tokens (rough: 4 chars = 1 token)
    let estimatedTokens = this.context.messages.reduce(
      (sum, m) => sum + Math.ceil(m.content.length / 4),
      0
    );

    while (estimatedTokens > this.maxContextTokens && this.context.messages.length > 10) {
      const removed = this.context.messages.shift();
      if (removed) {
        estimatedTokens -= Math.ceil(removed.content.length / 4);
      }
    }
  }
}
```

---

## 3. Enhanced StatusBar Design

### 3.1 Full StatusBar Implementation

**File**: `packages/cli/src/ui/components/StatusBar.tsx` (enhanced)

```typescript
import React, { useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';

export interface StatusBarProps {
  gitBranch?: string;
  tokens?: { input: number; output: number };
  cost?: number;
  sessionCost?: number;
  model?: string;
  agent?: string;
  workflowStage?: string;
  isConnected?: boolean;
  apiUrl?: string;
  webUrl?: string;
  sessionStartTime?: Date;
  subtaskProgress?: { completed: number; total: number };
  sessionName?: string;
}

export function StatusBar(props: StatusBarProps): React.ReactElement {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns || 120;

  // Session timer
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    if (!props.sessionStartTime) return;

    const updateTimer = () => {
      const diff = Date.now() - props.sessionStartTime!.getTime();
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setElapsed(
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [props.sessionStartTime]);

  // Calculate what fits in terminal width
  const segments = buildSegments(props, elapsed, terminalWidth);

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      width={terminalWidth}
      justifyContent="space-between"
    >
      <Box gap={2}>
        {segments.left.map((seg, i) => (
          <Text key={i}>
            <Text color={seg.iconColor}>{seg.icon}</Text>
            <Text color={seg.valueColor}>{seg.value}</Text>
          </Text>
        ))}
      </Box>

      <Box gap={2}>
        {segments.right.map((seg, i) => (
          <Text key={i}>
            <Text color={seg.labelColor || 'gray'}>{seg.label}</Text>
            <Text color={seg.valueColor}>{seg.value}</Text>
          </Text>
        ))}
      </Box>
    </Box>
  );
}

interface Segment {
  icon?: string;
  iconColor?: string;
  label?: string;
  labelColor?: string;
  value: string;
  valueColor: string;
  minWidth: number;
}

function buildSegments(
  props: StatusBarProps,
  elapsed: string,
  terminalWidth: number
): { left: Segment[]; right: Segment[] } {
  const left: Segment[] = [];
  const right: Segment[] = [];

  // Left side segments
  left.push({
    icon: props.isConnected !== false ? '●' : '○',
    iconColor: props.isConnected !== false ? 'green' : 'red',
    value: '',
    valueColor: 'white',
    minWidth: 2,
  });

  if (props.gitBranch) {
    left.push({
      icon: '',
      iconColor: 'cyan',
      value: props.gitBranch,
      valueColor: 'yellow',
      minWidth: props.gitBranch.length + 3,
    });
  }

  if (props.agent) {
    left.push({
      icon: '⚡',
      iconColor: 'magenta',
      value: props.agent,
      valueColor: 'white',
      minWidth: props.agent.length + 2,
    });
  }

  if (props.workflowStage) {
    left.push({
      icon: '▶',
      iconColor: 'blue',
      value: props.workflowStage,
      valueColor: 'gray',
      minWidth: props.workflowStage.length + 2,
    });
  }

  if (props.subtaskProgress && props.subtaskProgress.total > 0) {
    const { completed, total } = props.subtaskProgress;
    left.push({
      icon: '📋',
      iconColor: 'cyan',
      value: `[${completed}/${total}]`,
      valueColor: completed === total ? 'green' : 'yellow',
      minWidth: 8,
    });
  }

  if (props.apiUrl) {
    left.push({
      label: 'api:',
      labelColor: 'gray',
      value: props.apiUrl.replace('http://localhost:', ''),
      valueColor: 'green',
      minWidth: 10,
    });
  }

  if (props.webUrl) {
    left.push({
      label: 'web:',
      labelColor: 'gray',
      value: props.webUrl.replace('http://localhost:', ''),
      valueColor: 'green',
      minWidth: 10,
    });
  }

  // Right side segments
  right.push({
    label: '',
    value: elapsed,
    valueColor: 'gray',
    minWidth: 6,
  });

  if (props.tokens) {
    const total = props.tokens.input + props.tokens.output;
    right.push({
      label: 'tokens:',
      labelColor: 'gray',
      value: formatTokens(total),
      valueColor: 'cyan',
      minWidth: 14,
    });
  }

  if (props.cost !== undefined) {
    right.push({
      label: 'cost:',
      labelColor: 'gray',
      value: `$${props.cost.toFixed(4)}`,
      valueColor: 'green',
      minWidth: 12,
    });
  }

  if (props.model) {
    right.push({
      label: 'model:',
      labelColor: 'gray',
      value: props.model,
      valueColor: 'blue',
      minWidth: props.model.length + 7,
    });
  }

  // Filter segments based on available width
  const minLeftWidth = left.reduce((sum, s) => sum + s.minWidth + 1, 0);
  const minRightWidth = right.reduce((sum, s) => sum + s.minWidth + 1, 0);
  const padding = 6; // Border and spacing

  if (minLeftWidth + minRightWidth + padding > terminalWidth) {
    // Remove lower priority segments from left side
    while (left.length > 3 &&
           left.reduce((sum, s) => sum + s.minWidth + 1, 0) +
           right.reduce((sum, s) => sum + s.minWidth + 1, 0) +
           padding > terminalWidth) {
      // Remove services first, then stage, keeping branch and agent
      if (left.length > 3) {
        left.splice(left.length - 1, 1);
      }
    }
  }

  return { left, right };
}

function formatTokens(total: number): string {
  if (total >= 1000000) {
    return `${(total / 1000000).toFixed(1)}M`;
  } else if (total >= 1000) {
    return `${(total / 1000).toFixed(1)}k`;
  }
  return total.toString();
}
```

---

## 4. Agent Visualization Components

### 4.1 Agent Panel

**File**: `packages/cli/src/ui/components/agents/AgentPanel.tsx`

```typescript
import React from 'react';
import { Box, Text } from 'ink';

export interface AgentInfo {
  name: string;
  status: 'active' | 'waiting' | 'completed' | 'idle';
  stage?: string;
  progress?: number; // 0-100
}

export interface AgentPanelProps {
  agents: AgentInfo[];
  currentAgent?: string;
  compact?: boolean;
}

const agentColors: Record<string, string> = {
  planner: 'magenta',
  architect: 'blue',
  developer: 'green',
  reviewer: 'yellow',
  tester: 'cyan',
  devops: 'red',
};

const statusIcons: Record<AgentInfo['status'], string> = {
  active: '⚡',
  waiting: '○',
  completed: '✓',
  idle: '·',
};

export function AgentPanel({
  agents,
  currentAgent,
  compact = false,
}: AgentPanelProps): React.ReactElement {
  if (compact) {
    // Single line: ⚡developer | ○tester | ○reviewer
    return (
      <Box>
        {agents.map((agent, index) => (
          <React.Fragment key={agent.name}>
            <Text color={agent.name === currentAgent ? agentColors[agent.name] : 'gray'}>
              {statusIcons[agent.status]}
              {agent.name}
            </Text>
            {index < agents.length - 1 && <Text color="gray"> │ </Text>}
          </React.Fragment>
        ))}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      <Text color="cyan" bold>
        Active Agents
      </Text>
      <Box marginTop={1} flexDirection="column">
        {agents.map(agent => (
          <AgentRow
            key={agent.name}
            agent={agent}
            isActive={agent.name === currentAgent}
          />
        ))}
      </Box>
    </Box>
  );
}

function AgentRow({
  agent,
  isActive,
}: {
  agent: AgentInfo;
  isActive: boolean;
}): React.ReactElement {
  const color = agentColors[agent.name] || 'white';

  return (
    <Box>
      <Text color={isActive ? color : 'gray'}>
        {statusIcons[agent.status]}{' '}
      </Text>
      <Text color={isActive ? color : 'gray'} bold={isActive}>
        {agent.name}
      </Text>
      {agent.stage && (
        <Text color="gray" dimColor>
          {' '}({agent.stage})
        </Text>
      )}
      {agent.progress !== undefined && agent.progress > 0 && agent.progress < 100 && (
        <Text color="gray">
          {' '}{agent.progress}%
        </Text>
      )}
    </Box>
  );
}
```

### 4.2 Subtask Tree

**File**: `packages/cli/src/ui/components/agents/SubtaskTree.tsx`

```typescript
import React from 'react';
import { Box, Text } from 'ink';

export interface SubtaskNode {
  id: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  children?: SubtaskNode[];
}

export interface SubtaskTreeProps {
  task: SubtaskNode;
  maxDepth?: number;
  collapsed?: boolean;
}

const statusIcons: Record<SubtaskNode['status'], { icon: string; color: string }> = {
  pending: { icon: '○', color: 'gray' },
  'in-progress': { icon: '●', color: 'blue' },
  completed: { icon: '✓', color: 'green' },
  failed: { icon: '✗', color: 'red' },
};

export function SubtaskTree({
  task,
  maxDepth = 3,
  collapsed = false,
}: SubtaskTreeProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <SubtaskNodeRow node={task} depth={0} maxDepth={maxDepth} isLast={true} />
    </Box>
  );
}

function SubtaskNodeRow({
  node,
  depth,
  maxDepth,
  isLast,
  prefix = '',
}: {
  node: SubtaskNode;
  depth: number;
  maxDepth: number;
  isLast: boolean;
  prefix?: string;
}): React.ReactElement {
  const { icon, color } = statusIcons[node.status];
  const connector = isLast ? '└── ' : '├── ';
  const childPrefix = prefix + (isLast ? '    ' : '│   ');

  const truncatedDesc = node.description.length > 50
    ? node.description.slice(0, 47) + '...'
    : node.description;

  return (
    <>
      <Box>
        <Text color="gray">{prefix}{depth > 0 ? connector : ''}</Text>
        <Text color={color}>[{icon}]</Text>
        <Text color={node.status === 'in-progress' ? 'white' : 'gray'}>
          {' '}{truncatedDesc}
        </Text>
      </Box>

      {node.children && depth < maxDepth && (
        <>
          {node.children.map((child, index) => (
            <SubtaskNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              maxDepth={maxDepth}
              isLast={index === node.children!.length - 1}
              prefix={childPrefix}
            />
          ))}
        </>
      )}

      {node.children && depth >= maxDepth && node.children.length > 0 && (
        <Box>
          <Text color="gray">{childPrefix}└── </Text>
          <Text color="gray" italic>
            ... {node.children.length} more subtasks
          </Text>
        </Box>
      )}
    </>
  );
}
```

---

## 5. Configuration Schema Updates

Add to `packages/core/src/types.ts`:

```typescript
export const CLIConfigSchema = z.object({
  theme: z.enum(['dark', 'light']).optional().default('dark'),
  streaming: z.object({
    enabled: z.boolean().optional().default(true),
    speed: z.enum(['slow', 'normal', 'fast', 'instant']).optional().default('normal'),
  }).optional(),
  session: z.object({
    persistence: z.boolean().optional().default(true),
    autoSave: z.boolean().optional().default(true),
    autoSaveInterval: z.number().optional().default(30000),
    maxMessages: z.number().optional().default(1000),
  }).optional(),
  completion: z.object({
    enabled: z.boolean().optional().default(true),
    debounceMs: z.number().optional().default(150),
    maxSuggestions: z.number().optional().default(15),
  }).optional(),
  display: z.object({
    compact: z.boolean().optional().default(false),
    verbose: z.boolean().optional().default(false),
    showThinking: z.boolean().optional().default(true),
  }).optional(),
  shortcuts: z.record(z.string()).optional(),
});

export type CLIConfig = z.infer<typeof CLIConfigSchema>;
```

---

## 6. Implementation Priority & Timeline

### Phase 1: Session Management (Week 1) - HIGH PRIORITY
1. SessionStore implementation
2. SessionAutoSaver implementation
3. Session commands (/session list, load, save, info)
4. Integration with existing REPL

### Phase 2: Input Enhancement (Week 2) - HIGH PRIORITY
1. CompletionEngine with all providers
2. Integration with AdvancedInput component
3. History search (Ctrl+R) enhancement
4. Multi-line input with heredoc

### Phase 3: Shortcuts & Context (Week 3) - MEDIUM PRIORITY
1. ShortcutManager implementation
2. ConversationManager implementation
3. Integration with UI components
4. Context-aware shortcuts

### Phase 4: Agent Visualization (Week 4) - MEDIUM PRIORITY
1. AgentPanel component
2. SubtaskTree component
3. Integration with orchestrator events
4. StatusBar enhancements (subtask progress)

### Phase 5: Polish & Testing (Week 5) - HIGH PRIORITY
1. Session branching & export
2. Comprehensive test coverage
3. Documentation updates
4. Performance optimization

---

## 7. Testing Requirements

### Unit Tests
- `SessionStore`: CRUD operations, archiving, indexing
- `CompletionEngine`: Provider matching, suggestion sorting
- `ShortcutManager`: Key matching, context handling
- `ConversationManager`: Message tracking, clarification flow

### Integration Tests
- Full session lifecycle
- Completion with file system access
- Shortcut handling in different contexts

### E2E Tests
- REPL startup with session recovery
- Natural language task execution
- Session export

### Coverage Targets
- Services: 90%+
- Components: 80%+
- Hooks: 85%+

---

## 8. References

- ADR-001: Rich Terminal UI Architecture
- ADR-002: Natural Language Interface
- ADR-003: Session Management
- ADR-004: Keyboard Shortcuts System
- ADR-005: Implementation Architecture
- ADR-006: Feature Development Guide
- ADR-007: Technical Design Summary
- `docs/v030-implementation-plan.md`
- `ROADMAP.md`
