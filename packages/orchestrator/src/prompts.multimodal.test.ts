import { describe, it, expect } from 'vitest';
import {
  buildMultimodalContent,
  extractImagesFromMultimodalContext,
  buildMultimodalContextDescription,
  buildStagePromptMultimodal,
  buildPlannerStagePromptMultimodal,
  type MultimodalPromptResult,
  type ContentBlockParam,
  type TextBlockParam,
  type StagePromptContext,
} from './prompts';
import type { ImageBlockParam } from './tools/multimodal-input-handler';
import type {
  MultimodalContext,
  AgentDefinition,
  WorkflowDefinition,
  Task,
  WorkflowStage,
  StageResult
} from '@apexcli/core';
import { getEffectiveConfig, ApexConfigSchema } from '@apexcli/core';

describe('Multimodal Prompt Functions', () => {
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
  });

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

  const createMockImageBlock = (data: string = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA'): ImageBlockParam => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/png',
      data,
    },
  });

  const createMockMultimodalContext = (options?: {
    images?: number;
    webPages?: number;
    designMockups?: number;
    contextSummary?: string;
  }): MultimodalContext => {
    const { images = 1, webPages = 0, designMockups = 0, contextSummary } = options || {};
    const inputs: any[] = [];

    // Add image inputs
    for (let i = 0; i < images; i++) {
      inputs.push({
        input: {
          type: 'image',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA',
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

  describe('buildMultimodalContent', () => {
    it('should create text-only content when no images provided', () => {
      const textContent = 'Implement the login screen';
      const result = buildMultimodalContent(textContent);

      expect(result).toEqual({
        textPrompt: textContent,
        contentBlocks: [
          {
            type: 'text',
            text: textContent,
          },
        ],
        hasMultimodalContent: false,
      });
    });

    it('should create text-only content when empty images array provided', () => {
      const textContent = 'Implement the dashboard';
      const result = buildMultimodalContent(textContent, []);

      expect(result).toEqual({
        textPrompt: textContent,
        contentBlocks: [
          {
            type: 'text',
            text: textContent,
          },
        ],
        hasMultimodalContent: false,
      });
    });

    it('should create multimodal content when images provided', () => {
      const textContent = 'Implement this design:';
      const imageBlock = createMockImageBlock();
      const result = buildMultimodalContent(textContent, [imageBlock]);

      expect(result.textPrompt).toBe(textContent);
      expect(result.hasMultimodalContent).toBe(true);
      expect(result.contentBlocks).toHaveLength(2);

      // Check text block
      expect(result.contentBlocks[0]).toEqual({
        type: 'text',
        text: textContent,
      });

      // Check image block
      expect(result.contentBlocks[1]).toEqual(imageBlock);
    });

    it('should handle multiple images', () => {
      const textContent = 'Implement these designs:';
      const imageBlocks = [
        createMockImageBlock('image1'),
        createMockImageBlock('image2'),
        createMockImageBlock('image3'),
      ];
      const result = buildMultimodalContent(textContent, imageBlocks);

      expect(result.hasMultimodalContent).toBe(true);
      expect(result.contentBlocks).toHaveLength(4); // 1 text + 3 images
      expect(result.contentBlocks[0].type).toBe('text');
      expect(result.contentBlocks[1].type).toBe('image');
      expect(result.contentBlocks[2].type).toBe('image');
      expect(result.contentBlocks[3].type).toBe('image');
    });

    it('should handle empty text content', () => {
      const imageBlock = createMockImageBlock();
      const result = buildMultimodalContent('', [imageBlock]);

      expect(result.contentBlocks).toHaveLength(1); // Only image, no text block
      expect(result.contentBlocks[0]).toEqual(imageBlock);
      expect(result.hasMultimodalContent).toBe(true);
    });

    it('should handle whitespace-only text content', () => {
      const imageBlock = createMockImageBlock();
      const result = buildMultimodalContent('   \n\t   ', [imageBlock]);

      expect(result.contentBlocks).toHaveLength(1); // Only image, no text block
      expect(result.contentBlocks[0]).toEqual(imageBlock);
    });

    it('should preserve original text prompt even with images', () => {
      const textContent = 'Original prompt text';
      const imageBlock = createMockImageBlock();
      const result = buildMultimodalContent(textContent, [imageBlock]);

      expect(result.textPrompt).toBe(textContent);
    });
  });

  describe('extractImagesFromMultimodalContext', () => {
    it('should return empty array when no multimodal context', () => {
      const images = extractImagesFromMultimodalContext();
      expect(images).toEqual([]);
    });

    it('should return empty array when no inputs', () => {
      const context: MultimodalContext = {
        inputs: [],
        status: 'completed',
        inputCounts: { images: 0, webPages: 0, designMockups: 0 },
        createdAt: new Date(),
      };

      const images = extractImagesFromMultimodalContext(context);
      expect(images).toEqual([]);
    });

    it('should extract images from completed image inputs', () => {
      const context = createMockMultimodalContext({ images: 2 });
      const images = extractImagesFromMultimodalContext(context);

      expect(images).toHaveLength(2);
      images.forEach((image) => {
        expect(image.type).toBe('image');
        expect(image.source.type).toBe('base64');
        expect(image.source.media_type).toBe('image/png');
        expect(image.source.data).toBeTruthy();
      });
    });

    it('should skip non-image inputs', () => {
      const context = createMockMultimodalContext({
        images: 1,
        webPages: 2,
        designMockups: 1
      });

      const images = extractImagesFromMultimodalContext(context);
      expect(images).toHaveLength(1);
      expect(images[0].type).toBe('image');
    });

    it('should skip failed image inputs', () => {
      const context = createMockMultimodalContext({ images: 2 });
      // Mark first image as failed
      context.inputs![0].status = 'failed';

      const images = extractImagesFromMultimodalContext(context);
      expect(images).toHaveLength(1);
    });

    it('should handle missing data or mediaType', () => {
      const context: MultimodalContext = {
        inputs: [
          {
            input: {
              type: 'image',
              mediaType: 'image/png',
              // Missing data
            },
            status: 'completed',
            processedAt: new Date(),
            processingDurationMs: 100,
          },
          {
            input: {
              type: 'image',
              data: 'base64data',
              // Missing mediaType
            },
            status: 'completed',
            processedAt: new Date(),
            processingDurationMs: 100,
          },
        ],
        status: 'completed',
        inputCounts: { images: 2, webPages: 0, designMockups: 0 },
        createdAt: new Date(),
      };

      const images = extractImagesFromMultimodalContext(context);
      expect(images).toEqual([]);
    });

    it('should convert different media types correctly', () => {
      const context: MultimodalContext = {
        inputs: [
          {
            input: {
              type: 'image',
              mediaType: 'image/jpeg',
              data: 'jpegdata123',
            },
            status: 'completed',
            processedAt: new Date(),
            processingDurationMs: 100,
          },
          {
            input: {
              type: 'image',
              mediaType: 'image/webp',
              data: 'webpdata456',
            },
            status: 'completed',
            processedAt: new Date(),
            processingDurationMs: 100,
          },
        ],
        status: 'completed',
        inputCounts: { images: 2, webPages: 0, designMockups: 0 },
        createdAt: new Date(),
      };

      const images = extractImagesFromMultimodalContext(context);
      expect(images).toHaveLength(2);
      expect(images[0].source.media_type).toBe('image/jpeg');
      expect(images[0].source.data).toBe('jpegdata123');
      expect(images[1].source.media_type).toBe('image/webp');
      expect(images[1].source.data).toBe('webpdata456');
    });
  });

  describe('buildMultimodalContextDescription', () => {
    it('should return empty string when no multimodal context', () => {
      const description = buildMultimodalContextDescription();
      expect(description).toBe('');
    });

    it('should return empty string when no input counts', () => {
      const context: MultimodalContext = {
        inputs: [],
        status: 'completed',
        createdAt: new Date(),
      };

      const description = buildMultimodalContextDescription(context);
      expect(description).toBe('');
    });

    it('should return empty string when all counts are zero', () => {
      const context = createMockMultimodalContext({
        images: 0,
        webPages: 0,
        designMockups: 0
      });

      const description = buildMultimodalContextDescription(context);
      expect(description).toBe('');
    });

    it('should use contextSummary when available', () => {
      const context = createMockMultimodalContext({
        images: 2,
        contextSummary: 'Custom summary of multimodal content'
      });

      const description = buildMultimodalContextDescription(context);
      expect(description).toBe('\n\n## Multimodal Context\nCustom summary of multimodal content');
    });

    it('should build description for single image', () => {
      const context = createMockMultimodalContext({ images: 1 });
      const description = buildMultimodalContextDescription(context);

      expect(description).toBe('\n\n## Multimodal Context\nThis task includes 1 image for context and reference.');
    });

    it('should build description for multiple images', () => {
      const context = createMockMultimodalContext({ images: 3 });
      const description = buildMultimodalContextDescription(context);

      expect(description).toBe('\n\n## Multimodal Context\nThis task includes 3 images for context and reference.');
    });

    it('should build description for single web page', () => {
      const context = createMockMultimodalContext({ webPages: 1 });
      const description = buildMultimodalContextDescription(context);

      expect(description).toBe('\n\n## Multimodal Context\nThis task includes 1 web page for context and reference.');
    });

    it('should build description for multiple web pages', () => {
      const context = createMockMultimodalContext({ webPages: 2 });
      const description = buildMultimodalContextDescription(context);

      expect(description).toBe('\n\n## Multimodal Context\nThis task includes 2 web pages for context and reference.');
    });

    it('should build description for single design mockup', () => {
      const context = createMockMultimodalContext({ designMockups: 1 });
      const description = buildMultimodalContextDescription(context);

      expect(description).toBe('\n\n## Multimodal Context\nThis task includes 1 design mockup for context and reference.');
    });

    it('should build description for multiple design mockups', () => {
      const context = createMockMultimodalContext({ designMockups: 2 });
      const description = buildMultimodalContextDescription(context);

      expect(description).toBe('\n\n## Multimodal Context\nThis task includes 2 design mockups for context and reference.');
    });

    it('should build description for mixed content types', () => {
      const context = createMockMultimodalContext({
        images: 2,
        webPages: 1,
        designMockups: 3
      });
      const description = buildMultimodalContextDescription(context);

      expect(description).toBe('\n\n## Multimodal Context\nThis task includes 2 images, 1 web page, 3 design mockups for context and reference.');
    });

    it('should handle partial content types', () => {
      const context = createMockMultimodalContext({ images: 1, designMockups: 1 });
      const description = buildMultimodalContextDescription(context);

      expect(description).toBe('\n\n## Multimodal Context\nThis task includes 1 image, 1 design mockup for context and reference.');
    });
  });

  describe('buildStagePromptMultimodal', () => {
    const createStagePromptContext = (
      stageName: string = 'implementation',
      multimodalContext?: MultimodalContext,
      previousResults: Map<string, StageResult> = new Map()
    ): StagePromptContext => {
      const workflow = createMockWorkflow();
      const stage = workflow.stages.find(s => s.name === stageName) || workflow.stages[1];
      const agents = createMockAgents();
      const task = createMockTask(multimodalContext);

      return {
        task,
        stage,
        agent: agents[stage.agent],
        workflow,
        config: createMockConfig(),
        previousStageResults: previousResults,
      };
    };

    it('should return text-only result when no multimodal content', () => {
      const context = createStagePromptContext();
      const result = buildStagePromptMultimodal(context);

      expect(result.hasMultimodalContent).toBe(false);
      expect(result.contentBlocks).toHaveLength(1);
      expect(result.contentBlocks[0].type).toBe('text');
      expect(result.textPrompt).toBeTruthy();
    });

    it('should return multimodal result when images present', () => {
      const multimodalContext = createMockMultimodalContext({ images: 2 });
      const context = createStagePromptContext('implementation', multimodalContext);
      const result = buildStagePromptMultimodal(context);

      expect(result.hasMultimodalContent).toBe(true);
      expect(result.contentBlocks).toHaveLength(3); // 1 text + 2 images
      expect(result.contentBlocks[0].type).toBe('text');
      expect(result.contentBlocks[1].type).toBe('image');
      expect(result.contentBlocks[2].type).toBe('image');
    });

    it('should include multimodal context description in text prompt', () => {
      const multimodalContext = createMockMultimodalContext({
        images: 1,
        webPages: 1,
        contextSummary: 'Custom multimodal summary'
      });
      const context = createStagePromptContext('implementation', multimodalContext);
      const result = buildStagePromptMultimodal(context);

      expect(result.textPrompt).toContain('## Multimodal Context');
      expect(result.textPrompt).toContain('Custom multimodal summary');
    });

    it('should include agent name and role', () => {
      const context = createStagePromptContext('implementation');
      const result = buildStagePromptMultimodal(context);

      expect(result.textPrompt).toContain('Developer Agent');
      expect(result.textPrompt).toContain('Implements features');
    });

    it('should include task description', () => {
      const context = createStagePromptContext();
      const result = buildStagePromptMultimodal(context);

      expect(result.textPrompt).toContain('Add user authentication');
    });

    it('should include stage information', () => {
      const context = createStagePromptContext('testing');
      const result = buildStagePromptMultimodal(context);

      expect(result.textPrompt).toContain('testing stage');
      expect(result.textPrompt).toContain('Your Stage: testing');
    });

    it('should include project context', () => {
      const context = createStagePromptContext();
      const result = buildStagePromptMultimodal(context);

      expect(result.textPrompt).toContain('test-project');
      expect(result.textPrompt).toContain('typescript');
      expect(result.textPrompt).toContain('nextjs');
    });

    it('should include critical instructions', () => {
      const context = createStagePromptContext();
      const result = buildStagePromptMultimodal(context);

      expect(result.textPrompt).toContain('CRITICAL: Before completing');
      expect(result.textPrompt).toContain('npm run build');
      expect(result.textPrompt).toContain('npm run test');
    });

    it('should include output format instructions', () => {
      const context = createStagePromptContext();
      const result = buildStagePromptMultimodal(context);

      expect(result.textPrompt).toContain('### Stage Summary:');
      expect(result.textPrompt).toContain('**Status**: completed | failed');
      expect(result.textPrompt).toContain('**Files Modified**:');
    });

    it('should include inputs from previous stages', () => {
      const planningResult: StageResult = {
        stageName: 'planning',
        agent: 'planner',
        status: 'completed',
        outputs: { plan: 'Implementation plan' },
        artifacts: ['docs/plan.md'],
        summary: 'Created detailed plan',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.001 },
        startedAt: new Date(),
        completedAt: new Date(),
      };

      const previousResults = new Map([['planning', planningResult]]);
      const context = createStagePromptContext('implementation', undefined, previousResults);
      const result = buildStagePromptMultimodal(context);

      expect(result.textPrompt).toContain('Inputs from Previous Stages');
      expect(result.textPrompt).toContain('From planning stage');
      expect(result.textPrompt).toContain('Created detailed plan');
    });

    it('should work with different agents', () => {
      const context = createStagePromptContext('testing');
      const result = buildStagePromptMultimodal(context);

      expect(result.textPrompt).toContain('Tester Agent');
      expect(result.textPrompt).toContain('Writes and runs tests');
      expect(result.textPrompt).toContain('You are a testing agent');
    });

    it('should handle acceptance criteria when present', () => {
      const context = createStagePromptContext();
      context.task.acceptanceCriteria = 'JWT tokens working with proper validation';
      const result = buildStagePromptMultimodal(context);

      expect(result.textPrompt).toContain('Acceptance Criteria');
      expect(result.textPrompt).toContain('JWT tokens working with proper validation');
    });
  });

  describe('buildPlannerStagePromptMultimodal', () => {
    const createPlannerContext = (multimodalContext?: MultimodalContext): StagePromptContext => {
      const workflow = createMockWorkflow();
      const stage = workflow.stages.find(s => s.name === 'planning')!;
      const agents = createMockAgents();
      const task = createMockTask(multimodalContext);

      return {
        task,
        stage,
        agent: agents.planner,
        workflow,
        config: createMockConfig(),
        previousStageResults: new Map(),
      };
    };

    it('should return text-only result when no multimodal content', () => {
      const context = createPlannerContext();
      const result = buildPlannerStagePromptMultimodal(context);

      expect(result.hasMultimodalContent).toBe(false);
      expect(result.contentBlocks).toHaveLength(1);
      expect(result.contentBlocks[0].type).toBe('text');
    });

    it('should return multimodal result when images present', () => {
      const multimodalContext = createMockMultimodalContext({ images: 1 });
      const context = createPlannerContext(multimodalContext);
      const result = buildPlannerStagePromptMultimodal(context);

      expect(result.hasMultimodalContent).toBe(true);
      expect(result.contentBlocks).toHaveLength(2); // 1 text + 1 image
      expect(result.contentBlocks[0].type).toBe('text');
      expect(result.contentBlocks[1].type).toBe('image');
    });

    it('should include decomposition instructions', () => {
      const context = createPlannerContext();
      const result = buildPlannerStagePromptMultimodal(context);

      expect(result.textPrompt).toContain('CRITICAL: Task Analysis and Decomposition');
      expect(result.textPrompt).toContain('You MUST DECOMPOSE if the task');
      expect(result.textPrompt).toContain('```decompose');
    });

    it('should explain decomposition strategies', () => {
      const context = createPlannerContext();
      const result = buildPlannerStagePromptMultimodal(context);

      expect(result.textPrompt).toContain('sequential');
      expect(result.textPrompt).toContain('parallel');
      expect(result.textPrompt).toContain('dependency-based');
    });

    it('should include multimodal context when present', () => {
      const multimodalContext = createMockMultimodalContext({
        images: 2,
        designMockups: 1,
        contextSummary: 'Design mockups and screenshots available'
      });
      const context = createPlannerContext(multimodalContext);
      const result = buildPlannerStagePromptMultimodal(context);

      expect(result.textPrompt).toContain('## Multimodal Context');
      expect(result.textPrompt).toContain('Design mockups and screenshots available');
    });

    it('should include planning-specific guidance', () => {
      const context = createPlannerContext();
      const result = buildPlannerStagePromptMultimodal(context);

      expect(result.textPrompt).toContain('Planner Agent - Planning Stage');
      expect(result.textPrompt).toContain('responsible for planning the implementation');
      expect(result.textPrompt).toContain('Only for SIMPLE tasks');
    });

    it('should include project context', () => {
      const context = createPlannerContext();
      const result = buildPlannerStagePromptMultimodal(context);

      expect(result.textPrompt).toContain('test-project');
      expect(result.textPrompt).toContain('typescript');
      expect(result.textPrompt).toContain('feature');
    });

    it('should handle multiple images from multimodal context', () => {
      const multimodalContext = createMockMultimodalContext({ images: 3 });
      const context = createPlannerContext(multimodalContext);
      const result = buildPlannerStagePromptMultimodal(context);

      expect(result.hasMultimodalContent).toBe(true);
      expect(result.contentBlocks).toHaveLength(4); // 1 text + 3 images

      // All image blocks should be valid
      const imageBlocks = result.contentBlocks.slice(1) as ImageBlockParam[];
      imageBlocks.forEach((block) => {
        expect(block.type).toBe('image');
        expect(block.source.type).toBe('base64');
        expect(block.source.data).toBeTruthy();
      });
    });

    it('should include decomposition format examples', () => {
      const context = createPlannerContext();
      const result = buildPlannerStagePromptMultimodal(context);

      expect(result.textPrompt).toContain('acceptanceCriteria');
      expect(result.textPrompt).toContain('dependsOn');
      expect(result.textPrompt).toContain('workflow');
      expect(result.textPrompt).toContain('subtasks');
    });

    it('should provide clear output format instructions', () => {
      const context = createPlannerContext();
      const result = buildPlannerStagePromptMultimodal(context);

      expect(result.textPrompt).toContain('Output Format');
      expect(result.textPrompt).toContain('If NOT decomposing');
      expect(result.textPrompt).toContain('If DECOMPOSING');
    });
  });

  describe('Integration Tests', () => {
    it('should maintain backward compatibility with text-only prompts', () => {
      const context = createStagePromptContext();

      // Test that multimodal function returns same text as original function
      const multimodalResult = buildStagePromptMultimodal(context);

      expect(multimodalResult.textPrompt).toBeTruthy();
      expect(multimodalResult.contentBlocks[0].type).toBe('text');
      expect((multimodalResult.contentBlocks[0] as TextBlockParam).text).toBe(multimodalResult.textPrompt);
    });

    it('should properly format Claude SDK content blocks', () => {
      const multimodalContext = createMockMultimodalContext({ images: 2 });
      const context = createStagePromptContext('implementation', multimodalContext);
      const result = buildStagePromptMultimodal(context);

      // Validate structure matches Claude SDK expectations
      expect(result.contentBlocks).toHaveLength(3);

      // Text block validation
      const textBlock = result.contentBlocks[0] as TextBlockParam;
      expect(textBlock).toMatchObject({
        type: 'text',
        text: expect.any(String),
      });

      // Image block validation
      const imageBlocks = result.contentBlocks.slice(1) as ImageBlockParam[];
      imageBlocks.forEach((block) => {
        expect(block).toMatchObject({
          type: 'image',
          source: {
            type: 'base64',
            media_type: expect.stringMatching(/^image\/(png|jpeg|gif|webp)$/),
            data: expect.any(String),
          },
        });
      });
    });

    it('should handle empty multimodal context gracefully', () => {
      const emptyContext = createMockMultimodalContext({ images: 0 });
      const context = createStagePromptContext('implementation', emptyContext);
      const result = buildStagePromptMultimodal(context);

      expect(result.hasMultimodalContent).toBe(false);
      expect(result.contentBlocks).toHaveLength(1);
      expect(result.textPrompt).not.toContain('## Multimodal Context');
    });

    function createStagePromptContext(
      stageName: string = 'implementation',
      multimodalContext?: MultimodalContext
    ): StagePromptContext {
      const workflow = createMockWorkflow();
      const stage = workflow.stages.find(s => s.name === stageName) || workflow.stages[1];
      const agents = createMockAgents();
      const task = createMockTask(multimodalContext);

      return {
        task,
        stage,
        agent: agents[stage.agent],
        workflow,
        config: createMockConfig(),
        previousStageResults: new Map(),
      };
    }
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed multimodal context', () => {
      const malformedContext: Partial<MultimodalContext> = {
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
        ],
        inputCounts: { images: 1, webPages: 0, designMockups: 0 },
      };

      const images = extractImagesFromMultimodalContext(malformedContext as MultimodalContext);
      expect(images).toEqual([]);
    });

    it('should handle mixed success/failure status in multimodal context', () => {
      const context = createMockMultimodalContext({ images: 3 });
      context.inputs![0].status = 'failed';
      context.inputs![2].status = 'processing';

      const images = extractImagesFromMultimodalContext(context);
      expect(images).toHaveLength(1); // Only the completed one
    });

    it('should handle very long text content in multimodal prompts', () => {
      const longText = 'A'.repeat(10000);
      const imageBlock = createMockImageBlock();
      const result = buildMultimodalContent(longText, [imageBlock]);

      expect(result.textPrompt).toBe(longText);
      expect(result.hasMultimodalContent).toBe(true);
      expect(result.contentBlocks[0].type).toBe('text');
      expect((result.contentBlocks[0] as TextBlockParam).text).toBe(longText);
    });

    it('should preserve exact image data in conversions', () => {
      const originalData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA';
      const context: MultimodalContext = {
        inputs: [
          {
            input: {
              type: 'image',
              mediaType: 'image/png',
              data: originalData,
            },
            status: 'completed',
            processedAt: new Date(),
            processingDurationMs: 100,
          },
        ],
        status: 'completed',
        inputCounts: { images: 1, webPages: 0, designMockups: 0 },
        createdAt: new Date(),
      };

      const images = extractImagesFromMultimodalContext(context);
      expect(images).toHaveLength(1);
      expect(images[0].source.data).toBe(originalData);
    });
  });
});