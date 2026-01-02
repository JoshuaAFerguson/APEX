/**
 * BrowserManager Tests
 *
 * Comprehensive test suite for BrowserManager class covering:
 * - Browser lifecycle management
 * - Context creation and management
 * - Configuration options
 * - Resource cleanup
 * - Event emission
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { BrowserManager, BrowserManagerOptions, BrowserLaunchConfig, BrowserContextConfig } from './browser-manager';

// Mock Playwright
const mockBrowser = {
  isConnected: vi.fn(() => true),
  version: vi.fn(() => '1.40.0'),
  newContext: vi.fn(),
  close: vi.fn(),
  on: vi.fn(),
  _connection: {
    _transport: {
      _ws: {
        process: { pid: 12345 }
      }
    }
  }
};

const mockContext = {
  close: vi.fn(),
  on: vi.fn(),
};

const mockBrowserType = {
  launch: vi.fn(() => Promise.resolve(mockBrowser)),
};

// Mock Playwright modules
vi.mock('playwright', () => ({
  chromium: mockBrowserType,
  firefox: mockBrowserType,
  webkit: mockBrowserType,
}));

describe('BrowserManager', () => {
  let browserManager: BrowserManager;
  let mockPermissionManager: any;
  let mockBrowserTool: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock responses
    mockBrowser.newContext.mockResolvedValue(mockContext);
    mockBrowser.close.mockResolvedValue(undefined);
    mockContext.close.mockResolvedValue(undefined);

    // Create mock permission manager
    mockPermissionManager = {
      checkToolPermission: vi.fn(() => Promise.resolve({ allowed: true })),
      getToolConfig: vi.fn(() => Promise.resolve({})),
    };

    // Create mock browser tool
    mockBrowserTool = {
      setPermissionManager: vi.fn(),
    };

    // Create fresh browser manager instance
    browserManager = new BrowserManager({
      permissionManager: mockPermissionManager,
      browserTool: mockBrowserTool,
      maxBrowsers: 3,
      maxContextsPerBrowser: 5,
      autoCleanupTimeout: 1000, // 1 second for testing
    });
  });

  afterEach(async () => {
    // Clean up any remaining browsers
    try {
      await browserManager.cleanup({ force: true, timeout: 1000 });
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Constructor and Configuration', () => {
    it('should create browser manager with default configuration', () => {
      const manager = new BrowserManager();
      expect(manager).toBeInstanceOf(BrowserManager);
      expect(manager).toBeInstanceOf(EventEmitter);
    });

    it('should create browser manager with custom options', () => {
      const options: BrowserManagerOptions = {
        permissionManager: mockPermissionManager,
        browserTool: mockBrowserTool,
        defaultConfig: {
          engine: 'firefox',
          headless: false,
          viewport: { width: 1920, height: 1080 },
        },
        maxBrowsers: 10,
        maxContextsPerBrowser: 20,
      };

      const manager = new BrowserManager(options);
      expect(manager).toBeInstanceOf(BrowserManager);
    });

    it('should set permission manager', () => {
      browserManager.setPermissionManager(mockPermissionManager);
      expect(mockBrowserTool.setPermissionManager).toHaveBeenCalledWith(mockPermissionManager);
    });

    it('should set browser tool', () => {
      const newBrowserTool = { setPermissionManager: vi.fn() };
      browserManager.setBrowserTool(newBrowserTool);
      expect(newBrowserTool.setPermissionManager).toHaveBeenCalledWith(mockPermissionManager);
    });
  });

  describe('Browser Lifecycle', () => {
    it('should launch browser with default configuration', async () => {
      const browserId = await browserManager.launchBrowser();

      expect(mockBrowserType.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          headless: true,
          timeout: 30000,
        })
      );

      expect(browserId).toMatch(/^browser_\d+_\d+$/);

      const browserInfo = browserManager.getBrowserInfo(browserId);
      expect(browserInfo).toMatchObject({
        id: browserId,
        engine: 'chromium',
        version: '1.40.0',
        isConnected: true,
        contextCount: 0,
        pid: 12345,
      });
    });

    it('should launch browser with custom configuration', async () => {
      const config: BrowserLaunchConfig = {
        engine: 'firefox',
        headless: false,
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Custom User Agent',
        timeout: 60000,
      };

      const browserId = await browserManager.launchBrowser(config);

      expect(mockBrowserType.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          headless: false,
          timeout: 60000,
        })
      );

      const browserInfo = browserManager.getBrowserInfo(browserId);
      expect(browserInfo?.engine).toBe('firefox');
    });

    it('should emit browser:launched event', async () => {
      const eventSpy = vi.fn();
      browserManager.on('browser:launched', eventSpy);

      const browserId = await browserManager.launchBrowser();

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: browserId,
          engine: 'chromium',
          version: '1.40.0',
        })
      );
    });

    it('should reject when maximum browsers exceeded', async () => {
      // Launch maximum browsers
      await browserManager.launchBrowser();
      await browserManager.launchBrowser();
      await browserManager.launchBrowser();

      // This should fail
      await expect(browserManager.launchBrowser()).rejects.toThrow('Maximum browser limit reached');
    });

    it('should close browser and emit event', async () => {
      const browserId = await browserManager.launchBrowser();
      const eventSpy = vi.fn();
      browserManager.on('browser:closed', eventSpy);

      await browserManager.closeBrowser(browserId);

      expect(mockBrowser.close).toHaveBeenCalled();
      expect(browserManager.getBrowser(browserId)).toBeNull();
    });

    it('should reject when closing non-existent browser', async () => {
      await expect(browserManager.closeBrowser('non-existent')).rejects.toThrow('Browser with ID non-existent not found');
    });
  });

  describe('Context Management', () => {
    let browserId: string;

    beforeEach(async () => {
      browserId = await browserManager.launchBrowser();
    });

    it('should create context with default configuration', async () => {
      const contextId = await browserManager.createContext(browserId);

      expect(mockBrowser.newContext).toHaveBeenCalledWith(
        expect.objectContaining({
          viewport: undefined,
          userAgent: undefined,
        })
      );

      expect(contextId).toMatch(/^context_\d+_\d+$/);

      const contextInfo = browserManager.getContextInfo(contextId);
      expect(contextInfo).toMatchObject({
        id: contextId,
        browserId,
        pageCount: 0,
      });
    });

    it('should create context with custom configuration', async () => {
      const config: BrowserContextConfig = {
        viewport: { width: 800, height: 600 },
        userAgent: 'Custom Context Agent',
        acceptDownloads: true,
        locale: 'en-US',
      };

      const contextId = await browserManager.createContext(browserId, config);

      expect(mockBrowser.newContext).toHaveBeenCalledWith(
        expect.objectContaining({
          viewport: { width: 800, height: 600 },
          userAgent: 'Custom Context Agent',
          acceptDownloads: true,
          locale: 'en-US',
        })
      );
    });

    it('should emit context:created event', async () => {
      const eventSpy = vi.fn();
      browserManager.on('context:created', eventSpy);

      const contextId = await browserManager.createContext(browserId);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: contextId,
          browserId,
          pageCount: 0,
        })
      );
    });

    it('should update browser context count', async () => {
      const contextId = await browserManager.createContext(browserId);

      const browserInfo = browserManager.getBrowserInfo(browserId);
      expect(browserInfo?.contextCount).toBe(1);
    });

    it('should reject when maximum contexts exceeded', async () => {
      // Create maximum contexts
      for (let i = 0; i < 5; i++) {
        await browserManager.createContext(browserId);
      }

      // This should fail
      await expect(browserManager.createContext(browserId)).rejects.toThrow('Maximum context limit reached');
    });

    it('should close context and emit event', async () => {
      const contextId = await browserManager.createContext(browserId);
      const eventSpy = vi.fn();
      browserManager.on('context:closed', eventSpy);

      await browserManager.closeContext(contextId);

      expect(mockContext.close).toHaveBeenCalled();
      expect(browserManager.getContext(contextId)).toBeNull();
    });

    it('should reject when closing non-existent context', async () => {
      await expect(browserManager.closeContext('non-existent')).rejects.toThrow('Context with ID non-existent not found');
    });

    it('should reject creating context for non-existent browser', async () => {
      await expect(browserManager.createContext('non-existent')).rejects.toThrow('Browser with ID non-existent not found');
    });
  });

  describe('Listing and Querying', () => {
    let browserId1: string;
    let browserId2: string;
    let contextId1: string;
    let contextId2: string;

    beforeEach(async () => {
      browserId1 = await browserManager.launchBrowser({ engine: 'chromium' });
      browserId2 = await browserManager.launchBrowser({ engine: 'firefox' });
      contextId1 = await browserManager.createContext(browserId1);
      contextId2 = await browserManager.createContext(browserId2);
    });

    it('should list all browsers', () => {
      const browsers = browserManager.listBrowsers();
      expect(browsers).toHaveLength(2);
      expect(browsers.some(b => b.id === browserId1)).toBe(true);
      expect(browsers.some(b => b.id === browserId2)).toBe(true);
    });

    it('should list all contexts', () => {
      const contexts = browserManager.listContexts();
      expect(contexts).toHaveLength(2);
      expect(contexts.some(c => c.id === contextId1)).toBe(true);
      expect(contexts.some(c => c.id === contextId2)).toBe(true);
    });

    it('should list contexts for specific browser', () => {
      const browser1Contexts = browserManager.listContexts(browserId1);
      expect(browser1Contexts).toHaveLength(1);
      expect(browser1Contexts[0].id).toBe(contextId1);

      const browser2Contexts = browserManager.listContexts(browserId2);
      expect(browser2Contexts).toHaveLength(1);
      expect(browser2Contexts[0].id).toBe(contextId2);
    });

    it('should check for active browsers', () => {
      expect(browserManager.hasActiveBrowsers()).toBe(true);
    });

    it('should get total context count', () => {
      expect(browserManager.getTotalContextCount()).toBe(2);
    });
  });

  describe('Cleanup', () => {
    let browserId: string;
    let contextId: string;

    beforeEach(async () => {
      browserId = await browserManager.launchBrowser();
      contextId = await browserManager.createContext(browserId);
    });

    it('should cleanup all browsers gracefully', async () => {
      await browserManager.cleanup();

      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(browserManager.hasActiveBrowsers()).toBe(false);
    });

    it('should force cleanup with force option', async () => {
      await browserManager.cleanup({ force: true });

      expect(mockBrowser.close).toHaveBeenCalled();
      expect(browserManager.hasActiveBrowsers()).toBe(false);
    });

    it('should timeout cleanup if timeout exceeded', async () => {
      // Make close hang
      mockBrowser.close.mockImplementation(() => new Promise(() => {}));

      await expect(
        browserManager.cleanup({ timeout: 100 })
      ).rejects.toThrow('Cleanup timeout exceeded');
    });
  });

  describe('Error Handling', () => {
    it('should handle browser launch failure', async () => {
      mockBrowserType.launch.mockRejectedValueOnce(new Error('Launch failed'));

      await expect(browserManager.launchBrowser()).rejects.toThrow('Failed to launch browser: Launch failed');
    });

    it('should handle context creation failure', async () => {
      const browserId = await browserManager.launchBrowser();
      mockBrowser.newContext.mockRejectedValueOnce(new Error('Context failed'));

      await expect(browserManager.createContext(browserId)).rejects.toThrow('Failed to create context: Context failed');
    });

    it('should handle browser close failure', async () => {
      const browserId = await browserManager.launchBrowser();
      mockBrowser.close.mockRejectedValueOnce(new Error('Close failed'));

      await expect(browserManager.closeBrowser(browserId)).rejects.toThrow('Failed to close browser: Close failed');
    });

    it('should handle context close failure', async () => {
      const browserId = await browserManager.launchBrowser();
      const contextId = await browserManager.createContext(browserId);
      mockContext.close.mockRejectedValueOnce(new Error('Close failed'));

      await expect(browserManager.closeContext(contextId)).rejects.toThrow('Failed to close context: Close failed');
    });

    it('should emit error events', async () => {
      const errorSpy = vi.fn();
      browserManager.on('error', errorSpy);

      mockBrowserType.launch.mockRejectedValueOnce(new Error('Test error'));

      try {
        await browserManager.launchBrowser();
      } catch {
        // Expected to fail
      }

      expect(errorSpy).toHaveBeenCalledWith(
        expect.any(Error),
        'launchBrowser'
      );
    });
  });

  describe('Browser Engine Support', () => {
    it('should support chromium engine', async () => {
      const browserId = await browserManager.launchBrowser({ engine: 'chromium' });
      const browserInfo = browserManager.getBrowserInfo(browserId);
      expect(browserInfo?.engine).toBe('chromium');
    });

    it('should support firefox engine', async () => {
      const browserId = await browserManager.launchBrowser({ engine: 'firefox' });
      const browserInfo = browserManager.getBrowserInfo(browserId);
      expect(browserInfo?.engine).toBe('firefox');
    });

    it('should support webkit engine', async () => {
      const browserId = await browserManager.launchBrowser({ engine: 'webkit' });
      const browserInfo = browserManager.getBrowserInfo(browserId);
      expect(browserInfo?.engine).toBe('webkit');
    });
  });

  describe('Event Handling', () => {
    it('should handle browser disconnection', async () => {
      const browserId = await browserManager.launchBrowser();
      const contextId = await browserManager.createContext(browserId);

      const browserClosedSpy = vi.fn();
      const contextClosedSpy = vi.fn();
      browserManager.on('browser:closed', browserClosedSpy);
      browserManager.on('context:closed', contextClosedSpy);

      // Simulate browser disconnection
      const disconnectCallback = mockBrowser.on.mock.calls.find(call => call[0] === 'disconnected')?.[1];
      if (disconnectCallback) {
        disconnectCallback();
      }

      expect(browserClosedSpy).toHaveBeenCalledWith(browserId);
      expect(contextClosedSpy).toHaveBeenCalledWith(contextId, browserId);

      // Browser and contexts should be cleaned up
      expect(browserManager.getBrowser(browserId)).toBeNull();
      expect(browserManager.getContext(contextId)).toBeNull();
    });

    it('should handle context close events', async () => {
      const browserId = await browserManager.launchBrowser();
      const contextId = await browserManager.createContext(browserId);

      const contextClosedSpy = vi.fn();
      browserManager.on('context:closed', contextClosedSpy);

      // Simulate context close
      const closeCallback = mockContext.on.mock.calls.find(call => call[0] === 'close')?.[1];
      if (closeCallback) {
        closeCallback();
      }

      expect(contextClosedSpy).toHaveBeenCalledWith(contextId, browserId);

      // Context should be cleaned up, browser context count should decrease
      expect(browserManager.getContext(contextId)).toBeNull();
      const browserInfo = browserManager.getBrowserInfo(browserId);
      expect(browserInfo?.contextCount).toBe(0);
    });

    it('should handle page creation events', async () => {
      const browserId = await browserManager.launchBrowser();
      const contextId = await browserManager.createContext(browserId);

      const pageCreatedSpy = vi.fn();
      browserManager.on('page:created', pageCreatedSpy);

      const mockPage = { url: () => 'https://example.com' };

      // Simulate page creation
      const pageCallback = mockContext.on.mock.calls.find(call => call[0] === 'page')?.[1];
      if (pageCallback) {
        pageCallback(mockPage);
      }

      expect(pageCreatedSpy).toHaveBeenCalledWith(mockPage, contextId, browserId);

      // Context page count should increase
      const contextInfo = browserManager.getContextInfo(contextId);
      expect(contextInfo?.pageCount).toBe(1);
    });
  });
});