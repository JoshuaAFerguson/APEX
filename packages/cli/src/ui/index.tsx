import React from 'react';
import { render } from 'ink';
import { App, type AppState, type Message } from './App.js';
import type { ApexConfig } from '@apex/core';
import type { ApexOrchestrator } from '@apex/orchestrator';

export interface InkAppInstance {
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateState: (updates: Partial<AppState>) => void;
  getState: () => AppState;
  waitUntilExit: () => Promise<void>;
  unmount: () => void;
}

export interface StartInkAppOptions {
  projectPath: string;
  initialized: boolean;
  config: ApexConfig | null;
  orchestrator: ApexOrchestrator | null;
  gitBranch?: string;
  onCommand: (command: string, args: string[]) => Promise<void>;
  onTask: (description: string) => Promise<void>;
  onExit: () => void;
}

export async function startInkApp(options: StartInkAppOptions): Promise<InkAppInstance> {
  const {
    projectPath,
    initialized,
    config,
    orchestrator,
    gitBranch,
    onCommand,
    onTask,
    onExit,
  } = options;

  const initialState: AppState = {
    initialized,
    projectPath,
    config,
    orchestrator,
    gitBranch,
    messages: [],
    inputHistory: [],
    isProcessing: false,
    tokens: { input: 0, output: 0 },
    cost: 0,
    model: config?.models?.implementation || 'sonnet',
    sessionStartTime: new Date(),
    sessionName: `Session ${new Date().toLocaleDateString()}`,
  };

  const { waitUntilExit, unmount } = render(
    <App
      initialState={initialState}
      onCommand={onCommand}
      onTask={onTask}
      onExit={onExit}
    />
  );

  // Wait a tick for the app to initialize
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Get the app instance from global
  const appInstance = (globalThis as Record<string, unknown>).__apexApp as {
    addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
    updateState: (updates: Partial<AppState>) => void;
    getState: () => AppState;
  } | undefined;

  return {
    addMessage: (message) => appInstance?.addMessage(message),
    updateState: (updates) => appInstance?.updateState(updates),
    getState: () => appInstance?.getState() || initialState,
    waitUntilExit,
    unmount,
  };
}

export { App, type AppState, type AppProps, type Message } from './App.js';
export * from './components/index.js';
