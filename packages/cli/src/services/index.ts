export { McpService } from './mcp-service';
export { CompletionEngine } from './CompletionEngine';
export { ConversationManager } from './ConversationManager';
export { SessionAutoSaver } from './SessionAutoSaver';
export { SessionStore } from './SessionStore';
export { ShortcutManager } from './ShortcutManager';

// Re-export types
export type {
  CompletionProvider,
  CompletionSuggestion,
  CompletionContext,
  CompletionFilter
} from './CompletionEngine';

export type {
  Session,
  SessionMessage,
  SessionState,
  SessionMetadata,
  ToolCallRecord
} from './SessionStore';