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
 * Extract key decisions from assistant messages
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
 * Track progress indicators from conversation
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
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate token count for a message
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
 */
export function estimateConversationTokens(messages: AgentMessage[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
}

/**
 * Truncate a tool result to maximum length
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
 * Compact a conversation by:
 * 1. Keeping recent messages in full
 * 2. Summarizing older messages
 * 3. Truncating large tool results
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
 * Enhanced version with decision tracking, progress monitoring, and detailed file operations
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
