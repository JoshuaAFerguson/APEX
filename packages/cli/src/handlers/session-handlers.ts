/**
 * Session Command Handlers
 *
 * Extracted session command handlers for improved testability and modularity.
 * These handlers can be used directly by the REPL or tested in isolation.
 */

import * as fs from 'fs/promises';
import { formatTokens } from '@apexcli/core';
import type { InkAppInstance } from '../ui/index.js';
import { Session, SessionSummary } from '../services/SessionStore.js';

/**
 * Context interface for session handlers containing required services and state.
 */
export interface SessionContext {
  initialized: boolean;
  sessionStore: {
    listSessions: (options?: { all?: boolean; search?: string; limit?: number; tags?: string[] }) => Promise<SessionSummary[]>;
    getSession: (id: string) => Promise<Session | null>;
    deleteSession: (id: string) => Promise<void>;
    branchSession: (sessionId: string, fromIndex: number, name?: string) => Promise<Session>;
    exportSession: (sessionId: string, format: 'md' | 'json' | 'html') => Promise<string>;
    setActiveSession: (sessionId: string) => Promise<void>;
  } | null;
  sessionAutoSaver: {
    getSession: () => Session | null;
    save: () => Promise<void>;
    start: (sessionId?: string) => Promise<Session>;
    updateSessionInfo: (info: { name?: string; tags?: string[] }) => Promise<void>;
    getUnsavedChangesCount: () => number;
  } | null;
  app: InkAppInstance | null;
}

/**
 * Main session command handler that routes to specific session subcommands.
 *
 * @param args - Command arguments where first element is the subcommand (list, load, save, etc.)
 * @param ctx - Session context containing session store and app instance
 * @throws Will show error message if APEX is not initialized or session store is not available
 */
export async function handleSession(args: string[], ctx: SessionContext): Promise<void> {
  if (!ctx.initialized || !ctx.sessionStore) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'APEX not initialized. Run /init first.',
    });
    return;
  }

  const subcommand = args[0];

  switch (subcommand) {
    case 'list':
      await handleSessionList(args.slice(1), ctx);
      break;
    case 'load':
      await handleSessionLoad(args[1], ctx);
      break;
    case 'save':
      await handleSessionSave(args.slice(1), ctx);
      break;
    case 'branch':
      await handleSessionBranch(args.slice(1), ctx);
      break;
    case 'export':
      await handleSessionExport(args.slice(1), ctx);
      break;
    case 'delete':
      await handleSessionDelete(args[1], ctx);
      break;
    case 'info':
      await handleSessionInfo(ctx);
      break;
    default:
      ctx.app?.addMessage({
        type: 'error',
        content: `Unknown session command: ${subcommand || 'none'}\n\nUsage:\n  /session list [--all] [--search <query>]\n  /session load <id|name>\n  /session save <name> [--tags <tags>]\n  /session branch [<name>] [--from <index>]\n  /session export [--format md|json|html] [--output <file>]\n  /session delete <id>\n  /session info`,
      });
  }
}

/**
 * Handles the session list command to display available sessions.
 *
 * @param args - Command arguments that may include --all and --search flags
 * @param ctx - Session context containing session store and app instance
 */
