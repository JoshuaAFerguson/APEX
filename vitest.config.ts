import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'tests/**/*.test.ts', 'docs/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        // CLI is mostly wiring code that calls into core/orchestrator/api
        // It's tested via integration tests and manual testing
        'packages/cli/src/**/*.ts',
        // Web UI components require browser environment (Next.js, React)
        'packages/web-ui/src/app/**/*.{ts,tsx}',
        'packages/web-ui/src/components/**/*.{ts,tsx}',
        // WebSocket client requires browser WebSocket API
        'packages/web-ui/src/lib/websocket-client.ts',
      ],
    },
  },
});
