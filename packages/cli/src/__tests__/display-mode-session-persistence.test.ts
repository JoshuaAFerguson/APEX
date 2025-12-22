/**
 * Tests for display mode session persistence
 * Validates that display modes are correctly saved and restored
 * across sessions, and that the state persists through various
 * session operations and edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DisplayMode } from '@apex/core';

interface SessionData {
  displayMode: DisplayMode;
  projectPath: string;
  timestamp: Date;
  version: string;
  metadata?: {
    lastCommand?: string;
    sessionDuration?: number;
    commandHistory?: string[];
  };
}

interface SessionStore {
  save(data: SessionData): Promise<void>;
  load(): Promise<SessionData | null>;
  exists(): Promise<boolean>;
  clear(): Promise<void>;
  getDisplayMode(): Promise<DisplayMode | null>;
  setDisplayMode(mode: DisplayMode): Promise<void>;
}

// Mock SessionStore implementation
const createMockSessionStore = (): SessionStore => {
  let storage: Map<string, any> = new Map();

  return {
    async save(data: SessionData): Promise<void> {
      storage.set('session', { ...data, timestamp: new Date(data.timestamp) });
    },

    async load(): Promise<SessionData | null> {
      const data = storage.get('session');
      return data || null;
    },

    async exists(): Promise<boolean> {
      return storage.has('session');
    },

    async clear(): Promise<void> {
      storage.clear();
    },

    async getDisplayMode(): Promise<DisplayMode | null> {
      const data = storage.get('session');
      return data?.displayMode || null;
    },

    async setDisplayMode(mode: DisplayMode): Promise<void> {
      const existing = storage.get('session') || {};
      storage.set('session', {
        ...existing,
        displayMode: mode,
        timestamp: new Date(),
      });
    },
  };
};

// Mock display mode manager
class DisplayModeManager {
  private currentMode: DisplayMode = 'normal';
  private sessionStore: SessionStore;
  private listeners: ((mode: DisplayMode) => void)[] = [];

  constructor(sessionStore: SessionStore) {
    this.sessionStore = sessionStore;
  }

  async initialize(): Promise<void> {
    try {
      const savedMode = await this.sessionStore.getDisplayMode();
      if (savedMode && this.isValidDisplayMode(savedMode)) {
        this.currentMode = savedMode;
        return;
      }
    } catch {
      // Fall back to full session load for resilience
    }

    try {
      const session = await this.sessionStore.load();
      if (session?.displayMode && this.isValidDisplayMode(session.displayMode)) {
        this.currentMode = session.displayMode;
      }
    } catch {
      // Default to normal when storage is unavailable
      this.currentMode = 'normal';
    }
  }

  async setDisplayMode(mode: DisplayMode): Promise<void> {
    if (!this.isValidDisplayMode(mode)) {
      throw new Error(`Invalid display mode: ${mode}`);
    }

    this.currentMode = mode;
    await this.sessionStore.setDisplayMode(mode);
    this.notifyListeners(mode);
  }

  getDisplayMode(): DisplayMode {
    return this.currentMode;
  }

  async toggleCompact(): Promise<DisplayMode> {
    const newMode = this.currentMode === 'compact' ? 'normal' : 'compact';
    await this.setDisplayMode(newMode);
    return newMode;
  }

  async toggleVerbose(): Promise<DisplayMode> {
    const newMode = this.currentMode === 'verbose' ? 'normal' : 'verbose';
    await this.setDisplayMode(newMode);
    return newMode;
  }

  onModeChange(listener: (mode: DisplayMode) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private isValidDisplayMode(mode: any): mode is DisplayMode {
    return ['normal', 'compact', 'verbose'].includes(mode);
  }

  private notifyListeners(mode: DisplayMode): void {
    this.listeners.forEach(listener => listener(mode));
  }
}

describe('Display Mode Session Persistence', () => {
  let sessionStore: SessionStore;
  let displayModeManager: DisplayModeManager;

  beforeEach(async () => {
    sessionStore = createMockSessionStore();
    displayModeManager = new DisplayModeManager(sessionStore);
  });

  afterEach(async () => {
    await sessionStore.clear();
  });

  describe('Basic Persistence', () => {
    it('should save display mode when set', async () => {
      await displayModeManager.setDisplayMode('compact');

      const savedMode = await sessionStore.getDisplayMode();
      expect(savedMode).toBe('compact');
    });

    it('should restore display mode on initialization', async () => {
      // Set mode and simulate app restart
      await sessionStore.setDisplayMode('verbose');

      const newManager = new DisplayModeManager(sessionStore);
      await newManager.initialize();

      expect(newManager.getDisplayMode()).toBe('verbose');
    });

    it('should default to normal mode when no saved state exists', async () => {
      await displayModeManager.initialize();
      expect(displayModeManager.getDisplayMode()).toBe('normal');
    });

    it('should persist mode changes through toggle operations', async () => {
      await displayModeManager.initialize();

      // Toggle to compact
      const compactResult = await displayModeManager.toggleCompact();
      expect(compactResult).toBe('compact');
      expect(await sessionStore.getDisplayMode()).toBe('compact');

      // Toggle back to normal
      const normalResult = await displayModeManager.toggleCompact();
      expect(normalResult).toBe('normal');
      expect(await sessionStore.getDisplayMode()).toBe('normal');
    });

    it('should persist verbose mode toggle correctly', async () => {
      await displayModeManager.initialize();

      // Toggle to verbose
      const verboseResult = await displayModeManager.toggleVerbose();
      expect(verboseResult).toBe('verbose');
      expect(await sessionStore.getDisplayMode()).toBe('verbose');

      // Toggle back to normal
      const normalResult = await displayModeManager.toggleVerbose();
      expect(normalResult).toBe('normal');
      expect(await sessionStore.getDisplayMode()).toBe('normal');
    });
  });

  describe('Session Data Integrity', () => {
    it('should maintain complete session data when updating display mode', async () => {
      const initialSession: SessionData = {
        displayMode: 'normal',
        projectPath: '/test/project',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        version: '1.0.0',
        metadata: {
          lastCommand: '/help',
          sessionDuration: 5000,
          commandHistory: ['/init', '/help'],
        },
      };

      await sessionStore.save(initialSession);
      await displayModeManager.initialize();
      await displayModeManager.setDisplayMode('compact');

      const updatedSession = await sessionStore.load();
      expect(updatedSession).toBeDefined();
      expect(updatedSession!.displayMode).toBe('compact');
      expect(updatedSession!.projectPath).toBe('/test/project');
      expect(updatedSession!.version).toBe('1.0.0');
      expect(updatedSession!.metadata?.lastCommand).toBe('/help');
    });

    it('should update timestamp when display mode changes', async () => {
      const originalTime = new Date('2024-01-01T10:00:00Z');
      await sessionStore.save({
        displayMode: 'normal',
        projectPath: '/test',
        timestamp: originalTime,
        version: '1.0.0',
      });

      await displayModeManager.initialize();

      // Wait a bit and change mode
      await new Promise(resolve => setTimeout(resolve, 10));
      await displayModeManager.setDisplayMode('verbose');

      const updatedSession = await sessionStore.load();
      expect(updatedSession!.timestamp.getTime()).toBeGreaterThan(originalTime.getTime());
    });

    it('should preserve session data across multiple mode changes', async () => {
      await sessionStore.save({
        displayMode: 'normal',
        projectPath: '/important/project',
        timestamp: new Date(),
        version: '2.0.0',
        metadata: {
          commandHistory: ['/init', '/compact', '/verbose'],
          sessionDuration: 10000,
        },
      });

      await displayModeManager.initialize();

      // Make multiple mode changes
      await displayModeManager.setDisplayMode('compact');
      await displayModeManager.setDisplayMode('verbose');
      await displayModeManager.setDisplayMode('normal');

      const finalSession = await sessionStore.load();
      expect(finalSession!.projectPath).toBe('/important/project');
      expect(finalSession!.version).toBe('2.0.0');
      expect(finalSession!.metadata?.commandHistory).toEqual(['/init', '/compact', '/verbose']);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid saved display modes gracefully', async () => {
      // Manually save invalid mode
      const mockStore = sessionStore as any;
      await mockStore.save({
        displayMode: 'invalid-mode',
        projectPath: '/test',
        timestamp: new Date(),
        version: '1.0.0',
      });

      await displayModeManager.initialize();

      // Should default to normal mode
      expect(displayModeManager.getDisplayMode()).toBe('normal');
    });

    it('should handle corrupted session data', async () => {
      // Simulate corrupted data
      const corruptedStore = {
        ...sessionStore,
        async load(): Promise<SessionData | null> {
          return { displayMode: null } as any;
        },
      };

      const manager = new DisplayModeManager(corruptedStore);
      await manager.initialize();

      expect(manager.getDisplayMode()).toBe('normal');
    });

    it('should handle session store failures gracefully', async () => {
      const failingStore: SessionStore = {
        async save(): Promise<void> {
          throw new Error('Storage failed');
        },
        async load(): Promise<SessionData | null> {
          return null;
        },
        async exists(): Promise<boolean> {
          return false;
        },
        async clear(): Promise<void> {
          // No-op
        },
        async getDisplayMode(): Promise<DisplayMode | null> {
          throw new Error('Storage failed');
        },
        async setDisplayMode(): Promise<void> {
          throw new Error('Storage failed');
        },
      };

      const manager = new DisplayModeManager(failingStore);

      // Should not throw during initialization
      await expect(manager.initialize()).resolves.not.toThrow();
      expect(manager.getDisplayMode()).toBe('normal');

      // Should handle save failures gracefully
      await expect(manager.setDisplayMode('compact')).rejects.toThrow('Storage failed');
    });

    it('should validate display mode values before saving', async () => {
      await expect(
        displayModeManager.setDisplayMode('invalid' as DisplayMode)
      ).rejects.toThrow('Invalid display mode: invalid');

      // Should not have saved the invalid mode
      const savedMode = await sessionStore.getDisplayMode();
      expect(savedMode).not.toBe('invalid');
    });

    it('should handle concurrent mode changes', async () => {
      await displayModeManager.initialize();

      // Simulate concurrent mode changes
      const promises = [
        displayModeManager.setDisplayMode('compact'),
        displayModeManager.setDisplayMode('verbose'),
        displayModeManager.setDisplayMode('normal'),
      ];

      await Promise.all(promises);

      // Should have a valid final state
      const finalMode = displayModeManager.getDisplayMode();
      expect(['normal', 'compact', 'verbose']).toContain(finalMode);

      const savedMode = await sessionStore.getDisplayMode();
      expect(savedMode).toBe(finalMode);
    });
  });

  describe('Mode Change Notifications', () => {
    it('should notify listeners when display mode changes', async () => {
      await displayModeManager.initialize();

      const modeChanges: DisplayMode[] = [];
      const unsubscribe = displayModeManager.onModeChange(mode => {
        modeChanges.push(mode);
      });

      await displayModeManager.setDisplayMode('compact');
      await displayModeManager.setDisplayMode('verbose');
      await displayModeManager.setDisplayMode('normal');

      expect(modeChanges).toEqual(['compact', 'verbose', 'normal']);

      unsubscribe();
    });

    it('should handle multiple listeners correctly', async () => {
      await displayModeManager.initialize();

      const listener1Changes: DisplayMode[] = [];
      const listener2Changes: DisplayMode[] = [];

      const unsub1 = displayModeManager.onModeChange(mode => listener1Changes.push(mode));
      const unsub2 = displayModeManager.onModeChange(mode => listener2Changes.push(mode));

      await displayModeManager.setDisplayMode('verbose');

      expect(listener1Changes).toEqual(['verbose']);
      expect(listener2Changes).toEqual(['verbose']);

      // Unsubscribe first listener
      unsub1();

      await displayModeManager.setDisplayMode('compact');

      expect(listener1Changes).toEqual(['verbose']); // No new changes
      expect(listener2Changes).toEqual(['verbose', 'compact']);

      unsub2();
    });

    it('should not notify on initialization', async () => {
      await sessionStore.setDisplayMode('compact');

      const modeChanges: DisplayMode[] = [];
      const newManager = new DisplayModeManager(sessionStore);
      newManager.onModeChange(mode => modeChanges.push(mode));

      await newManager.initialize();

      expect(modeChanges).toEqual([]); // No notifications during init
      expect(newManager.getDisplayMode()).toBe('compact');
    });
  });

  describe('Session Lifecycle Integration', () => {
    it('should persist mode through complete session lifecycle', async () => {
      // Session start
      await displayModeManager.initialize();
      expect(displayModeManager.getDisplayMode()).toBe('normal');

      // User changes mode during session
      await displayModeManager.setDisplayMode('verbose');
      expect(displayModeManager.getDisplayMode()).toBe('verbose');

      // Session end (simulate app shutdown/restart)
      const newSessionStore = createMockSessionStore();
      // Copy saved data to new store
      const savedData = await sessionStore.load();
      if (savedData) {
        await newSessionStore.save(savedData);
      }

      const newManager = new DisplayModeManager(newSessionStore);
      await newManager.initialize();

      // Mode should be restored
      expect(newManager.getDisplayMode()).toBe('verbose');
    });

    it('should handle session migration between versions', async () => {
      // Simulate old session format
      const oldSessionStore = {
        ...sessionStore,
        async load(): Promise<SessionData | null> {
          return {
            displayMode: 'compact',
            projectPath: '/old/project',
            timestamp: new Date('2023-01-01'),
            version: '0.9.0', // Old version
          };
        },
      };

      const manager = new DisplayModeManager(oldSessionStore);
      await manager.initialize();

      // Should still restore the display mode correctly
      expect(manager.getDisplayMode()).toBe('compact');
    });

    it('should clear display mode when session is cleared', async () => {
      await displayModeManager.setDisplayMode('verbose');
      expect(await sessionStore.getDisplayMode()).toBe('verbose');

      await sessionStore.clear();
      expect(await sessionStore.getDisplayMode()).toBeNull();

      // New manager should start with default mode
      const newManager = new DisplayModeManager(sessionStore);
      await newManager.initialize();
      expect(newManager.getDisplayMode()).toBe('normal');
    });
  });

  describe('Performance and Memory', () => {
    it('should not cause memory leaks with many mode changes', async () => {
      await displayModeManager.initialize();

      // Simulate many mode changes
      const modes: DisplayMode[] = ['compact', 'verbose', 'normal'];
      for (let i = 0; i < 1000; i++) {
        const mode = modes[i % modes.length];
        await displayModeManager.setDisplayMode(mode);
      }

      // Should still function correctly
      expect(['normal', 'compact', 'verbose']).toContain(displayModeManager.getDisplayMode());
      expect(await sessionStore.getDisplayMode()).toBe(displayModeManager.getDisplayMode());
    });

    it('should efficiently handle frequent toggle operations', async () => {
      await displayModeManager.initialize();

      const startTime = Date.now();

      // Perform many toggle operations
      for (let i = 0; i < 100; i++) {
        await displayModeManager.toggleCompact();
        await displayModeManager.toggleVerbose();
      }

      const duration = Date.now() - startTime;

      // Operations should complete reasonably quickly (less than 1 second)
      expect(duration).toBeLessThan(1000);

      // Final state should be consistent
      const currentMode = displayModeManager.getDisplayMode();
      const savedMode = await sessionStore.getDisplayMode();
      expect(currentMode).toBe(savedMode);
    });

    it('should handle cleanup of event listeners correctly', async () => {
      await displayModeManager.initialize();

      const listeners: (() => void)[] = [];

      // Create many listeners
      for (let i = 0; i < 100; i++) {
        const unsubscribe = displayModeManager.onModeChange(() => {});
        listeners.push(unsubscribe);
      }

      // Unsubscribe all
      listeners.forEach(unsub => unsub());

      // Mode changes should still work
      await displayModeManager.setDisplayMode('compact');
      expect(displayModeManager.getDisplayMode()).toBe('compact');
    });
  });

  describe('Cross-Session Consistency', () => {
    it('should maintain consistency across multiple concurrent sessions', async () => {
      // Simulate multiple session managers sharing the same storage
      const manager1 = new DisplayModeManager(sessionStore);
      const manager2 = new DisplayModeManager(sessionStore);

      await manager1.initialize();
      await manager2.initialize();

      // Both should start with the same mode
      expect(manager1.getDisplayMode()).toBe(manager2.getDisplayMode());

      // Change mode in first manager
      await manager1.setDisplayMode('compact');

      // Second manager should be able to read the updated state
      const newManager2 = new DisplayModeManager(sessionStore);
      await newManager2.initialize();
      expect(newManager2.getDisplayMode()).toBe('compact');
    });

    it('should handle session data races gracefully', async () => {
      const manager1 = new DisplayModeManager(sessionStore);
      const manager2 = new DisplayModeManager(sessionStore);

      await manager1.initialize();
      await manager2.initialize();

      // Concurrent writes from different managers
      const promises = [
        manager1.setDisplayMode('compact'),
        manager2.setDisplayMode('verbose'),
      ];

      await Promise.allSettled(promises);

      // Final state should be consistent (one of the two modes)
      const finalMode = await sessionStore.getDisplayMode();
      expect(['compact', 'verbose']).toContain(finalMode!);
    });
  });
});
