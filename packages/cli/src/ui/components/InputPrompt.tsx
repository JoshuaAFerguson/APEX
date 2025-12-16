import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { AdvancedInput, type Suggestion } from './AdvancedInput.js';
import { CompletionEngine, type CompletionContext } from '../../services/CompletionEngine.js';
import { ShortcutManager } from '../../services/ShortcutManager.js';

export interface InputPromptProps {
  prompt?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel?: () => void;
  history?: string[];
  suggestions?: string[];
  disabled?: boolean;
  completionEngine?: CompletionEngine;
  completionContext?: CompletionContext;
  shortcutManager?: ShortcutManager;
  initialValue?: string;
  onValueCleared?: () => void;
}

export function InputPrompt({
  prompt = 'apex>',
  placeholder = 'Type a task or /help for commands...',
  onSubmit,
  onCancel,
  history = [],
  suggestions = [],
  disabled = false,
  completionEngine,
  completionContext,
  shortcutManager,
  initialValue,
  onValueCleared,
}: InputPromptProps): React.ReactElement {
  const [value, setValue] = useState(initialValue || '');

  // Handle initialValue updates (for edit mode)
  useEffect(() => {
    if (initialValue !== undefined) {
      setValue(initialValue);
      // Clear the initial value to avoid re-setting on subsequent renders
      onValueCleared?.();
    }
  }, [initialValue, onValueCleared]);

  // Convert string suggestions to Suggestion objects
  const suggestionObjects: Suggestion[] = suggestions.map(s => ({
    value: s,
    type: s.startsWith('/') ? 'command' : 'option',
    description: s.startsWith('/') ? 'Command' : undefined,
  }));

  const handleSubmit = (submittedValue: string) => {
    if (submittedValue.trim()) {
      onSubmit(submittedValue.trim());
      setValue('');
    }
  };

  const handleChange = (newValue: string) => {
    setValue(newValue);
  };

  const handleCancel = () => {
    setValue('');
    onCancel?.();
  };

  if (disabled) {
    return (
      <Box>
        <Text color="cyan" bold>
          {prompt}{' '}
        </Text>
        <Text color="gray">Processing...</Text>
      </Box>
    );
  }

  return (
    <AdvancedInput
      prompt={`${prompt} `}
      placeholder={placeholder}
      value={value}
      onSubmit={handleSubmit}
      onChange={handleChange}
      onCancel={handleCancel}
      history={history}
      suggestions={suggestionObjects}
      completionEngine={completionEngine}
      completionContext={completionContext}
      multiline={false}
      autoComplete={true}
      searchHistory={true}
    />
  );
}
