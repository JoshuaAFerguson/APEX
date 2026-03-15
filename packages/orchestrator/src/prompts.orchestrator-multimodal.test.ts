import { describe, it, expect } from 'vitest';
import {
  buildStagePrompt,
  buildPlannerStagePrompt,
  buildStagePromptMultimodal,
  buildPlannerStagePromptMultimodal,
  buildMultimodalContextDescription,
  extractImagesFromMultimodalContext,
  type StagePromptContext,
} from './prompts';
import type {
  MultimodalContext,
  AgentDefinition,
  WorkflowDefinition,
  Task,
  StageResult,
} from '@apexcli/core';
import { getEffectiveConfig, ApexConfigSchema } from '@apexcli/core';

describe('Orchestrator Multimodal Integration Tests', () => {
  // Helper functions
  const createMockConfig = () => {
    const config = ApexConfigSchema.parse({
      version: '1.0',
      project: {
        name: 'test-project',
        language: 'typescript',
        framework: 'nextjs',
      },
    });
    return getEffectiveConfig(config);
  };

  const createMockWorkflow = (): WorkflowDefinition => ({
    name: 'feature',
    description: 'Feature development workflow',
    stages: [
      { name: 'planning', agent: 'planner', parallel: false, maxRetries: 2 },
      { name: 'implementation', agent: 'developer', dependsOn: ['planning'], parallel: false, maxRetries: 2 },
      { name: 'testing', agent: 'tester', dependsOn: ['implementation'], parallel: true, maxRetries: 2 },
      { name: 'review', agent: 'reviewer', dependsOn: ['testing'], parallel: false, maxRetries: 2 },
    ],
  });

  const createMockAgents = (): Record<string, AgentDefinition> => ({
    planner: {
      name: 'planner',
      description: 'Plans implementation strategy',
      prompt: 'You are a planning agent.',
      model: 'opus',
    },
    developer: {
      name: 'developer',
      description: 'Implements features',
      prompt: 'You are a developer agent.',
      model: 'sonnet',
      tools: ['Read', 'Write', 'Edit', 'Bash'],
    },
    tester: {
      name: 'tester',
      description: 'Writes and runs tests',
      prompt: 'You are a testing agent.',
      model: 'sonnet',
    },
    reviewer: {
      name: 'reviewer',
      description: 'Reviews code changes',
      prompt: 'You are a code review agent.',
      model: 'haiku',
    },
  });

  const createMockMultimodalContext = (options?: {
    images?: number;
    webPages?: number;
    designMockups?: number;
    contextSummary?: string;
    includeFailedInputs?: boolean;
  }): MultimodalContext => {
    const {
      images = 0,
      webPages = 0,
      designMockups = 0,
      contextSummary,
      includeFailedInputs = false
    } = options || {};
    const inputs: any[] = [];

    // Add image inputs
    for (let i = 0; i < images; i++) {
      inputs.push({
        input: {
          type: 'image',
          mediaType: 'image/png',
          data: `image-data-${i + 1}`,
          description: `Test image ${i + 1}`,
        },
        status: 'completed' as const,
        processedAt: new Date(),
        processingDurationMs: 100,
        extractedContent: {
          text: `Image ${i + 1}`,
        },
      });
    }

    // Add web page inputs
    for (let i = 0; i < webPages; i++) {
      inputs.push({
        input: {
          type: 'web_page',
          url: `https://example.com/page${i + 1}`,
          capturedText: `Web page ${i + 1} content`,
        },
        status: 'completed' as const,
        processedAt: new Date(),
        processingDurationMs: 200,
        extractedContent: {
          text: `Web page ${i + 1} content`,
        },
      });
    }

    // Add design mockup inputs
    for (let i = 0; i < designMockups; i++) {
      inputs.push({
        input: {
          type: 'design_mockup',
          designTool: 'figma' as const,
          fileUrl: `https://figma.com/file/mockup${i + 1}`,
          description: `Design mockup ${i + 1}`,
        },
        status: 'completed' as const,
        processedAt: new Date(),
        processingDurationMs: 150,
        extractedContent: {
          text: `Design mockup ${i + 1}`,
          structuredData: {
            designTool: 'figma',
          },
        },
      });
    }

    // Add some failed inputs for testing
    if (includeFailedInputs) {
      inputs.push({
        input: {
          type: 'image',
          mediaType: 'image/png',
          data: 'failed-image-data',
          description: 'Failed image',
        },
        status: 'failed' as const,
        processedAt: new Date(),
        processingDurationMs: 300,
        error: 'Failed to process image',
      });
    }

    return {
      inputs,
      status: 'completed',
      inputCounts: {
        images,
        webPages,
        designMockups,
      },
      contextSummary,
      createdAt: new Date(),
      completedAt: new Date(),
      totalProcessingTimeMs: 500,
    };
  };

  const createMockTask = (multimodalContext?: MultimodalContext): Task => ({
    id: 'task_123_abc',
    description: 'Add user authentication',
    workflow: 'feature',
    autonomy: 'full',
    status: 'in-progress',
    projectPath: '/test/project',
    branchName: 'apex/123-add-user-authentication',
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:30:00Z'),
    usage: {
      inputTokens: 5000,
      outputTokens: 2000,
      totalTokens: 7000,
      estimatedCost: 0.045,
    },
    logs: [],
    artifacts: [],
    multimodalContext,
  });

  describe('Backward Compatibility Tests', () => {
    it('should maintain backward compatibility for buildStagePrompt with multimodal context', () => {
      const multimodalContext = createMockMultimodalContext({
        images: 2,
        webPages: 1,
        contextSummary: 'Design images and documentation'
      });

      const context: StagePromptContext = {
        task: createMockTask(multimodalContext),
        stage: { name: 'implementation', agent: 'developer', maxRetries: 2 },
        agent: createMockAgents().developer,
        workflow: createMockWorkflow(),
        config: createMockConfig(),
        previousStageResults: new Map(),
      };

      // Original function should still work and include multimodal context description
      const legacyPrompt = buildStagePrompt(context);
      const multimodalPrompt = buildStagePromptMultimodal(context);

      // Text content should be identical
      expect(legacyPrompt).toBe(multimodalPrompt.textPrompt);

      // Legacy prompt should include multimodal context description
      expect(legacyPrompt).toContain('## Multimodal Context');
      expect(legacyPrompt).toContain('Design images and documentation');
    });

    it('should maintain backward compatibility for buildPlannerStagePrompt with multimodal context', () => {
      const multimodalContext = createMockMultimodalContext({
        designMockups: 3,
        contextSummary: 'Figma designs for the new feature'
      });

      const context: StagePromptContext = {
        task: createMockTask(multimodalContext),
        stage: { name: 'planning', agent: 'planner', maxRetries: 2 },
        agent: createMockAgents().planner,
        workflow: createMockWorkflow(),
        config: createMockConfig(),
        previousStageResults: new Map(),
      };

      // Original function should still work and include multimodal context description
      const legacyPrompt = buildPlannerStagePrompt(context);
      const multimodalPrompt = buildPlannerStagePromptMultimodal(context);

      // Text content should be identical
      expect(legacyPrompt).toBe(multimodalPrompt.textPrompt);

      // Legacy prompt should include multimodal context description
      expect(legacyPrompt).toContain('## Multimodal Context');
      expect(legacyPrompt).toContain('Figma designs for the new feature');
    });

    it('should work without multimodal context (legacy behavior)', () => {
      const context: StagePromptContext = {
        task: createMockTask(), // No multimodal context
        stage: { name: 'implementation', agent: 'developer', maxRetries: 2 },
        agent: createMockAgents().developer,
        workflow: createMockWorkflow(),
        config: createMockConfig(),
        previousStageResults: new Map(),
      };

      const legacyPrompt = buildStagePrompt(context);
      const multimodalPrompt = buildStagePromptMultimodal(context);

      // Should be identical and not contain multimodal sections
      expect(legacyPrompt).toBe(multimodalPrompt.textPrompt);
      expect(legacyPrompt).not.toContain('## Multimodal Context');
      expect(multimodalPrompt.hasMultimodalContent).toBe(false);
    });
  });

  describe('Orchestrator Integration with Multimodal Workflows', () => {
    it('should properly format prompts for orchestrator with multimodal tasks', () => {
      const multimodalContext = createMockMultimodalContext({
        images: 3,
        webPages: 2,
        designMockups: 1,
        contextSummary: 'Complete design system with mockups, documentation, and reference images'
      });

      const task = createMockTask(multimodalContext);
      task.description = 'Implement a complete design system based on provided multimodal references';
      task.acceptanceCriteria = 'Design system matches all provided mockups and follows documentation guidelines';

      // Test planning stage
      const planningContext: StagePromptContext = {
        task,
        stage: { name: 'planning', agent: 'planner', maxRetries: 2 },
        agent: createMockAgents().planner,
        workflow: createMockWorkflow(),
        config: createMockConfig(),
        previousStageResults: new Map(),
      };

      const planningResult = buildStagePromptMultimodal(planningContext);

      // Should include multimodal content (images)
      expect(planningResult.hasMultimodalContent).toBe(true);
      expect(planningResult.contentBlocks).toHaveLength(4); // text + 3 images

      // Should include comprehensive context
      expect(planningResult.textPrompt).toContain('Complete design system with mockups');
      expect(planningResult.textPrompt).toContain('Acceptance Criteria');
      expect(planningResult.textPrompt).toContain('Design system matches all provided mockups');

      // Should include planning-specific instructions
      expect(planningResult.textPrompt).toContain('Task Analysis and Decomposition');
      expect(planningResult.textPrompt).toContain('You MUST DECOMPOSE if the task');

      // Test implementation stage with planning results
      const planningStageResult: StageResult = {
        stageName: 'planning',
        agent: 'planner',
        status: 'completed',
        outputs: {
          plan: 'Decomposed into component library, documentation site, and style guide',
          decomposition: {
            shouldDecompose: true,
            strategy: 'sequential',
            subtasks: [
              { description: 'Create component library', acceptanceCriteria: 'All components match designs' },
              { description: 'Build documentation site', acceptanceCriteria: 'Documentation is complete and accessible' },
              { description: 'Implement style guide', acceptanceCriteria: 'Style guide matches design tokens' },
            ],
          },
        },
        artifacts: ['docs/plan.md', 'docs/decomposition.json'],
        summary: 'Created comprehensive implementation plan with task decomposition',
        usage: { inputTokens: 2000, outputTokens: 800, totalTokens: 2800, estimatedCost: 0.015 },
        startedAt: new Date(),
        completedAt: new Date(),
      };

      const implementationContext: StagePromptContext = {
        task,
        stage: { name: 'implementation', agent: 'developer', maxRetries: 2, dependsOn: ['planning'] },
        agent: createMockAgents().developer,
        workflow: createMockWorkflow(),
        config: createMockConfig(),
        previousStageResults: new Map([['planning', planningStageResult]]),
      };

      const implementationResult = buildStagePromptMultimodal(implementationContext);

      // Should include inputs from planning
      expect(implementationResult.textPrompt).toContain('Inputs from Previous Stages');
      expect(implementationResult.textPrompt).toContain('From planning stage (planner)');
      expect(implementationResult.textPrompt).toContain('Created comprehensive implementation plan');
      expect(implementationResult.textPrompt).toContain('docs/plan.md');

      // Should still have multimodal content
      expect(implementationResult.hasMultimodalContent).toBe(true);
      expect(implementationResult.contentBlocks).toHaveLength(4); // text + 3 images

      // Should include developer-specific instructions
      expect(implementationResult.textPrompt).toContain('Developer Agent');
      expect(implementationResult.textPrompt).toContain('Implements features');
    });

    it('should handle orchestrator workflow with partial multimodal failure', () => {
      const multimodalContext = createMockMultimodalContext({
        images: 2,
        webPages: 1,
        includeFailedInputs: true, // This adds a failed image
        contextSummary: 'Partial multimodal context with some processing failures'
      });

      const task = createMockTask(multimodalContext);
      task.description = 'Implement feature with partial multimodal input';

      const context: StagePromptContext = {
        task,
        stage: { name: 'implementation', agent: 'developer', maxRetries: 2 },
        agent: createMockAgents().developer,
        workflow: createMockWorkflow(),
        config: createMockConfig(),
        previousStageResults: new Map(),
      };

      const result = buildStagePromptMultimodal(context);

      // Should only extract successful images
      const extractedImages = extractImagesFromMultimodalContext(multimodalContext);
      expect(extractedImages).toHaveLength(2); // Only successful images

      // Should be multimodal with successful images
      expect(result.hasMultimodalContent).toBe(true);
      expect(result.contentBlocks).toHaveLength(3); // text + 2 successful images

      // Should include context about partial processing
      expect(result.textPrompt).toContain('Partial multimodal context with some processing failures');
    });

    it('should handle complex workflow dependencies with multimodal context', () => {
      const multimodalContext = createMockMultimodalContext({
        images: 1,
        designMockups: 2,
        contextSummary: 'API documentation and UI mockups for integration'
      });

      const task = createMockTask(multimodalContext);
      task.description = 'Implement API integration with UI components';

      // Simulate planning stage completion
      const planningResult: StageResult = {
        stageName: 'planning',
        agent: 'planner',
        status: 'completed',
        outputs: {
          architecture: 'Service layer with React components',
          apiEndpoints: '/auth, /users, /dashboard',
        },
        artifacts: ['docs/architecture.md'],
        summary: 'Defined integration architecture',
        usage: { inputTokens: 1500, outputTokens: 600, totalTokens: 2100, estimatedCost: 0.012 },
        startedAt: new Date(),
        completedAt: new Date(),
      };

      // Simulate implementation stage completion
      const implementationResult: StageResult = {
        stageName: 'implementation',
        agent: 'developer',
        status: 'completed',
        outputs: {
          codeFiles: 'src/services/api.ts, src/components/Dashboard.tsx',
          testsCreated: true,
        },
        artifacts: ['src/services/api.ts', 'src/components/Dashboard.tsx'],
        summary: 'Implemented API service and UI components',
        usage: { inputTokens: 3000, outputTokens: 1200, totalTokens: 4200, estimatedCost: 0.025 },
        startedAt: new Date(),
        completedAt: new Date(),
      };

      // Test testing stage with dependencies
      const testingContext: StagePromptContext = {
        task,
        stage: {
          name: 'testing',
          agent: 'tester',
          maxRetries: 2,
          dependsOn: ['implementation'],
          parallel: true
        },
        agent: createMockAgents().tester,
        workflow: createMockWorkflow(),
        config: createMockConfig(),
        previousStageResults: new Map([
          ['planning', planningResult],
          ['implementation', implementationResult]
        ]),
      };

      const testingPrompt = buildStagePromptMultimodal(testingContext);

      // Should include inputs from implementation (direct dependency)
      expect(testingPrompt.textPrompt).toContain('Inputs from Previous Stages');
      expect(testingPrompt.textPrompt).toContain('From implementation stage (developer)');
      expect(testingPrompt.textPrompt).toContain('Implemented API service and UI components');

      // Should include files created in implementation
      expect(testingPrompt.textPrompt).toContain('src/services/api.ts');
      expect(testingPrompt.textPrompt).toContain('src/components/Dashboard.tsx');

      // Should include multimodal context for reference during testing
      expect(testingPrompt.textPrompt).toContain('API documentation and UI mockups for integration');

      // Should have testing-specific content
      expect(testingPrompt.textPrompt).toContain('Tester Agent');
      expect(testingPrompt.textPrompt).toContain('Writes and runs tests');
    });

    it('should format multimodal context descriptions consistently across stages', () => {
      const multimodalContext = createMockMultimodalContext({
        images: 2,
        webPages: 1,
        designMockups: 1,
      });

      const task = createMockTask(multimodalContext);

      const stages = ['planning', 'implementation', 'testing', 'review'];
      const agents = createMockAgents();
      const workflow = createMockWorkflow();

      stages.forEach(stageName => {
        const stage = workflow.stages.find(s => s.name === stageName);
        if (!stage) return;

        const context: StagePromptContext = {
          task,
          stage,
          agent: agents[stage.agent],
          workflow,
          config: createMockConfig(),
          previousStageResults: new Map(),
        };

        const result = buildStagePromptMultimodal(context);
        const description = buildMultimodalContextDescription(multimodalContext);

        // All stages should include the same multimodal context description
        expect(result.textPrompt).toContain(description);
        expect(result.textPrompt).toContain('2 images, 1 web page, 1 design mockup');
      });
    });
  });

  describe('Error Handling in Orchestrator Context', () => {
    it('should handle corrupted multimodal context gracefully', () => {
      const corruptedContext = {
        inputs: [
          {
            input: {
              type: 'image',
              // Missing required fields
            },
            status: 'completed',
            processedAt: new Date(),
            processingDurationMs: 100,
          },
          null, // null input
          {
            input: {
              type: 'invalid_type',
              data: 'some_data',
            },
            status: 'completed',
            processedAt: new Date(),
            processingDurationMs: 100,
          },
        ],
        status: 'completed',
        inputCounts: { images: 1, webPages: 0, designMockups: 0 },
        createdAt: new Date(),
      } as unknown as MultimodalContext;

      const task = createMockTask(corruptedContext);
      const context: StagePromptContext = {
        task,
        stage: { name: 'implementation', agent: 'developer', maxRetries: 2 },
        agent: createMockAgents().developer,
        workflow: createMockWorkflow(),
        config: createMockConfig(),
        previousStageResults: new Map(),
      };

      // Should not throw an error
      expect(() => buildStagePromptMultimodal(context)).not.toThrow();

      const result = buildStagePromptMultimodal(context);

      // Should fallback to text-only
      expect(result.hasMultimodalContent).toBe(false);
      expect(result.contentBlocks).toHaveLength(1);

      // Should still include basic prompt structure
      expect(result.textPrompt).toContain('Developer Agent');
      expect(result.textPrompt).toContain('Add user authentication');
    });

    it('should handle missing multimodal context fields', () => {
      const incompleteContext = {
        inputs: [],
        status: 'completed',
        // Missing inputCounts
        createdAt: new Date(),
      } as unknown as MultimodalContext;

      const description = buildMultimodalContextDescription(incompleteContext);
      expect(description).toBe(''); // Should return empty string

      const images = extractImagesFromMultimodalContext(incompleteContext);
      expect(images).toEqual([]); // Should return empty array
    });

    it('should handle orchestrator workflow with all failed multimodal inputs', () => {
      const multimodalContext: MultimodalContext = {
        inputs: [
          {
            input: {
              type: 'image',
              mediaType: 'image/png',
              data: 'failed-image-1',
            },
            status: 'failed',
            processedAt: new Date(),
            processingDurationMs: 100,
            error: 'Image processing failed',
          },
          {
            input: {
              type: 'image',
              mediaType: 'image/jpeg',
              data: 'failed-image-2',
            },
            status: 'failed',
            processedAt: new Date(),
            processingDurationMs: 150,
            error: 'Corrupt image data',
          },
        ],
        status: 'failed',
        inputCounts: { images: 2, webPages: 0, designMockups: 0 },
        contextSummary: 'All multimodal inputs failed to process',
        createdAt: new Date(),
        completedAt: new Date(),
        totalProcessingTimeMs: 250,
      };

      const task = createMockTask(multimodalContext);
      const context: StagePromptContext = {
        task,
        stage: { name: 'implementation', agent: 'developer', maxRetries: 2 },
        agent: createMockAgents().developer,
        workflow: createMockWorkflow(),
        config: createMockConfig(),
        previousStageResults: new Map(),
      };

      const result = buildStagePromptMultimodal(context);

      // Should be text-only since no images were successfully processed
      expect(result.hasMultimodalContent).toBe(false);
      expect(result.contentBlocks).toHaveLength(1);

      // Should still include context about failed processing
      expect(result.textPrompt).toContain('## Multimodal Context');
      expect(result.textPrompt).toContain('All multimodal inputs failed to process');
    });
  });
});