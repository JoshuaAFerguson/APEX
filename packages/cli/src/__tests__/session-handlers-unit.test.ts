/**
 * Unit tests for session handlers extraction
 * Simple verification that handlers are importable and basic functionality works
 */

import { describe, it, expect, vi } from 'vitest';
import { handleSession, handleSessionList } from '../handlers/session-handlers.js';

describe('Session Handlers Unit Tests', () => {
  it('should export the main session handler function', () => {
    expect(typeof handleSession).toBe('function');
  });

  it('should export individual session handler functions', () => {
    expect(typeof handleSessionList).toBe('function');
  });

  it('should handle uninitialized context gracefully', async () => {
    const mockContext = {
      initialized: false,
      sessionStore: null,
      sessionAutoSaver: null,
      app: {
        addMessage: vi.fn(),
        updateState: vi.fn(),
      },
    };

    await handleSession(['list'], mockContext);

    expect(mockContext.app.addMessage).toHaveBeenCalledWith({
      type: 'error',
      content: 'APEX not initialized. Run /init first.',
    });
  });
});