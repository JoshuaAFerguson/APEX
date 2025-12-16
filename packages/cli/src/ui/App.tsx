import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import {
  AgentPanel,
  Banner,
  InputPrompt,
  PreviewPanel,
  ResponseStream,
  ServicesPanel,
  StatusBar,
  TaskProgress,
  ToolCall,
} from './components/index.js';
import type { AgentInfo } from './components/agents/AgentPanel.js';
import type { ApexConfig, Task, DisplayMode } from '@apexcli/core';
import type { ApexOrchestrator } from '@apexcli/orchestrator';
import { ConversationManager } from '../services/ConversationManager.js';
import { ShortcutManager, type ShortcutEvent } from '../services/ShortcutManager.js';
import { CompletionEngine, type CompletionContext } from '../services/CompletionEngine.js';

const VERSION = '0.3.0';

/**
 * Build agent list from workflow configuration for AgentPanel display
 * Note: This is a placeholder - workflows are loaded dynamically via loadWorkflow()
 * The actual agent list is populated via orchestrator events
 */
function getWorkflowAgents(_workflowName: string, _config: ApexConfig | null): AgentInfo[] {
  // Workflows are loaded separately via loadWorkflow(), not stored in config
  // The agent list is populated dynamically via orchestrator events (task:stage-changed)
  return [];
}

export interface Message {
  id: string;
  type: 'user' | 'assistant' | 'tool' | 'system' | 'error';
  content: string;
  agent?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  toolStatus?: 'pending' | 'running' | 'success' | 'error';
  toolDuration?: number;
  timestamp: Date;
}

export interface AppState {
  initialized: boolean;
  projectPath: string;
  config: ApexConfig | null;
  orchestrator: ApexOrchestrator | null;
  gitBranch?: string;
  currentTask?: Task;
  messages: Message[];
  inputHistory: string[];
  isProcessing: boolean;
  tokens: { input: number; output: number };
  cost: number;
  model: string;
  activeAgent?: string;
  apiUrl?: string;
  webUrl?: string;
  sessionStartTime?: Date;
  sessionName?: string;
  subtaskProgress?: { completed: number; total: number };

  // Display mode for UI customization
  displayMode: DisplayMode;

  // Agent handoff tracking
  previousAgent?: string;  // Previous agent for handoff animation

  // Parallel execution tracking
  parallelAgents?: AgentInfo[];  // Agents running in parallel
  showParallelPanel?: boolean;   // Whether to show parallel section

  // Preview mode state
  previewMode: boolean;
  pendingPreview?: {
    input: string;
    intent: {
      type: 'command' | 'task' | 'question' | 'clarification';
      confidence: number;
      command?: string;
      args?: string[];
      metadata?: Record<string, unknown>;
    };
    timestamp: Date;
  };
}

export interface AppProps {
  initialState: AppState;
  onCommand: (command: string, args: string[]) => Promise<void>;
  onTask: (description: string) => Promise<void>;
  onExit: () => void;
}

