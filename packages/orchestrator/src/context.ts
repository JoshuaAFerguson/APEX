/**
 * Context compaction strategies for managing conversation history
 *
 * These utilities help reduce token usage in long-running tasks by:
 * 1. Summarizing older messages
 * 2. Truncating large tool results
 * 3. Pruning redundant information
 */

import type { AgentMessage, AgentContentBlock } from '@apexcli/core';

// ============================================================================
// Enhanced Context Summary Types
// ============================================================================

/**
 * Represents a key decision made during conversation
 */
export interface KeyDecision {
  /** Decision content text */
  text: string;
  /** Message index where decision was found */
  messageIndex: number;
  /** Confidence level of decision detection (0-1) */
  confidence: number;
  /** Category of decision */
  category: 'implementation' | 'architecture' | 'approach' | 'workflow' | 'other';
}

/**
 * Represents progress tracking information
 */
export interface ProgressInfo {
  /** Completed stages/steps */
  completed: string[];
  /** Current active stage/step */
  current?: string;
  /** Overall progress percentage (0-100) */
  percentage: number;
  /** Last activity timestamp */
  lastActivity?: Date;
}

/**
 * Enhanced file modification tracking
 */
export interface FileModification {
  /** File path */
  path: string;
  /** Type of action performed */
  action: 'read' | 'write' | 'edit' | 'create' | 'delete';
  /** Number of times this action was performed */
  count: number;
  /** Last message index where action occurred */
  lastMessageIndex: number;
}

/**
 * Structured context summary containing enhanced information
 */
export interface ContextSummaryData {
  /** Basic conversation metrics */
  metrics: {
    messageCount: number;
    userRequestCount: number;
    toolUsageCount: number;
  };
  /** Key decisions extracted from conversation */
  keyDecisions: KeyDecision[];
  /** Progress tracking information */
  progress: ProgressInfo;
  /** Enhanced file modification tracking */
  fileModifications: FileModification[];
  /** Tools used with frequency */
  toolsUsed: Record<string, number>;
  /** Recent user requests (last 3) */
  recentRequests: string[];
}

/**
 * Configuration options for conversation compaction
 */
export interface ContextCompactionOptions {
  /** Maximum tokens to keep in context (approximate) */
  maxTokens?: number;
  /** Maximum messages to keep in full detail */
  maxRecentMessages?: number;
  /** Maximum characters for tool results */
  maxToolResultLength?: number;
  /** Whether to summarize older messages */
  summarizeOlder?: boolean;
  /** Keep only the last N tool results in full */
  keepLastNToolResults?: number;
}

const DEFAULT_OPTIONS: ContextCompactionOptions = {
  maxTokens: 100000,
  maxRecentMessages: 10,
  maxToolResultLength: 5000,
  summarizeOlder: true,
  keepLastNToolResults: 5,
};

// ============================================================================
// Enhanced Context Analysis Functions
// ============================================================================

/**
 * Decision extraction patterns with confidence scoring
 */