export async function handleSessionList(args: string[], ctx: SessionContext): Promise<void> {
  if (!ctx.sessionStore) return;

  const all = args.includes('--all');
  const searchIndex = args.indexOf('--search');
  const search = searchIndex >= 0 ? args[searchIndex + 1] : undefined;

  const sessions = await ctx.sessionStore.listSessions({ all, search, limit: 20 });

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

/**
 * Loads a previously saved session by its ID.
 *
 * @param sessionId - The ID of the session to load
 * @param ctx - Session context containing session store and session auto-saver
 */
export async function handleSessionLoad(sessionId: string, ctx: SessionContext): Promise<void> {
  if (!ctx.sessionStore || !ctx.sessionAutoSaver || !sessionId) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'Usage: /session load <session_id>',
    });
    return;
  }

  try {
    const session = await ctx.sessionStore.getSession(sessionId);
    if (!session) {
      ctx.app?.addMessage({
        type: 'error',
        content: `Session not found: ${sessionId}`,
      });
      return;
    }

    // Save current session before switching
    await ctx.sessionAutoSaver.save();

    // Load the new session
    await ctx.sessionAutoSaver.start(sessionId);
    await ctx.sessionStore.setActiveSession(sessionId);

    ctx.app?.addMessage({
      type: 'system',
      content: `Loaded session: ${session.name || sessionId}\nMessages: ${session.messages.length}, Cost: $${session.state.totalCost.toFixed(4)}`,
    });

    // Update app state with session info
    ctx.app?.updateState({
      sessionName: session.name,
      sessionStartTime: session.lastAccessedAt,
    });

  } catch (error) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Failed to load session: ${(error as Error).message}`,
    });
  }
}

/**
 * Saves the current session with a given name and optional tags.
 *
 * @param args - Command arguments where first element is the session name, optional --tags flag
 * @param ctx - Session context containing session auto-saver
 */
export async function handleSessionSave(args: string[], ctx: SessionContext): Promise<void> {
  if (!ctx.sessionAutoSaver || !args[0]) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'Usage: /session save <name> [--tags tag1,tag2]',
    });
    return;
  }

  const name = args[0];
  const tagsIndex = args.indexOf('--tags');
  const tags = tagsIndex >= 0 ? args[tagsIndex + 1]?.split(',') || [] : [];

  try {
    await ctx.sessionAutoSaver.updateSessionInfo({ name, tags });
    await ctx.sessionAutoSaver.save();

    ctx.app?.addMessage({
      type: 'system',
      content: `Session saved as "${name}"${tags.length > 0 ? ` with tags: ${tags.join(', ')}` : ''}`,
    });

    ctx.app?.updateState({ sessionName: name });
  } catch (error) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Failed to save session: ${(error as Error).message}`,
    });
  }
}

/**
 * Creates a new session branch from the current session at a specific message index.
 *
 * @param args - Command arguments that may include branch name and --from flag
 * @param ctx - Session context containing session store and session auto-saver
 */
export async function handleSessionBranch(args: string[], ctx: SessionContext): Promise<void> {
  if (!ctx.sessionStore || !ctx.sessionAutoSaver) return;

  const currentSession = ctx.sessionAutoSaver.getSession();
  if (!currentSession) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'No active session to branch from.',
    });
    return;
  }

  const name = args[0];
  const fromIndex = args.includes('--from') ?
    parseInt(args[args.indexOf('--from') + 1], 10) :
    currentSession.messages.length - 1;

  if (isNaN(fromIndex) || fromIndex < 0 || fromIndex >= currentSession.messages.length) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Invalid message index: ${fromIndex}. Must be between 0 and ${currentSession.messages.length - 1}`,
    });
    return;
  }

  try {
    const branchedSession = await ctx.sessionStore.branchSession(
      currentSession.id,
      fromIndex,
      name
    );

    // Switch to the new branch
    await ctx.sessionAutoSaver.start(branchedSession.id);
    await ctx.sessionStore.setActiveSession(branchedSession.id);

    ctx.app?.addMessage({
      type: 'system',
      content: `Created and switched to branch: ${branchedSession.name}\nBranched from message ${fromIndex + 1} of ${currentSession.messages.length}`,
    });

    ctx.app?.updateState({
      sessionName: branchedSession.name,
      sessionStartTime: branchedSession.createdAt,
    });
  } catch (error) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Failed to create branch: ${(error as Error).message}`,
    });
  }
}

/**
 * Exports the current session to a file in the specified format (md, json, or html).
 *
 * @param args - Command arguments that may include --format and --output flags
 * @param ctx - Session context containing session store and session auto-saver
 */
