# ADR-002: Natural Language Interface for v0.3.0

## Status
Proposed

## Context
The v0.3.0 roadmap specifies a "Natural Language First" interface that should:
- Allow users to type tasks directly without commands
- Smart intent detection to distinguish commands from tasks
- Conversational context with multi-turn memory
- Task refinement through clarifying questions
- Contextual suggestions based on project state

Currently, APEX already supports natural language task input (any non-command input becomes a task), but lacks:
- Intent classification sophistication
- Conversational memory within sessions
- Clarifying question flows
- Context-aware suggestions

## Decision

### 1. Intent Classification System

```typescript
// Intent types
type Intent =
  | { type: 'command'; command: string; args: string[] }
  | { type: 'task'; description: string; workflow?: string; confidence: number }
  | { type: 'question'; query: string }
  | { type: 'clarification'; context: ClarificationContext }
  | { type: 'confirmation'; affirmative: boolean }
  | { type: 'ambiguous'; suggestions: Intent[] };

// Classification engine
interface IntentClassifier {
  classify(input: string, context: ConversationContext): Promise<Intent>;
}

// Rule-based fast path + optional LLM fallback
class HybridIntentClassifier implements IntentClassifier {
  async classify(input: string, context: ConversationContext): Promise<Intent> {
    // Fast path: explicit commands
    if (input.startsWith('/')) {
      return this.parseCommand(input);
    }

    // Fast path: yes/no responses to pending questions
    if (context.pendingClarification) {
      const confirmation = this.parseConfirmation(input);
      if (confirmation !== null) {
        return { type: 'confirmation', affirmative: confirmation };
      }
    }

    // Fast path: task indicators
    const taskIndicators = [
      /^(add|create|implement|build|make|fix|update|refactor|delete|remove)/i,
      /^(i want|i need|please|can you|could you|would you)/i,
    ];
    if (taskIndicators.some(r => r.test(input))) {
      return this.classifyAsTask(input, context);
    }

    // Question indicators
    const questionIndicators = [
      /^(what|how|why|when|where|who|which|can|could|would|is|are|do|does|did)/i,
      /\?$/,
    ];
    if (questionIndicators.some(r => r.test(input))) {
      return { type: 'question', query: input };
    }

    // Default: treat as task with lower confidence
    return this.classifyAsTask(input, context, 0.7);
  }

  private parseCommand(input: string): Intent {
    const parts = input.slice(1).split(/\s+/);
    return {
      type: 'command',
      command: parts[0].toLowerCase(),
      args: parts.slice(1),
    };
  }

  private parseConfirmation(input: string): boolean | null {
    const normalized = input.toLowerCase().trim();
    const affirmative = ['yes', 'y', 'yeah', 'yep', 'sure', 'ok', 'okay', 'affirmative', 'correct', 'right'];
    const negative = ['no', 'n', 'nope', 'nah', 'cancel', 'abort', 'stop', 'negative', 'wrong'];

    if (affirmative.includes(normalized)) return true;
    if (negative.includes(normalized)) return false;
    return null;
  }

  private classifyAsTask(
    input: string,
    context: ConversationContext,
    confidence = 0.9
  ): Intent {
    // Detect workflow type from keywords
    const workflowKeywords: Record<string, string[]> = {
      bugfix: ['bug', 'fix', 'broken', 'error', 'issue', 'crash', 'failing'],
      refactor: ['refactor', 'clean', 'restructure', 'reorganize', 'simplify'],
      feature: ['add', 'create', 'implement', 'build', 'new'],
    };

    let detectedWorkflow: string | undefined;
    for (const [workflow, keywords] of Object.entries(workflowKeywords)) {
      if (keywords.some(kw => input.toLowerCase().includes(kw))) {
        detectedWorkflow = workflow;
        break;
      }
    }

    return {
      type: 'task',
      description: input,
      workflow: detectedWorkflow,
      confidence,
    };
  }
}
```

### 2. Conversation Context Management

