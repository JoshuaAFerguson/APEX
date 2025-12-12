import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import Fuse from 'fuse.js';
import { CompletionEngine, CompletionSuggestion, CompletionContext } from '../../services/CompletionEngine.js';

export interface Suggestion {
  value: string;
  description?: string;
  type?: 'command' | 'file' | 'agent' | 'workflow' | 'option';
  icon?: string;
}

export interface AdvancedInputProps {
  placeholder?: string;
  prompt?: string;
  value?: string;
  onSubmit?: (input: string) => void;
  onChange?: (input: string) => void;
  onCancel?: () => void;
  history?: string[];
  suggestions?: Suggestion[];
  multiline?: boolean;
  width?: number;
  showSuggestions?: boolean;
  autoComplete?: boolean;
  searchHistory?: boolean;
  completionEngine?: CompletionEngine;
  completionContext?: CompletionContext;
  debounceMs?: number;
}

/**
 * Advanced input component with tab completion, history search, and multi-line support
 */
export function AdvancedInput({
  placeholder = 'Type a command or describe what you want to do...',
  prompt = 'apex> ',
  value: initialValue = '',
  onSubmit,
  onChange,
  onCancel,
  history = [],
  suggestions = [],
  multiline = false,
  width = 80,
  showSuggestions = true,
  autoComplete = true,
  searchHistory = true,
  completionEngine,
  completionContext,
  debounceMs = 150,
}: AdvancedInputProps): React.ReactElement {
  const [input, setInput] = useState(initialValue);
  const [cursorPosition, setCursorPosition] = useState(initialValue.length);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isHistoryMode, setIsHistoryMode] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [showingSuggestions, setShowingSuggestions] = useState(false);
  const [isMultilineMode, setIsMultilineMode] = useState(false);
  const [lines, setLines] = useState([initialValue]);
  const [currentLine, setCurrentLine] = useState(0);
  const [engineSuggestions, setEngineSuggestions] = useState<CompletionSuggestion[]>([]);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Initialize fuzzy search for history
  const historyFuse = new Fuse(history, {
    threshold: 0.3,
    includeScore: true,
  });

  // Initialize fuzzy search for suggestions
  const suggestionsFuse = new Fuse(suggestions, {
    keys: ['value', 'description'],
    threshold: 0.4,
    includeScore: true,
  });

  useEffect(() => {
    onChange?.(input);
  }, [input, onChange]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  // Get completions from engine
  const updateCompletions = useCallback(async () => {
    if (completionEngine && completionContext && input.length > 0) {
      try {
        const completions = await completionEngine.getCompletions(
          input,
          cursorPosition,
          completionContext
        );
        setEngineSuggestions(completions);
      } catch (error) {
        console.error('Completion engine error:', error);
        setEngineSuggestions([]);
      }
    } else {
      setEngineSuggestions([]);
    }
  }, [completionEngine, completionContext, input, cursorPosition]);

  // Debounced completion updates
  useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (!showSuggestions || !input.trim()) {
      setFilteredSuggestions([]);
      setShowingSuggestions(false);
      setEngineSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      updateCompletions();
    }, debounceMs);

    setDebounceTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [input, showSuggestions, debounceMs, updateCompletions]);

  // Update suggestions based on current input and engine results
  useEffect(() => {
    if (!showSuggestions || !input.trim()) {
      setFilteredSuggestions([]);
      setShowingSuggestions(false);
      return;
    }

    // Combine static suggestions with engine suggestions
    const allSuggestions: Suggestion[] = [
      // Convert engine suggestions to Suggestion format
      ...engineSuggestions.map(s => ({
        value: s.value,
        description: s.description,
        type: s.type as any,
        icon: s.icon,
      })),
      // Add fallback fuzzy search on static suggestions if engine didn't provide many results
      ...(engineSuggestions.length < 5 ? suggestionsFuse.search(input).map(result => result.item).slice(0, 5) : [])
    ];

    // Deduplicate by value
    const seen = new Set<string>();
    const deduplicated = allSuggestions.filter(s => {
      if (seen.has(s.value)) return false;
      seen.add(s.value);
      return true;
    });

    setFilteredSuggestions(deduplicated.slice(0, 10));
    setShowingSuggestions(deduplicated.length > 0);
    setSelectedSuggestionIndex(deduplicated.length > 0 ? 0 : -1);
  }, [input, suggestions, engineSuggestions, showSuggestions]);

  const handleHistorySearch = useCallback((query: string) => {
    if (!searchHistory || !query.trim()) return [];

    const results = historyFuse.search(query);
    return results.map(result => result.item);
  }, [history, searchHistory]);

  const insertAtCursor = useCallback((text: string, position: number = cursorPosition) => {
    const before = input.substring(0, position);
    const after = input.substring(position);
    return before + text + after;
  }, [input, cursorPosition]);

  const deleteAtCursor = useCallback((length: number = 1, position: number = cursorPosition) => {
    const before = input.substring(0, Math.max(0, position - length));
    const after = input.substring(position);
    return before + after;
  }, [input, cursorPosition]);

  useInput((inputChar, key) => {
    // Handle Ctrl+C (cancel)
    if (key.ctrl && inputChar === 'c') {
      onCancel?.();
      return;
    }

    // Handle Ctrl+R (reverse history search)
    if (key.ctrl && inputChar === 'r') {
      setIsHistoryMode(!isHistoryMode);
      return;
    }

    // Handle Ctrl+L (clear)
    if (key.ctrl && inputChar === 'l') {
      setInput('');
      setCursorPosition(0);
      setHistoryIndex(-1);
      setIsHistoryMode(false);
      setShowingSuggestions(false);
      return;
    }

    // Handle Enter
    if (key.return) {
      if (multiline && key.shift) {
        // Shift+Enter: new line in multiline mode
        setIsMultilineMode(true);
        const newLines = [...lines];
        newLines.splice(currentLine + 1, 0, '');
        setLines(newLines);
        setCurrentLine(currentLine + 1);
        setInput(newLines.join('\n'));
        setCursorPosition(0);
        return;
      }

      // Regular enter: submit
      if (selectedSuggestionIndex >= 0 && showingSuggestions && filteredSuggestions.length > 0) {
        // Accept selected suggestion
        const suggestion = filteredSuggestions[selectedSuggestionIndex];
        setInput(suggestion.value);
        setShowingSuggestions(false);
        setSelectedSuggestionIndex(-1);
        onSubmit?.(suggestion.value);
      } else {
        onSubmit?.(isMultilineMode ? lines.join('\n') : input);
      }
      return;
    }

    // Handle Escape
    if (key.escape) {
      setShowingSuggestions(false);
      setIsHistoryMode(false);
      setSelectedSuggestionIndex(-1);
      return;
    }

    // Handle Tab (autocomplete)
    if (key.tab && autoComplete) {
      if (showingSuggestions && filteredSuggestions.length > 0) {
        const suggestion = filteredSuggestions[selectedSuggestionIndex >= 0 ? selectedSuggestionIndex : 0];

        // Smart completion: replace the word being completed
        let newInput = suggestion.value;
        let newCursorPos = suggestion.value.length;

        // Try to find what prefix we're completing
        const beforeCursor = input.substring(0, cursorPosition);
        const afterCursor = input.substring(cursorPosition);

        // For commands, replace from start or after whitespace
        if (suggestion.value.startsWith('/')) {
          const commandMatch = beforeCursor.match(/(\s|^)(\/\S*)$/);
          if (commandMatch) {
            const prefix = beforeCursor.substring(0, commandMatch.index! + commandMatch[1].length);
            newInput = prefix + suggestion.value + afterCursor;
            newCursorPos = prefix.length + suggestion.value.length;
          }
        }
        // For other completions, try to replace the current word
        else {
          const wordMatch = beforeCursor.match(/(\S+)$/);
          if (wordMatch) {
            const prefix = beforeCursor.substring(0, wordMatch.index!);
            newInput = prefix + suggestion.value + afterCursor;
            newCursorPos = prefix.length + suggestion.value.length;
          }
        }

        setInput(newInput);
        setCursorPosition(newCursorPos);
        setShowingSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }
      return;
    }

    // Handle arrow keys
    if (key.upArrow) {
      if (showingSuggestions) {
        // Navigate suggestions
        setSelectedSuggestionIndex(Math.max(0, selectedSuggestionIndex - 1));
      } else if (isHistoryMode) {
        // Navigate filtered history
        const filtered = handleHistorySearch(input);
        if (filtered.length > 0) {
          const newIndex = Math.max(0, historyIndex - 1);
          setHistoryIndex(newIndex);
          if (filtered[newIndex]) {
            setInput(filtered[newIndex]);
            setCursorPosition(filtered[newIndex].length);
          }
        }
      } else {
        // Navigate full history
        const newIndex = Math.min(history.length - 1, historyIndex + 1);
        setHistoryIndex(newIndex);
        if (history[history.length - 1 - newIndex]) {
          setInput(history[history.length - 1 - newIndex]);
          setCursorPosition(history[history.length - 1 - newIndex].length);
        }
      }
      return;
    }

    if (key.downArrow) {
      if (showingSuggestions) {
        // Navigate suggestions
        setSelectedSuggestionIndex(Math.min(filteredSuggestions.length - 1, selectedSuggestionIndex + 1));
      } else if (isHistoryMode) {
        // Navigate filtered history
        const filtered = handleHistorySearch(input);
        const newIndex = Math.min(filtered.length - 1, historyIndex + 1);
        setHistoryIndex(newIndex);
        if (filtered[newIndex]) {
          setInput(filtered[newIndex]);
          setCursorPosition(filtered[newIndex].length);
        }
      } else {
        // Navigate full history
        const newIndex = Math.max(-1, historyIndex - 1);
        setHistoryIndex(newIndex);
        if (newIndex === -1) {
          setInput('');
          setCursorPosition(0);
        } else if (history[history.length - 1 - newIndex]) {
          setInput(history[history.length - 1 - newIndex]);
          setCursorPosition(history[history.length - 1 - newIndex].length);
        }
      }
      return;
    }

    // Handle left/right arrows
    if (key.leftArrow) {
      setCursorPosition(Math.max(0, cursorPosition - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPosition(Math.min(input.length, cursorPosition + 1));
      return;
    }

    // Handle backspace
    if (key.backspace || key.delete) {
      if (input.length > 0 && cursorPosition > 0) {
        const newInput = deleteAtCursor(1);
        setInput(newInput);
        setCursorPosition(Math.max(0, cursorPosition - 1));
      }
      return;
    }

    // Handle regular characters
    if (inputChar && !key.meta && !key.ctrl) {
      const newInput = insertAtCursor(inputChar);
      setInput(newInput);
      setCursorPosition(cursorPosition + inputChar.length);
      setIsHistoryMode(false);
      setHistoryIndex(-1);
    }
  });

  const displayInput = input.substring(0, cursorPosition) + '▊' + input.substring(cursorPosition);

  return (
    <Box flexDirection="column" width={width}>
      {/* Main input line */}
      <Box>
        <Text color="cyan" bold>{prompt}</Text>
        <Text>{displayInput}</Text>
        {isHistoryMode && (
          <Text color="gray"> (reverse-i-search)</Text>
        )}
      </Box>

      {/* Multiline display */}
      {isMultilineMode && lines.length > 1 && (
        <Box flexDirection="column" marginLeft={prompt.length}>
          {lines.slice(1).map((line, index) => (
            <Text key={index}>
              {index === currentLine - 1 ? '▊' : ''}{line}
            </Text>
          ))}
        </Box>
      )}

      {/* Suggestions panel */}
      {showingSuggestions && filteredSuggestions.length > 0 && (
        <Box flexDirection="column" marginTop={1} marginLeft={prompt.length}>
          <Text color="gray" dimColor>
            Suggestions (Tab to complete):
          </Text>
          {filteredSuggestions.map((suggestion, index) => (
            <Box key={index}>
              <Text
                color={index === selectedSuggestionIndex ? 'cyan' : 'gray'}
                backgroundColor={index === selectedSuggestionIndex ? 'blue' : undefined}
              >
                {suggestion.icon && `${suggestion.icon} `}
                {suggestion.value}
                {suggestion.description && ` - ${suggestion.description}`}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Placeholder */}
      {!input && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            {placeholder}
          </Text>
        </Box>
      )}

      {/* Help text */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          {multiline ? 'Shift+Enter: new line • ' : ''}
          Tab: autocomplete • ↑↓: history • Ctrl+R: search • Ctrl+L: clear • Ctrl+C: cancel
        </Text>
      </Box>
    </Box>
  );
}

export default AdvancedInput;