import { describe, it, expect } from 'vitest';
import {
  Task,
  CreateTaskRequest,
  MultimodalInput,
  MultimodalContext,
  ProcessedMultimodalInput,
  TaskStatus,
  AutonomyLevel,
  TaskPriority,
  TaskEffort,
  TaskUsage,
} from '../types';

describe('Task-Multimodal Integration', () => {
  describe('CreateTaskRequest Integration', () => {
    it('should create task request without multimodal inputs', () => {
      const basicRequest: CreateTaskRequest = {
        description: 'Simple text-based task',
        acceptanceCriteria: 'Task should be completed successfully',
        workflow: 'basic-workflow',
        autonomy: 'medium',
        priority: 'medium',
        effort: 'small',
      };

      expect(basicRequest.multimodalInputs).toBeUndefined();
      expect(basicRequest.description).toBe('Simple text-based task');
    });

    it('should create task request with single multimodal input', () => {
      const singleMultimodalRequest: CreateTaskRequest = {
        description: 'Analyze the provided screenshot',
        acceptanceCriteria: 'Identify all UI elements in the screenshot',
        workflow: 'visual-analysis',
        autonomy: 'high',
        multimodalInputs: [
          {
            type: 'image',
            mediaType: 'image/png',
            data: 'base64-screenshot-data',
            encoding: 'base64',
            name: 'ui-screenshot.png',
            description: 'Current UI state for analysis',
          },
        ],
      };

      expect(singleMultimodalRequest.multimodalInputs).toHaveLength(1);
      expect(singleMultimodalRequest.multimodalInputs![0].type).toBe('image');
    });

    it('should create task request with multiple multimodal inputs', () => {
      const multipleInputsRequest: CreateTaskRequest = {
        description: 'Redesign login flow based on mockups and current implementation',
        acceptanceCriteria: 'New login should match Figma design and improve UX',
        workflow: 'ui-redesign',
        autonomy: 'medium',
        priority: 'high',
        effort: 'large',
        multimodalInputs: [
          {
            type: 'design_mockup',
            designTool: 'figma',
            fileId: 'login-v2-design',
            name: 'New Login Design',
            description: 'Updated login screen with better UX',
          },
          {
            type: 'image',
            mediaType: 'image/png',
            url: 'https://assets.example.com/current-login.png',
            name: 'current-login.png',
            description: 'Screenshot of current login implementation',
          },
          {
            type: 'web_page',
            url: 'https://app.example.com/login',
            title: 'Current Login Page',
            capturedText: 'Username field, Password field, Login button',
            capturedAt: new Date(),
          },
        ],
      };

      expect(multipleInputsRequest.multimodalInputs).toHaveLength(3);
      expect(multipleInputsRequest.multimodalInputs!.map(i => i.type)).toEqual([
        'design_mockup',
        'image',
        'web_page',
      ]);
    });

    it('should handle complex workflow scenarios', () => {
      const complexWorkflowRequest: CreateTaskRequest = {
        description: 'Implement e-commerce product page with accessibility improvements',
        acceptanceCriteria: `
          1. Match the provided Figma design exactly
          2. Improve accessibility based on current page analysis
          3. Maintain responsive behavior shown in mockups
          4. Implement proper SEO structure
        `,
        workflow: 'feature-development',
        autonomy: 'low', // Requires human oversight for accessibility
        priority: 'medium',
        effort: 'large',
        projectPath: '/workspace/ecommerce-app',
        multimodalInputs: [
          {
            type: 'design_mockup',
            designTool: 'figma',
            fileId: 'ecommerce-product-page',
            nodeId: 'product-page-mobile',
            name: 'Product Page - Mobile',
            description: 'Mobile-first product page design with improved accessibility',
            metadata: {
              viewport: 'mobile',
              includesA11y: true,
              designSystem: 'ecommerce-v2',
            },
          },
          {
            type: 'design_mockup',
            designTool: 'figma',
            fileId: 'ecommerce-product-page',
            nodeId: 'product-page-desktop',
            name: 'Product Page - Desktop',
            description: 'Desktop variant of the product page',
            metadata: {
              viewport: 'desktop',
              includesA11y: true,
              designSystem: 'ecommerce-v2',
            },
          },
          {
            type: 'web_page',
            url: 'https://shop.example.com/products/widget-123',
            title: 'Current Product Page - Widget 123',
            capturedText: 'Product title, price $29.99, add to cart button, product images',
            metadata: {
              a11yIssues: [
                'Missing alt text on product images',
                'Low color contrast on price text',
                'Missing ARIA labels on interactive elements',
              ],
              currentFeatures: ['image zoom', 'reviews', 'related products'],
            },
          },
          {
            type: 'image',
            mediaType: 'image/png',
            url: 'https://assets.example.com/accessibility-report.png',
            name: 'accessibility-report.png',
            description: 'Lighthouse accessibility audit showing current issues',
            metadata: {
              auditTool: 'lighthouse',
              score: 67,
              issues: 12,
            },
          },
        ],
      };

      expect(complexWorkflowRequest.multimodalInputs).toHaveLength(4);
      expect(complexWorkflowRequest.autonomy).toBe('low');
      expect(complexWorkflowRequest.effort).toBe('large');
    });
  });

  describe('Task with Multimodal Context', () => {
    it('should create basic task without multimodal context', () => {
      const basicTask: Task = {
        id: 'task-basic-001',
        description: 'Simple refactoring task',
        workflow: 'refactoring',
        autonomy: 'high',
        status: 'pending',
        priority: 'low',
        effort: 'small',
        projectPath: '/workspace/project',
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
          totalCostCents: 0,
          executionTimeMs: 0,
        },
        logs: [],
        artifacts: [],
        // No multimodalContext
      };

      expect(basicTask.multimodalContext).toBeUndefined();
      expect(basicTask.status).toBe('pending');
    });

    it('should create task with processed multimodal context', () => {
      const processedInputs: ProcessedMultimodalInput[] = [
        {
          input: {
            type: 'image',
            mediaType: 'image/png',
            data: 'base64-screenshot',
            name: 'login-form.png',
          },
          status: 'completed',
          processedAt: new Date('2024-01-15T10:05:00Z'),
          processingDurationMs: 2500,
          extractedContent: {
            text: 'Login form with username field, password field, and submit button',
            structuredData: {
              formType: 'login',
              fieldCount: 2,
              hasValidation: true,
            },
            entities: [
              {
                type: 'input',
                value: 'username',
                confidence: 0.98,
                bounds: { x: 50, y: 100, width: 200, height: 40 },
              },
              {
                type: 'input',
                value: 'password',
                confidence: 0.97,
                bounds: { x: 50, y: 150, width: 200, height: 40 },
              },
              {
                type: 'button',
                value: 'Login',
                confidence: 0.99,
                bounds: { x: 50, y: 200, width: 100, height: 40 },
              },
            ],
          },
        },
      ];

      const multimodalContext: MultimodalContext = {
        inputs: processedInputs,
        status: 'completed',
        contextSummary: 'Processed login form screenshot with 2 input fields and 1 submit button',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        completedAt: new Date('2024-01-15T10:05:05Z'),
        totalProcessingTimeMs: 2500,
        inputCounts: {
          images: 1,
          webPages: 0,
          designMockups: 0,
        },
      };

      const taskWithContext: Task = {
        id: 'task-multimodal-001',
        description: 'Update login form based on screenshot analysis',
        workflow: 'ui-improvement',
        autonomy: 'medium',
        status: 'in_progress',
        priority: 'medium',
        effort: 'medium',
        projectPath: '/workspace/webapp',
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T10:05:00Z'),
        usage: {
          inputTokens: 850,
          outputTokens: 1250,
          totalTokens: 2100,
          estimatedCost: 0.042,
          totalCostCents: 4,
          executionTimeMs: 15000,
        },
        logs: [],
        artifacts: [],
        multimodalContext,
      };

      expect(taskWithContext.multimodalContext).toBeDefined();
      expect(taskWithContext.multimodalContext!.status).toBe('completed');
      expect(taskWithContext.multimodalContext!.inputs).toHaveLength(1);
      expect(taskWithContext.multimodalContext!.inputCounts.images).toBe(1);
    });

    it('should handle task with failed multimodal processing', () => {
      const failedProcessing: ProcessedMultimodalInput[] = [
        {
          input: {
            type: 'web_page',
            url: 'https://inaccessible-site.example.com',
          },
          status: 'failed',
          processedAt: new Date(),
          processingDurationMs: 5000,
          error: 'Failed to access URL: connection timeout',
        },
        {
          input: {
            type: 'image',
            mediaType: 'image/png',
            data: 'corrupted-base64-data',
          },
          status: 'failed',
          processedAt: new Date(),
          processingDurationMs: 500,
          error: 'Invalid image data: corrupted base64 encoding',
        },
      ];

      const failedContext: MultimodalContext = {
        inputs: failedProcessing,
        status: 'failed',
        contextSummary: '0 of 2 multimodal inputs processed successfully due to technical issues',
        createdAt: new Date(),
        completedAt: new Date(),
        totalProcessingTimeMs: 5500,
        inputCounts: {
          images: 1,
          webPages: 1,
          designMockups: 0,
        },
        metadata: {
          failureReason: 'All inputs failed processing',
          retryable: true,
        },
      };

      const taskWithFailedContext: Task = {
        id: 'task-failed-multimodal',
        description: 'Task with failed multimodal processing',
        workflow: 'analysis',
        autonomy: 'medium',
        status: 'failed',
        priority: 'medium',
        effort: 'small',
        projectPath: '/workspace/project',
        retryCount: 1,
        maxRetries: 3,
        resumeAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.003,
          totalCostCents: 0,
          executionTimeMs: 6000,
        },
        logs: [],
        artifacts: [],
        error: 'Multimodal processing failed for all inputs',
        multimodalContext: failedContext,
      };

      expect(taskWithFailedContext.multimodalContext!.status).toBe('failed');
      expect(taskWithFailedContext.status).toBe('failed');
      expect(taskWithFailedContext.retryCount).toBe(1);
    });

    it('should handle task with partial multimodal processing', () => {
      const partialProcessing: ProcessedMultimodalInput[] = [
        {
          input: {
            type: 'design_mockup',
            designTool: 'figma',
            fileId: 'success-design',
          },
          status: 'completed',
          processedAt: new Date(),
          processingDurationMs: 3000,
          extractedContent: {
            text: 'Figma design mockup processed successfully',
            structuredData: {
              artboards: 3,
              components: 15,
              designSystem: 'material-design',
            },
          },
        },
        {
          input: {
            type: 'web_page',
            url: 'https://partial-fail.example.com',
          },
          status: 'failed',
          processedAt: new Date(),
          error: 'Page requires authentication',
        },
        {
          input: {
            type: 'image',
            mediaType: 'image/png',
            data: 'valid-image-data',
          },
          status: 'completed',
          processedAt: new Date(),
          processingDurationMs: 1500,
          extractedContent: {
            text: 'UI screenshot analyzed',
            entities: [
              { type: 'button', value: 'Submit', confidence: 0.95 },
              { type: 'input', value: 'email', confidence: 0.92 },
            ],
          },
        },
      ];

      const partialContext: MultimodalContext = {
        inputs: partialProcessing,
        status: 'completed', // Can be completed even with some failures
        contextSummary: '2 of 3 multimodal inputs processed successfully (1 Figma design, 1 image). Web page access failed.',
        createdAt: new Date(),
        completedAt: new Date(),
        totalProcessingTimeMs: 4500,
        inputCounts: {
          images: 1,
          webPages: 1,
          designMockups: 1,
        },
        metadata: {
          successRate: 0.67,
          processedSuccessfully: 2,
          failed: 1,
        },
      };

      const taskWithPartialContext: Task = {
        id: 'task-partial-multimodal',
        description: 'Task with partial multimodal processing success',
        workflow: 'design-analysis',
        autonomy: 'medium',
        status: 'in_progress',
        priority: 'medium',
        effort: 'medium',
        projectPath: '/workspace/design-project',
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 600,
          outputTokens: 800,
          totalTokens: 1400,
          estimatedCost: 0.028,
          totalCostCents: 3,
          executionTimeMs: 12000,
        },
        logs: [],
        artifacts: [],
        multimodalContext: partialContext,
      };

      expect(taskWithPartialContext.multimodalContext!.status).toBe('completed');
      expect(taskWithPartialContext.status).toBe('in_progress');

      // Verify partial success metrics
      const completedInputs = taskWithPartialContext.multimodalContext!.inputs.filter(
        i => i.status === 'completed'
      );
      const failedInputs = taskWithPartialContext.multimodalContext!.inputs.filter(
        i => i.status === 'failed'
      );

      expect(completedInputs).toHaveLength(2);
      expect(failedInputs).toHaveLength(1);
    });
  });

  describe('Workflow Integration Scenarios', () => {
    it('should handle UI redesign workflow', () => {
      const uiRedesignTask: Task = {
        id: 'task-ui-redesign-homepage',
        description: 'Redesign homepage based on new brand guidelines and user feedback',
        acceptanceCriteria: `
          1. Implement new brand colors and typography from design system
          2. Improve mobile responsiveness based on current issues
          3. Enhance accessibility score to 95+
          4. Maintain existing functionality
        `,
        workflow: 'ui-redesign',
        autonomy: 'medium',
        status: 'in_progress',
        priority: 'high',
        effort: 'large',
        projectPath: '/workspace/company-website',
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 1500,
          outputTokens: 2200,
          totalTokens: 3700,
          estimatedCost: 0.074,
          totalCostCents: 7,
          executionTimeMs: 25000,
        },
        logs: [],
        artifacts: [],
        multimodalContext: {
          inputs: [
            {
              input: {
                type: 'design_mockup',
                designTool: 'figma',
                fileId: 'homepage-redesign-v3',
                name: 'Homepage Redesign V3',
                description: 'New homepage design with updated branding',
              },
              status: 'completed',
              processedAt: new Date(),
              extractedContent: {
                text: 'Homepage design with hero section, feature grid, testimonials, and footer',
                structuredData: {
                  sections: ['hero', 'features', 'testimonials', 'cta', 'footer'],
                  colorPalette: ['#1a365d', '#2b77e5', '#38a169'],
                  typography: ['Inter', 'Roboto'],
                },
              },
            },
            {
              input: {
                type: 'web_page',
                url: 'https://company.example.com',
                title: 'Current Homepage',
                capturedText: 'Company homepage with outdated design and poor mobile experience',
              },
              status: 'completed',
              processedAt: new Date(),
              extractedContent: {
                text: 'Current homepage analysis',
                structuredData: {
                  issues: ['poor mobile layout', 'outdated colors', 'low accessibility score'],
                  currentSections: ['header', 'hero', 'services', 'about', 'contact'],
                  lighthouseScore: 72,
                },
              },
            },
            {
              input: {
                type: 'image',
                mediaType: 'image/png',
                url: 'https://assets.example.com/mobile-issues.png',
                name: 'mobile-issues.png',
                description: 'Screenshot showing mobile layout problems',
              },
              status: 'completed',
              processedAt: new Date(),
              extractedContent: {
                text: 'Mobile layout issues: overlapping text, unresponsive images, poor touch targets',
                entities: [
                  { type: 'issue', value: 'overlapping text', confidence: 0.95 },
                  { type: 'issue', value: 'small touch targets', confidence: 0.92 },
                ],
              },
            },
          ],
          status: 'completed',
          contextSummary: 'Processed design mockup, current homepage analysis, and mobile issues documentation. Ready for implementation.',
          createdAt: new Date(),
          completedAt: new Date(),
          totalProcessingTimeMs: 8000,
          inputCounts: { images: 1, webPages: 1, designMockups: 1 },
        },
      };

      expect(uiRedesignTask.multimodalContext!.inputs).toHaveLength(3);
      expect(uiRedesignTask.workflow).toBe('ui-redesign');
      expect(uiRedesignTask.priority).toBe('high');
      expect(uiRedesignTask.effort).toBe('large');
    });

    it('should handle bug investigation workflow', () => {
      const bugInvestigationTask: Task = {
        id: 'task-investigate-checkout-bug',
        description: 'Investigate and fix checkout cart total calculation error',
        acceptanceCriteria: 'Cart totals should calculate correctly with all discounts and taxes',
        workflow: 'bug-investigation',
        autonomy: 'high',
        status: 'pending',
        priority: 'critical',
        effort: 'medium',
        projectPath: '/workspace/ecommerce',
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
          totalCostCents: 0,
          executionTimeMs: 0,
        },
        logs: [],
        artifacts: [],
        multimodalContext: {
          inputs: [
            {
              input: {
                type: 'image',
                mediaType: 'image/png',
                data: 'error-screenshot-base64',
                name: 'checkout-error.png',
                description: 'Screenshot of incorrect cart total calculation',
              },
              status: 'completed',
              processedAt: new Date(),
              extractedContent: {
                text: 'Cart showing: Subtotal $100, Discount -$20, Tax $6.40, Total $87.40 (should be $86.40)',
                structuredData: {
                  subtotal: 100.00,
                  discount: -20.00,
                  tax: 6.40,
                  displayedTotal: 87.40,
                  expectedTotal: 86.40,
                  discrepancy: 1.00,
                },
                entities: [
                  { type: 'price', value: '$100.00', confidence: 0.99 },
                  { type: 'discount', value: '-$20.00', confidence: 0.98 },
                  { type: 'tax', value: '$6.40', confidence: 0.97 },
                  { type: 'total', value: '$87.40', confidence: 0.99 },
                ],
              },
            },
          ],
          status: 'completed',
          contextSummary: 'Cart calculation error identified: $1.00 discrepancy in total calculation',
          createdAt: new Date(),
          completedAt: new Date(),
          totalProcessingTimeMs: 1500,
          inputCounts: { images: 1, webPages: 0, designMockups: 0 },
          metadata: {
            bugType: 'calculation-error',
            severity: 'high',
            affectedArea: 'checkout',
          },
        },
      };

      expect(bugInvestigationTask.priority).toBe('critical');
      expect(bugInvestigationTask.multimodalContext!.metadata!.bugType).toBe('calculation-error');
    });
  });

  describe('Task State Management with Multimodal Context', () => {
    it('should handle task progression with multimodal processing', () => {
      // Initial task creation
      const initialTask: Partial<Task> = {
        id: 'task-progression-test',
        description: 'Task with multimodal processing lifecycle',
        status: 'pending',
        multimodalContext: undefined, // Not yet processed
      };

      expect(initialTask.multimodalContext).toBeUndefined();

      // Task with processing started
      const processingTask: Partial<Task> = {
        ...initialTask,
        status: 'in_progress',
        multimodalContext: {
          inputs: [
            {
              input: { type: 'image', mediaType: 'image/png', data: 'test-data' },
              status: 'processing',
            },
          ],
          status: 'processing',
          createdAt: new Date(),
          inputCounts: { images: 1, webPages: 0, designMockups: 0 },
        },
      };

      expect(processingTask.multimodalContext!.status).toBe('processing');

      // Task with completed processing
      const completedTask: Partial<Task> = {
        ...processingTask,
        multimodalContext: {
          ...processingTask.multimodalContext!,
          inputs: [
            {
              input: { type: 'image', mediaType: 'image/png', data: 'test-data' },
              status: 'completed',
              processedAt: new Date(),
              extractedContent: { text: 'Processing complete' },
            },
          ],
          status: 'completed',
          completedAt: new Date(),
        },
      };

      expect(completedTask.multimodalContext!.status).toBe('completed');
      expect(completedTask.multimodalContext!.inputs[0].status).toBe('completed');
    });
  });
});