```typescript
interface ConversationContext {
  // Message history for context
  messages: ConversationMessage[];

  // Current state
  currentTask?: TaskReference;
  pendingClarification?: ClarificationRequest;

  // Project awareness
  projectState: ProjectState;

  // Session metadata
  sessionId: string;
  startedAt: Date;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  intent?: Intent;
  metadata?: Record<string, unknown>;
}

interface ProjectState {
  path: string;
  gitBranch?: string;
  uncommittedChanges: boolean;
  recentFiles: string[];
  activeAgents: string[];
  pendingTasks: string[];
}

// Context window management
class ConversationManager {
  private context: ConversationContext;
  private maxHistoryLength = 50;

  addMessage(message: Omit<ConversationMessage, 'id' | 'timestamp'>) {
    this.context.messages.push({
      ...message,
      id: generateId(),
      timestamp: new Date(),
    });

    // Trim old messages but keep system messages
    if (this.context.messages.length > this.maxHistoryLength) {
      this.context.messages = this.context.messages
        .slice(-this.maxHistoryLength)
        .filter((m, i) => m.role === 'system' || i > this.maxHistoryLength - 20);
    }
  }

  getRelevantContext(query: string): ConversationMessage[] {
    // Simple: return recent messages
    // Future: semantic similarity search
    return this.context.messages.slice(-10);
  }

  summarizeContext(): string {
    // Create a summary for long contexts
    const messages = this.context.messages;
    if (messages.length < 10) {
      return messages.map(m => `${m.role}: ${m.content}`).join('\n');
    }

    // Summarize older messages
    const recent = messages.slice(-5);
    const older = messages.slice(0, -5);

    const summary = `[Earlier in conversation: ${older.length} messages about ${this.extractTopics(older).join(', ')}]`;
    return summary + '\n' + recent.map(m => `${m.role}: ${m.content}`).join('\n');
  }

  private extractTopics(messages: ConversationMessage[]): string[] {
    // Simple topic extraction
    const taskDescriptions = messages
      .filter(m => m.intent?.type === 'task')
      .map(m => (m.intent as { description: string }).description)
      .slice(-3);
    return taskDescriptions;
  }
}
```

### 3. Clarification Flow

```typescript
interface ClarificationRequest {
  id: string;
  type: 'choice' | 'confirm' | 'freeform';
  question: string;
  options?: string[];
  defaultOption?: string;
  context: {
    originalInput: string;
    ambiguity: string;
  };
  timeout?: number; // Auto-select default after timeout
}

interface ClarificationHandler {
  requestClarification(request: ClarificationRequest): Promise<string>;
  detectAmbiguity(intent: Intent, context: ConversationContext): ClarificationRequest | null;
}

// Ambiguity detection
function detectTaskAmbiguity(
  task: TaskIntent,
  context: ConversationContext
): ClarificationRequest | null {
  const description = task.description.toLowerCase();

  // Ambiguous file references
  if (description.includes('the file') || description.includes('that file')) {
    if (!context.projectState.recentFiles.length) {
      return {
        id: generateId(),
        type: 'freeform',
        question: 'Which file are you referring to?',
        context: {
          originalInput: task.description,
          ambiguity: 'file_reference',
        },
      };
    }
    return {
      id: generateId(),
      type: 'choice',
      question: 'Which file are you referring to?',
      options: context.projectState.recentFiles.slice(0, 5),
      context: {
        originalInput: task.description,
        ambiguity: 'file_reference',
      },
    };
  }

  // Ambiguous scope
  if (description.match(/\b(it|this|that|these|those)\b/) && !context.currentTask) {
    return {
      id: generateId(),
      type: 'freeform',
      question: 'Could you be more specific about what you want to modify?',
      context: {
        originalInput: task.description,
        ambiguity: 'scope_reference',
      },
    };
  }

  // Multiple possible workflows
  if (!task.workflow && task.confidence < 0.8) {
    return {
      id: generateId(),
      type: 'choice',
      question: 'What type of task is this?',
      options: ['New feature', 'Bug fix', 'Refactoring', 'Other'],
      defaultOption: 'New feature',
      context: {
        originalInput: task.description,
        ambiguity: 'workflow_type',
      },
    };
  }

  return null;
}
```

### 4. Contextual Suggestions

