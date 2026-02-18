import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { BrowserTool, type BrowserOperation, type BrowserParams } from './tools/browser-tool';

const operationSchema = z.enum([
  'navigate',
  'click',
  'type',
  'screenshot',
  'compareScreenshot',
  'evaluate',
  'submit',
  'waitForSelector',
  'getAttribute',
  'getText',
  'getHtml',
  'scroll',
  'hover',
]);

export type BrowserToolsServer = { name: string; config: ReturnType<typeof createSdkMcpServer> };

export function buildBrowserToolsServer(browserTool: BrowserTool): BrowserToolsServer {
  const name = 'browser-tools';
  const browserToolDefinition = tool(
    'Browser',
    'Browser automation tool for navigation, interaction, screenshots, and evaluation.',
    {
      operation: operationSchema,
      params: z.record(z.unknown()).optional(),
    },
    async (args) => {
      const operation = args.operation as BrowserOperation;
      const params = (args.params ?? {}) as BrowserParams['params'];
      const result = await browserTool.execute({ operation, params } as BrowserParams);

      const outputText = result.success
        ? `Browser ${operation} succeeded`
        : `Browser ${operation} failed: ${result.error ?? 'Unknown error'}`;

      return {
        content: [{ type: 'text', text: outputText }],
        structuredContent: result as unknown as Record<string, unknown>,
        isError: !result.success,
      };
    }
  );

  return {
    name,
    config: createSdkMcpServer({
      name,
      tools: [browserToolDefinition],
    }),
  };
}