export async function handleSessionExport(args: string[], ctx: SessionContext): Promise<void> {
  if (!ctx.sessionStore || !ctx.sessionAutoSaver) return;

  const currentSession = ctx.sessionAutoSaver.getSession();
  if (!currentSession) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'No active session to export.',
    });
    return;
  }

  const formatIndex = args.indexOf('--format');
  const format = (formatIndex >= 0 ? args[formatIndex + 1] : 'md') as 'md' | 'json' | 'html';

  const outputIndex = args.indexOf('--output');
  const outputFile = outputIndex >= 0 ? args[outputIndex + 1] : undefined;

  try {
    const exported = await ctx.sessionStore.exportSession(currentSession.id, format);

    if (outputFile) {
      await fs.writeFile(outputFile, exported, 'utf-8');
      ctx.app?.addMessage({
        type: 'system',
        content: `Session exported to ${outputFile} (${format.toUpperCase()} format)`,
      });
    } else {
      // Show first 500 characters as preview
      const preview = exported.length > 500 ? exported.slice(0, 500) + '...' : exported;
      ctx.app?.addMessage({
        type: 'assistant',
        content: `**Session Export (${format.toUpperCase()}):**\n\`\`\`${format}\n${preview}\n\`\`\``,
      });
    }
  } catch (error) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Failed to export session: ${(error as Error).message}`,
    });
  }
}

/**
 * Deletes a session by its ID after user confirmation.
 *
 * @param sessionId - The ID of the session to delete
 * @param ctx - Session context containing session store
 */
export async function handleSessionDelete(sessionId: string, ctx: SessionContext): Promise<void> {
  if (!ctx.sessionStore || !sessionId) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'Usage: /session delete <session_id>',
    });
    return;
  }

  try {
    const session = await ctx.sessionStore.getSession(sessionId);
    if (!session) {
      ctx.app?.addMessage({
        type: 'error',
        content: `Session not found: ${sessionId}`,
      });
      return;
    }

    await ctx.sessionStore.deleteSession(sessionId);
    ctx.app?.addMessage({
      type: 'system',
      content: `Deleted session: ${session.name || sessionId}`,
    });
  } catch (error) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Failed to delete session: ${(error as Error).message}`,
    });
  }
}

/**
 * Displays information about the current session including messages, cost, and metadata.
 *
 * @param ctx - Session context containing session auto-saver
 */
export async function handleSessionInfo(ctx: SessionContext): Promise<void> {
  if (!ctx.sessionAutoSaver) return;

  const currentSession = ctx.sessionAutoSaver.getSession();
  if (!currentSession) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'No active session.',
    });
    return;
  }

  const lines = [
    `**Current Session:**`,
    `  ID: ${currentSession.id}`,
    `  Name: ${currentSession.name || 'Unnamed'}`,
    `  Messages: ${currentSession.messages.length}`,
    `  Created: ${currentSession.createdAt.toLocaleString()}`,
    `  Updated: ${currentSession.updatedAt.toLocaleString()}`,
    `  Total Cost: $${currentSession.state.totalCost.toFixed(4)}`,
    `  Tokens: ${formatTokens(currentSession.state.totalTokens.input + currentSession.state.totalTokens.output)}`,
  ];

  if (currentSession.tags.length > 0) {
    lines.push(`  Tags: ${currentSession.tags.join(', ')}`);
  }

  if (currentSession.parentSessionId) {
    lines.push(`  Branched from: ${currentSession.parentSessionId}`);
  }

  if (currentSession.childSessionIds.length > 0) {
    lines.push(`  Branches: ${currentSession.childSessionIds.length}`);
  }

  const unsavedChanges = ctx.sessionAutoSaver.getUnsavedChangesCount();
  if (unsavedChanges > 0) {
    lines.push(`  Unsaved changes: ${unsavedChanges}`);
  }

  ctx.app?.addMessage({
    type: 'assistant',
    content: lines.join('\n'),
  });
}
