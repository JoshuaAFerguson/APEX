/**
 * Edge cases and error handling tests for display modes feature
 *
 * Tests various edge cases, error conditions, and boundary scenarios
 * to ensure robust behavior under unusual conditions:
 * - Input validation and sanitization
 * - Memory constraints and performance limits
 * - Concurrent operations and race conditions
 * - System failures and recovery
 * - Malformed data handling
 * - Network/storage failures
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DisplayMode } from '@apexcli/core';

// Mock performance.now for testing
const mockPerformanceNow = vi.fn(() => Date.now());
Object.defineProperty(global, 'performance', {
  value: { now: mockPerformanceNow },
  writable: true,
});

describe('Display Mode Edge Cases and Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerformanceNow.mockImplementation(() => Date.now());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Input Validation and Sanitization', () => {
    const validateDisplayMode = (input: any): input is DisplayMode => {
      return typeof input === 'string' && ['normal', 'compact', 'verbose'].includes(input);
    };

    const sanitizeDisplayModeInput = (input: any): DisplayMode => {
      if (typeof input !== 'string') {
        return 'normal';
      }

      const cleaned = input.toString().toLowerCase().trim();
      switch (cleaned) {
        case 'compact':
        case 'c':
        case 'mini':
        case 'minimal':
          return 'compact';
        case 'verbose':
        case 'v':
        case 'debug':
        case 'detailed':
          return 'verbose';
        default:
          return 'normal';
      }
    };

    it('should validate valid display modes', () => {
      expect(validateDisplayMode('normal')).toBe(true);
      expect(validateDisplayMode('compact')).toBe(true);
      expect(validateDisplayMode('verbose')).toBe(true);
    });

    it('should reject invalid display modes', () => {
      expect(validateDisplayMode('invalid')).toBe(false);
      expect(validateDisplayMode(null)).toBe(false);
      expect(validateDisplayMode(undefined)).toBe(false);
      expect(validateDisplayMode(42)).toBe(false);
      expect(validateDisplayMode({})).toBe(false);
      expect(validateDisplayMode([])).toBe(false);
      expect(validateDisplayMode(true)).toBe(false);
    });

    it('should sanitize various input formats', () => {
      expect(sanitizeDisplayModeInput('COMPACT')).toBe('compact');
      expect(sanitizeDisplayModeInput('  verbose  ')).toBe('verbose');
      expect(sanitizeDisplayModeInput('c')).toBe('compact');
      expect(sanitizeDisplayModeInput('v')).toBe('verbose');
      expect(sanitizeDisplayModeInput('mini')).toBe('compact');
      expect(sanitizeDisplayModeInput('debug')).toBe('verbose');
      expect(sanitizeDisplayModeInput('detailed')).toBe('verbose');
    });

    it('should fallback to normal for invalid inputs', () => {
      expect(sanitizeDisplayModeInput(null)).toBe('normal');
      expect(sanitizeDisplayModeInput(undefined)).toBe('normal');
      expect(sanitizeDisplayModeInput(42)).toBe('normal');
      expect(sanitizeDisplayModeInput({})).toBe('normal');
      expect(sanitizeDisplayModeInput('')).toBe('normal');
      expect(sanitizeDisplayModeInput('unknown')).toBe('normal');
    });

    it('should handle special characters and encoding issues', () => {
      expect(sanitizeDisplayModeInput('comp\x00act')).toBe('normal');
      expect(sanitizeDisplayModeInput('verbose\r\n')).toBe('verbose');
      expect(sanitizeDisplayModeInput('\t\tcompact\t\t')).toBe('compact');
      expect(sanitizeDisplayModeInput('🤖verbose')).toBe('normal');
    });

    it('should handle extremely long input strings', () => {
      const longString = 'compact'.repeat(10000);
      expect(sanitizeDisplayModeInput(longString)).toBe('normal');

      const longStringWithValid = 'a'.repeat(10000) + 'compact';
      expect(sanitizeDisplayModeInput(longStringWithValid)).toBe('normal');
    });
  });

  describe('Memory Constraints and Performance', () => {
    interface MemoryConstrainedDisplayManager {
      mode: DisplayMode;
      history: { mode: DisplayMode; timestamp: number }[];
      maxHistorySize: number;
      memoryUsage: number;
      maxMemoryUsage: number;
    }

    const createMemoryConstrainedManager = (
      maxHistorySize = 100,
      maxMemoryUsage = 1024 * 1024 // 1MB
    ): MemoryConstrainedDisplayManager => ({
      mode: 'normal',
      history: [],
      maxHistorySize,
      memoryUsage: 0,
      maxMemoryUsage,
    });

    const updateModeWithMemoryCheck = (
      manager: MemoryConstrainedDisplayManager,
      newMode: DisplayMode
    ): boolean => {
      const entrySize = 64; // Estimated size of one history entry
      const newMemoryUsage = manager.memoryUsage + entrySize;

      if (newMemoryUsage > manager.maxMemoryUsage) {
        // Clean up old history entries
        const entriesToRemove = Math.ceil(manager.history.length * 0.5);
        manager.history.splice(0, entriesToRemove);
        manager.memoryUsage = manager.history.length * entrySize;
      }

      if (manager.history.length >= manager.maxHistorySize) {
        manager.history.shift();
      } else {
        manager.memoryUsage += entrySize;
      }

      manager.history.push({ mode: newMode, timestamp: Date.now() });
      manager.mode = newMode;
      return true;
    };

    it('should handle memory constraints gracefully', () => {
      const manager = createMemoryConstrainedManager(10, 640); // Very small limits

      // Fill up to memory limit
      for (let i = 0; i < 20; i++) {
        const mode = ['normal', 'compact', 'verbose'][i % 3] as DisplayMode;
        expect(updateModeWithMemoryCheck(manager, mode)).toBe(true);
      }

      // Should have cleaned up old entries
      expect(manager.history.length).toBeLessThanOrEqual(10);
      expect(manager.memoryUsage).toBeLessThanOrEqual(640);
    });

    it('should handle rapid mode changes without memory leaks', () => {
      const manager = createMemoryConstrainedManager();
      const initialMemory = manager.memoryUsage;

      // Perform many rapid changes
      for (let i = 0; i < 1000; i++) {
        const mode = ['normal', 'compact', 'verbose'][i % 3] as DisplayMode;
        updateModeWithMemoryCheck(manager, mode);
      }

      // Memory should be bounded
      expect(manager.memoryUsage).toBeLessThan(manager.maxMemoryUsage);
      expect(manager.history.length).toBeLessThanOrEqual(manager.maxHistorySize);
    });

    it('should maintain performance under heavy load', () => {
      const manager = createMemoryConstrainedManager();
      const startTime = performance.now();

      // Heavy load test
      for (let i = 0; i < 10000; i++) {
        const mode = ['normal', 'compact', 'verbose'][i % 3] as DisplayMode;
        updateModeWithMemoryCheck(manager, mode);
      }

      const duration = performance.now() - startTime;

      // Should complete in reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000); // Less than 1 second
      expect(manager.mode).toBeDefined();
    });
  });

  describe('Concurrent Operations and Race Conditions', () => {
    interface ConcurrentDisplayManager {
      mode: DisplayMode;
      pendingOperations: Set<string>;
      operationQueue: Array<{ id: string; mode: DisplayMode; resolve: () => void }>;
      isProcessing: boolean;
    }

    const createConcurrentManager = (): ConcurrentDisplayManager => ({
      mode: 'normal',
      pendingOperations: new Set(),
      operationQueue: [],
      isProcessing: false,
    });

    const queueModeChange = async (
      manager: ConcurrentDisplayManager,
      newMode: DisplayMode
    ): Promise<void> => {
      const operationId = Math.random().toString(36);

      if (manager.pendingOperations.has(newMode)) {
        // Operation for this mode already pending
        return;
      }

      return new Promise((resolve) => {
        manager.operationQueue.push({ id: operationId, mode: newMode, resolve });
        manager.pendingOperations.add(newMode);
        processQueue(manager);
      });
    };

    const processQueue = async (manager: ConcurrentDisplayManager): Promise<void> => {
      if (manager.isProcessing || manager.operationQueue.length === 0) {
        return;
      }

      manager.isProcessing = true;

      while (manager.operationQueue.length > 0) {
        const operation = manager.operationQueue.shift()!;

        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 1));

        manager.mode = operation.mode;
        manager.pendingOperations.delete(operation.mode);
        operation.resolve();
      }

      manager.isProcessing = false;
    };

    it('should handle concurrent mode changes safely', async () => {
      const manager = createConcurrentManager();

      const operations = [
        queueModeChange(manager, 'compact'),
        queueModeChange(manager, 'verbose'),
        queueModeChange(manager, 'normal'),
        queueModeChange(manager, 'compact'),
      ];

      await Promise.all(operations);

      // Should end in a valid state
      expect(['normal', 'compact', 'verbose']).toContain(manager.mode);
      expect(manager.pendingOperations.size).toBe(0);
      expect(manager.operationQueue.length).toBe(0);
    });

    it('should deduplicate concurrent operations for the same mode', async () => {
      const manager = createConcurrentManager();

      // Multiple operations for the same mode
      const operations = [
        queueModeChange(manager, 'compact'),
        queueModeChange(manager, 'compact'),
        queueModeChange(manager, 'compact'),
      ];

      await Promise.all(operations);

      expect(manager.mode).toBe('compact');
    });

    it('should maintain consistency under high concurrency', async () => {
      const manager = createConcurrentManager();
      const results: DisplayMode[] = [];

      // Many concurrent operations
      const operations = Array.from({ length: 100 }, (_, i) => {
        const mode = ['normal', 'compact', 'verbose'][i % 3] as DisplayMode;
        return queueModeChange(manager, mode).then(() => {
          results.push(manager.mode);
        });
      });

      await Promise.all(operations);

      // All results should be valid display modes
      expect(results.every(mode => ['normal', 'compact', 'verbose'].includes(mode))).toBe(true);
      expect(manager.mode).toBeDefined();
    });
  });

  describe('System Failures and Recovery', () => {
    interface FailureProneDisplayManager {
      mode: DisplayMode;
      failureRate: number;
      recoveryAttempts: number;
      maxRecoveryAttempts: number;
      lastError: Error | null;
    }

    const createFailureProneManager = (failureRate = 0.1): FailureProneDisplayManager => ({
      mode: 'normal',
      failureRate,
      recoveryAttempts: 0,
      maxRecoveryAttempts: 3,
      lastError: null,
    });

    const attemptModeChange = async (
      manager: FailureProneDisplayManager,
      newMode: DisplayMode
    ): Promise<boolean> => {
      try {
        // Simulate random failures
        if (Math.random() < manager.failureRate) {
          throw new Error(`Simulated failure during mode change to ${newMode}`);
        }

        manager.mode = newMode;
        manager.recoveryAttempts = 0;
        manager.lastError = null;
        return true;

      } catch (error) {
        manager.lastError = error as Error;
        return false;
      }
    };

    const robustModeChange = async (
      manager: FailureProneDisplayManager,
      newMode: DisplayMode
    ): Promise<boolean> => {
      for (let attempt = 0; attempt <= manager.maxRecoveryAttempts; attempt++) {
        const success = await attemptModeChange(manager, newMode);

        if (success) {
          return true;
        }

        manager.recoveryAttempts = attempt + 1;

        if (attempt < manager.maxRecoveryAttempts) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 10));
        }
      }

      return false;
    };

    it('should recover from transient failures', async () => {
      const manager = createFailureProneManager(0.7); // High failure rate

      const success = await robustModeChange(manager, 'compact');

      // Should eventually succeed despite failures
      expect(success).toBe(true);
      expect(manager.mode).toBe('compact');
    });

    it('should give up after max recovery attempts', async () => {
      const manager = createFailureProneManager(1.0); // Always fails

      const success = await robustModeChange(manager, 'verbose');

      expect(success).toBe(false);
      expect(manager.recoveryAttempts).toBe(manager.maxRecoveryAttempts + 1);
      expect(manager.lastError).toBeDefined();
      expect(manager.mode).toBe('normal'); // Should remain unchanged
    });

    it('should handle cascading failures gracefully', async () => {
      const manager = createFailureProneManager(0.5);

      const results = await Promise.allSettled([
        robustModeChange(manager, 'compact'),
        robustModeChange(manager, 'verbose'),
        robustModeChange(manager, 'normal'),
      ]);

      // At least some operations should succeed
      const successes = results.filter(r => r.status === 'fulfilled');
      expect(successes.length).toBeGreaterThan(0);

      // Manager should be in a valid state
      expect(['normal', 'compact', 'verbose']).toContain(manager.mode);
    });
  });

  describe('Malformed Data Handling', () => {
    const sanitizeStateData = (data: any): { displayMode: DisplayMode; isValid: boolean } => {
      try {
        if (!data || typeof data !== 'object') {
          return { displayMode: 'normal', isValid: false };
        }

        const mode = data.displayMode;
        if (!['normal', 'compact', 'verbose'].includes(mode)) {
          return { displayMode: 'normal', isValid: false };
        }

        return { displayMode: mode, isValid: true };

      } catch (error) {
        return { displayMode: 'normal', isValid: false };
      }
    };

    it('should handle null and undefined state data', () => {
      expect(sanitizeStateData(null)).toEqual({ displayMode: 'normal', isValid: false });
      expect(sanitizeStateData(undefined)).toEqual({ displayMode: 'normal', isValid: false });
    });

    it('should handle corrupted object data', () => {
      const corruptedData = { displayMode: 'corrupted', extraField: 'hack' };
      expect(sanitizeStateData(corruptedData)).toEqual({ displayMode: 'normal', isValid: false });

      const circularRef: any = { displayMode: 'normal' };
      circularRef.self = circularRef;
      expect(sanitizeStateData(circularRef)).toEqual({ displayMode: 'normal', isValid: true });
    });

    it('should handle primitive data types', () => {
      expect(sanitizeStateData('string')).toEqual({ displayMode: 'normal', isValid: false });
      expect(sanitizeStateData(42)).toEqual({ displayMode: 'normal', isValid: false });
      expect(sanitizeStateData(true)).toEqual({ displayMode: 'normal', isValid: false });
    });

    it('should handle arrays and complex objects', () => {
      expect(sanitizeStateData([])).toEqual({ displayMode: 'normal', isValid: false });
      expect(sanitizeStateData(['compact'])).toEqual({ displayMode: 'normal', isValid: false });

      const complexObject = {
        displayMode: 'verbose',
        nested: { deeply: { nested: 'value' } },
        array: [1, 2, 3],
      };
      expect(sanitizeStateData(complexObject)).toEqual({ displayMode: 'verbose', isValid: true });
    });

    it('should handle data with prototype pollution attempts', () => {
      const maliciousData = JSON.parse('{"__proto__":{"polluted":true},"displayMode":"compact"}');
      const result = sanitizeStateData(maliciousData);
      expect(result.displayMode).toBe('compact');
      expect(result.isValid).toBe(true);
      expect(({} as any).polluted).toBeUndefined(); // Should not be polluted
    });
  });

  describe('Network and Storage Failures', () => {
    interface NetworkAwareDisplayManager {
      mode: DisplayMode;
      isOnline: boolean;
      pendingSync: DisplayMode | null;
      localCache: { mode: DisplayMode; timestamp: number } | null;
    }

    const createNetworkAwareManager = (): NetworkAwareDisplayManager => ({
      mode: 'normal',
      isOnline: true,
      pendingSync: null,
      localCache: null,
    });

    const setModeWithNetworking = async (
      manager: NetworkAwareDisplayManager,
      newMode: DisplayMode
    ): Promise<void> => {
      manager.mode = newMode;

      if (manager.isOnline) {
        try {
          // Simulate network operation
          if (Math.random() < 0.1) {
            throw new Error('Network failure');
          }
          // Successful sync
          manager.pendingSync = null;
          manager.localCache = { mode: newMode, timestamp: Date.now() };
        } catch (error) {
          // Queue for later sync
          manager.pendingSync = newMode;
        }
      } else {
        // Offline mode - queue for sync
        manager.pendingSync = newMode;
      }
    };

    const syncPendingChanges = async (manager: NetworkAwareDisplayManager): Promise<boolean> => {
      if (!manager.pendingSync || !manager.isOnline) {
        return false;
      }

      try {
        // Simulate sync operation
        if (Math.random() < 0.05) {
          throw new Error('Sync failure');
        }

        manager.localCache = { mode: manager.pendingSync, timestamp: Date.now() };
        manager.pendingSync = null;
        return true;

      } catch (error) {
        return false;
      }
    };

    it('should handle network failures gracefully', async () => {
      const manager = createNetworkAwareManager();

      // Force network failure scenario
      Math.random = vi.fn(() => 0.5); // Always trigger network failure

      await setModeWithNetworking(manager, 'compact');

      expect(manager.mode).toBe('compact');
      expect(manager.pendingSync).toBe('compact');
    });

    it('should queue changes when offline', async () => {
      const manager = createNetworkAwareManager();
      manager.isOnline = false;

      await setModeWithNetworking(manager, 'verbose');

      expect(manager.mode).toBe('verbose');
      expect(manager.pendingSync).toBe('verbose');
      expect(manager.localCache).toBeNull();
    });

    it('should sync pending changes when back online', async () => {
      const manager = createNetworkAwareManager();
      manager.isOnline = false;

      await setModeWithNetworking(manager, 'compact');
      expect(manager.pendingSync).toBe('compact');

      manager.isOnline = true;
      Math.random = vi.fn(() => 0); // Force successful sync

      const synced = await syncPendingChanges(manager);

      expect(synced).toBe(true);
      expect(manager.pendingSync).toBeNull();
      expect(manager.localCache?.mode).toBe('compact');
    });

    it('should handle partial sync failures', async () => {
      const manager = createNetworkAwareManager();

      // Set multiple changes
      await setModeWithNetworking(manager, 'compact');
      manager.pendingSync = 'compact'; // Force pending state

      await setModeWithNetworking(manager, 'verbose');

      // Should have latest mode locally
      expect(manager.mode).toBe('verbose');

      // Should still have pending sync
      expect(manager.pendingSync).toBeDefined();
    });
  });

  describe('Resource Exhaustion', () => {
    interface ResourceConstrainedManager {
      mode: DisplayMode;
      operationsCount: number;
      maxOperations: number;
      memoryPressure: number;
      cpuUsage: number;
    }

    const createResourceConstrainedManager = (
      maxOperations = 1000
    ): ResourceConstrainedManager => ({
      mode: 'normal',
      operationsCount: 0,
      maxOperations,
      memoryPressure: 0,
      cpuUsage: 0,
    });

    const performModeChangeWithResourceCheck = (
      manager: ResourceConstrainedManager,
      newMode: DisplayMode
    ): boolean => {
      // Check resource limits
      if (manager.operationsCount >= manager.maxOperations) {
        return false;
      }

      if (manager.memoryPressure > 0.9 || manager.cpuUsage > 0.95) {
        return false;
      }

      // Simulate resource usage
      manager.operationsCount++;
      manager.memoryPressure += 0.001;
      manager.cpuUsage += 0.002;

      // Simulate cleanup/garbage collection
      if (manager.operationsCount % 100 === 0) {
        manager.memoryPressure = Math.max(0, manager.memoryPressure - 0.1);
        manager.cpuUsage = Math.max(0, manager.cpuUsage - 0.2);
      }

      manager.mode = newMode;
      return true;
    };

    it('should respect operation limits', () => {
      const manager = createResourceConstrainedManager(5);

      // Should succeed for first few operations
      expect(performModeChangeWithResourceCheck(manager, 'compact')).toBe(true);
      expect(performModeChangeWithResourceCheck(manager, 'verbose')).toBe(true);
      expect(performModeChangeWithResourceCheck(manager, 'normal')).toBe(true);
      expect(performModeChangeWithResourceCheck(manager, 'compact')).toBe(true);
      expect(performModeChangeWithResourceCheck(manager, 'verbose')).toBe(true);

      // Should fail after reaching limit
      expect(performModeChangeWithResourceCheck(manager, 'normal')).toBe(false);
    });

    it('should handle memory pressure gracefully', () => {
      const manager = createResourceConstrainedManager();
      manager.memoryPressure = 0.95; // High memory pressure

      const success = performModeChangeWithResourceCheck(manager, 'compact');

      expect(success).toBe(false);
      expect(manager.mode).toBe('normal'); // Should remain unchanged
    });

    it('should perform garbage collection and recovery', () => {
      const manager = createResourceConstrainedManager(150);

      // Perform operations to trigger cleanup
      for (let i = 0; i < 100; i++) {
        const mode = ['normal', 'compact', 'verbose'][i % 3] as DisplayMode;
        performModeChangeWithResourceCheck(manager, mode);
      }

      // Memory should have been cleaned up
      expect(manager.memoryPressure).toBeLessThan(0.1);
      expect(manager.cpuUsage).toBeLessThan(0.2);
    });
  });

  describe('State Corruption and Recovery', () => {
    interface SelfHealingDisplayManager {
      mode: DisplayMode;
      backupStates: DisplayMode[];
      corruptionDetected: boolean;
      healingAttempts: number;
      maxHealingAttempts: number;
    }

    const createSelfHealingManager = (): SelfHealingDisplayManager => ({
      mode: 'normal',
      backupStates: ['normal'],
      corruptionDetected: false,
      healingAttempts: 0,
      maxHealingAttempts: 3,
    });

    const detectCorruption = (manager: SelfHealingDisplayManager): boolean => {
      // Simple corruption detection
      const validModes = ['normal', 'compact', 'verbose'];
      return !validModes.includes(manager.mode);
    };

    const healCorruption = (manager: SelfHealingDisplayManager): boolean => {
      if (manager.healingAttempts >= manager.maxHealingAttempts) {
        return false;
      }

      manager.healingAttempts++;

      // Restore from backup
      if (manager.backupStates.length > 0) {
        const lastValidState = manager.backupStates[manager.backupStates.length - 1];
        manager.mode = lastValidState;
        manager.corruptionDetected = false;
        return true;
      }

      // Fallback to default
      manager.mode = 'normal';
      manager.corruptionDetected = false;
      return true;
    };

    const safeModeChange = (
      manager: SelfHealingDisplayManager,
      newMode: DisplayMode
    ): boolean => {
      // Backup current state
      if (!detectCorruption(manager)) {
        manager.backupStates.push(manager.mode);
        if (manager.backupStates.length > 5) {
          manager.backupStates.shift();
        }
      }

      // Apply change
      manager.mode = newMode;

      // Check for corruption
      if (detectCorruption(manager)) {
        manager.corruptionDetected = true;
        return healCorruption(manager);
      }

      manager.healingAttempts = 0;
      return true;
    };

    it('should detect state corruption', () => {
      const manager = createSelfHealingManager();
      manager.mode = 'corrupted' as DisplayMode;

      expect(detectCorruption(manager)).toBe(true);
    });

    it('should heal corruption from backup states', () => {
      const manager = createSelfHealingManager();
      manager.backupStates = ['normal', 'compact'];
      manager.mode = 'corrupted' as DisplayMode;
      manager.corruptionDetected = true;

      const healed = healCorruption(manager);

      expect(healed).toBe(true);
      expect(manager.mode).toBe('compact');
      expect(manager.corruptionDetected).toBe(false);
    });

    it('should fallback to default when no backups available', () => {
      const manager = createSelfHealingManager();
      manager.backupStates = [];
      manager.mode = 'corrupted' as DisplayMode;
      manager.corruptionDetected = true;

      const healed = healCorruption(manager);

      expect(healed).toBe(true);
      expect(manager.mode).toBe('normal');
    });

    it('should maintain backup history during normal operations', () => {
      const manager = createSelfHealingManager();

      safeModeChange(manager, 'compact');
      safeModeChange(manager, 'verbose');
      safeModeChange(manager, 'normal');

      expect(manager.backupStates).toEqual(['normal', 'compact', 'verbose']);
      expect(manager.mode).toBe('normal');
    });

    it('should limit healing attempts', () => {
      const manager = createSelfHealingManager();
      manager.maxHealingAttempts = 2;
      manager.healingAttempts = 2;
      manager.mode = 'corrupted' as DisplayMode;

      const healed = healCorruption(manager);

      expect(healed).toBe(false);
      expect(manager.healingAttempts).toBe(3);
    });
  });
});