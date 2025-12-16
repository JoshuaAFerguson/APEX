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

  // Wait for the app to initialize with polling (max 2 seconds)
  const maxWaitTime = 2000;
  const pollInterval = 10;
  let waited = 0;

  while (waited < maxWaitTime) {
    const appInstance = (globalThis as Record<string, unknown>).__apexApp;
    if (appInstance) break;
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    waited += pollInterval;
  }

  // Helper to get the current app instance (may change during lifecycle)
  const getAppInstance = () => (globalThis as Record<string, unknown>).__apexApp as {
    addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
    updateState: (updates: Partial<AppState>) => void;
    getState: () => AppState;
  } | undefined;

  return {
    addMessage: (message) => {
      const instance = getAppInstance();
      if (instance) {
        instance.addMessage(message);
      } else {
        console.error('App not initialized - message dropped:', message.type);
      }
    },
    updateState: (updates) => {
      const instance = getAppInstance();
      if (instance) {
        instance.updateState(updates);
      }
    },
    getState: () => getAppInstance()?.getState() || initialState,
    waitUntilExit,
    unmount,
  };
}

export { App, type AppState, type AppProps, type Message } from './App.js';
export * from './components/index.js';
export * from './hooks/index.js';
