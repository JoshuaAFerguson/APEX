/**
 * Test helper that simulates the REPL handleServe function
 * This mimics the functionality found in packages/cli/src/repl.tsx
 */

import { spawn, SpawnOptions, ChildProcess } from 'child_process';
import path from 'path';

// Mock context similar to the real REPL context
const mockContext = {
  initialized: true,
  cwd: '/mock/project',
  apiProcess: null as any,
  apiPort: 3000,
  app: {
    addMessage: (msg: any) => {},
    updateState: (state: any) => {}
  }
};

// Create a global context for testing
(global as any).ctx = mockContext;

/**
 * Simulates the REPL handleServe function
 * Based on the actual implementation in packages/cli/src/repl.tsx
 */
export async function handleServe(args: string[]): Promise<void> {
  const ctx = (global as any).ctx;

  if (!ctx.initialized) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'APEX not initialized. Run /init first.',
    });
    return;
  }

  if (ctx.apiProcess) {
    ctx.app?.addMessage({
      type: 'system',
      content: 'API server is already running.',
    });
    return;
  }

  let port = ctx.apiPort ?? 3000;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' || args[i] === '-p') {
      port = parseInt(args[++i], 10);
    }
  }

  ctx.app?.addMessage({
    type: 'system',
    content: `Starting API server on port ${port}...`,
  });

  try {
    // Find the API package path
    const apiPath = path.resolve(__dirname, '../../api');

    // Spawn the API server as a background process
    const proc = spawn('node', [path.join(apiPath, 'dist/index.js')], {
      cwd: ctx.cwd,
      env: {
        ...process.env,
        PORT: port.toString(),
        APEX_PROJECT: ctx.cwd,
        APEX_SILENT: '1',
      },
      stdio: 'ignore',
      detached: true,
    });

    proc.unref();
    ctx.apiProcess = proc;
    ctx.apiPort = port;
    const apiUrl = `http://localhost:${port}`;

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 1500));

    ctx.app?.updateState({ apiUrl });
    ctx.app?.addMessage({
      type: 'assistant',
      content: `API server running at ${apiUrl}`,
    });
  } catch (error: unknown) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Failed to start API server: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * Reset context for testing
 */
export function resetContext(overrides: Partial<typeof mockContext> = {}) {
  Object.assign(mockContext, {
    initialized: true,
    cwd: '/mock/project',
    apiProcess: null,
    apiPort: 3000,
    app: {
      addMessage: () => {},
      updateState: () => {}
    },
    ...overrides
  });
  (global as any).ctx = mockContext;
}