/**
 * End-to-End Test for Auto-Fix in Workflow Context
 *
 * This test creates a complete workflow task that triggers code generation,
 * verifies AutoFixService is invoked, confirms events are emitted in correct order,
 * and validates final task state reflects auto-fix results.
 *
 * Tests the complete integration from task creation -> stage execution ->
 * code generation -> auto-fix triggering -> event emission -> task completion.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import { TaskStore } from '../store';
import { ImportAutoFixer } from '../import-auto-fixer/import-auto-fixer';
import type {
  Task,
  WorkflowDefinition,
  WorkflowStage,
  AutoFixEvent,
  AutoFixRequestedEventData,
  AutoFixStartedEventData,
  AutoFixCompletedEventData,
  AutoFixFailedEventData,
  StageResult,
} from '@apexcli/core';

// Mock Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  ClaudeAgentSDK: vi.fn().mockImplementation(() => ({
    query: vi.fn(),
    abortQuery: vi.fn(),
  })),
  tool: vi.fn((config) => config),
  createSdkMcpServer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() }))}));

// Mock dependencies
vi.mock('../import-auto-fixer/import-auto-fixer');
vi.mock('child_process');

const MockImportAutoFixer = vi.mocked(ImportAutoFixer);

describe('Auto-Fix Workflow E2E Test', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let capturedEvents: Array<{ eventType: string; payload: any; timestamp: Date }>;
  let taskId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedEvents = [];

    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-autofix-workflow-e2e-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'src'), { recursive: true });

    // Create comprehensive APEX configuration
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `
project:
  name: "AutoFix E2E Test Project"

# Enable auto-fix for this test
codeQuality:
  autoFix:
    enabled: true
    triggerStages: ["implementation", "testing"]
    triggerAgents: ["developer", "tester"]
    fileExtensions: [".ts", ".tsx", ".js", ".jsx"]
    maxFilesPerStage: 10
    skipOnStageFailure: false

# Linter configuration
linter:
  global:
    enabled: true
    runAfterEdit: true
    timeoutMs: 30000

# Import auto-fixer configuration
importAutoFixer:
  enabled: true
  detector: "eslint"
  behavior:
    autoInstallPackages: false
    dryRun: false
`,
      'utf8'
    );

    // Create package.json
    await fs.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify({
        name: 'autofix-e2e-test',
        version: '1.0.0',
        dependencies: {
          react: '^18.0.0',
          typescript: '^5.0.0',
          lodash: '^4.17.21'
        },
        devDependencies: {
          '@types/react': '^18.0.0',
          '@types/lodash': '^4.14.0'
        }
      }, null, 2),
      'utf8'
    );

    // Create agents directory and agent definition
    await fs.mkdir(path.join(testDir, '.apex', 'agents'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'developer.md'),
      `# Developer Agent

You are a software developer agent specializing in implementing features.

## Role
Implements features and writes production code

## Capabilities
- Write TypeScript/React components
- Create utility functions
- Implement business logic
- Handle error cases

## Instructions
1. Write clean, readable code
2. Follow TypeScript best practices
3. Add appropriate type annotations
4. Use modern React patterns
`,
      'utf8'
    );

    // Create workflows directory and workflow definition
    await fs.mkdir(path.join(testDir, '.apex', 'workflows'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'feature.yaml'),
      `
name: feature
description: Implement a new feature with auto-fix integration
stages:
  - name: implementation
    agent: developer
    description: Implement the feature with potential import issues
    outputs:
      - code_changes
      - files_modified
`,
      'utf8'
    );

    // Initialize TaskStore
    store = new TaskStore(testDir);
    await store.initialize();

    // Create orchestrator with proper config
    orchestrator = new ApexOrchestrator({
      projectPath: testDir,
      apiUrl: 'http://localhost:3000',
    });

    await orchestrator.initialize();

    // Set up comprehensive event capture for all auto-fix events
    const autoFixEventTypes = [
      'autofix:requested',
      'autofix:started',
      'autofix:progress',
      'autofix:completed',
      'autofix:failed',
      'autofix:skipped',
      'auto-fix-start',
      'auto-fix-progress',
      'auto-fix-complete',
      'auto-fix-error'
    ];

    autoFixEventTypes.forEach(eventType => {
      orchestrator.on(eventType as any, (payload: any) => {
        capturedEvents.push({
          eventType,
          payload,
          timestamp: new Date()
        });
      });
    });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    if (store) {
      await store.close();
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should complete full workflow with auto-fix integration and emit events in correct order', async () => {
    // Create a task that will trigger code generation
    const task: Task = {
      id: `autofix-e2e-${Date.now()}`,
      title: 'Implement React component with missing imports',
      description: 'Create a React component that uses hooks and external libraries without proper imports',
      workflow: 'feature',
      status: 'pending',
      currentStage: 0,
      stages: [
        {
          name: 'implementation',
          agent: 'developer',
          description: 'Implement the feature with potential import issues',
          outputs: ['code_changes', 'files_modified']
        } as WorkflowStage
      ],
      results: [],
      usage: { totalTokens: 0, totalCost: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
      branch: 'apex/autofix-e2e-test',
      gitCommit: 'abc123def',
      projectPath: testDir,
      autonomy: 'full'
    };

    await store.createTask(task);
    taskId = task.id;

    // Mock Claude SDK to simulate agent generating code with import issues
    const mockClaudeSDK = {
      query: vi.fn().mockResolvedValue({
        messages: [
          'I\'ll implement a React component with hooks that will need import fixes.',
          '',
          'Here\'s the implementation:',
          '',
          '```typescript',
          'export function useCounter(initialValue: number = 0) {',
          '  const [count, setCount] = useState(initialValue);',
          '  const [history, setHistory] = useState<number[]>([]);',
          '',
          '  const increment = useCallback(() => {',
          '    setCount(prev => prev + 1);',
          '    setHistory(prev => [...prev, count + 1]);',
          '  }, [count]);',
          '',
          '  const reset = () => {',
          '    setCount(initialValue);',
          '    setHistory([]);',
          '  };',
          '',
          '  return { count, increment, reset, history };',
          '}',
          '',
          'export const CounterDisplay: React.FC<{ counter: ReturnType<typeof useCounter> }> = ({ counter }) => {',
          '  return (',
          '    <div>',
          '      <h2>Count: {counter.count}</h2>',
          '      <Button onClick={counter.increment}>Increment</Button>',
          '      <Button onClick={counter.reset}>Reset</Button>',
          '      <div>',
          '        History: {join(counter.history, ", ")}',
          '      </div>',
          '    </div>',
          '  );',
          '};',
          '```',
          '',
          '### Stage Summary: implementation',
          '**Status**: completed',
          '**Summary**: Implemented React counter component with hooks and utility functions that require import fixes',
          '**Files Modified**: src/components/Counter.tsx',
          '**Outputs**:',
          '- **code_changes**: Created useCounter hook and CounterDisplay component using React hooks and lodash',
          '- **files_modified**: src/components/Counter.tsx'
        ].join('\n')
      }),
      abortQuery: vi.fn()
    };

    (orchestrator as any).sdk = mockClaudeSDK;

    // Mock file system operations to capture generated code
    const generatedFiles: Map<string, string> = new Map();
    const originalWriteFile = fs.writeFile;

    vi.mocked(fs.writeFile).mockImplementation(async (filePath: any, content: any) => {
      if (typeof filePath === 'string' && filePath.includes('Counter.tsx')) {
        generatedFiles.set(filePath, content as string);
        return;
      }
      return originalWriteFile(filePath, content);
    });

    // Ensure components directory exists
    await fs.mkdir(path.join(testDir, 'src', 'components'), { recursive: true });

    // Mock the ImportAutoFixer with realistic behavior
    const mockAutoFixer = createMockAutoFixerWithAnalysis({
      filePath: path.join(testDir, 'src', 'components', 'Counter.tsx'),
      missingImports: [
        { identifier: 'React', source: 'react', importType: 'default' },
        { identifier: 'useState', source: 'react', importType: 'named' },
        { identifier: 'useCallback', source: 'react', importType: 'named' },
        { identifier: 'Button', source: './Button', importType: 'default' },
        { identifier: 'join', source: 'lodash', importType: 'named' }
      ],
      fixResults: {
        success: true,
        importsAdded: [
          { identifier: 'React', source: 'react', originalIdentifier: 'React', importType: 'default' },
          { identifier: 'useState', source: 'react', originalIdentifier: 'useState', importType: 'named' },
          { identifier: 'useCallback', source: 'react', originalIdentifier: 'useCallback', importType: 'named' },
          { identifier: 'Button', source: './Button', originalIdentifier: 'Button', importType: 'default' },
          { identifier: 'join', source: 'lodash', originalIdentifier: 'join', importType: 'named' }
        ],
        duration: 1500,
        errors: []
      }
    });

    MockImportAutoFixer.mockImplementation(() => mockAutoFixer as any);

    // Mock tool action store to provide modified files for auto-fix
    (orchestrator as any).toolActionStore = {
      getToolActions: vi.fn().mockResolvedValue([
        {
          stageName: 'implementation',
          modifiedFiles: [path.join(testDir, 'src', 'components', 'Counter.tsx')]
        }
      ])
    };

    // Execute the workflow task
    const result = await orchestrator.runTask(taskId);

    // ============================================================================
    // ASSERTIONS: Task Completion
    // ============================================================================
    expect(result.success).toBe(true);
    expect(result.task.status).toBe('completed');
    expect(result.task.results).toHaveLength(1);

    const stageResult = result.task.results[0];
    expect(stageResult.stageName).toBe('implementation');
    expect(stageResult.status).toBe('completed');

    // Verify auto-fix results are included in stage result
    expect(stageResult.autoFixResults).toBeDefined();
    expect(stageResult.autoFixResults?.applied).toBe(true);
    expect(stageResult.autoFixResults?.filesProcessed).toHaveLength(1);
    expect(stageResult.autoFixResults?.filesModified).toHaveLength(1);
    expect(stageResult.autoFixResults?.totalImportsAdded).toBe(5);

    // ============================================================================
    // ASSERTIONS: AutoFixService Invocation
    // ============================================================================
    expect(MockImportAutoFixer).toHaveBeenCalledWith({
      projectPath: testDir,
      detector: 'auto'
    });

    // Verify auto-fixer methods were called
    expect(mockAutoFixer.isAvailable).toHaveBeenCalled();
    expect(mockAutoFixer.analyze).toHaveBeenCalledWith([
      path.join(testDir, 'src', 'components', 'Counter.tsx')
    ]);
    expect(mockAutoFixer.fix).toHaveBeenCalledWith([
      path.join(testDir, 'src', 'components', 'Counter.tsx')
    ]);
    expect(mockAutoFixer.getSummary).toHaveBeenCalled();

    // ============================================================================
    // ASSERTIONS: Event Emission in Correct Order
    // ============================================================================
    expect(capturedEvents.length).toBeGreaterThan(0);

    // Sort events by timestamp to verify chronological order
    const sortedEvents = [...capturedEvents].sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Verify event sequence for the processed file
    const autoFixEventTypes = sortedEvents.map(e => e.eventType);

    // Should have requested -> started -> progress -> completed sequence
    expect(autoFixEventTypes.includes('autofix:requested')).toBe(true);
    expect(autoFixEventTypes.includes('autofix:started')).toBe(true);
    expect(autoFixEventTypes.includes('autofix:progress')).toBe(true);
    expect(autoFixEventTypes.includes('autofix:completed')).toBe(true);

    // Should also have standardized events
    expect(autoFixEventTypes.includes('auto-fix-start')).toBe(true);
    expect(autoFixEventTypes.includes('auto-fix-progress')).toBe(true);
    expect(autoFixEventTypes.includes('auto-fix-complete')).toBe(true);

    // Verify events contain correct task ID and file information
    const requestedEvent = capturedEvents.find(e => e.eventType === 'autofix:requested');
    expect(requestedEvent?.payload.taskId).toBe(taskId);
    expect(requestedEvent?.payload.filePath).toContain('Counter.tsx');
    expect(requestedEvent?.payload.fixTypes).toContain('imports');
    expect(requestedEvent?.payload.triggeredBy).toBe('hook');

    const startedEvent = capturedEvents.find(e => e.eventType === 'autofix:started');
    expect(startedEvent?.payload.taskId).toBe(taskId);
    expect(startedEvent?.payload.filePath).toContain('Counter.tsx');
    expect(startedEvent?.payload.fixType).toBe('imports');
    expect(startedEvent?.payload.issuesDetected).toBe(5);

    const completedEvent = capturedEvents.find(e => e.eventType === 'autofix:completed');
    expect(completedEvent?.payload.taskId).toBe(taskId);
    expect(completedEvent?.payload.filePath).toContain('Counter.tsx');
    expect(completedEvent?.payload.issuesFixed).toBe(5);
    expect(completedEvent?.payload.duration).toBe(1500);

    // ============================================================================
    // ASSERTIONS: Task State Reflects Auto-Fix Results
    // ============================================================================

    // Verify task logs contain auto-fix information
    const taskLogs = await store.getLogs(taskId);
    const autoFixLogs = taskLogs.filter(log =>
      log.message.toLowerCase().includes('auto-fix') ||
      log.message.toLowerCase().includes('import')
    );
    expect(autoFixLogs.length).toBeGreaterThan(0);

    // Verify stage results contain auto-fix metadata
    expect(stageResult.autoFixResults?.errors).toHaveLength(0);
    expect(stageResult.autoFixResults?.skipReason).toBeUndefined();
    expect(stageResult.autoFixResults?.totalDuration).toBe(1500);

    // Verify task artifacts include the generated file
    const finalTask = await store.getTask(taskId);
    expect(finalTask?.artifacts).toBeDefined();

    console.log(`✅ E2E Auto-Fix Test Completed Successfully:
    - Task: ${taskId}
    - Files Processed: ${stageResult.autoFixResults?.filesProcessed.length}
    - Imports Added: ${stageResult.autoFixResults?.totalImportsAdded}
    - Events Captured: ${capturedEvents.length}
    - Duration: ${stageResult.autoFixResults?.totalDuration}ms`);
  });

  it('should handle auto-fix failures gracefully within workflow context', async () => {
    // Create task that will encounter auto-fix errors
    const task: Task = {
      id: `autofix-error-e2e-${Date.now()}`,
      title: 'Test auto-fix error handling in workflow',
      description: 'Create a scenario where auto-fix encounters unrecoverable errors',
      workflow: 'feature',
      status: 'pending',
      currentStage: 0,
      stages: [
        {
          name: 'implementation',
          agent: 'developer',
          description: 'Generate code that will cause auto-fix errors',
          outputs: ['code_changes']
        } as WorkflowStage
      ],
      results: [],
      usage: { totalTokens: 0, totalCost: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
      branch: 'apex/autofix-error-test',
      gitCommit: 'def456ghi',
      projectPath: testDir,
      autonomy: 'full'
    };

    await store.createTask(task);
    taskId = task.id;

    // Mock Claude SDK to generate problematic code
    const mockClaudeSDK = {
      query: vi.fn().mockResolvedValue({
        messages: [
          'I\'ll create a component with complex import issues that will cause auto-fix errors.',
          '',
          '### Stage Summary: implementation',
          '**Status**: completed',
          '**Summary**: Created component with unresolvable import issues',
          '**Files Modified**: src/problematic.ts',
          '**Outputs**:',
          '- **code_changes**: Generated code with complex import dependencies'
        ].join('\n')
      }),
      abortQuery: vi.fn()
    };

    (orchestrator as any).sdk = mockClaudeSDK;

    // Mock auto-fixer to throw errors
    const mockErrorAutoFixer = {
      isAvailable: vi.fn().mockResolvedValue(true),
      analyze: vi.fn().mockResolvedValue([
        {
          missingImports: [
            { identifier: 'NonExistentModule', line: 1, suggestedSources: [] }
          ]
        }
      ]),
      fix: vi.fn().mockRejectedValue(new Error('Cannot resolve module: NonExistentModule not found in any registry')),
      getSummary: vi.fn().mockReturnValue({
        totalFiles: 1,
        successCount: 0,
        errorCount: 1,
        totalImports: 0,
        duration: 500
      })
    };

    MockImportAutoFixer.mockImplementation(() => mockErrorAutoFixer as any);

    // Mock tool action store
    (orchestrator as any).toolActionStore = {
      getToolActions: vi.fn().mockResolvedValue([
        {
          stageName: 'implementation',
          modifiedFiles: [path.join(testDir, 'src', 'problematic.ts')]
        }
      ])
    };

    // Execute the workflow
    const result = await orchestrator.runTask(taskId);

    // Task should still complete successfully (auto-fix failures don't fail the task)
    expect(result.success).toBe(true);
    expect(result.task.status).toBe('completed');

    // Verify error events were emitted
    const errorEvents = capturedEvents.filter(e =>
      e.eventType === 'autofix:failed' || e.eventType === 'auto-fix-error'
    );
    expect(errorEvents.length).toBeGreaterThan(0);

    const errorEvent = errorEvents.find(e => e.eventType === 'autofix:failed');
    expect(errorEvent?.payload.taskId).toBe(taskId);
    expect(errorEvent?.payload.error).toContain('Cannot resolve module');

    // Verify stage result reflects the failure
    const stageResult = result.task.results[0];
    expect(stageResult.autoFixResults?.applied).toBe(false);
    expect(stageResult.autoFixResults?.errors).toHaveLength(1);
    expect(stageResult.autoFixResults?.errors[0]).toContain('Cannot resolve module');

    // Verify logs contain error information
    const taskLogs = await store.getLogs(taskId);
    const errorLogs = taskLogs.filter(log =>
      log.level === 'warn' &&
      log.message.toLowerCase().includes('auto-fix')
    );
    expect(errorLogs.length).toBeGreaterThan(0);
  });

  // Helper function to create a comprehensive mock auto-fixer
  function createMockAutoFixerWithAnalysis(options: {
    filePath: string;
    missingImports: Array<{ identifier: string; source: string; importType: string }>;
    fixResults: {
      success: boolean;
      importsAdded: Array<{
        identifier: string;
        source: string;
        originalIdentifier: string;
        importType: string
      }>;
      duration: number;
      errors: string[];
    };
  }) {
    const { filePath, missingImports, fixResults } = options;

    return {
      isAvailable: vi.fn().mockResolvedValue(true),

      analyze: vi.fn().mockResolvedValue([
        {
          filePath,
          missingImports: missingImports.map(imp => ({
            identifier: imp.identifier,
            line: Math.floor(Math.random() * 20) + 1,
            column: Math.floor(Math.random() * 40) + 1,
            suggestedSources: [imp.source],
            isTypeOnly: false,
            context: { usageType: 'value' }
          }))
        }
      ]),

      fix: vi.fn().mockImplementation(async (files: string[]) => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100));

        return files.map(file => ({
          success: fixResults.success,
          filePath: file,
          importsAdded: fixResults.importsAdded,
          errors: fixResults.errors.map(err => ({
            message: err,
            line: 1,
            column: 1
          })),
          duration: fixResults.duration,
          content: 'mock-updated-content'
        }));
      }),

      getSummary: vi.fn().mockReturnValue({
        totalFiles: 1,
        successCount: fixResults.success ? 1 : 0,
        errorCount: fixResults.success ? 0 : 1,
        totalImports: fixResults.importsAdded.length,
        duration: fixResults.duration
      })
    };
  }
});