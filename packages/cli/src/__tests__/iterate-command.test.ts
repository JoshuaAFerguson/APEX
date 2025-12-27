/**
 * Iterate Command Tests
 * Tests for the new iterate command functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { commands } from '../index.js';
import { Task, IterationDiff, IterationHistory } from '@apexcli/core';

describe('Iterate Command', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let readlineSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Mock readline module for interactive feedback tests
    readlineSpy = vi.spyOn(require('readline'), 'createInterface').mockImplementation(() => ({
      question: vi.fn((query, callback) => callback('test feedback')),
      close: vi.fn(),
    }));
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    readlineSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('should have iterate command registered in commands array', () => {
    const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

    expect(iterateCommand).toBeDefined();
    expect(iterateCommand?.name).toBe('iterate');
    expect(iterateCommand?.description).toContain('Iterate on a running task');
    expect(iterateCommand?.usage).toContain('/iterate <task-id>');
    expect(typeof iterateCommand?.handler).toBe('function');
  });

  it('should validate required task-id parameter', async () => {
    const iterateCommand = commands.find(cmd => cmd.name === 'iterate');
    expect(iterateCommand).toBeDefined();

    const mockContext = {
      orchestrator: null,
      cwd: '/test',
      initialized: false,
      config: null,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };

    await iterateCommand!.handler(mockContext, []);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('❌ Orchestrator not available')
    );
  });

  it('should handle missing orchestrator gracefully', async () => {
    const iterateCommand = commands.find(cmd => cmd.name === 'iterate');
    expect(iterateCommand).toBeDefined();

    const mockContext = {
      orchestrator: null,
      cwd: '/test',
      initialized: false,
      config: null,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };

    await iterateCommand!.handler(mockContext, ['task-123']);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('❌ Orchestrator not available')
    );
  });

  it('should provide usage information when called without arguments', async () => {
    const iterateCommand = commands.find(cmd => cmd.name === 'iterate');
    expect(iterateCommand).toBeDefined();

    // Create a mock orchestrator
    const mockOrchestrator = {
      getTask: vi.fn(),
      iterateTask: vi.fn(),
      getIterationDiff: vi.fn(),
    } as any;

    const mockContext = {
      orchestrator: mockOrchestrator,
      cwd: '/test',
      initialized: true,
      config: null,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };

    await iterateCommand!.handler(mockContext, []);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Usage: /iterate <task-id>')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Interactive mode: /iterate <task-id>')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Direct mode: /iterate <task-id> "your feedback here"')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Show diff: /iterate <task-id> --diff')
    );
  });

  describe('Direct Feedback Mode', () => {
    it('should process direct feedback successfully', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');
      expect(iterateCommand).toBeDefined();

      const mockTask: Partial<Task> = {
        id: 'task-123',
        status: 'in-progress',
        currentStage: 'development',
      };

      const mockOrchestrator = {
        getTask: vi.fn().mockResolvedValue(mockTask),
        iterateTask: vi.fn().mockResolvedValue('iter-456'),
        getIterationDiff: vi.fn(),
      } as any;

      const mockContext = {
        orchestrator: mockOrchestrator,
        cwd: '/test',
        initialized: true,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      await iterateCommand!.handler(mockContext, ['task-123', 'Please fix the bug']);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('task-123');
      expect(mockOrchestrator.iterateTask).toHaveBeenCalledWith('task-123', 'Please fix the bug');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔄 Processing feedback for task task-123...')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Feedback: "Please fix the bug"')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Iteration started with ID: iter-456')
      );
    });

    it('should handle task not found error', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockOrchestrator = {
        getTask: vi.fn().mockResolvedValue(null),
        iterateTask: vi.fn(),
        getIterationDiff: vi.fn(),
      } as any;

      const mockContext = {
        orchestrator: mockOrchestrator,
        cwd: '/test',
        initialized: true,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      await iterateCommand!.handler(mockContext, ['nonexistent-task', 'feedback']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Task nonexistent-task not found')
      );
    });

    it('should handle task not in progress error', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockTask: Partial<Task> = {
        id: 'task-123',
        status: 'completed',
        currentStage: 'done',
      };

      const mockOrchestrator = {
        getTask: vi.fn().mockResolvedValue(mockTask),
        iterateTask: vi.fn(),
        getIterationDiff: vi.fn(),
      } as any;

      const mockContext = {
        orchestrator: mockOrchestrator,
        cwd: '/test',
        initialized: true,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      await iterateCommand!.handler(mockContext, ['task-123', 'feedback']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Task task-123 is not in progress (status: completed)')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Only in-progress tasks can be iterated')
      );
    });

    it('should handle iteration errors gracefully', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockTask: Partial<Task> = {
        id: 'task-123',
        status: 'in-progress',
        currentStage: 'development',
      };

      const mockOrchestrator = {
        getTask: vi.fn().mockResolvedValue(mockTask),
        iterateTask: vi.fn().mockRejectedValue(new Error('Iteration failed')),
        getIterationDiff: vi.fn(),
      } as any;

      const mockContext = {
        orchestrator: mockOrchestrator,
        cwd: '/test',
        initialized: true,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      await iterateCommand!.handler(mockContext, ['task-123', 'feedback']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Iteration failed: Error: Iteration failed')
      );
    });
  });

  describe('Interactive Feedback Mode', () => {
    it('should handle interactive feedback successfully', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockTask: Partial<Task> = {
        id: 'task-123',
        status: 'in-progress',
        currentStage: 'development',
      };

      const mockOrchestrator = {
        getTask: vi.fn().mockResolvedValue(mockTask),
        iterateTask: vi.fn().mockResolvedValue('iter-789'),
        getIterationDiff: vi.fn(),
      } as any;

      // Mock readline for interactive input
      const mockReadline = {
        question: vi.fn((query, callback) => {
          // Simulate user entering feedback
          setTimeout(() => callback('Interactive feedback from user'), 0);
        }),
        close: vi.fn(),
      };

      readlineSpy.mockReturnValue(mockReadline);

      const mockContext = {
        orchestrator: mockOrchestrator,
        cwd: '/test',
        initialized: true,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      await iterateCommand!.handler(mockContext, ['task-123']);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('task-123');
      expect(mockReadline.question).toHaveBeenCalledWith(
        expect.stringContaining('Enter your feedback for task task-123'),
        expect.any(Function)
      );

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockOrchestrator.iterateTask).toHaveBeenCalledWith('task-123', 'Interactive feedback from user');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Iteration started with ID: iter-789')
      );
    });

    it('should handle empty feedback in interactive mode', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockTask: Partial<Task> = {
        id: 'task-123',
        status: 'in-progress',
        currentStage: 'development',
      };

      const mockOrchestrator = {
        getTask: vi.fn().mockResolvedValue(mockTask),
        iterateTask: vi.fn().mockRejectedValue(new Error('No feedback provided')),
        getIterationDiff: vi.fn(),
      } as any;

      const mockReadline = {
        question: vi.fn((query, callback) => {
          setTimeout(() => callback(''), 0); // Empty feedback
        }),
        close: vi.fn(),
      };

      readlineSpy.mockReturnValue(mockReadline);

      const mockContext = {
        orchestrator: mockOrchestrator,
        cwd: '/test',
        initialized: true,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      await iterateCommand!.handler(mockContext, ['task-123']);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  No feedback provided, iteration cancelled')
      );
    });
  });

  describe('Diff Mode', () => {
    it('should display iteration diff when --diff flag is provided', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockDiff: IterationDiff = {
        iterationId: 'iter-123',
        previousIterationId: 'iter-122',
        stageChange: { from: 'planning', to: 'development' },
        filesChanged: {
          added: ['new-feature.ts'],
          modified: ['existing-file.ts'],
          removed: ['old-file.ts'],
        },
        metricsChange: {
          tokenUsage: { before: 1000, after: 1200, delta: 200 },
          cost: { before: 0.05, after: 0.07, delta: 0.02 },
          duration: { before: 5000, after: 7000, delta: 2000 },
        },
        summary: 'Added new feature implementation',
      };

      const mockOrchestrator = {
        getTask: vi.fn(),
        iterateTask: vi.fn(),
        getIterationDiff: vi.fn().mockResolvedValue(mockDiff),
      } as any;

      const mockContext = {
        orchestrator: mockOrchestrator,
        cwd: '/test',
        initialized: true,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      await iterateCommand!.handler(mockContext, ['task-123', '--diff']);

      expect(mockOrchestrator.getIterationDiff).toHaveBeenCalledWith('task-123');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊 Getting iteration diff for task task-123...')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📈 Iteration Diff:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Iteration: iter-123')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Previous: iter-122')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stage: planning → development')
      );
    });

    it('should handle diff retrieval errors', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockOrchestrator = {
        getTask: vi.fn(),
        iterateTask: vi.fn(),
        getIterationDiff: vi.fn().mockRejectedValue(new Error('Diff not available')),
      } as any;

      const mockContext = {
        orchestrator: mockOrchestrator,
        cwd: '/test',
        initialized: true,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      await iterateCommand!.handler(mockContext, ['task-123', '--diff']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to get diff: Error: Diff not available')
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle task check failures gracefully', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockOrchestrator = {
        getTask: vi.fn().mockRejectedValue(new Error('Database error')),
        iterateTask: vi.fn(),
        getIterationDiff: vi.fn(),
      } as any;

      const mockContext = {
        orchestrator: mockOrchestrator,
        cwd: '/test',
        initialized: true,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      await iterateCommand!.handler(mockContext, ['task-123', 'feedback']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to check task: Error: Database error')
      );
    });

    it('should handle multiple arguments correctly', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockTask: Partial<Task> = {
        id: 'task-123',
        status: 'in-progress',
        currentStage: 'development',
      };

      const mockOrchestrator = {
        getTask: vi.fn().mockResolvedValue(mockTask),
        iterateTask: vi.fn().mockResolvedValue('iter-999'),
        getIterationDiff: vi.fn(),
      } as any;

      const mockContext = {
        orchestrator: mockOrchestrator,
        cwd: '/test',
        initialized: true,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      // Test with feedback containing spaces
      await iterateCommand!.handler(mockContext, ['task-123', 'This', 'is', 'multi-word', 'feedback']);

      expect(mockOrchestrator.iterateTask).toHaveBeenCalledWith('task-123', 'This');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Feedback: "This"')
      );
    });
  });
});

describe('Iterate Command Integration', () => {
  it('should be able to import ApexOrchestrator with iteration methods', async () => {
    try {
      const { ApexOrchestrator } = await import('@apexcli/orchestrator');
      expect(ApexOrchestrator).toBeDefined();
      expect(typeof ApexOrchestrator).toBe('function');

      // Check that the orchestrator has the iteration methods we need
      const orchestrator = new ApexOrchestrator({ projectPath: '/test' });
      expect(typeof orchestrator.iterateTask).toBe('function');
      expect(typeof orchestrator.getIterationDiff).toBe('function');
      expect(typeof orchestrator.getIterationHistory).toBe('function');
      expect(typeof orchestrator.getInteractionManager).toBe('function');
    } catch (error) {
      console.error('Failed to import ApexOrchestrator with iteration methods:', error);
      throw error;
    }
  });
});