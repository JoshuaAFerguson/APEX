import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  skipOnWindows,
  skipOnUnix,
  skipOnMacOS,
  skipOnLinux,
  skipUnlessWindows,
  skipUnlessUnix,
  describeWindows,
  describeUnix,
  describeMacOS,
  describeLinux,
  runOnWindows,
  runOnUnix,
  runOnMacOS,
  runOnLinux,
  mockPlatform
} from '../test-utils.js';

/**
 * Test suite for platform-specific skip utilities
 */
describe('Skip Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Skip Functions', () => {
    describe('skipOnWindows', () => {
      it('should skip on Windows platform', () => {
        const restore = mockPlatform('win32');
        const skipSpy = vi.spyOn(vi, 'skip');

        skipOnWindows();

        expect(skipSpy).toHaveBeenCalled();
        restore();
        skipSpy.mockRestore();
      });

      it('should not skip on Unix platforms', () => {
        const restore = mockPlatform('linux');
        const skipSpy = vi.spyOn(vi, 'skip');

        skipOnWindows();

        expect(skipSpy).not.toHaveBeenCalled();
        restore();
        skipSpy.mockRestore();
      });
    });

    describe('skipOnUnix', () => {
      it('should skip on Unix platforms', () => {
        const restore = mockPlatform('linux');
        const skipSpy = vi.spyOn(vi, 'skip');

        skipOnUnix();

        expect(skipSpy).toHaveBeenCalled();
        restore();
        skipSpy.mockRestore();
      });

      it('should not skip on Windows', () => {
        const restore = mockPlatform('win32');
        const skipSpy = vi.spyOn(vi, 'skip');

        skipOnUnix();

        expect(skipSpy).not.toHaveBeenCalled();
        restore();
        skipSpy.mockRestore();
      });
    });

    describe('skipOnMacOS', () => {
      it('should skip on macOS', () => {
        const restore = mockPlatform('darwin');
        const skipSpy = vi.spyOn(vi, 'skip');

        skipOnMacOS();

        expect(skipSpy).toHaveBeenCalled();
        restore();
        skipSpy.mockRestore();
      });

      it('should not skip on other platforms', () => {
        const restore = mockPlatform('linux');
        const skipSpy = vi.spyOn(vi, 'skip');

        skipOnMacOS();

        expect(skipSpy).not.toHaveBeenCalled();
        restore();
        skipSpy.mockRestore();
      });
    });

    describe('skipOnLinux', () => {
      it('should skip on Linux', () => {
        const restore = mockPlatform('linux');
        const skipSpy = vi.spyOn(vi, 'skip');

        skipOnLinux();

        expect(skipSpy).toHaveBeenCalled();
        restore();
        skipSpy.mockRestore();
      });

      it('should not skip on other platforms', () => {
        const restore = mockPlatform('darwin');
        const skipSpy = vi.spyOn(vi, 'skip');

        skipOnLinux();

        expect(skipSpy).not.toHaveBeenCalled();
        restore();
        skipSpy.mockRestore();
      });
    });

    describe('skipUnlessWindows', () => {
      it('should not skip on Windows', () => {
        const restore = mockPlatform('win32');
        const skipSpy = vi.spyOn(vi, 'skip');

        skipUnlessWindows();

        expect(skipSpy).not.toHaveBeenCalled();
        restore();
        skipSpy.mockRestore();
      });

      it('should skip on non-Windows platforms', () => {
        const restore = mockPlatform('linux');
        const skipSpy = vi.spyOn(vi, 'skip');

        skipUnlessWindows();

        expect(skipSpy).toHaveBeenCalled();
        restore();
        skipSpy.mockRestore();
      });
    });

    describe('skipUnlessUnix', () => {
      it('should not skip on Unix platforms', () => {
        const restore = mockPlatform('linux');
        const skipSpy = vi.spyOn(vi, 'skip');

        skipUnlessUnix();

        expect(skipSpy).not.toHaveBeenCalled();
        restore();
        skipSpy.mockRestore();
      });

      it('should skip on Windows', () => {
        const restore = mockPlatform('win32');
        const skipSpy = vi.spyOn(vi, 'skip');

        skipUnlessUnix();

        expect(skipSpy).toHaveBeenCalled();
        restore();
        skipSpy.mockRestore();
      });
    });
  });

  describe('Conditional Describe Blocks', () => {
    describe('describeWindows', () => {
      it('should create describe block on Windows', () => {
        const restore = mockPlatform('win32');
        const describeSpy = vi.spyOn(globalThis, 'describe');
        const skipSpy = vi.spyOn(describe, 'skip');

        const testFn = vi.fn();
        describeWindows('Windows test', testFn);

        expect(describeSpy).toHaveBeenCalledWith('Windows test (Windows)', testFn);
        expect(skipSpy).not.toHaveBeenCalled();

        restore();
        describeSpy.mockRestore();
        skipSpy.mockRestore();
      });

      it('should skip describe block on non-Windows', () => {
        const restore = mockPlatform('linux');
        const skipSpy = vi.spyOn(describe, 'skip');

        const testFn = vi.fn();
        describeWindows('Windows test', testFn);

        expect(skipSpy).toHaveBeenCalledWith('Windows test (Windows - skipped on linux)', testFn);

        restore();
        skipSpy.mockRestore();
      });
    });

    describe('describeUnix', () => {
      it('should create describe block on Unix', () => {
        const restore = mockPlatform('linux');
        const describeSpy = vi.spyOn(globalThis, 'describe');
        const skipSpy = vi.spyOn(describe, 'skip');

        const testFn = vi.fn();
        describeUnix('Unix test', testFn);

        expect(describeSpy).toHaveBeenCalledWith('Unix test (Unix)', testFn);
        expect(skipSpy).not.toHaveBeenCalled();

        restore();
        describeSpy.mockRestore();
        skipSpy.mockRestore();
      });

      it('should skip describe block on Windows', () => {
        const restore = mockPlatform('win32');
        const skipSpy = vi.spyOn(describe, 'skip');

        const testFn = vi.fn();
        describeUnix('Unix test', testFn);

        expect(skipSpy).toHaveBeenCalledWith('Unix test (Unix - skipped on win32)', testFn);

        restore();
        skipSpy.mockRestore();
      });
    });

    describe('describeMacOS', () => {
      it('should create describe block on macOS', () => {
        const restore = mockPlatform('darwin');
        const describeSpy = vi.spyOn(globalThis, 'describe');

        const testFn = vi.fn();
        describeMacOS('macOS test', testFn);

        expect(describeSpy).toHaveBeenCalledWith('macOS test (macOS)', testFn);

        restore();
        describeSpy.mockRestore();
      });

      it('should skip describe block on non-macOS', () => {
        const restore = mockPlatform('linux');
        const skipSpy = vi.spyOn(describe, 'skip');

        const testFn = vi.fn();
        describeMacOS('macOS test', testFn);

        expect(skipSpy).toHaveBeenCalledWith('macOS test (macOS - skipped on linux)', testFn);

        restore();
        skipSpy.mockRestore();
      });
    });

    describe('describeLinux', () => {
      it('should create describe block on Linux', () => {
        const restore = mockPlatform('linux');
        const describeSpy = vi.spyOn(globalThis, 'describe');

        const testFn = vi.fn();
        describeLinux('Linux test', testFn);

        expect(describeSpy).toHaveBeenCalledWith('Linux test (Linux)', testFn);

        restore();
        describeSpy.mockRestore();
      });

      it('should skip describe block on non-Linux', () => {
        const restore = mockPlatform('darwin');
        const skipSpy = vi.spyOn(describe, 'skip');

        const testFn = vi.fn();
        describeLinux('Linux test', testFn);

        expect(skipSpy).toHaveBeenCalledWith('Linux test (Linux - skipped on darwin)', testFn);

        restore();
        skipSpy.mockRestore();
      });
    });
  });

  describe('Conditional Execution Functions', () => {
    describe('runOnWindows', () => {
      it('should execute function on Windows', () => {
        const restore = mockPlatform('win32');
        const testFn = vi.fn().mockReturnValue('windows-result');

        const result = runOnWindows(testFn);

        expect(testFn).toHaveBeenCalled();
        expect(result).toBe('windows-result');
        restore();
      });

      it('should not execute function on non-Windows', () => {
        const restore = mockPlatform('linux');
        const testFn = vi.fn();

        const result = runOnWindows(testFn);

        expect(testFn).not.toHaveBeenCalled();
        expect(result).toBeUndefined();
        restore();
      });
    });

    describe('runOnUnix', () => {
      it('should execute function on Unix', () => {
        const restore = mockPlatform('linux');
        const testFn = vi.fn().mockReturnValue('unix-result');

        const result = runOnUnix(testFn);

        expect(testFn).toHaveBeenCalled();
        expect(result).toBe('unix-result');
        restore();
      });

      it('should not execute function on Windows', () => {
        const restore = mockPlatform('win32');
        const testFn = vi.fn();

        const result = runOnUnix(testFn);

        expect(testFn).not.toHaveBeenCalled();
        expect(result).toBeUndefined();
        restore();
      });
    });

    describe('runOnMacOS', () => {
      it('should execute function on macOS', () => {
        const restore = mockPlatform('darwin');
        const testFn = vi.fn().mockReturnValue('macos-result');

        const result = runOnMacOS(testFn);

        expect(testFn).toHaveBeenCalled();
        expect(result).toBe('macos-result');
        restore();
      });

      it('should not execute function on non-macOS', () => {
        const restore = mockPlatform('linux');
        const testFn = vi.fn();

        const result = runOnMacOS(testFn);

        expect(testFn).not.toHaveBeenCalled();
        expect(result).toBeUndefined();
        restore();
      });
    });

    describe('runOnLinux', () => {
      it('should execute function on Linux', () => {
        const restore = mockPlatform('linux');
        const testFn = vi.fn().mockReturnValue('linux-result');

        const result = runOnLinux(testFn);

        expect(testFn).toHaveBeenCalled();
        expect(result).toBe('linux-result');
        restore();
      });

      it('should not execute function on non-Linux', () => {
        const restore = mockPlatform('darwin');
        const testFn = vi.fn();

        const result = runOnLinux(testFn);

        expect(testFn).not.toHaveBeenCalled();
        expect(result).toBeUndefined();
        restore();
      });
    });
  });

  describe('Integration Tests', () => {
    it('should allow chaining conditional functions', () => {
      const restore = mockPlatform('win32');

      const windowsResult = runOnWindows(() => 'windows');
      const unixResult = runOnUnix(() => 'unix');
      const macOSResult = runOnMacOS(() => 'macos');
      const linuxResult = runOnLinux(() => 'linux');

      expect(windowsResult).toBe('windows');
      expect(unixResult).toBeUndefined();
      expect(macOSResult).toBeUndefined();
      expect(linuxResult).toBeUndefined();

      restore();
    });

    it('should work with async functions', async () => {
      const restore = mockPlatform('linux');

      const unixResult = runOnUnix(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return 'async-unix';
      });

      expect(unixResult).toBeInstanceOf(Promise);
      const result = await unixResult!;
      expect(result).toBe('async-unix');

      restore();
    });

    it('should handle exceptions in conditional functions', () => {
      const restore = mockPlatform('win32');

      expect(() => {
        runOnWindows(() => {
          throw new Error('test error');
        });
      }).toThrow('test error');

      // Should not throw on non-matching platform
      expect(() => {
        runOnUnix(() => {
          throw new Error('should not throw');
        });
      }).not.toThrow();

      restore();
    });
  });

  describe('Real-World Usage Patterns', () => {
    it('should support typical test skipping patterns', () => {
      // Simulate typical usage in real tests
      const restore = mockPlatform('win32');
      const skipSpy = vi.spyOn(vi, 'skip');

      // Unix-only: chmod permission model doesn't apply to Windows
      skipOnWindows();

      expect(skipSpy).toHaveBeenCalled();
      restore();
      skipSpy.mockRestore();
    });

    it('should support complex platform-specific logic', () => {
      const restore = mockPlatform('darwin');

      const result = runOnMacOS(() => 'launchd') ||
                    runOnLinux(() => 'systemd') ||
                    runOnWindows(() => 'service manager');

      expect(result).toBe('launchd');
      restore();
    });

    it('should handle test suite organization', () => {
      const restore = mockPlatform('linux');
      const describeSpy = vi.spyOn(globalThis, 'describe');

      // Organize tests by platform
      describeUnix('Service Management', () => {});
      describeLinux('systemd integration', () => {});
      describeMacOS('launchd integration', () => {});

      expect(describeSpy).toHaveBeenCalledWith(
        expect.stringContaining('Service Management (Unix)'),
        expect.any(Function)
      );

      restore();
      describeSpy.mockRestore();
    });
  });
});