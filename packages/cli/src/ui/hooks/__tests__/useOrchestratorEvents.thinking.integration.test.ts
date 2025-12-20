import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOrchestratorEvents } from '../useOrchestratorEvents';
import { createMockOrchestrator } from '../../components/agents/__tests__/test-utils/MockOrchestrator';
import { createWorkflowStages } from '../../components/agents/__tests__/test-utils/fixtures';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

/**
 * Integration tests for agent:thinking event handler with complete workflow scenarios
 * Tests the thinking functionality in realistic workflow execution contexts
 */
describe('useOrchestratorEvents - Thinking Event Integration', () => {
  let mockOrchestrator: ReturnType<typeof createMockOrchestrator>;

  beforeEach(() => {
    mockOrchestrator = createMockOrchestrator();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockOrchestrator.cleanup();
    vi.clearAllMocks();
  });

  describe('Complete Workflow Integration', () => {
    it('should maintain thinking content through complete workflow execution', async () => {
      const taskId = 'workflow-integration-test';
      const workflow = {
        stages: createWorkflowStages(['planning', 'architecture', 'implementation', 'testing']),
      };

      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          taskId,
          workflow,
          debug: true,
        })
      );

      // Start task
      act(() => {
        mockOrchestrator.simulateTaskStart({ id: taskId, status: 'running' });
      });

      // Planning stage with thinking
      act(() => {
        mockOrchestrator.simulateAgentTransition(taskId, null, 'planner');
        mockOrchestrator.emit('agent:thinking', taskId, 'planner',
          'Planning the system architecture. Need to consider scalability, maintainability, and performance requirements.');
      });

      // Verify planning thinking is captured
      const plannerAgent = result.current.agents.find(a => a.name === 'planner');
      expect(plannerAgent?.debugInfo?.thinking).toContain('Planning the system architecture');
      expect(plannerAgent?.status).toBe('active');

      // Transition to architecture with thinking
      act(() => {
        mockOrchestrator.simulateAgentTransition(taskId, 'planner', 'architect');
        mockOrchestrator.emit('agent:thinking', taskId, 'architect',
          'Based on the planning, I need to design a modular architecture with clear separation of concerns.');
      });

      // Verify both agents maintain their thinking content
      const updatedPlannerAgent = result.current.agents.find(a => a.name === 'planner');
      const architectAgent = result.current.agents.find(a => a.name === 'architect');

      expect(updatedPlannerAgent?.debugInfo?.thinking).toContain('Planning the system architecture');
      expect(updatedPlannerAgent?.status).toBe('completed');
      expect(architectAgent?.debugInfo?.thinking).toContain('modular architecture');
      expect(architectAgent?.status).toBe('active');

      // Implementation stage with detailed thinking
      act(() => {
        mockOrchestrator.simulateAgentTransition(taskId, 'architect', 'developer');
        mockOrchestrator.emit('agent:thinking', taskId, 'developer',
          'Implementing core functionality. Need to write clean, testable code following the architectural patterns.');
      });

      // Final testing stage
      act(() => {
        mockOrchestrator.simulateAgentTransition(taskId, 'developer', 'tester');
        mockOrchestrator.emit('agent:thinking', taskId, 'tester',
          'Creating comprehensive test suite. Need unit tests, integration tests, and performance tests.');
      });

      // Verify all agents maintain their unique thinking content
      const finalAgents = result.current.agents;
      const finalPlanner = finalAgents.find(a => a.name === 'planner');
      const finalArchitect = finalAgents.find(a => a.name === 'architect');
      const finalDeveloper = finalAgents.find(a => a.name === 'developer');
      const finalTester = finalAgents.find(a => a.name === 'tester');

      expect(finalPlanner?.debugInfo?.thinking).toContain('Planning the system architecture');
      expect(finalArchitect?.debugInfo?.thinking).toContain('modular architecture');
      expect(finalDeveloper?.debugInfo?.thinking).toContain('clean, testable code');
      expect(finalTester?.debugInfo?.thinking).toContain('comprehensive test suite');

      // Verify status transitions worked correctly
      expect(finalPlanner?.status).toBe('completed');
      expect(finalArchitect?.status).toBe('completed');
      expect(finalDeveloper?.status).toBe('completed');
      expect(finalTester?.status).toBe('active');
    });

    it('should handle thinking during parallel execution', async () => {
      const taskId = 'parallel-thinking-test';
      const workflow = {
        stages: createWorkflowStages(['planning', 'review', 'testing']),
      };

      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          taskId,
          workflow,
        })
      );

      // Start with planning
      act(() => {
        mockOrchestrator.simulateTaskStart({ id: taskId, status: 'running' });
        mockOrchestrator.simulateAgentTransition(taskId, null, 'planner');
        mockOrchestrator.emit('agent:thinking', taskId, 'planner', 'Initial planning complete.');
      });

      // Start parallel execution
      act(() => {
        mockOrchestrator.simulateParallelStart(taskId, ['review', 'testing'], ['reviewer', 'tester']);

        // Add thinking for parallel agents
        mockOrchestrator.emit('agent:thinking', taskId, 'reviewer',
          'Reviewing code for quality, security, and adherence to standards.');
        mockOrchestrator.emit('agent:thinking', taskId, 'tester',
          'Setting up test environment and writing test cases.');
      });

      // Verify parallel agents have thinking content
      const agents = result.current.agents;
      const reviewerAgent = agents.find(a => a.name === 'reviewer');
      const testerAgent = agents.find(a => a.name === 'tester');

      expect(reviewerAgent?.debugInfo?.thinking).toContain('Reviewing code for quality');
      expect(testerAgent?.debugInfo?.thinking).toContain('Setting up test environment');

      // Verify parallel panel shows agents
      expect(result.current.parallelAgents).toHaveLength(2);
      expect(result.current.showParallelPanel).toBe(true);
    });

    it('should preserve thinking content during task failure recovery', () => {
      const taskId = 'failure-recovery-test';
      const workflow = {
        stages: createWorkflowStages(['implementation', 'testing']),
      };

      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          taskId,
          workflow,
        })
      );

      // Start implementation with thinking
      act(() => {
        mockOrchestrator.simulateTaskStart({ id: taskId, status: 'running' });
        mockOrchestrator.simulateAgentTransition(taskId, null, 'developer');
        mockOrchestrator.emit('agent:thinking', taskId, 'developer',
          'Implementation in progress. Working on core business logic.');
      });

      const developerBefore = result.current.agents.find(a => a.name === 'developer');
      expect(developerBefore?.debugInfo?.thinking).toContain('Implementation in progress');

      // Simulate task failure (this should clear state but preserve agents array structure)
      act(() => {
        mockOrchestrator.simulateTaskFail(
          { id: taskId, status: 'failed' },
          new Error('Network timeout')
        );
      });

      // Task state should be cleared but agent structure preserved for recovery
      expect(result.current.currentAgent).toBeUndefined();
      expect(result.current.currentTaskId).toBeUndefined();

      // Agents array should still exist (for potential recovery scenarios)
      expect(result.current.agents).toHaveLength(workflow.stages.length);
    });
  });

  describe('Real-time Thinking Updates', () => {
    it('should handle streaming thinking updates in real-time', async () => {
      const taskId = 'streaming-thinking-test';
      const workflow = {
        stages: [{ name: 'analysis', agent: 'analyst' }],
      };

      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          taskId,
          workflow,
        })
      );

      act(() => {
        mockOrchestrator.simulateAgentTransition(taskId, null, 'analyst');
      });

      // Simulate streaming thinking content (like what would happen during real agent execution)
      const thinkingSteps = [
        'Starting analysis...',
        'Analyzing requirements: user authentication needed',
        'Considering security implications: JWT vs sessions',
        'Evaluating database options: PostgreSQL vs MongoDB',
        'Final recommendation: PostgreSQL with JWT authentication'
      ];

      for (const [index, thinking] of thinkingSteps.entries()) {
        act(() => {
          mockOrchestrator.emit('agent:thinking', taskId, 'analyst', thinking);
        });

        // Verify each update is captured immediately
        const analystAgent = result.current.agents.find(a => a.name === 'analyst');
        expect(analystAgent?.debugInfo?.thinking).toBe(thinking);

        // Verify it's the latest content (not accumulated)
        if (index > 0) {
          expect(analystAgent?.debugInfo?.thinking).not.toContain(thinkingSteps[index - 1]);
        }
      }
    });

    it('should handle concurrent thinking from multiple agents', () => {
      const taskId = 'concurrent-thinking-test';
      const workflow = {
        stages: createWorkflowStages(['planning', 'architecture', 'implementation']),
      };

      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          taskId,
          workflow,
        })
      );

      // Simulate concurrent thinking updates (like what might happen with parallel processing)
      act(() => {
        // All agents start thinking simultaneously
        mockOrchestrator.emit('agent:thinking', taskId, 'planner', 'Planning the overall strategy...');
        mockOrchestrator.emit('agent:thinking', taskId, 'architect', 'Designing the system architecture...');
        mockOrchestrator.emit('agent:thinking', taskId, 'developer', 'Preparing development environment...');
      });

      // Verify each agent has its unique thinking content
      const agents = result.current.agents;
      expect(agents.find(a => a.name === 'planner')?.debugInfo?.thinking).toContain('overall strategy');
      expect(agents.find(a => a.name === 'architect')?.debugInfo?.thinking).toContain('system architecture');
      expect(agents.find(a => a.name === 'developer')?.debugInfo?.thinking).toContain('development environment');

      // Update one agent's thinking while others remain unchanged
      act(() => {
        mockOrchestrator.emit('agent:thinking', taskId, 'planner', 'Refined strategy based on requirements...');
      });

      const updatedAgents = result.current.agents;
      expect(updatedAgents.find(a => a.name === 'planner')?.debugInfo?.thinking).toContain('Refined strategy');
      expect(updatedAgents.find(a => a.name === 'architect')?.debugInfo?.thinking).toContain('system architecture'); // unchanged
      expect(updatedAgents.find(a => a.name === 'developer')?.debugInfo?.thinking).toContain('development environment'); // unchanged
    });
  });

  describe('Performance and Memory Integration', () => {
    it('should handle high-frequency thinking updates efficiently', () => {
      const taskId = 'performance-test';
      const workflow = {
        stages: [{ name: 'processing', agent: 'processor' }],
      };

      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          taskId,
          workflow,
        })
      );

      act(() => {
        mockOrchestrator.simulateAgentTransition(taskId, null, 'processor');
      });

      // Simulate high-frequency updates (like real-time streaming)
      const startTime = Date.now();

      act(() => {
        for (let i = 0; i < 1000; i++) {
          mockOrchestrator.emit('agent:thinking', taskId, 'processor', `Processing item ${i + 1}/1000...`);
        }
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Verify final state is correct
      const processorAgent = result.current.agents.find(a => a.name === 'processor');
      expect(processorAgent?.debugInfo?.thinking).toBe('Processing item 1000/1000...');

      // Verify reasonable performance (should complete in reasonable time)
      expect(processingTime).toBeLessThan(1000); // Less than 1 second for 1000 updates
    });

    it('should maintain thinking content integrity during rapid state changes', () => {
      const taskId = 'state-integrity-test';
      const workflow = {
        stages: createWorkflowStages(['planning', 'implementation', 'testing']),
      };

      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          taskId,
          workflow,
        })
      );

      // Rapid sequence of state changes with thinking updates
      act(() => {
        // Planning
        mockOrchestrator.simulateAgentTransition(taskId, null, 'planner');
        mockOrchestrator.emit('agent:thinking', taskId, 'planner', 'Starting to plan...');

        // Quick transition to implementation
        mockOrchestrator.simulateAgentTransition(taskId, 'planner', 'developer');
        mockOrchestrator.emit('agent:thinking', taskId, 'developer', 'Beginning implementation...');

        // Add more thinking to planner (testing that completed agents can still receive thinking)
        mockOrchestrator.emit('agent:thinking', taskId, 'planner', 'Final planning notes...');

        // Transition to testing
        mockOrchestrator.simulateAgentTransition(taskId, 'developer', 'tester');
        mockOrchestrator.emit('agent:thinking', taskId, 'tester', 'Setting up tests...');

        // Update developer thinking
        mockOrchestrator.emit('agent:thinking', taskId, 'developer', 'Implementation complete.');
      });

      // Verify all thinking content is preserved correctly despite rapid changes
      const finalAgents = result.current.agents;
      expect(finalAgents.find(a => a.name === 'planner')?.debugInfo?.thinking).toBe('Final planning notes...');
      expect(finalAgents.find(a => a.name === 'developer')?.debugInfo?.thinking).toBe('Implementation complete.');
      expect(finalAgents.find(a => a.name === 'tester')?.debugInfo?.thinking).toBe('Setting up tests...');

      // Verify status integrity
      expect(finalAgents.find(a => a.name === 'planner')?.status).toBe('completed');
      expect(finalAgents.find(a => a.name === 'developer')?.status).toBe('completed');
      expect(finalAgents.find(a => a.name === 'tester')?.status).toBe('active');
    });
  });
});