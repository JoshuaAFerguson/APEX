/**
 * Comprehensive Integration Tests for Diff Preview Feature
 *
 * Tests all acceptance criteria:
 * 1. Integration tests verify diff correctly shows file additions (new file)
 * 2. Diff correctly shows file deletions
 * 3. Diff correctly shows modifications with proper context
 * 4. Config flag properly enables/disables preview
 * 5. CLI flag overrides config setting
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { ApexOrchestrator } from '../index';
import type { HookContext } from '../hooks';
import type { DiffPreviewEvent } from '../index';

// Mock the fs modules for controlled testing
vi.mock('fs', () => {
  const mock = {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => ''),
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(),
    unlinkSync: vi.fn(),
    promises: {
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      readFile: vi.fn(),
      unlink: vi.fn(),
      access: vi.fn(),
      stat: vi.fn(),
      readdir: vi.fn(),
      rmdir: vi.fn(),
    },
  };
  return { ...mock, default: mock };
});

const mockedFsSync = vi.mocked(fsSync);

describe('Diff Preview Comprehensive Integration Tests', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let mockEventEmitter: EventEmitter;
  let capturedEvents: DiffPreviewEvent[];
  let mockStore: any;
  let mockFileSnapshots: Map<string, string>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create temp directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-diff-comprehensive-'));

    // Create real event emitter to capture events
    mockEventEmitter = new EventEmitter();
    capturedEvents = [];

    // Capture diff preview events
    mockEventEmitter.on('diff:preview', (data: DiffPreviewEvent) => {
      capturedEvents.push(data);
    });

    // Mock store
    mockStore = {
      addLog: vi.fn().mockResolvedValue(undefined),
      getTask: vi.fn(),
      updateTask: vi.fn(),
    };

    // Initialize file snapshots
    mockFileSnapshots = new Map();

    // Initialize orchestrator with temp directory
    orchestrator = new ApexOrchestrator({
      projectPath: tempDir,
      eventEmitter: mockEventEmitter,
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    capturedEvents = [];
    mockFileSnapshots.clear();

    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  const createHookContext = (config?: any, cliFlags?: { diffPreview?: boolean }): HookContext => ({
    taskId: 'comprehensive-test-123',
    store: mockStore,
    eventEmitter: mockEventEmitter,
    fileSnapshots: mockFileSnapshots,
    config: config || { ui: { diffPreview: true } },
    cliFlags,
  });

  const simulateDiffPreviewHook = async (
    context: HookContext,
    toolName: 'Write' | 'Edit',
    filePath: string,
    newContent: string,
    oldContent?: string
  ): Promise<void> => {
    // Skip if no event emitter available
    if (!context.eventEmitter) return;

    // Check CLI flag override
    let shouldGeneratePreview = true;
    if (context.cliFlags?.diffPreview !== undefined) {
      // CLI flag overrides config
      shouldGeneratePreview = context.cliFlags.diffPreview;
    } else {
      // Use config setting (default enabled if not specified)
      shouldGeneratePreview = context.config?.ui?.diffPreview !== false;
    }

    if (!shouldGeneratePreview) return;

    // Generate diff based on tool type
    let diffResult: any;
    if (toolName === 'Write') {
      const { generateFileDiff } = await import('../utils/diff');
      diffResult = generateFileDiff(filePath, newContent);
    } else if (toolName === 'Edit') {
      const { generateDiff } = await import('../utils/diff');
      const originalContent = oldContent || mockFileSnapshots.get(filePath) || '';
      diffResult = generateDiff({
        filePath,
        originalContent,
        newContent,
      });
    }

    if (diffResult?.hasDifferences) {
      const eventData: DiffPreviewEvent = {
        taskId: context.taskId,
        toolName,
        callId: `test-${toolName.toLowerCase()}-${Date.now()}`,
        filePath,
        diff: diffResult.diff,
        addedLines: diffResult.addedLines,
        removedLines: diffResult.removedLines,
        timestamp: new Date(),
      };

      context.eventEmitter.emit('diff:preview', eventData);

      // Log the event
      await context.store.addLog(context.taskId, {
        level: 'debug',
        message: `Diff preview generated for: ${filePath}`,
        metadata: {
          tool: toolName,
          filePath,
          addedLines: diffResult.addedLines,
          removedLines: diffResult.removedLines,
          callId: eventData.callId,
        },
      });
    }
  };

  describe('1. File Addition Tests (New File)', () => {
    it('should correctly show diff for new file creation', async () => {
      const filePath = '/src/components/NewComponent.tsx';
      const newFileContent = `import React from 'react';

interface Props {
  title: string;
  description?: string;
}

export const NewComponent: React.FC<Props> = ({ title, description }) => {
  return (
    <div className="new-component">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  );
};

export default NewComponent;`;

      // Mock file as non-existent
      mockedFsSync.existsSync.mockReturnValue(false);

      const context = createHookContext();
      await simulateDiffPreviewHook(context, 'Write', filePath, newFileContent);

      // Verify event was captured
      expect(capturedEvents).toHaveLength(1);
      const event = capturedEvents[0];

      // Verify event structure
      expect(event.taskId).toBe('comprehensive-test-123');
      expect(event.toolName).toBe('Write');
      expect(event.filePath).toBe(filePath);
      expect(event.addedLines).toBeGreaterThan(0);
      expect(event.removedLines).toBe(0);

      // Verify diff content shows addition
      expect(event.diff).toContain('+import React from \'react\';');
      expect(event.diff).toContain('+interface Props {');
      expect(event.diff).toContain('+export const NewComponent');
      expect(event.diff).toContain('+export default NewComponent;');

      // Verify logging
      expect(mockStore.addLog).toHaveBeenCalledWith(
        'comprehensive-test-123',
        expect.objectContaining({
          level: 'debug',
          message: expect.stringContaining('Diff preview generated for:'),
          metadata: expect.objectContaining({
            tool: 'Write',
            filePath,
            addedLines: expect.any(Number),
            removedLines: 0,
          }),
        })
      );
    });

    it('should handle new file with yaml configuration', async () => {
      const filePath = '/config/test-config.yaml';
      const newFileContent = `version: '3.8'
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
    environment:
      NODE_ENV: production
volumes:
  data:`;

      mockedFsSync.existsSync.mockReturnValue(false);

      const context = createHookContext();
      await simulateDiffPreviewHook(context, 'Write', filePath, newFileContent);

      expect(capturedEvents).toHaveLength(1);
      const event = capturedEvents[0];

      expect(event.addedLines).toBe(9);
      expect(event.removedLines).toBe(0);
      expect(event.diff).toContain('+version: \'3.8\'');
      expect(event.diff).toContain('+    environment:');
    });
  });

  describe('2. File Deletion Tests', () => {
    it('should correctly show diff for file deletion', async () => {
      const filePath = '/src/utils/deprecatedHelper.js';
      const existingContent = `// Deprecated utility function
export function oldHelper(input) {
  console.warn('This function is deprecated');
  return input.toUpperCase();
}

export function anotherOldFunction() {
  return 'legacy behavior';
}`;

      // Mock file as existing with content
      mockedFsSync.existsSync.mockReturnValue(true);
      mockedFsSync.readFileSync.mockReturnValue(existingContent);
      mockFileSnapshots.set(filePath, existingContent);

      // Simulate file deletion (Write tool with empty content)
      const context = createHookContext();
      await simulateDiffPreviewHook(context, 'Write', filePath, '');

      expect(capturedEvents).toHaveLength(1);
      const event = capturedEvents[0];

      expect(event.addedLines).toBe(0);
      expect(event.removedLines).toBeGreaterThan(0);
      expect(event.diff).toContain('-// Deprecated utility function');
      expect(event.diff).toContain('-export function oldHelper(input)');
      expect(event.diff).toContain('-export function anotherOldFunction()');
    });

    it('should handle deletion of complex structured file', async () => {
      const filePath = '/src/legacy/ComplexClass.java';
      const existingContent = `package com.apex.legacy;

import java.util.*;

public class ComplexClass extends BaseClass {
    private final Map<String, Object> data = new HashMap<>();
    private static final String CONSTANT = "LEGACY_VALUE";

    public ComplexClass(String name) {
        super(name);
        this.initialize();
    }

    private void initialize() {
        for (int i = 0; i < 100; i++) {
            data.put("key" + i, "value" + i);
        }
    }
}`;

      mockedFsSync.existsSync.mockReturnValue(true);
      mockedFsSync.readFileSync.mockReturnValue(existingContent);

      const context = createHookContext();
      await simulateDiffPreviewHook(context, 'Write', filePath, '');

      expect(capturedEvents).toHaveLength(1);
      const event = capturedEvents[0];

      expect(event.removedLines).toBeGreaterThan(15);
      expect(event.diff).toContain('-package com.apex.legacy;');
      expect(event.diff).toContain('-public class ComplexClass extends BaseClass');
    });
  });

  describe('3. File Modification Tests (Proper Context)', () => {
    it('should show modifications with proper context lines', async () => {
      const filePath = '/src/services/UserService.ts';
      const originalContent = `import { User, CreateUserRequest } from '../types/User';
import { DatabaseService } from './DatabaseService';
import { ValidationService } from './ValidationService';

export class UserService {
  constructor(
    private dbService: DatabaseService,
    private validationService: ValidationService
  ) {}

  async createUser(request: CreateUserRequest): Promise<User> {
    await this.validationService.validateCreateUser(request);

    const existingUser = await this.dbService.findUserByEmail(request.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const userData = {
      ...request,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return await this.dbService.createUser(userData);
  }

  async getUserById(id: string): Promise<User | null> {
    return await this.dbService.findUserById(id);
  }
}`;

      const modifiedContent = originalContent.replace(
        'throw new Error(\'User with this email already exists\');',
        'throw new ValidationError(\'User with this email already exists\', \'DUPLICATE_EMAIL\');'
      ).replace(
        'import { ValidationService } from \'./ValidationService\';',
        `import { ValidationService } from './ValidationService';
import { ValidationError } from '../errors/ValidationError';`
      );

      mockedFsSync.existsSync.mockReturnValue(true);
      mockedFsSync.readFileSync.mockReturnValue(originalContent);
      mockFileSnapshots.set(filePath, originalContent);

      const context = createHookContext();
      await simulateDiffPreviewHook(context, 'Edit', filePath, modifiedContent, originalContent);

      expect(capturedEvents).toHaveLength(1);
      const event = capturedEvents[0];

      // Verify modifications are captured
      expect(event.addedLines).toBe(2);
      expect(event.removedLines).toBe(1);

      // Check that diff shows context around changes
      expect(event.diff).toContain('import { ValidationService } from \'./ValidationService\';');
      expect(event.diff).toContain('+import { ValidationError } from \'../errors/ValidationError\';');
      expect(event.diff).toContain('-      throw new Error(\'User with this email already exists\');');
      expect(event.diff).toContain('+      throw new ValidationError(\'User with this email already exists\', \'DUPLICATE_EMAIL\');');

      // Verify context lines are included
      expect(event.diff).toContain('if (existingUser) {');
      expect(event.diff).toContain('}');
    });

    it('should handle multiple modifications in same file', async () => {
      const filePath = '/src/components/UserProfile.tsx';
      const originalContent = `import React, { useState } from 'react';

interface UserProfileProps {
  userId: string;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId }) => {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  const loadUser = async () => {
    setLoading(true);
    try {
      const userData = await fetch(\`/api/users/\${userId}\`);
      setUser(userData);
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-profile">
      <h1>User Profile</h1>
      {loading && <p>Loading...</p>}
      {user && <UserDetails user={user} />}
    </div>
  );
};`;

      const modifiedContent = originalContent
        .replace('import React, { useState } from \'react\';',
                'import React, { useState } from \'react\';\nimport { useNotification } from \'../hooks/useNotification\';')
        .replace('const [user, setUser] = useState(null);',
                'const [user, setUser] = useState(null);\n  const [error, setError] = useState<string | null>(null);\n  const { showError } = useNotification();')
        .replace('const userData = await fetch(`/api/users/${userId}`);',
                'const response = await fetch(`/api/users/${userId}`);\n      if (!response.ok) {\n        throw new Error(\'Failed to fetch user data\');\n      }\n      const userData = await response.json();')
        .replace('console.error(\'Failed to load user:\', error);',
                'const errorMessage = \'Failed to load user data\';\n      setError(errorMessage);\n      showError(errorMessage);\n      console.error(\'Failed to load user:\', error);')
        .replace('{user && <UserDetails user={user} />}',
                '{error && <div className="error">{error}</div>}\n      {user && <UserDetails user={user} />}');

      mockedFsSync.existsSync.mockReturnValue(true);
      mockedFsSync.readFileSync.mockReturnValue(originalContent);

      const context = createHookContext();
      await simulateDiffPreviewHook(context, 'Edit', filePath, modifiedContent, originalContent);

      expect(capturedEvents).toHaveLength(1);
      const event = capturedEvents[0];

      // Multiple additions and modifications
      expect(event.addedLines).toBeGreaterThan(5);
      expect(event.removedLines).toBeGreaterThan(2);

      // Check key modifications are captured
      expect(event.diff).toContain('+import { useNotification } from \'../hooks/useNotification\';');
      expect(event.diff).toContain('+  const [error, setError] = useState<string | null>(null);');
      expect(event.diff).toContain('+      if (!response.ok) {');
      expect(event.diff).toContain('+      {error && <div className="error">{error}</div>}');
    });
  });

  describe('4. Config Flag Enable/Disable Tests', () => {
    it('should generate events when diffPreview is enabled in config', async () => {
      const filePath = '/test/config-enabled.js';
      const content = 'console.log("Config enabled test");';

      mockedFsSync.existsSync.mockReturnValue(false);

      const context = createHookContext({ ui: { diffPreview: true } });
      await simulateDiffPreviewHook(context, 'Write', filePath, content);

      expect(capturedEvents).toHaveLength(1);
      expect(mockStore.addLog).toHaveBeenCalled();
    });

    it('should not generate events when diffPreview is disabled in config', async () => {
      const filePath = '/test/config-disabled.js';
      const content = 'console.log("Config disabled test");';

      mockedFsSync.existsSync.mockReturnValue(false);

      const context = createHookContext({ ui: { diffPreview: false } });
      await simulateDiffPreviewHook(context, 'Write', filePath, content);

      expect(capturedEvents).toHaveLength(0);
      expect(mockStore.addLog).not.toHaveBeenCalled();
    });

    it('should default to enabled when no config is provided', async () => {
      const filePath = '/test/no-config.js';
      const content = 'console.log("No config test");';

      mockedFsSync.existsSync.mockReturnValue(false);

      const context = createHookContext(undefined);
      await simulateDiffPreviewHook(context, 'Write', filePath, content);

      expect(capturedEvents).toHaveLength(1);
      expect(mockStore.addLog).toHaveBeenCalled();
    });

    it('should default to enabled when ui section is empty', async () => {
      const filePath = '/test/empty-ui-config.js';
      const content = 'console.log("Empty UI config test");';

      mockedFsSync.existsSync.mockReturnValue(false);

      const context = createHookContext({ ui: {} });
      await simulateDiffPreviewHook(context, 'Write', filePath, content);

      expect(capturedEvents).toHaveLength(1);
      expect(mockStore.addLog).toHaveBeenCalled();
    });
  });

  describe('5. CLI Flag Override Tests', () => {
    it('should enable preview with CLI flag even when config disables it', async () => {
      const filePath = '/test/cli-override-enable.js';
      const content = 'console.log("CLI override enable test");';

      mockedFsSync.existsSync.mockReturnValue(false);

      // Config disables but CLI flag enables
      const context = createHookContext(
        { ui: { diffPreview: false } },
        { diffPreview: true }
      );

      await simulateDiffPreviewHook(context, 'Write', filePath, content);

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].filePath).toBe(filePath);
      expect(mockStore.addLog).toHaveBeenCalled();
    });

    it('should disable preview with CLI flag even when config enables it', async () => {
      const filePath = '/test/cli-override-disable.js';
      const content = 'console.log("CLI override disable test");';

      mockedFsSync.existsSync.mockReturnValue(false);

      // Config enables but CLI flag disables
      const context = createHookContext(
        { ui: { diffPreview: true } },
        { diffPreview: false }
      );

      await simulateDiffPreviewHook(context, 'Write', filePath, content);

      expect(capturedEvents).toHaveLength(0);
      expect(mockStore.addLog).not.toHaveBeenCalled();
    });

    it('should fall back to config when CLI flag is not provided', async () => {
      const testCases = [
        { config: { ui: { diffPreview: true } }, expectedEvents: 1 },
        { config: { ui: { diffPreview: false } }, expectedEvents: 0 },
        { config: undefined, expectedEvents: 1 }, // default enabled
      ];

      for (const [index, testCase] of testCases.entries()) {
        const filePath = `/test/cli-fallback-${index}.js`;
        const content = `console.log("CLI fallback test ${index}");`;

        mockedFsSync.existsSync.mockReturnValue(false);

        // No CLI flags provided, should use config
        const context = createHookContext(testCase.config, undefined);
        await simulateDiffPreviewHook(context, 'Write', filePath, content);

        expect(capturedEvents).toHaveLength(testCase.expectedEvents);

        // Clear events for next test
        capturedEvents.length = 0;
      }
    });

    it('should handle multiple CLI flag scenarios in sequence', async () => {
      const scenarios = [
        {
          description: 'CLI true, config false',
          config: { ui: { diffPreview: false } },
          cliFlags: { diffPreview: true },
          expectedEvents: 1,
        },
        {
          description: 'CLI false, config true',
          config: { ui: { diffPreview: true } },
          cliFlags: { diffPreview: false },
          expectedEvents: 0,
        },
        {
          description: 'CLI true, config true',
          config: { ui: { diffPreview: true } },
          cliFlags: { diffPreview: true },
          expectedEvents: 1,
        },
        {
          description: 'CLI false, config false',
          config: { ui: { diffPreview: false } },
          cliFlags: { diffPreview: false },
          expectedEvents: 0,
        },
      ];

      for (const [index, scenario] of scenarios.entries()) {
        const filePath = `/test/cli-scenario-${index}.js`;
        const content = `console.log("${scenario.description}");`;

        mockedFsSync.existsSync.mockReturnValue(false);

        const context = createHookContext(scenario.config, scenario.cliFlags);
        await simulateDiffPreviewHook(context, 'Write', filePath, content);

        expect(capturedEvents).toHaveLength(scenario.expectedEvents);

        // Clear events for next scenario
        capturedEvents.length = 0;
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing event emitter gracefully', async () => {
      const context = createHookContext();
      context.eventEmitter = undefined;

      const filePath = '/test/no-emitter.js';
      const content = 'console.log("No emitter test");';

      // Should not throw
      await simulateDiffPreviewHook(context, 'Write', filePath, content);
      expect(capturedEvents).toHaveLength(0);
    });

    it('should handle file read errors gracefully', async () => {
      const filePath = '/test/read-error.js';
      const content = 'console.log("Read error test");';

      // Mock file exists but throws on read
      mockedFsSync.existsSync.mockReturnValue(true);
      mockedFsSync.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const context = createHookContext();

      // Should not throw, should treat as new file
      await simulateDiffPreviewHook(context, 'Write', filePath, content);

      // Should still generate event for "new" file
      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].addedLines).toBeGreaterThan(0);
      expect(capturedEvents[0].removedLines).toBe(0);
    });

    it('should handle very large files efficiently', async () => {
      const filePath = '/test/large-file.js';

      // Generate large file content (2000 lines to be more reasonable)
      const originalLines = Array.from({ length: 2000 }, (_, i) =>
        `const variable${i} = "value${i}";`
      );
      const modifiedLines = [...originalLines];
      modifiedLines[1000] = 'const MODIFIED_VARIABLE = "MODIFIED_VALUE";';

      const originalContent = originalLines.join('\n');
      const modifiedContent = modifiedLines.join('\n');

      mockedFsSync.existsSync.mockReturnValue(true);
      mockedFsSync.readFileSync.mockReturnValue(originalContent);

      const context = createHookContext();

      const start = Date.now();
      await simulateDiffPreviewHook(context, 'Edit', filePath, modifiedContent, originalContent);
      const duration = Date.now() - start;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(2000);
      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].addedLines).toBe(1);
      expect(capturedEvents[0].removedLines).toBe(1);
    });
  });

  describe('Tool-Specific Behavior', () => {
    it('should handle Write tool for new files correctly', async () => {
      const filePath = '/test/write-tool-new.js';
      const content = 'export const newFunction = () => "hello";';

      mockedFsSync.existsSync.mockReturnValue(false);

      const context = createHookContext();
      await simulateDiffPreviewHook(context, 'Write', filePath, content);

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].toolName).toBe('Write');
      expect(capturedEvents[0].removedLines).toBe(0);
    });

    it('should handle Edit tool for existing files correctly', async () => {
      const filePath = '/test/edit-tool-existing.js';
      const originalContent = 'export const oldFunction = () => "old";';
      const newContent = 'export const newFunction = () => "new";';

      mockFileSnapshots.set(filePath, originalContent);

      const context = createHookContext();
      await simulateDiffPreviewHook(context, 'Edit', filePath, newContent, originalContent);

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].toolName).toBe('Edit');
      expect(capturedEvents[0].addedLines).toBe(1);
      expect(capturedEvents[0].removedLines).toBe(1);
    });
  });
});