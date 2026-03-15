import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildStagePromptMultimodal,
  buildPlannerStagePromptMultimodal,
  extractImagesFromMultimodalContext,
  buildMultimodalContent,
  type StagePromptContext,
} from './prompts';
import { MultimodalInputHandler, type ImageBlockParam } from './tools/multimodal-input-handler';
import type {
  MultimodalContext,
  AgentDefinition,
  WorkflowDefinition,
  Task,
} from '@apexcli/core';
import { getEffectiveConfig, ApexConfigSchema } from '@apexcli/core';

describe('Multimodal Prompt Integration Tests', () => {
  let mockHandler: MultimodalInputHandler;

  beforeEach(() => {
    mockHandler = new MultimodalInputHandler();
  });

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
  });

  describe('Integration with Real MultimodalInputHandler Processing', () => {
    it('should correctly process and convert multimodal inputs for Claude API', async () => {
      // Simulate processing multimodal inputs that would come from MultimodalInputHandler
      const mockInputs = [
        {
          type: 'image' as const,
          mediaType: 'image/png' as const,
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA',
          description: 'Login screen mockup',
        },
        {
          type: 'web_page' as const,
          url: 'https://example.com/design-system',
          capturedText: 'Design system guidelines for authentication components',
        },
        {
          type: 'design_mockup' as const,
          designTool: 'figma' as const,
          fileUrl: 'https://figma.com/file/123/login-flow',
          description: 'Complete login flow designs',
        },
      ];

      // Process inputs using MultimodalInputHandler.processInputs method
      const processedContext = await mockHandler.processInputs(mockInputs);

      const task: Task = {
        id: 'task_123_abc',
        description: 'Implement user authentication with provided designs',
        workflow: 'feature',
        autonomy: 'full',
        status: 'in-progress',
        projectPath: '/test/project',
        branchName: 'apex/123-implement-auth',
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        },
        logs: [],
        artifacts: [],
        multimodalContext: processedContext,
      };

      const context: StagePromptContext = {
        task,
        stage: { name: 'implementation', agent: 'developer', maxRetries: 2 },
        agent: createMockAgents().developer,
        workflow: createMockWorkflow(),
        config: createMockConfig(),
        previousStageResults: new Map(),
      };

      // Build multimodal prompt
      const result = buildStagePromptMultimodal(context);

      // Verify the prompt includes multimodal context
      expect(result.textPrompt).toContain('## Multimodal Context');
      expect(result.textPrompt).toContain('1 image, 1 web page, 1 design mockup');

      // For images, should have multimodal content
      expect(result.hasMultimodalContent).toBe(true);
      expect(result.contentBlocks).toHaveLength(2); // text + 1 image

      // The image block should be properly formatted
      const imageBlock = result.contentBlocks[1] as ImageBlockParam;
      expect(imageBlock.type).toBe('image');
      expect(imageBlock.source.type).toBe('base64');
      expect(imageBlock.source.media_type).toBe('image/png');
      expect(imageBlock.source.data).toBeTruthy();
    });

    it('should handle GitHub issue images in prompt building', async () => {
      const githubIssueContent = `
        ## Bug Report

        The login form has styling issues. See screenshots:

        ![Login form issue](https://user-images.githubusercontent.com/12345/screenshot1.png)
        ![Error state](https://user-images.githubusercontent.com/12345/screenshot2.png)

        Expected behavior: Form should display correctly.
      `;

      // Mock the GitHub issue processing (since we can't actually download images in tests)
      const mockGitHubResult = {
        issueContent: githubIssueContent,
        imageUrls: [
          'https://user-images.githubusercontent.com/12345/screenshot1.png',
          'https://user-images.githubusercontent.com/12345/screenshot2.png',
        ],
        imageBlocks: [
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: 'image/png' as const,
              data: 'mock-base64-data-1',
            },
          },
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: 'image/png' as const,
              data: 'mock-base64-data-2',
            },
          },
        ],
        imageMetadata: [
          { url: 'https://user-images.githubusercontent.com/12345/screenshot1.png', fileSizeBytes: 1024, mediaType: 'image/png', downloadTime: 500 },
          { url: 'https://user-images.githubusercontent.com/12345/screenshot2.png', fileSizeBytes: 2048, mediaType: 'image/png', downloadTime: 750 },
        ],
        totalProcessingTime: 1250,
      };

      // Create multimodal context based on GitHub images
      const multimodalContext: MultimodalContext = {
        inputs: mockGitHubResult.imageBlocks.map((block, index) => ({
          input: {
            type: 'image',
            mediaType: block.source.media_type,
            data: block.source.data,
            description: `GitHub screenshot ${index + 1}`,
          },
          status: 'completed' as const,
          processedAt: new Date(),
          processingDurationMs: mockGitHubResult.imageMetadata[index].downloadTime,
          extractedContent: {
            text: `GitHub screenshot ${index + 1}`,
          },
        })),
        status: 'completed',
        inputCounts: { images: 2, webPages: 0, designMockups: 0 },
        contextSummary: 'GitHub issue with 2 screenshots showing login form issues',
        createdAt: new Date(),
        completedAt: new Date(),
        totalProcessingTimeMs: mockGitHubResult.totalProcessingTime,
      };

      const task: Task = {
        id: 'task_456_def',
        description: 'Fix login form styling issues reported in GitHub issue',
        workflow: 'feature',
        autonomy: 'full',
        status: 'in-progress',
        projectPath: '/test/project',
        branchName: 'apex/456-fix-login-styling',
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
        logs: [],
        artifacts: [],
        multimodalContext,
      };

      const context: StagePromptContext = {
        task,
        stage: { name: 'implementation', agent: 'developer', maxRetries: 2 },
        agent: createMockAgents().developer,
        workflow: createMockWorkflow(),
        config: createMockConfig(),
        previousStageResults: new Map(),
      };

      const result = buildStagePromptMultimodal(context);

      // Should be multimodal with GitHub images
      expect(result.hasMultimodalContent).toBe(true);
      expect(result.contentBlocks).toHaveLength(3); // text + 2 images

      // Should contain context description
      expect(result.textPrompt).toContain('GitHub issue with 2 screenshots showing login form issues');

      // Images should be properly converted
      const imageBlocks = result.contentBlocks.slice(1) as ImageBlockParam[];
      expect(imageBlocks).toHaveLength(2);
      imageBlocks.forEach((block, index) => {
        expect(block.type).toBe('image');
        expect(block.source.media_type).toBe('image/png');
        expect(block.source.data).toBe(`mock-base64-data-${index + 1}`);
      });
    });

    it('should handle design mockups from Figma URLs in planning stage', async () => {
      // Mock Figma design processing
      const figmaUrl = 'https://www.figma.com/file/abc123xyz/LoginScreens?node-id=123:456';

      const mockFigmaResult = {
        imageBlock: {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: 'image/png' as const,
            data: 'figma-export-base64-data',
          },
        },
        designTool: 'figma' as const,
        metadata: {
          fileId: 'abc123xyz',
          nodeId: '123:456',
          fileUrl: figmaUrl,
          frameName: 'LoginScreens',
        },
        exportFormat: 'png' as const,
        exportScale: 2,
        fileSizeBytes: 4096,
        mediaType: 'image/png',
        processingTime: 1500,
        fromCache: false,
      };

      // Create multimodal context for Figma design
      const multimodalContext: MultimodalContext = {
        inputs: [
          {
            input: {
              type: 'design_mockup',
              designTool: 'figma',
              fileUrl: figmaUrl,
              description: 'Login screen designs from Figma',
              fileId: mockFigmaResult.metadata.fileId,
              frameName: mockFigmaResult.metadata.frameName,
            },
            status: 'completed',
            processedAt: new Date(),
            processingDurationMs: mockFigmaResult.processingTime,
            extractedContent: {
              text: 'Login screen designs from Figma',
              structuredData: {
                designTool: 'figma',
                metadata: mockFigmaResult.metadata,
              },
            },
          },
        ],
        status: 'completed',
        inputCounts: { images: 0, webPages: 0, designMockups: 1 },
        contextSummary: 'Figma design file with login screen mockups for implementation guidance',
        createdAt: new Date(),
        completedAt: new Date(),
        totalProcessingTimeMs: mockFigmaResult.processingTime,
      };

      const task: Task = {
        id: 'task_789_ghi',
        description: 'Plan implementation of login screens based on Figma designs',
        workflow: 'feature',
        autonomy: 'full',
        status: 'in-progress',
        projectPath: '/test/project',
        branchName: 'apex/789-plan-login-screens',
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
        logs: [],
        artifacts: [],
        multimodalContext,
      };

      const context: StagePromptContext = {
        task,
        stage: { name: 'planning', agent: 'planner', maxRetries: 2 },
        agent: createMockAgents().planner,
        workflow: createMockWorkflow(),
        config: createMockConfig(),
        previousStageResults: new Map(),
      };

      const result = buildPlannerStagePromptMultimodal(context);

      // For design mockups without actual images, should be text-only but include context
      expect(result.hasMultimodalContent).toBe(false);
      expect(result.contentBlocks).toHaveLength(1);
      expect(result.contentBlocks[0].type).toBe('text');

      // Should include Figma context in the text prompt
      expect(result.textPrompt).toContain('## Multimodal Context');
      expect(result.textPrompt).toContain('Figma design file with login screen mockups for implementation guidance');

      // Should include planning-specific decomposition instructions
      expect(result.textPrompt).toContain('CRITICAL: Task Analysis and Decomposition');
      expect(result.textPrompt).toContain('```decompose');
    });

    it('should properly format content blocks for Claude API consumption', () => {
      const textContent = 'Implement this login screen design:';
      const images: ImageBlockParam[] = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: 'login-mockup-data',
          },
        },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: 'error-state-data',
          },
        },
      ];

      const result = buildMultimodalContent(textContent, images);

      // Validate the structure is exactly what Claude SDK expects
      expect(result.contentBlocks).toHaveLength(3);

      // Text block
      const textBlock = result.contentBlocks[0];
      expect(textBlock).toEqual({
        type: 'text',
        text: textContent,
      });

      // Image blocks
      const imageBlocks = result.contentBlocks.slice(1);
      expect(imageBlocks).toEqual(images);

      // Should be marked as multimodal
      expect(result.hasMultimodalContent).toBe(true);

      // Text prompt should remain unchanged
      expect(result.textPrompt).toBe(textContent);
    });

    it('should handle mixed multimodal inputs with complex context', async () => {
      const complexInputs = [
        {
          type: 'image' as const,
          mediaType: 'image/png' as const,
          data: 'dashboard-wireframe-data',
          description: 'Dashboard wireframe',
        },
        {
          type: 'web_page' as const,
          url: 'https://example.com/api-docs',
          capturedMarkdown: '# API Documentation\n\n## Authentication Endpoints...',
        },
        {
          type: 'design_mockup' as const,
          designTool: 'sketch' as const,
          fileName: 'DashboardComponents.sketch',
          description: 'Component library for dashboard',
        },
        {
          type: 'image' as const,
          mediaType: 'image/jpeg' as const,
          data: 'user-flow-diagram-data',
          description: 'User flow diagram',
        },
      ];

      const processedContext = await mockHandler.processInputs(complexInputs);

      const task: Task = {
        id: 'task_complex',
        description: 'Build comprehensive dashboard with authentication',
        workflow: 'feature',
        autonomy: 'full',
        status: 'in-progress',
        projectPath: '/test/project',
        branchName: 'apex/complex-dashboard',
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
        logs: [],
        artifacts: [],
        multimodalContext: processedContext,
        acceptanceCriteria: 'Dashboard should match designs and integrate with authentication API',
      };

      const context: StagePromptContext = {
        task,
        stage: { name: 'implementation', agent: 'developer', maxRetries: 2 },
        agent: createMockAgents().developer,
        workflow: createMockWorkflow(),
        config: createMockConfig(),
        previousStageResults: new Map(),
      };

      const result = buildStagePromptMultimodal(context);

      // Should be multimodal (contains images)
      expect(result.hasMultimodalContent).toBe(true);

      // Should have text + images (2 images from the complex inputs)
      expect(result.contentBlocks).toHaveLength(3); // text + 2 images

      // Should include comprehensive multimodal context
      expect(result.textPrompt).toContain('## Multimodal Context');
      expect(result.textPrompt).toContain('2 images, 1 web page, 1 design mockup');

      // Should include acceptance criteria
      expect(result.textPrompt).toContain('Acceptance Criteria');
      expect(result.textPrompt).toContain('Dashboard should match designs and integrate with authentication API');

      // Images should be properly extracted
      const imageBlocks = result.contentBlocks.slice(1) as ImageBlockParam[];
      expect(imageBlocks).toHaveLength(2);
      expect(imageBlocks[0].source.media_type).toBe('image/png');
      expect(imageBlocks[1].source.media_type).toBe('image/jpeg');
    });

    it('should extract images correctly from processed multimodal context', () => {
      // Create a multimodal context as it would be created by MultimodalInputHandler
      const multimodalContext: MultimodalContext = {
        inputs: [
          {
            input: {
              type: 'image',
              mediaType: 'image/png',
              data: 'first-image-data',
              description: 'First screenshot',
            },
            status: 'completed',
            processedAt: new Date(),
            processingDurationMs: 100,
            extractedContent: { text: 'First screenshot' },
          },
          {
            input: {
              type: 'web_page',
              url: 'https://example.com',
              capturedText: 'Web content',
            },
            status: 'completed',
            processedAt: new Date(),
            processingDurationMs: 200,
            extractedContent: { text: 'Web content' },
          },
          {
            input: {
              type: 'image',
              mediaType: 'image/jpeg',
              data: 'second-image-data',
              description: 'Second screenshot',
            },
            status: 'completed',
            processedAt: new Date(),
            processingDurationMs: 150,
            extractedContent: { text: 'Second screenshot' },
          },
          {
            input: {
              type: 'image',
              mediaType: 'image/png',
              data: 'failed-image-data',
              description: 'Failed screenshot',
            },
            status: 'failed', // This should be skipped
            processedAt: new Date(),
            processingDurationMs: 300,
          },
        ],
        status: 'completed',
        inputCounts: { images: 3, webPages: 1, designMockups: 0 },
        createdAt: new Date(),
        completedAt: new Date(),
        totalProcessingTimeMs: 750,
      };

      const extractedImages = extractImagesFromMultimodalContext(multimodalContext);

      // Should extract only the completed images (2 out of 3)
      expect(extractedImages).toHaveLength(2);

      // First image
      expect(extractedImages[0]).toEqual({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: 'first-image-data',
        },
      });

      // Second image
      expect(extractedImages[1]).toEqual({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: 'second-image-data',
        },
      });
    });

    it('should handle edge case with no valid images in multimodal context', () => {
      const multimodalContext: MultimodalContext = {
        inputs: [
          {
            input: {
              type: 'web_page',
              url: 'https://example.com/docs',
              capturedText: 'Documentation content',
            },
            status: 'completed',
            processedAt: new Date(),
            processingDurationMs: 200,
            extractedContent: { text: 'Documentation content' },
          },
          {
            input: {
              type: 'design_mockup',
              designTool: 'figma',
              fileUrl: 'https://figma.com/file/123',
              description: 'Design file',
            },
            status: 'completed',
            processedAt: new Date(),
            processingDurationMs: 300,
            extractedContent: {
              text: 'Design file',
              structuredData: { designTool: 'figma' },
            },
          },
        ],
        status: 'completed',
        inputCounts: { images: 0, webPages: 1, designMockups: 1 },
        contextSummary: 'Documentation and design references without images',
        createdAt: new Date(),
        completedAt: new Date(),
        totalProcessingTimeMs: 500,
      };

      const task: Task = {
        id: 'task_no_images',
        description: 'Implement feature based on docs and designs',
        workflow: 'feature',
        autonomy: 'full',
        status: 'in-progress',
        projectPath: '/test/project',
        branchName: 'apex/no-images-test',
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
        logs: [],
        artifacts: [],
        multimodalContext,
      };

      const context: StagePromptContext = {
        task,
        stage: { name: 'implementation', agent: 'developer', maxRetries: 2 },
        agent: createMockAgents().developer,
        workflow: createMockWorkflow(),
        config: createMockConfig(),
        previousStageResults: new Map(),
      };

      const result = buildStagePromptMultimodal(context);

      // Should not be multimodal (no images)
      expect(result.hasMultimodalContent).toBe(false);
      expect(result.contentBlocks).toHaveLength(1);
      expect(result.contentBlocks[0].type).toBe('text');

      // But should still include multimodal context description
      expect(result.textPrompt).toContain('## Multimodal Context');
      expect(result.textPrompt).toContain('Documentation and design references without images');
    });
  });
});