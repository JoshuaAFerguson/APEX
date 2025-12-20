/**
 * Context compaction strategies for managing conversation history
 *
 * These utilities help reduce token usage in long-running tasks by:
 * 1. Summarizing older messages
 * 2. Truncating large tool results
 * 3. Pruning redundant information
 */

import type { AgentMessage, AgentContentBlock } from '@apexcli/core';

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
 * Create a context summary for including at the start of resumed conversations
 */
export function createContextSummary(messages: AgentMessage[]): string {
  const toolsUsed = new Set<string>();
  const filesRead = new Set<string>();
  const filesEdited = new Set<string>();
  let messageCount = 0;
  let userRequests: string[] = [];

  for (const msg of messages) {
    messageCount++;
    for (const block of msg.content) {
      if (block.type === 'tool_use' && block.toolName) {
        toolsUsed.add(block.toolName);

        // Extract file paths from common tools
        if (block.toolInput && typeof block.toolInput === 'object') {
          const input = block.toolInput as Record<string, unknown>;
          if (block.toolName === 'Read' && input.file_path) {
            filesRead.add(String(input.file_path));
          }
          if ((block.toolName === 'Write' || block.toolName === 'Edit') && input.file_path) {
            filesEdited.add(String(input.file_path));
          }
        }
      }

      // Extract user requests
      if (msg.type === 'user' && block.type === 'text' && block.text) {
        const request = block.text.substring(0, 100);
        userRequests.push(request);
      }
    }
  }

  let summary = '## Previous Context Summary\n\n';
  summary += `- Messages exchanged: ${messageCount}\n`;
  summary += `- Tools used: ${Array.from(toolsUsed).join(', ') || 'none'}\n`;

  if (filesRead.size > 0) {
    summary += `- Files read: ${Array.from(filesRead).slice(0, 10).join(', ')}`;
    if (filesRead.size > 10) {
      summary += ` (+${filesRead.size - 10} more)`;
    }
    summary += '\n';
  }

  if (filesEdited.size > 0) {
    summary += `- Files modified: ${Array.from(filesEdited).join(', ')}\n`;
  }

  if (userRequests.length > 0) {
    summary += '\nKey requests:\n';
    for (const req of userRequests.slice(-3)) {
      summary += `- ${req}${req.length >= 100 ? '...' : ''}\n`;
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
