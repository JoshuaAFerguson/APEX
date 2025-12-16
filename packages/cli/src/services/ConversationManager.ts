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

  // Intent detection helpers
  detectIntent(input: string): {
    type: 'command' | 'task' | 'question' | 'clarification';
    confidence: number;
    metadata?: Record<string, unknown>;
  } {
    const normalized = input.toLowerCase().trim();
    const metadata: Record<string, unknown> = {};

    // Command detection
    if (normalized.startsWith('/')) {
      const parts = input.slice(1).split(/\s+/);
      metadata.command = parts[0].toLowerCase();
      metadata.args = parts.slice(1);
      metadata.matchedPattern = 'slash_command';

      return {
        type: 'command',
        confidence: 1.0,
        metadata
      };
    }

    // Clarification response detection
    if (this.hasPendingClarification()) {
      return {
        type: 'clarification',
        confidence: 0.9,
        metadata: { matchedPattern: 'pending_clarification' }
      };
    }

    // Question patterns
    const questionPatterns = [
      { pattern: /^(what|how|where|when|why|who|can|could|would|should|is|are|do|does|will)\s/i, name: 'interrogative_start' },
      { pattern: /\?$/, name: 'question_mark_end' },
      { pattern: /^(explain|tell me|show me|help me understand)/i, name: 'explanation_request' },
    ];

    for (const { pattern, name } of questionPatterns) {
      if (pattern.test(normalized)) {
        metadata.matchedPattern = name;
        metadata.suggestedWorkflow = 'question';
        metadata.estimatedComplexity = 'simple';

        return {
          type: 'question',
          confidence: 0.8,
          metadata
        };
      }
    }

    // Task patterns with complexity estimation
    const taskPatterns = [
      { pattern: /^(create|make|build|add|implement|write|develop|generate)/i, name: 'creation_task', complexity: 'moderate' },
      { pattern: /^(fix|solve|resolve|debug|correct)/i, name: 'bugfix_task', complexity: 'simple' },
      { pattern: /^(update|modify|change|edit|refactor)/i, name: 'modification_task', complexity: 'moderate' },
      { pattern: /^(remove|delete|clean|clear)/i, name: 'deletion_task', complexity: 'simple' },
      { pattern: /^(test|check|verify|validate)/i, name: 'testing_task', complexity: 'simple' },
      { pattern: /^(deploy|install|setup|configure)/i, name: 'deployment_task', complexity: 'complex' },
    ];

    for (const { pattern, name, complexity } of taskPatterns) {
      if (pattern.test(normalized)) {
        metadata.matchedPattern = name;
        metadata.suggestedWorkflow = name.includes('bugfix') ? 'bugfix' : 'feature';
        metadata.estimatedComplexity = complexity;

        return {
          type: 'task',
          confidence: 0.7,
          metadata
        };
      }
    }

    // Default to task if it's not clearly a question
    metadata.matchedPattern = 'default_task';
    metadata.suggestedWorkflow = 'feature';
    metadata.estimatedComplexity = 'moderate';

    return {
      type: 'task',
      confidence: 0.5,
      metadata
    };
  }

  // Smart suggestions based on context
  getSuggestions(): string[] {
    const suggestions: string[] = [];

    if (this.context.pendingClarification) {
      const pending = this.context.pendingClarification;
      if (pending.type === 'confirm') {
        suggestions.push('yes', 'no');
      } else if (pending.type === 'choice' && pending.options) {
        suggestions.push(...pending.options);
      }
      return suggestions;
    }

    // Based on recent context
    const recentMessages = this.getRecentMessages(3);
    const lastMessage = recentMessages[recentMessages.length - 1];

    if (lastMessage?.role === 'assistant') {
      const content = lastMessage.content.toLowerCase();

      if (content.includes('error') || content.includes('failed')) {
        suggestions.push(
          'retry the task',
          'fix the error',
          'show me the logs',
          'try a different approach'
        );
      } else if (content.includes('completed') || content.includes('done')) {
        suggestions.push(
          'show me the changes',
          'test the implementation',
          'create a pull request',
          'deploy the changes'
        );
      }
    }

    // Based on current task
    if (this.context.currentTaskId) {
      suggestions.push(
        '/status',
        '/logs',
        'cancel the task',
        'modify the requirements'
      );
    }

    // General suggestions if no specific context
    if (suggestions.length === 0) {
      suggestions.push(
        'create a new feature',
        'fix a bug',
        'refactor code',
        'write tests',
        'update documentation',
        '/help',
        '/status',
        '/session info'
      );
    }

    return suggestions.slice(0, 8);
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