const DECISION_PATTERNS = [
  // High confidence patterns
  { pattern: /(?:I will|I'll|I'm going to|I've decided to|Let me|I plan to)\s+(.{1,150})/gi, confidence: 0.9, category: 'implementation' as const },
  { pattern: /(?:decided to|choosing|opted for|selected|going with)\s+(.{1,100})/gi, confidence: 0.85, category: 'approach' as const },
  { pattern: /(?:implementing|building|creating|developing)\s+(.{1,100})/gi, confidence: 0.8, category: 'implementation' as const },

  // Medium confidence patterns
  { pattern: /(?:approach|strategy|solution|method)\s+(?:will be|is|involves)\s+(.{1,100})/gi, confidence: 0.7, category: 'architecture' as const },
  { pattern: /(?:using|utilizing|employing)\s+(.{1,80})\s+(?:for|to|because)/gi, confidence: 0.65, category: 'approach' as const },
  { pattern: /(?:workflow|process|steps)\s+(?:will|should)\s+(.{1,100})/gi, confidence: 0.6, category: 'workflow' as const },

  // Lower confidence patterns
  { pattern: /(?:think|believe|suggest|recommend)\s+(?:we should|to)\s+(.{1,80})/gi, confidence: 0.5, category: 'other' as const }
];

/**
 * Progress tracking patterns
 */
const PROGRESS_PATTERNS = [
  /(?:completed|finished|done with)\s+(.{1,50})/gi,
  /(?:currently|now|next)\s+(?:working on|implementing|building)\s+(.{1,50})/gi,
  /(?:stage|phase|step)\s+(\d+|\w+)\s+(?:completed|finished|done)/gi,
  /(?:progress|status):\s*(.{1,100})/gi
];

/**
 * Extract key decisions from assistant messages using pattern matching
 *
 * Analyzes assistant messages to identify important decisions made during conversation.
 * Uses confidence-scored patterns to detect implementation choices, architectural decisions,
 * and workflow steps.
 *
 * @param messages - Array of messages to analyze
 * @returns Array of detected decisions with confidence scores and categories
 * @example
 * ```typescript
 * const messages: AgentMessage[] = [...];
 * const decisions = extractKeyDecisions(messages);
 * console.log(decisions[0].text); // "implement authentication using JWT"
 * console.log(decisions[0].confidence); // 0.9
 * console.log(decisions[0].category); // "implementation"
 * ```
 */
export function extractKeyDecisions(messages: AgentMessage[]): KeyDecision[] {
  const decisions: KeyDecision[] = [];

  messages.forEach((message, messageIndex) => {
    // Only look at assistant messages for decisions
    if (message.type !== 'assistant') return;

    message.content.forEach((block) => {
      if (block.type === 'text' && block.text) {
        // Apply each decision pattern
        DECISION_PATTERNS.forEach(({ pattern, confidence, category }) => {
          const matches = [...block.text!.matchAll(pattern)];
          matches.forEach((match) => {
            const text = match[1]?.trim();
            if (text && text.length > 10) { // Filter out very short matches
              decisions.push({
                text,
                messageIndex,
                confidence,
                category
              });
            }
          });
        });
      }
    });
  });

  // Remove duplicates and sort by confidence
  const uniqueDecisions = decisions
    .filter((decision, index, self) =>
      index === self.findIndex(d => d.text.toLowerCase() === decision.text.toLowerCase())
    )
    .sort((a, b) => b.confidence - a.confidence);

  // Return top 10 decisions to avoid overwhelming the summary
  return uniqueDecisions.slice(0, 10);
}

/**
 * Track progress indicators from conversation messages
 *
 * Scans conversation for progress markers like "completed", "currently working on",
 * and calculates overall completion percentage. Useful for tracking workflow progress.
 *
 * @param messages - Array of messages to scan for progress indicators
 * @returns Progress information including completed items, current activity, and percentage
 * @example
 * ```typescript
 * const messages: AgentMessage[] = [...];
 * const progress = extractProgressInfo(messages);
 * console.log(progress.completed); // ["file parsing", "test setup"]
 * console.log(progress.current); // "implementing authentication"
 * console.log(progress.percentage); // 66
 * ```
 */
export function extractProgressInfo(messages: AgentMessage[]): ProgressInfo {
  const completed: string[] = [];
  let current: string | undefined;
  let lastActivity: Date | undefined;

  messages.forEach((message) => {
    message.content.forEach((block) => {
      if (block.type === 'text' && block.text) {
        // Look for completion indicators
        const completedMatches = [...block.text.matchAll(PROGRESS_PATTERNS[0])];
        completedMatches.forEach((match) => {
          const item = match[1]?.trim();
          if (item && !completed.includes(item)) {
            completed.push(item);
            lastActivity = new Date();
          }
        });

        // Look for current activity
        const currentMatches = [...block.text.matchAll(PROGRESS_PATTERNS[1])];
        if (currentMatches.length > 0) {
          current = currentMatches[currentMatches.length - 1][1]?.trim();
          lastActivity = new Date();
        }
      }
    });
  });

  // Calculate percentage based on completed vs total identified items
  const totalIdentified = completed.length + (current ? 1 : 0);
  const percentage = totalIdentified > 0 ? Math.round((completed.length / totalIdentified) * 100) : 0;

  return {
    completed,
    current,
    percentage,
    lastActivity
  };
}

/**
 * Enhanced file modification tracking with action types
 *
 * Analyzes tool usage patterns to track file operations (read, write, edit).
 * Provides detailed statistics including operation counts and recent activity.
 *
 * @param messages - Array of messages containing tool usage
 * @returns Array of file modifications sorted by most recent activity
 * @example
 * ```typescript
 * const messages: AgentMessage[] = [...];
 * const mods = extractFileModifications(messages);
 * console.log(mods[0].path); // "src/auth.ts"
 * console.log(mods[0].action); // "edit"
 * console.log(mods[0].count); // 3
 * ```
 */
export function extractFileModifications(messages: AgentMessage[]): FileModification[] {
  const modifications = new Map<string, FileModification>();

  messages.forEach((message, messageIndex) => {
    message.content.forEach((block) => {
      if (block.type === 'tool_use' && block.toolName && block.toolInput) {
        const input = block.toolInput as Record<string, unknown>;
        const filePath = input.file_path as string;

        if (!filePath) return;

        // Determine action type based on tool name
        let action: FileModification['action'];
        switch (block.toolName) {
          case 'Read':
            action = 'read';
            break;
          case 'Write':
            action = 'write';
            break;
          case 'Edit':
            action = 'edit';
            break;
          default:
            return; // Skip unknown tools
        }

        const key = `${filePath}:${action}`;
        const existing = modifications.get(key);

        if (existing) {
          existing.count += 1;
          existing.lastMessageIndex = messageIndex;
        } else {
          modifications.set(key, {
            path: filePath,
            action,
            count: 1,
            lastMessageIndex: messageIndex
          });
        }
      }
    });
  });

  return Array.from(modifications.values())
    .sort((a, b) => b.lastMessageIndex - a.lastMessageIndex);
}

/**
 * Estimate token count for a string (rough approximation: ~4 chars per token)
 *
 * Provides a simple token estimation based on character count. Uses the common
 * approximation of 4 characters per token for most natural language text.
 *
 * @param text - The text to analyze
 * @returns Estimated number of tokens
 * @example
 * ```typescript
 * const text = "Hello world!";
 * const tokens = estimateTokens(text);
 * console.log(tokens); // 3 (12 chars / 4)
 * ```
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate token count for a message
 *
 * Calculates the estimated token count for all content in a message,
 * including text blocks, tool inputs, and tool results.
 *
 * @param message - The message to analyze
 * @returns Estimated total tokens for the message
 * @example
 * ```typescript
 * const message: AgentMessage = {
 *   type: 'assistant',
 *   content: [{ type: 'text', text: 'Hello world!' }]
 * };
 * const tokens = estimateMessageTokens(message);
 * console.log(tokens); // 3
 * ```
 */
export function estimateMessageTokens(message: AgentMessage): number {
  let tokens = 0;
  for (const block of message.content) {
    if (block.text) {
      tokens += estimateTokens(block.text);
    }
    if (block.toolInput) {
      tokens += estimateTokens(JSON.stringify(block.toolInput));
    }
    if (block.toolResult) {
      tokens += estimateTokens(
        typeof block.toolResult === 'string'
          ? block.toolResult
          : JSON.stringify(block.toolResult)
      );
    }
  }
  return tokens;
}

/**
 * Estimate total tokens in a conversation
 *
 * Sums up the estimated tokens for all messages in a conversation.
 * Useful for determining if context compaction is needed.
 *
 * @param messages - Array of messages in the conversation
 * @returns Total estimated tokens for the entire conversation
 * @example
 * ```typescript
 * const messages: AgentMessage[] = [...];
 * const totalTokens = estimateConversationTokens(messages);
 * if (totalTokens > 100000) {
 *   console.log('Consider compacting the conversation');
 * }
 * ```
 */
export function estimateConversationTokens(messages: AgentMessage[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
}

/**
 * Truncate a tool result to maximum length
 *
 * Limits the size of tool results to prevent context overflow. Handles both
 * string and object results by converting to string representation when needed.
 *
 * @param result - The tool result to truncate
 * @param maxLength - Maximum length in characters (default: 5000)
 * @returns Truncated result with truncation indicator if shortened
 * @example
 * ```typescript
 * const largeResult = "A".repeat(10000);
 * const truncated = truncateToolResult(largeResult, 1000);
 * // Returns: "AAA...[... truncated 9000 characters ...]"
 * ```
 */
export function truncateToolResult(
  result: unknown,
  maxLength: number = DEFAULT_OPTIONS.maxToolResultLength!
): unknown {
  const str = typeof result === 'string' ? result : JSON.stringify(result);

  if (str.length <= maxLength) {
    return result;
  }

  const truncated = str.substring(0, maxLength);
  const suffix = `\n\n[... truncated ${str.length - maxLength} characters ...]`;

  if (typeof result === 'string') {
    return truncated + suffix;
  }

  // For objects, return a truncated string representation
  return truncated + suffix;
}

/**
 * Create a summary of a message for context compaction
 *
 * Reduces message size by summarizing text content, preserving tool names,
 * and replacing tool results with placeholders. Used in conversation compaction.
 *
 * @param message - The message to summarize
 * @returns Summarized version of the message with reduced content
 * @example
 * ```typescript
 * const longMessage: AgentMessage = {
 *   type: 'assistant',
 *   content: [{ type: 'text', text: 'A very long explanation...' }]
 * };
 * const summary = summarizeMessage(longMessage);
 * // Returns message with "[Summary] A very long..." as text
 * ```
 */
export function summarizeMessage(message: AgentMessage): AgentMessage {
  const summarizedContent: AgentContentBlock[] = [];

  for (const block of message.content) {
    if (block.type === 'text' && block.text) {
      // Keep first 200 chars of text
      const summary =
        block.text.length > 200
          ? block.text.substring(0, 200) + '...'
          : block.text;
      summarizedContent.push({ type: 'text', text: `[Summary] ${summary}` });
    } else if (block.type === 'tool_use') {
      // Keep tool name but truncate input
      summarizedContent.push({
        type: 'tool_use',
        toolName: block.toolName,
        toolInput: { _summarized: true, tool: block.toolName },
      });
    } else if (block.type === 'tool_result') {
      // Indicate tool was used but don't keep result
      summarizedContent.push({
        type: 'tool_result',
        toolResult: '[Result omitted for brevity]',
      });
    }
  }

  return {
    ...message,
    content: summarizedContent,
  };
}

/**
 * Compact a conversation by keeping recent messages and summarizing older ones
 *
 * Implements a multi-stage compaction strategy: preserves system messages,
 * keeps recent messages in full detail, summarizes older messages, and
 * truncates tool results. Performs aggressive compaction if token limit exceeded.
 *
 * @param messages - Array of messages to compact
 * @param options - Compaction options with token limits and message counts
 * @returns Compacted conversation that fits within token budget
 * @example
 * ```typescript
 * const longConversation: AgentMessage[] = [...];
 * const compacted = compactConversation(longConversation, {
 *   maxTokens: 50000,
 *   maxRecentMessages: 5
 * });
 * console.log(`Reduced from ${longConversation.length} to ${compacted.length} messages`);
 * ```
 */
export function compactConversation(
  messages: AgentMessage[],
  options: ContextCompactionOptions = {}
): AgentMessage[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (messages.length === 0) {
    return [];
  }

  // Always keep system messages
  const systemMessages = messages.filter((m) => m.type === 'system');
  const nonSystemMessages = messages.filter((m) => m.type !== 'system');

  // Keep recent messages in full
  const recentCount = opts.maxRecentMessages!;
  const recentMessages = nonSystemMessages.slice(-recentCount);
  const olderMessages = nonSystemMessages.slice(0, -recentCount);

  // Process older messages
  let compactedOlder: AgentMessage[] = [];
  if (opts.summarizeOlder && olderMessages.length > 0) {
    // Summarize older messages
    compactedOlder = olderMessages.map(summarizeMessage);
  } else {
    compactedOlder = olderMessages;
  }

  // Process recent messages - truncate tool results
  const compactedRecent = recentMessages.map((message) => ({
    ...message,
    content: message.content.map((block) => {
      if (block.type === 'tool_result' && block.toolResult) {
        return {
          ...block,
          toolResult: truncateToolResult(block.toolResult, opts.maxToolResultLength),
        };
      }
      return block;
    }),
  }));

  // Combine: system + summarized older + recent
  const result = [...systemMessages, ...compactedOlder, ...compactedRecent];

  // Check if we're still over token limit
  const totalTokens = estimateConversationTokens(result);
  if (totalTokens > opts.maxTokens!) {
    // More aggressive compaction needed - drop more older messages
    const tokensToSave = totalTokens - opts.maxTokens!;
    let savedTokens = 0;
    let dropCount = 0;

    for (const msg of compactedOlder) {
      savedTokens += estimateMessageTokens(msg);
      dropCount++;
      if (savedTokens >= tokensToSave) {
        break;
      }
    }

    return [...systemMessages, ...compactedOlder.slice(dropCount), ...compactedRecent];
  }

  return result;
}

/**
 * Prune tool results except for the last N
 *
 * Removes tool result content from older messages while preserving the most
 * recent tool results. Helps reduce context size while maintaining recent context.
 *
 * @param messages - Array of messages to process
 * @param keepLast - Number of recent tool results to preserve in full (default: 5)
 * @returns Messages with older tool results replaced by placeholders
 * @example
 * ```typescript
 * const messages: AgentMessage[] = [...]; // 20 messages with tool results
 * const pruned = pruneToolResults(messages, 3);
 * // Only the last 3 tool results are kept, others become "[Result pruned...]"
 * ```
 */
export function pruneToolResults(
  messages: AgentMessage[],
  keepLast: number = DEFAULT_OPTIONS.keepLastNToolResults!
): AgentMessage[] {
  // Find all tool result indices
  const toolResultIndices: number[] = [];
  messages.forEach((msg, idx) => {
    if (msg.content.some((block) => block.type === 'tool_result')) {
      toolResultIndices.push(idx);
    }
  });

  // Keep only the last N tool results in full
  const indicesToPrune = toolResultIndices.slice(0, -keepLast);

  return messages.map((msg, idx) => {
    if (!indicesToPrune.includes(idx)) {
      return msg;
    }

    return {
      ...msg,
      content: msg.content.map((block) => {
        if (block.type === 'tool_result') {
          return {
            ...block,
            toolResult: '[Result pruned for context management]',
          };
        }
        return block;
      }),
    };
  });
}

/**
 * Create enhanced structured context summary data
 *
 * Generates comprehensive metadata about a conversation including metrics,
 * key decisions, progress tracking, file modifications, and tool usage patterns.
 * Used as foundation for creating human-readable summaries.
 *
 * @param messages - Array of messages to analyze
 * @returns Structured data object with all conversation insights
 * @example
 * ```typescript
 * const messages: AgentMessage[] = [...];
 * const data = createContextSummaryData(messages);
 * console.log(data.metrics.messageCount); // 42
 * console.log(data.keyDecisions.length); // 5
 * console.log(data.fileModifications[0].path); // "src/auth.ts"
 * ```
 */
export function createContextSummaryData(messages: AgentMessage[]): ContextSummaryData {
  const toolUsage = new Map<string, number>();
  const userRequests: string[] = [];
  let toolUsageCount = 0;

  // Extract basic metrics
  for (const msg of messages) {
    for (const block of msg.content) {
      if (block.type === 'tool_use' && block.toolName) {
        const count = toolUsage.get(block.toolName) || 0;
        toolUsage.set(block.toolName, count + 1);
        toolUsageCount++;
      }

      // Extract user requests
      if (msg.type === 'user' && block.type === 'text' && block.text) {
        const request = block.text.substring(0, 150);
        userRequests.push(request);
      }
    }
  }

  // Extract enhanced data using new functions
  const keyDecisions = extractKeyDecisions(messages);
  const progress = extractProgressInfo(messages);
  const fileModifications = extractFileModifications(messages);

  return {
    metrics: {
      messageCount: messages.length,
      userRequestCount: userRequests.length,
      toolUsageCount
    },
    keyDecisions,
    progress,
    fileModifications,
    toolsUsed: Object.fromEntries(toolUsage),
    recentRequests: userRequests.slice(-3)
  };
}

/**
 * Create a context summary for including at the start of resumed conversations
 *
 * Generates a formatted markdown summary of conversation history including
 * metrics, file operations, progress tracking, key decisions, and recent requests.
 * Enhanced version with decision tracking, progress monitoring, and detailed file operations.
 *
 * @param messages - Array of messages to summarize
 * @returns Markdown-formatted summary string for conversation resumption
 * @example
 * ```typescript
 * const messages: AgentMessage[] = [...];
 * const summary = createContextSummary(messages);
 * console.log(summary);
 * // ## Previous Context Summary
 * // - Messages exchanged: 15
 * // - Tools used: Read, Edit, Bash
 * // - Files edited: src/auth.ts, src/utils.ts
 * // ...
 * ```
 */
export function createContextSummary(messages: AgentMessage[]): string {
  // Use the enhanced data extraction
  const data = createContextSummaryData(messages);

  let summary = '## Previous Context Summary\n\n';

  // Basic metrics
  summary += `- Messages exchanged: ${data.metrics.messageCount}\n`;
  summary += `- Tools used: ${Object.keys(data.toolsUsed).join(', ') || 'none'}\n`;

  // Enhanced file modification tracking
  if (data.fileModifications.length > 0) {
    const readFiles = data.fileModifications.filter(f => f.action === 'read');
    const writeFiles = data.fileModifications.filter(f => f.action === 'write');
    const editFiles = data.fileModifications.filter(f => f.action === 'edit');

    if (readFiles.length > 0) {
      const paths = readFiles.slice(0, 10).map(f => f.path);
      summary += `- Files read: ${paths.join(', ')}`;
      if (readFiles.length > 10) {
        summary += ` (+${readFiles.length - 10} more)`;
      }
      summary += '\n';
    }

    if (writeFiles.length > 0) {
      summary += `- Files written: ${writeFiles.map(f => f.path).join(', ')}\n`;
    }

    if (editFiles.length > 0) {
      summary += `- Files edited: ${editFiles.map(f => f.path).join(', ')}\n`;
    }
  }

  // Progress tracking
  if (data.progress.completed.length > 0 || data.progress.current) {
    summary += '\n### Progress Tracking\n';
    if (data.progress.completed.length > 0) {
      summary += `- Completed: ${data.progress.completed.join(', ')}\n`;
    }
    if (data.progress.current) {
      summary += `- Currently: ${data.progress.current}\n`;
    }
    if (data.progress.percentage > 0) {
      summary += `- Overall progress: ${data.progress.percentage}%\n`;
    }
  }

  // Key decisions made
  if (data.keyDecisions.length > 0) {
    summary += '\n### Key Decisions Made\n';
    // Show top 5 highest confidence decisions
    for (const decision of data.keyDecisions.slice(0, 5)) {
      summary += `- [${decision.category}] ${decision.text}\n`;
    }
  }

  // Recent user requests
  if (data.recentRequests.length > 0) {
    summary += '\n### Recent Requests\n';
    for (const req of data.recentRequests) {
      summary += `- ${req}${req.length >= 150 ? '...' : ''}\n`;
    }
  }

  return summary;
}

/**
 * Analyze conversation to suggest compaction strategy
 *
 * Evaluates conversation size and composition to recommend appropriate
 * compaction strategy. Categorizes tokens by type and suggests strategy
 * based on total token count thresholds.
 *
 * @param messages - Array of messages to analyze
 * @returns Analysis object with token breakdown and recommended compaction strategy
 * @example
 * ```typescript
 * const messages: AgentMessage[] = [...];
 * const analysis = analyzeConversation(messages);
 * console.log(analysis.totalTokens); // 120000
 * console.log(analysis.recommendedStrategy); // "summarize"
 * console.log(analysis.toolResultTokens); // 80000
 * ```
 */
export function analyzeConversation(messages: AgentMessage[]): {
  totalTokens: number;
  messageCount: number;
  toolResultTokens: number;
  textTokens: number;
  recommendedStrategy: 'none' | 'truncate' | 'summarize' | 'aggressive';
} {
  let totalTokens = 0;
  let toolResultTokens = 0;
  let textTokens = 0;
  const messageCount = messages.length;

  for (const msg of messages) {
    for (const block of msg.content) {
      if (block.type === 'text' && block.text) {
        const tokens = estimateTokens(block.text);
        textTokens += tokens;
        totalTokens += tokens;
      }
      if (block.type === 'tool_result' && block.toolResult) {
        const tokens = estimateTokens(
          typeof block.toolResult === 'string'
            ? block.toolResult
            : JSON.stringify(block.toolResult)
        );
        toolResultTokens += tokens;
        totalTokens += tokens;
      }
      if (block.toolInput) {
        totalTokens += estimateTokens(JSON.stringify(block.toolInput));
      }
    }
  }

  let recommendedStrategy: 'none' | 'truncate' | 'summarize' | 'aggressive' = 'none';

  if (totalTokens > 150000) {
    recommendedStrategy = 'aggressive';
  } else if (totalTokens > 100000) {
    recommendedStrategy = 'summarize';
  } else if (totalTokens > 50000) {
    recommendedStrategy = 'truncate';
  }

  return {
    totalTokens,
    messageCount,
    toolResultTokens,
    textTokens,
    recommendedStrategy,
  };
}