```typescript
interface Suggestion {
  type: 'task' | 'command' | 'action';
  text: string;
  description?: string;
  priority: number;
}

interface SuggestionEngine {
  getSuggestions(context: ConversationContext): Promise<Suggestion[]>;
}

class ContextualSuggestionEngine implements SuggestionEngine {
  async getSuggestions(context: ConversationContext): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // Git-based suggestions
    if (context.projectState.uncommittedChanges) {
      suggestions.push({
        type: 'action',
        text: 'Review and commit changes',
        description: 'You have uncommitted changes',
        priority: 90,
      });
    }

    // Task completion suggestions
    if (context.currentTask) {
      suggestions.push({
        type: 'command',
        text: '/status',
        description: 'Check current task status',
        priority: 80,
      });
    }

    // Recent activity suggestions
    const recentTasks = context.messages
      .filter(m => m.intent?.type === 'task')
      .slice(-3);

    if (recentTasks.length > 0) {
      const lastTask = recentTasks[recentTasks.length - 1];
      suggestions.push({
        type: 'task',
        text: `Continue working on: ${(lastTask.intent as { description: string }).description.slice(0, 50)}`,
        priority: 70,
      });
    }

    // Time-based suggestions
    const hour = new Date().getHours();
    if (hour < 9 || hour > 17) {
      suggestions.push({
        type: 'task',
        text: 'Review code changes from today',
        priority: 60,
      });
    }

    return suggestions.sort((a, b) => b.priority - a.priority).slice(0, 5);
  }
}
```

### 5. Response Flow Integration

```typescript
// Main conversation loop
async function processInput(
  input: string,
  context: ConversationContext,
  classifier: IntentClassifier,
  suggestionEngine: SuggestionEngine
): Promise<ConversationResponse> {
  // Classify intent
  const intent = await classifier.classify(input, context);

  // Handle based on intent type
  switch (intent.type) {
    case 'command':
      return handleCommand(intent, context);

    case 'task':
      // Check for ambiguity
      const clarification = detectTaskAmbiguity(intent, context);
      if (clarification) {
        context.pendingClarification = clarification;
        return {
          type: 'clarification',
          message: clarification.question,
          options: clarification.options,
        };
      }
      // Execute task
      return handleTask(intent, context);

    case 'question':
      return handleQuestion(intent, context);

    case 'confirmation':
      if (context.pendingClarification) {
        return handleClarificationResponse(intent, context);
      }
      return { type: 'error', message: 'Nothing to confirm' };

    case 'ambiguous':
      return {
        type: 'clarification',
        message: 'I\'m not sure what you mean. Did you want to:',
        options: intent.suggestions.map(s => formatIntentOption(s)),
      };

    default:
      return { type: 'error', message: 'Unable to understand input' };
  }
}
```

### 6. Project State Awareness

```typescript
// Project state tracking
interface ProjectStateTracker {
  getState(): Promise<ProjectState>;
  watchChanges(callback: (state: ProjectState) => void): () => void;
}

class ProjectStateTrackerImpl implements ProjectStateTracker {
  private state: ProjectState;
  private watchers: ((state: ProjectState) => void)[] = [];

  async getState(): Promise<ProjectState> {
    const [gitBranch, uncommittedChanges, recentFiles] = await Promise.all([
      this.getGitBranch(),
      this.hasUncommittedChanges(),
      this.getRecentlyModifiedFiles(),
    ]);

    this.state = {
      path: this.projectPath,
      gitBranch,
      uncommittedChanges,
      recentFiles,
      activeAgents: this.orchestrator.getRunningTaskIds().length > 0
        ? ['executing']
        : [],
      pendingTasks: await this.getPendingTaskDescriptions(),
    };

    return this.state;
  }

  private async getGitBranch(): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync('git branch --show-current', {
        cwd: this.projectPath,
      });
      return stdout.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  private async hasUncommittedChanges(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: this.projectPath,
      });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  private async getRecentlyModifiedFiles(): Promise<string[]> {
    try {
      // Get files modified in the last hour
      const { stdout } = await execAsync(
        'find . -type f -mmin -60 -not -path "*/node_modules/*" -not -path "*/.git/*" | head -10',
        { cwd: this.projectPath }
      );
      return stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}
```

## Consequences

### Positive
- More natural interaction with APEX
- Reduced friction for new users
- Better error recovery through clarification
- Context-aware suggestions improve productivity

### Negative
- Intent classification can be wrong
- Clarification questions add interaction steps
- More complex state management
- May feel slower than direct commands for power users

### Risks
- Over-relying on intent classification may frustrate users
- Context window limits may lose important history
- Suggestions may become annoying if not well-tuned

## Implementation Notes

1. **Phase 1**: Basic intent classification with rule-based approach
2. **Phase 2**: Conversation context tracking
3. **Phase 3**: Clarification flow for ambiguous inputs
4. **Phase 4**: Contextual suggestions engine
5. **Phase 5**: Project state awareness integration

Power users can always use explicit commands (`/run`, `/status`) to bypass natural language processing.

## Related ADRs
- ADR-001: Rich Terminal UI Architecture
- ADR-003: Keyboard Shortcuts System
