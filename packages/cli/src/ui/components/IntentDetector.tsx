import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Fuse from 'fuse.js';

export interface Intent {
  type: 'command' | 'task' | 'question' | 'config' | 'help' | 'navigation';
  confidence: number;
  command?: string;
  parameters?: Record<string, string>;
  suggestions?: string[];
  description?: string;
}

export interface IntentDetectorProps {
  input: string;
  commands: Array<{
    name: string;
    aliases: string[];
    description: string;
    examples?: string[];
  }>;
  onIntentDetected?: (intent: Intent) => void;
  showSuggestions?: boolean;
  minConfidence?: number;
}

/**
 * Intelligent intent detection for natural language input
 */
export function IntentDetector({
  input,
  commands,
  onIntentDetected,
  showSuggestions = true,
  minConfidence = 0.3,
}: IntentDetectorProps): React.ReactElement {
  const [detectedIntent, setDetectedIntent] = useState<Intent | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Command patterns for better matching
  const commandPatterns = [
    { pattern: /^\/(\w+)/, type: 'command' as const },
    { pattern: /^(list|show|display)\s+(\w+)/, type: 'command' as const },
    { pattern: /^(help|how|what|explain)/, type: 'help' as const },
    { pattern: /^(config|configure|set|get)\s+(\w+)/, type: 'config' as const },
    { pattern: /\?$/, type: 'question' as const },
    { pattern: /^(create|make|build|add|implement|develop)/, type: 'task' as const },
    { pattern: /^(fix|repair|debug|solve|resolve)/, type: 'task' as const },
    { pattern: /^(update|modify|change|edit)/, type: 'task' as const },
    { pattern: /^(remove|delete|clean|clear)/, type: 'task' as const },
    { pattern: /^(test|check|verify|validate)/, type: 'task' as const },
    { pattern: /^(deploy|release|publish)/, type: 'task' as const },
    { pattern: /^(go to|navigate to|open|cd)/, type: 'navigation' as const },
  ];

  // Task templates for common requests
  const taskTemplates = [
    {
      keywords: ['create', 'add', 'new', 'make', 'build'],
      template: 'Create a new {item}',
      examples: ['component', 'file', 'function', 'test', 'feature'],
    },
    {
      keywords: ['fix', 'repair', 'debug', 'solve'],
      template: 'Fix {issue}',
      examples: ['bug', 'error', 'problem', 'issue'],
    },
    {
      keywords: ['update', 'modify', 'change', 'edit'],
      template: 'Update {target}',
      examples: ['code', 'file', 'configuration', 'documentation'],
    },
    {
      keywords: ['remove', 'delete', 'clean'],
      template: 'Remove {target}',
      examples: ['file', 'code', 'dependency', 'feature'],
    },
    {
      keywords: ['test', 'check', 'verify'],
      template: 'Test {target}',
      examples: ['code', 'function', 'component', 'application'],
    },
  ];

  // Initialize fuzzy search for commands
  const commandFuse = new Fuse(commands, {
    keys: ['name', 'aliases', 'description', 'examples'],
    threshold: 0.4,
    includeScore: true,
  });

  const detectIntent = (userInput: string): Intent => {
    const trimmedInput = userInput.trim().toLowerCase();

    // Check for exact command matches first
    for (const command of commands) {
      if (trimmedInput.startsWith(`/${command.name}`) ||
          command.aliases.some(alias => trimmedInput.startsWith(`/${alias}`))) {
        return {
          type: 'command',
          confidence: 1.0,
          command: command.name,
          description: `Execute ${command.name} command`,
        };
      }
    }

    // Check patterns
    for (const { pattern, type } of commandPatterns) {
      const match = trimmedInput.match(pattern);
      if (match) {
        if (type === 'command') {
          const commandName = match[1] || match[2];
          const fuzzyResults = commandFuse.search(commandName);
          if (fuzzyResults.length > 0 && fuzzyResults[0].score! < 0.5) {
            return {
              type: 'command',
              confidence: 1 - fuzzyResults[0].score!,
              command: fuzzyResults[0].item.name,
              description: `Execute ${fuzzyResults[0].item.name} command`,
            };
          }
        }

        return {
          type,
          confidence: 0.8,
          description: getIntentDescription(type, match),
          suggestions: getIntentSuggestions(type, trimmedInput),
        };
      }
    }

    // Fuzzy search for command similarity
    const fuzzyResults = commandFuse.search(trimmedInput);
    if (fuzzyResults.length > 0 && fuzzyResults[0].score! < 0.6) {
      return {
        type: 'command',
        confidence: 1 - fuzzyResults[0].score!,
        command: fuzzyResults[0].item.name,
        description: `Did you mean: ${fuzzyResults[0].item.name}?`,
        suggestions: [
          `/${fuzzyResults[0].item.name}`,
          ...fuzzyResults.slice(1, 3).map(r => `/${r.item.name}`),
        ],
      };
    }

    // Check for task templates
    for (const template of taskTemplates) {
      const hasKeyword = template.keywords.some(keyword =>
        trimmedInput.includes(keyword)
      );
      if (hasKeyword) {
        return {
          type: 'task',
          confidence: 0.7,
          description: 'Natural language task detected',
          suggestions: template.examples.map(ex =>
            template.template.replace('{item}', ex).replace('{issue}', ex).replace('{target}', ex)
          ),
        };
      }
    }

    // Default to task if input is descriptive
    if (trimmedInput.length > 10 && !trimmedInput.startsWith('/')) {
      return {
        type: 'task',
        confidence: 0.5,
        description: 'Interpreting as natural language task description',
        suggestions: [
          'Use specific action words like "create", "fix", "update"',
          'Try using a command like /run "' + userInput + '"',
          'Ask for help with /help',
        ],
      };
    }

    return {
      type: 'help',
      confidence: 0.3,
      description: 'Unable to determine intent',
      suggestions: [
        'Use /help to see available commands',
        'Start with an action word like "create", "fix", or "update"',
        'Use "/" followed by a command name',
      ],
    };
  };

  const getIntentDescription = (type: string, match: RegExpMatchArray): string => {
    switch (type) {
      case 'help':
        return 'Looking for help or information';
      case 'config':
        return 'Configuration operation detected';
      case 'question':
        return 'Question about the system';
      case 'task':
        return 'Task description detected';
      case 'navigation':
        return 'Navigation command detected';
      default:
        return 'Command pattern detected';
    }
  };

  const getIntentSuggestions = (type: string, input: string): string[] => {
    switch (type) {
      case 'help':
        return ['/help', '/agents', '/workflows', '/status'];
      case 'config':
        return ['/config get', '/config set', '/config --json'];
      case 'question':
        return ['/help', '/agents --help', '/workflows --help'];
      case 'task':
        return ['/run "' + input + '"', 'Be more specific', 'Use action words'];
      case 'navigation':
        return ['/status', '/logs', '/config'];
      default:
        return [];
    }
  };

  useEffect(() => {
    if (!input.trim()) {
      setDetectedIntent(null);
      return;
    }

    setIsLoading(true);

    // Add small delay to avoid constant re-computation
    const timer = setTimeout(() => {
      const intent = detectIntent(input);

      if (intent.confidence >= minConfidence) {
        setDetectedIntent(intent);
        onIntentDetected?.(intent);
      } else {
        setDetectedIntent(null);
      }

      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [input, minConfidence, onIntentDetected]);

  if (!detectedIntent && !isLoading) return <></>;

  const getIntentIcon = (type: string): { icon: string; color: string } => {
    switch (type) {
      case 'command':
        return { icon: '⚡', color: 'cyan' };
      case 'task':
        return { icon: '📝', color: 'green' };
      case 'question':
        return { icon: '❓', color: 'yellow' };
      case 'config':
        return { icon: '⚙️', color: 'blue' };
      case 'help':
        return { icon: '💡', color: 'magenta' };
      case 'navigation':
        return { icon: '🧭', color: 'purple' };
      default:
        return { icon: '🤖', color: 'gray' };
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'green';
    if (confidence >= 0.6) return 'yellow';
    return 'red';
  };

  if (isLoading) {
    return (
      <Box>
        <Text color="gray" dimColor>Analyzing intent...</Text>
      </Box>
    );
  }

  if (!detectedIntent) return <></>;

  const { icon, color } = getIntentIcon(detectedIntent.type);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
      {/* Intent header */}
      <Box justifyContent="space-between">
        <Box>
          <Text color={color}>{icon} </Text>
          <Text color="white" bold>
            {detectedIntent.type.charAt(0).toUpperCase() + detectedIntent.type.slice(1)} Intent
          </Text>
        </Box>
        <Text color={getConfidenceColor(detectedIntent.confidence)}>
          {Math.round(detectedIntent.confidence * 100)}%
        </Text>
      </Box>

      {/* Description */}
      {detectedIntent.description && (
        <Box marginLeft={2}>
          <Text color="gray">{detectedIntent.description}</Text>
        </Box>
      )}

      {/* Command suggestion */}
      {detectedIntent.command && (
        <Box marginLeft={2}>
          <Text color="cyan">Command: /{detectedIntent.command}</Text>
        </Box>
      )}

      {/* Suggestions */}
      {showSuggestions && detectedIntent.suggestions && detectedIntent.suggestions.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow" bold>Suggestions:</Text>
          {detectedIntent.suggestions.slice(0, 3).map((suggestion, index) => (
            <Box key={index} marginLeft={2}>
              <Text color="gray">• </Text>
              <Text color="white">{suggestion}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export interface SmartSuggestionsProps {
  input: string;
  history: string[];
  context?: {
    currentDirectory?: string;
    activeTask?: string;
    lastCommand?: string;
    recentFiles?: string[];
  };
  onSuggestion?: (suggestion: string) => void;
  maxSuggestions?: number;
}

/**
 * Smart suggestions based on context and history
 */
export function SmartSuggestions({
  input,
  history,
  context,
  onSuggestion,
  maxSuggestions = 5,
}: SmartSuggestionsProps): React.ReactElement {
  const [suggestions, setSuggestions] = useState<Array<{
    text: string;
    type: 'history' | 'completion' | 'context';
    score: number;
  }>>([]);

  useEffect(() => {
    const generateSuggestions = () => {
      const allSuggestions: Array<{
        text: string;
        type: 'history' | 'completion' | 'context';
        score: number;
      }> = [];

      // History-based suggestions
      const historyFuse = new Fuse(history, { threshold: 0.3 });
      const historyResults = historyFuse.search(input);
      historyResults.slice(0, 3).forEach(result => {
        allSuggestions.push({
          text: result.item,
          type: 'history',
          score: 1 - (result.score || 0),
        });
      });

      // Context-based suggestions
      if (context?.activeTask) {
        allSuggestions.push({
          text: `/status ${context.activeTask}`,
          type: 'context',
          score: 0.8,
        });
        allSuggestions.push({
          text: `/logs ${context.activeTask}`,
          type: 'context',
          score: 0.7,
        });
      }

      if (context?.recentFiles && context.recentFiles.length > 0) {
        context.recentFiles.slice(0, 2).forEach((file, index) => {
          allSuggestions.push({
            text: `Edit ${file}`,
            type: 'context',
            score: 0.6 - (index * 0.1),
          });
        });
      }

      // Command completions
      const commandCompletions = [
        'Create a new React component',
        'Fix the failing tests',
        'Update the documentation',
        'Add error handling',
        'Optimize performance',
        'Refactor the code',
      ];

      if (input.length >= 3) {
        commandCompletions.forEach(completion => {
          if (completion.toLowerCase().includes(input.toLowerCase())) {
            allSuggestions.push({
              text: completion,
              type: 'completion',
              score: 0.5,
            });
          }
        });
      }

      // Sort by score and take top suggestions
      const topSuggestions = allSuggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, maxSuggestions);

      setSuggestions(topSuggestions);
    };

    if (input.trim().length >= 2) {
      generateSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [input, history, context, maxSuggestions]);

  if (suggestions.length === 0) return <></>;

  const getTypeIcon = (type: string): { icon: string; color: string } => {
    switch (type) {
      case 'history':
        return { icon: '⏱️', color: 'blue' };
      case 'completion':
        return { icon: '💡', color: 'yellow' };
      case 'context':
        return { icon: '🎯', color: 'green' };
      default:
        return { icon: '💭', color: 'gray' };
    }
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="blue" paddingX={1}>
      <Text color="blue" bold>Smart Suggestions</Text>

      {suggestions.map((suggestion, index) => {
        const { icon, color } = getTypeIcon(suggestion.type);
        return (
          <Box key={index} marginLeft={1}>
            <Text color={color}>{icon} </Text>
            <Text color="white">{suggestion.text}</Text>
            <Text color="gray" dimColor> ({Math.round(suggestion.score * 100)}%)</Text>
          </Box>
        );
      })}
    </Box>
  );
}

export default IntentDetector;