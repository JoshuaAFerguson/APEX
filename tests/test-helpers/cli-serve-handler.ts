/**
 * Test helper that simulates the CLI serve command handler
 * This mimics the functionality found in packages/cli/src/index.ts
 */

import { spawn, SpawnOptions, ChildProcess } from 'child_process';
import path from 'path';

interface CliContext {
  initialized: boolean;
  cwd: string;
  apiProcess: any;
  apiPort: number;
  app?: {
    addMessage: (msg: any) => void;
    updateState: (state: any) => void;
  };
}

/**
 * Simulates the CLI serve command handler
 * Based on the actual implementation in packages/cli/src/index.ts
 */
export async function handleServeCommand(ctx: CliContext, args: string[]): Promise<void> {
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

  let port = ctx.apiPort;
  let keepAlive = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' || args[i] === '-p') {
      port = parseInt(args[++i], 10);
    } else if (args[i] === '--keep-alive' || args[i] === '--foreground') {
      keepAlive = true;
    }
  }

  // Simulate startAPIServer functionality
  ctx.app?.addMessage({
    type: 'system',
    content: `Starting API server on port ${port}...`,
  });

  try {
    // Find the API package path (simulated)
    const apiPath = path.resolve(__dirname, '../../api');

    // Spawn the API server as a background process (simulated)
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

    // Wait for server to start (simulated)
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
 * Resolves the executable path (simulated)
 */
export function resolveExecutable(name: string): string {
  return name; // Simplified for testing
}