export function App({
  initialState,
  onCommand,
  onTask,
  onExit,
}: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>(initialState);
  const [showHelp, setShowHelp] = useState(false);
  const [conversationManager] = useState(() => new ConversationManager());
  const [shortcutManager] = useState(() => new ShortcutManager());
  const [completionEngine] = useState(() => new CompletionEngine());

  // Handle exit
  const handleExit = useCallback(() => {
    onExit();
    exit();
    // Fallback in case ink's exit doesn't work
    setTimeout(() => process.exit(0), 100);
  }, [exit, onExit]);

  // Method to add messages from outside
  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    // Add to conversation manager if it's an assistant or system message
    if (message.type === 'assistant' || message.type === 'system') {
      conversationManager.addMessage({
        role: message.type === 'assistant' ? 'assistant' : 'system',
        content: message.content,
        metadata: {
          agent: message.agent,
          toolName: message.toolName,
        },
      });
    }

    setState((prev) => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          ...message,
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          timestamp: new Date(),
        },
      ],
    }));
  }, [conversationManager]);

  // Setup shortcut manager event handlers
  useEffect(() => {
    // Clear screen
    shortcutManager.on('clear', () => {
      setState((prev) => ({ ...prev, messages: [] }));
      conversationManager.clearContext();
    });

    // Exit application
    shortcutManager.on('exit', () => {
      handleExit();
    });

    // Cancel operation
    shortcutManager.on('cancel', () => {
      if (state.isProcessing) {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          messages: [
            ...prev.messages,
            {
              id: `msg_${Date.now()}`,
              type: 'system',
              content: 'Operation cancelled.',
              timestamp: new Date(),
            },
          ],
        }));
      }
    });

    // Handle commands from shortcuts
    shortcutManager.on('command', async (payload?: unknown) => {
      const command = payload as string;
      if (typeof command === 'string') {
        const parts = command.startsWith('/') ? command.slice(1).split(/\s+/) : command.split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        if (cmd === 'exit' || cmd === 'quit') {
          handleExit();
          return;
        }

        if (cmd === 'clear') {
          setState((prev) => ({ ...prev, messages: [] }));
          conversationManager.clearContext();
          return;
        }

        if (cmd === 'help') {
          setShowHelp(true);
          setTimeout(() => setShowHelp(false), 10000);
          return;
        }

        if (cmd === 'compact') {
          setState((prev) => ({ ...prev, displayMode: 'compact' }));
          return;
        }

        if (cmd === 'verbose') {
          setState((prev) => ({ ...prev, displayMode: 'verbose' }));
          return;
        }

        setState((prev) => ({ ...prev, isProcessing: true }));
        try {
          await onCommand(cmd, args);
        } finally {
          setState((prev) => ({ ...prev, isProcessing: false }));
        }
      }
    });

    // These events will be handled by InputPrompt/AdvancedInput components
    // We're just setting up the manager here

    return () => {
      // Cleanup if needed
    };
  }, [shortcutManager, handleExit, conversationManager, state.isProcessing, onCommand]);

  // Get smart suggestions from ConversationManager
  const getSmartSuggestions = useCallback(() => {
    const baseSuggestions = conversationManager.getSuggestions();
    const commands = [
      '/help',
      '/init',
      '/status',
      '/agents',
      '/workflows',
      '/config',
      '/logs',
      '/cancel',
      '/retry',
      '/serve',
      '/web',
      '/stop',
      '/compact',
      '/verbose',
      '/preview',
      '/clear',
      '/exit',
      '/quit',
      '/q',
    ];

    // Combine smart suggestions with available commands
    return [...baseSuggestions, ...commands];
  }, [conversationManager]);

  // Handle global keyboard shortcuts
  useInput((input, key) => {
    // Handle preview mode navigation first
    if (state.pendingPreview) {
      if (key.return) {
        // Confirm - execute the pending action
        const pendingPreview = state.pendingPreview;
        setState((prev) => ({ ...prev, pendingPreview: undefined }));

        // Execute the original input
        handleInput(pendingPreview.input);
        return;
      } else if (key.escape) {
        // Cancel - clear the preview
        setState(prev => ({ ...prev, pendingPreview: undefined }));
        addMessage({ type: 'system', content: 'Preview cancelled.' });
        return;
      } else if (input?.toLowerCase() === 'e') {
        // Edit - return input to text box for modification (this would need InputPrompt coordination)
        setState(prev => ({ ...prev, pendingPreview: undefined }));
        addMessage({ type: 'system', content: 'Edit mode not yet implemented.' });
        return;
      }
      // Don't process other shortcuts in preview mode
      return;
    }

    // Convert ink key event to ShortcutEvent
    const shortcutEvent: ShortcutEvent = {
      key: input || (key.tab ? 'Tab' : key.escape ? 'Escape' : key.return ? 'Enter' : ''),
      ctrl: !!key.ctrl,
      alt: !!key.meta, // In ink, meta is alt on some systems
      shift: !!key.shift,
      meta: !!key.meta,
    };

    // Set context based on current state
    if (state.isProcessing) {
      shortcutManager.pushContext('processing');
    } else {
      shortcutManager.pushContext('idle');
    }

    // Try to handle the shortcut
    const handled = shortcutManager.handleKey(shortcutEvent);

    // Pop the context we pushed
    shortcutManager.popContext();

    // If shortcut was handled, don't do anything else
    if (handled) {
      return;
    }

    // Legacy fallback handling for specific keys not covered by ShortcutManager
    // These will be gradually moved to ShortcutManager
  });

  const handleInput = useCallback(
    async (input: string) => {
      // Add to conversation context
      conversationManager.addMessage({
        role: 'user',
        content: input,
      });

      // Add to history
      setState((prev) => ({
        ...prev,
        inputHistory: [...prev.inputHistory, input],
      }));

      // Check if this is a clarification response
      if (conversationManager.hasPendingClarification()) {
        const clarification = conversationManager.provideClarification(input);
        if (clarification.matched) {
          addMessage({
            type: 'system',
            content: `Clarification received: ${clarification.value}`,
          });
          // Continue with the task that requested clarification
          return;
        } else {
          addMessage({
            type: 'error',
            content: 'Please provide a valid response to the clarification request.',
          });
          return;
        }
      }

      // Detect intent
      const intent = conversationManager.detectIntent(input);

      // Check if preview mode is enabled and this isn't the preview command itself
      if (state.previewMode && !input.startsWith('/preview')) {
        // Parse command/task details
        let command: string | undefined;
        let args: string[] = [];

        if (input.startsWith('/')) {
          const parts = input.slice(1).split(/\s+/);
          command = parts[0].toLowerCase();
          args = parts.slice(1);
        }

        // Store pending preview
        setState((prev) => ({
          ...prev,
          pendingPreview: {
            input,
            intent: {
              type: intent.type,
              confidence: intent.confidence,
              command,
              args,
              metadata: intent.metadata,
            },
            timestamp: new Date(),
          },
        }));

        // Don't execute - show preview panel instead
        return;
      }

      // Handle pending preview confirmation (if user is navigating preview)
      if (state.pendingPreview) {
        // Preview confirmation is handled by keyboard events, not text input
        // If we reach here, treat it as normal input processing
        setState((prev) => ({ ...prev, pendingPreview: undefined }));
      }

      // Check if it's a command
      if (input.startsWith('/') || intent.type === 'command') {
        const parts = input.startsWith('/') ? input.slice(1).split(/\s+/) : input.split(/\s+/);
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        // Handle exit specially
        if (command === 'exit' || command === 'quit' || command === 'q') {
          handleExit();
          return;
        }

        // Handle clear
        if (command === 'clear') {
          setState((prev) => ({ ...prev, messages: [] }));
          conversationManager.clearContext();
          return;
        }

        // Handle help
        if (command === 'help' || command === 'h' || command === '?') {
          setShowHelp(true);
          setTimeout(() => setShowHelp(false), 10000);
          return;
        }

        // Handle display mode commands
        if (command === 'compact') {
          setState((prev) => ({
            ...prev,
            displayMode: 'compact',
            messages: [
              ...prev.messages,
              {
                id: `msg_${Date.now()}`,
                type: 'system',
                content: 'Display mode set to compact: Single-line status, condensed output',
                timestamp: new Date(),
              },
            ],
          }));
          return;
        }

        if (command === 'verbose') {
          setState((prev) => ({
            ...prev,
            displayMode: 'verbose',
            messages: [
              ...prev.messages,
              {
                id: `msg_${Date.now()}`,
                type: 'system',
                content: 'Display mode set to verbose: Detailed debug output, full information',
                timestamp: new Date(),
              },
            ],
          }));
          return;
        }

        // Other commands
        setState((prev) => ({ ...prev, isProcessing: true }));
        try {
          await onCommand(command, args);
        } finally {
          setState((prev) => ({ ...prev, isProcessing: false }));
        }
      } else {
        // It's a task description or question
        setState((prev) => ({
          ...prev,
          isProcessing: true,
          messages: [
            ...prev.messages,
            {
              id: `msg_${Date.now()}`,
              type: 'user',
              content: input,
              timestamp: new Date(),
            },
          ],
        }));

        // Add intent detection feedback for low confidence
        if (intent.confidence < 0.7) {
          addMessage({
            type: 'system',
            content: `Interpreting as ${intent.type} (confidence: ${Math.round(intent.confidence * 100)}%)`,
          });
        }

        try {
          if (intent.type === 'question') {
            // Handle as a question - could be routed to a specific agent or handled differently
            await onTask(`Answer this question: ${input}`);
          } else {
            // Handle as a task
            await onTask(input);
          }
        } finally {
          setState((prev) => ({ ...prev, isProcessing: false }));
        }
      }
    },
    [handleExit, onCommand, onTask, conversationManager, addMessage]
  );

  // Method to update state from outside
  const updateState = useCallback((updates: Partial<AppState>) => {
    // Sync task and agent info with conversation manager
    if (updates.currentTask) {
      conversationManager.setTask(updates.currentTask.id);
    }
    if (updates.activeAgent) {
      conversationManager.setAgent(updates.activeAgent);
    }
    if ('currentTask' in updates && !updates.currentTask) {
      conversationManager.clearTask();
    }
    if ('activeAgent' in updates && !updates.activeAgent) {
      conversationManager.clearAgent();
    }

    setState((prev) => ({ ...prev, ...updates }));
  }, [conversationManager]);

  // Expose methods for external use
  useEffect(() => {
    (globalThis as Record<string, unknown>).__apexApp = {
      addMessage,
      updateState,
      getState: () => state,
    };
    return () => {
      delete (globalThis as Record<string, unknown>).__apexApp;
    };
  }, [addMessage, updateState, state]);

  return (
    <Box flexDirection="column" minHeight={20}>
      {/* Banner */}
      <Banner
        version={VERSION}
        projectPath={state.projectPath}
        initialized={state.initialized}
      />

      {/* Services Panel - shows when API or Web UI are running */}
      <ServicesPanel apiUrl={state.apiUrl} webUrl={state.webUrl} />

      {/* Preview Panel - shows when there's a pending preview */}
      {state.pendingPreview && (
        <PreviewPanel
          input={state.pendingPreview.input}
          intent={state.pendingPreview.intent}
          workflow={state.pendingPreview.intent.metadata?.suggestedWorkflow as string}
          onConfirm={() => {
            const pendingPreview = state.pendingPreview!;
            setState((prev) => ({ ...prev, pendingPreview: undefined }));
            handleInput(pendingPreview.input);
          }}
          onCancel={() => {
            setState(prev => ({ ...prev, pendingPreview: undefined }));
            addMessage({ type: 'system', content: 'Preview cancelled.' });
          }}
          onEdit={() => {
            setState(prev => ({ ...prev, pendingPreview: undefined }));
            addMessage({ type: 'system', content: 'Edit mode not yet implemented.' });
          }}
        />
      )}

      {/* Help overlay */}
      {showHelp && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
          paddingX={2}
          paddingY={1}
          marginBottom={1}
        >
          <Text bold color="cyan">
            Available Commands:
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Text>
              <Text color="yellow">/init</Text>
              <Text color="gray"> - Initialize APEX in current directory</Text>
            </Text>
            <Text>
              <Text color="yellow">/status</Text>
              <Text color="gray"> - Show task status</Text>
            </Text>
            <Text>
              <Text color="yellow">/agents</Text>
              <Text color="gray"> - List available agents</Text>
            </Text>
            <Text>
              <Text color="yellow">/workflows</Text>
              <Text color="gray"> - List available workflows</Text>
            </Text>
            <Text>
              <Text color="yellow">/config</Text>
              <Text color="gray"> - View/edit configuration</Text>
            </Text>
            <Text>
              <Text color="yellow">/serve</Text>
              <Text color="gray"> - Start API server</Text>
            </Text>
            <Text>
              <Text color="yellow">/web</Text>
              <Text color="gray"> - Start Web UI</Text>
            </Text>
            <Text>
              <Text color="yellow">/compact</Text>
              <Text color="gray"> - Toggle compact display mode</Text>
            </Text>
            <Text>
              <Text color="yellow">/verbose</Text>
              <Text color="gray"> - Toggle verbose display mode</Text>
            </Text>
            <Text>
              <Text color="yellow">/preview</Text>
              <Text color="gray"> - Toggle input preview mode</Text>
            </Text>
            <Text>
              <Text color="yellow">/clear</Text>
              <Text color="gray"> - Clear messages</Text>
            </Text>
            <Text>
              <Text color="yellow">/exit</Text>
              <Text color="gray"> - Exit APEX</Text>
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray">Or just type a task description to execute it.</Text>
          </Box>
        </Box>
      )}

      {/* Messages area */}
      <Box flexDirection="column" flexGrow={1} marginBottom={1}>
        {state.messages.slice(-20).filter((msg) => {
          // Filter messages based on display mode
          if (state.displayMode === 'compact') {
            // In compact mode, hide system messages and tool calls to save space
            return msg.type !== 'system' && msg.type !== 'tool';
          } else if (state.displayMode === 'verbose') {
            // In verbose mode, show all messages including debug info
            return true;
          } else {
            // In normal mode, show most messages but may filter some debug info
            return true;
          }
        }).map((msg) => {
          if (msg.type === 'tool' && msg.toolName) {
            return (
              <ToolCall
                key={msg.id}
                toolName={msg.toolName}
                input={msg.toolInput}
                output={msg.toolOutput}
                status={msg.toolStatus || 'success'}
                duration={msg.toolDuration}
              />
            );
          }

          return (
            <ResponseStream
              key={msg.id}
              content={msg.content}
              agent={msg.agent}
              type={msg.type === 'error' ? 'error' : msg.type === 'system' ? 'system' : 'text'}
            />
          );
        })}

        {/* Current task progress */}
        {state.currentTask && (
          <>
            <TaskProgress
              taskId={state.currentTask.id}
              description={state.currentTask.description}
              status={state.currentTask.status}
              workflow={state.currentTask.workflow}
              agent={state.activeAgent}
              tokens={state.tokens}
              cost={state.cost}
            />
            <AgentPanel
              agents={getWorkflowAgents(state.currentTask.workflow, state.config)}
              currentAgent={state.activeAgent}
              showParallel={state.showParallelPanel}
              parallelAgents={state.parallelAgents}
            />
          </>
        )}
      </Box>

      {/* Input prompt */}
      <InputPrompt
        prompt={conversationManager.hasPendingClarification() ? "clarify>" : "apex>"}
        placeholder={
          conversationManager.hasPendingClarification()
            ? "Please provide clarification..."
            : "Type a task or /help for commands..."
        }
        onSubmit={handleInput}
        onCancel={() => handleExit()}
        history={state.inputHistory}
        suggestions={getSmartSuggestions()}
        disabled={state.isProcessing}
      />

      {/* Status bar */}
      <StatusBar
        gitBranch={state.gitBranch}
        tokens={state.tokens}
        cost={state.cost}
        model={state.model}
        agent={state.activeAgent}
        isConnected={state.initialized}
        apiUrl={state.apiUrl}
        webUrl={state.webUrl}
        sessionStartTime={state.sessionStartTime}
        sessionName={state.sessionName}
        subtaskProgress={state.subtaskProgress}
        displayMode={state.displayMode}
        previewMode={state.previewMode}
      />
    </Box>
  );
}
