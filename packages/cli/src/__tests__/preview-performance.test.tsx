import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PreviewPanel, type PreviewPanelProps } from '../ui/components/PreviewPanel';

describe('Preview Feature Performance Tests', () => {
  let mockOnConfirm: ReturnType<typeof vi.fn>;
  let mockOnCancel: ReturnType<typeof vi.fn>;
  let mockOnEdit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnConfirm = vi.fn();
    mockOnCancel = vi.fn();
    mockOnEdit = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  const createProps = (overrides: Partial<PreviewPanelProps> = {}): PreviewPanelProps => ({
    input: 'test input',
    intent: { type: 'task', confidence: 0.8 },
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
    onEdit: mockOnEdit,
    ...overrides,
  });

  describe('Rendering Performance', () => {
    it('should render quickly with normal input sizes', () => {
      const normalInput = 'Create a user authentication system with JWT tokens';
      const props = createProps({ input: normalInput });

      const startTime = performance.now();
      render(<PreviewPanel {...props} />);
      const endTime = performance.now();

      // Should render in under 10ms
      expect(endTime - startTime).toBeLessThan(10);
    });

    it('should handle large input text efficiently', () => {
      const largeInput = 'Create a comprehensive user management system '.repeat(100);
      const props = createProps({ input: largeInput });

      const startTime = performance.now();
      render(<PreviewPanel {...props} />);
      const endTime = performance.now();

      // Should still render efficiently even with large input
      expect(endTime - startTime).toBeLessThan(50);
    });

    it('should handle extremely large input without performance degradation', () => {
      const extremeInput = 'x'.repeat(50000); // 50KB of text
      const props = createProps({ input: extremeInput });

      const startTime = performance.now();
      render(<PreviewPanel {...props} />);
      const endTime = performance.now();

      // Should handle extreme input sizes gracefully
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle rapid re-renders efficiently', () => {
      const { rerender } = render(<PreviewPanel {...createProps()} />);

      const startTime = performance.now();

      // Simulate 100 rapid re-renders with different props
      for (let i = 0; i < 100; i++) {
        const props = createProps({
          input: `Dynamic input ${i}`,
          intent: { type: 'task', confidence: Math.random() },
        });
        rerender(<PreviewPanel {...props} />);
      }

      const endTime = performance.now();

      // Should handle rapid re-renders efficiently
      expect(endTime - startTime).toBeLessThan(200);
    });
  });

  describe('Memory Management', () => {
    it('should not create memory leaks during rapid mount/unmount cycles', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create and destroy components rapidly
      for (let i = 0; i < 50; i++) {
        const { unmount } = render(<PreviewPanel {...createProps()} />);
        unmount();

        // Force garbage collection if available (Node.js)
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDiff = finalMemory - initialMemory;

      // Memory usage should not increase significantly
      expect(memoryDiff).toBeLessThan(1024 * 1024); // Less than 1MB increase
    });

    it('should clean up resources on unmount', () => {
      const { unmount } = render(<PreviewPanel {...createProps()} />);

      // Mock some resource tracking
      const resourceCleanupSpy = vi.fn();

      // Simulate component cleanup
      unmount();

      // Should not cause any errors during cleanup
      expect(() => {
        vi.advanceTimersByTime(1000);
      }).not.toThrow();
    });

    it('should handle component updates without memory accumulation', () => {
      const { rerender } = render(<PreviewPanel {...createProps()} />);

      const initialMemory = process.memoryUsage().heapUsed;

      // Update component many times
      for (let i = 0; i < 200; i++) {
        rerender(<PreviewPanel {...createProps({
          input: `Input ${i}`,
          intent: {
            type: i % 2 === 0 ? 'task' : 'question',
            confidence: Math.random(),
          },
        })} />);

        // Periodically check memory
        if (i % 50 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // Less than 5MB
    });
  });

  describe('Stress Testing', () => {
    it('should handle maximum terminal width input', () => {
      // Simulate very wide terminal with maximum width text
      const maxWidthInput = 'x'.repeat(1000);
      const props = createProps({ input: maxWidthInput });

      expect(() => {
        render(<PreviewPanel {...props} />);
      }).not.toThrow();
    });

    it('should handle unicode stress test', () => {
      // Complex unicode input with various character sets
      const unicodeInput = '🚀🌟💻🔥⭐️🎯🌈🔮🎨🎭🎪🎬🎵🎸🎹🎺🎻🥁🎷🎤🎧🎮🎲🎰🃏🎴🎳🎯🎱⚽️🏀🏈⚾️🎾🏐🏉🥎🏓🏸🥅🏒🏑🥍🏏🏏' +
                            '文字化け테스트Тест日本語العربية한글中文Português' +
                            'ñáéíóúüÑÁÉÍÓÚÜçÇôâêî';

      const props = createProps({ input: unicodeInput });

      expect(() => {
        render(<PreviewPanel {...props} />);
      }).not.toThrow();
    });

    it('should handle malformed data gracefully', () => {
      const malformedProps = {
        input: null as any,
        intent: { type: undefined as any, confidence: NaN },
        onConfirm: null as any,
        onCancel: undefined as any,
        onEdit: (() => { throw new Error('Callback error'); }) as any,
      };

      // Should not crash even with malformed data
      expect(() => {
        render(<PreviewPanel {...malformedProps} />);
      }).not.toThrow();
    });

    it('should handle concurrent rendering stress', async () => {
      // Simulate multiple concurrent renders
      const renderPromises = Array.from({ length: 20 }, (_, i) =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            const props = createProps({
              input: `Concurrent input ${i}`,
              intent: { type: 'task', confidence: Math.random() },
            });
            render(<PreviewPanel {...props} />);
            resolve();
          }, Math.random() * 10);
        })
      );

      // All renders should complete successfully
      await Promise.all(renderPromises);
    });

    it('should handle rapid property changes', () => {
      const { rerender } = render(<PreviewPanel {...createProps()} />);

      const startTime = performance.now();

      // Rapidly change all possible properties
      for (let i = 0; i < 500; i++) {
        const intentTypes: Array<'task' | 'command' | 'question' | 'clarification'> =
          ['task', 'command', 'question', 'clarification'];

        const props = createProps({
          input: `Rapid change ${i}`,
          intent: {
            type: intentTypes[i % intentTypes.length],
            confidence: Math.random(),
            command: i % 2 === 0 ? `cmd${i}` : undefined,
            args: i % 3 === 0 ? [`arg1`, `arg2`] : undefined,
            metadata: { test: `value${i}` },
          },
          workflow: i % 4 === 0 ? `workflow${i}` : undefined,
        });

        rerender(<PreviewPanel {...props} />);

        // Advance timers occasionally to simulate time passing
        if (i % 50 === 0) {
          vi.advanceTimersByTime(1);
        }
      }

      const endTime = performance.now();

      // Should handle rapid changes efficiently
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Resource Usage Optimization', () => {
    it('should optimize rendering for repeated identical props', () => {
      const staticProps = createProps({
        input: 'Static input',
        intent: { type: 'task', confidence: 0.8 },
      });

      const { rerender } = render(<PreviewPanel {...staticProps} />);

      const startTime = performance.now();

      // Re-render with identical props many times
      for (let i = 0; i < 100; i++) {
        rerender(<PreviewPanel {...staticProps} />);
      }

      const endTime = performance.now();

      // Identical prop renders should be very fast
      expect(endTime - startTime).toBeLessThan(20);
    });

    it('should handle large command argument arrays efficiently', () => {
      const largeArgs = Array.from({ length: 1000 }, (_, i) => `arg${i}`);
      const props = createProps({
        intent: {
          type: 'command',
          confidence: 1.0,
          command: 'test',
          args: largeArgs,
        },
      });

      const startTime = performance.now();
      render(<PreviewPanel {...props} />);
      const endTime = performance.now();

      // Should handle large argument arrays efficiently
      expect(endTime - startTime).toBeLessThan(50);
    });

    it('should optimize confidence calculation and color mapping', () => {
      const { rerender } = render(<PreviewPanel {...createProps()} />);

      const startTime = performance.now();

      // Test many different confidence values
      for (let i = 0; i <= 100; i++) {
        const confidence = i / 100;
        const props = createProps({
          intent: { type: 'task', confidence },
        });
        rerender(<PreviewPanel {...props} />);
      }

      const endTime = performance.now();

      // Confidence calculations should be fast
      expect(endTime - startTime).toBeLessThan(30);
    });

    it('should handle deeply nested metadata efficiently', () => {
      const deepMetadata = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  data: 'deep value',
                  array: Array.from({ length: 100 }, (_, i) => `item${i}`),
                },
              },
            },
          },
        },
      };

      const props = createProps({
        intent: {
          type: 'task',
          confidence: 0.8,
          metadata: deepMetadata,
        },
      });

      const startTime = performance.now();
      render(<PreviewPanel {...props} />);
      const endTime = performance.now();

      // Should handle deep metadata without performance issues
      expect(endTime - startTime).toBeLessThan(30);
    });
  });

  describe('Edge Case Performance', () => {
    it('should handle zero-length strings efficiently', () => {
      const props = createProps({
        input: '',
        intent: { type: 'task', confidence: 0 },
      });

      const startTime = performance.now();
      render(<PreviewPanel {...props} />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10);
    });

    it('should handle boundary confidence values efficiently', () => {
      const boundaryValues = [0, 0.00001, 0.5, 0.99999, 1, 1.00001, 100, -1, Infinity, -Infinity, NaN];

      boundaryValues.forEach((confidence) => {
        const props = createProps({
          intent: { type: 'task', confidence },
        });

        const startTime = performance.now();
        render(<PreviewPanel {...props} />);
        const endTime = performance.now();

        expect(endTime - startTime).toBeLessThan(10);
      });
    });

    it('should handle special character heavy input efficiently', () => {
      const specialChars = '!@#$%^&*(){}[]|\\:";\'<>?,./-+=' +
                          '¡™£¢∞§¶•ªº–≠"'åß∂ƒ©˙∆˚¬…æ«Ω≈ç√∫˜µ≤≥÷' +
                          '‽⸘¿°•‡‰‱‴‵‶‷″‹›「」『』【】〖〗《》〈〉';

      const props = createProps({
        input: specialChars.repeat(10),
      });

      const startTime = performance.now();
      render(<PreviewPanel {...props} />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(20);
    });

    it('should handle rapid workflow changes efficiently', () => {
      const { rerender } = render(<PreviewPanel {...createProps()} />);
      const workflowNames = ['feature', 'bugfix', 'hotfix', 'documentation', 'testing', 'refactor'];

      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        const props = createProps({
          workflow: workflowNames[i % workflowNames.length],
        });
        rerender(<PreviewPanel {...props} />);
      }

      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50);
    });

    it('should maintain performance with complex intent metadata', () => {
      const complexMetadata = {
        suggestedWorkflow: 'feature',
        complexity: 'high',
        estimatedTime: '2-4 hours',
        requiredSkills: ['react', 'typescript', 'css', 'jest'],
        dependencies: [
          { name: 'react', version: '^18.0.0' },
          { name: 'typescript', version: '^4.8.0' },
        ],
        relatedFiles: Array.from({ length: 50 }, (_, i) => `/src/components/Component${i}.tsx`),
        tags: ['frontend', 'ui', 'component', 'feature'],
        aiInsights: {
          confidenceFactors: [
            'clear task description',
            'specific technology mentioned',
            'actionable language',
          ],
          potentialIssues: [
            'may require additional clarification on styling',
            'consider accessibility requirements',
          ],
          suggestedApproach: 'start with basic component structure, then add functionality',
        },
      };

      const props = createProps({
        intent: {
          type: 'task',
          confidence: 0.85,
          metadata: complexMetadata,
        },
      });

      const startTime = performance.now();
      render(<PreviewPanel {...props} />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(25);
    });
  });

  describe('Browser Performance Simulation', () => {
    it('should handle simulated slow rendering environment', () => {
      // Simulate slow environment by adding artificial delays
      const originalPerformanceNow = performance.now;
      let callCount = 0;

      performance.now = () => {
        callCount++;
        // Add small delay every few calls to simulate slow environment
        if (callCount % 10 === 0) {
          const start = Date.now();
          while (Date.now() - start < 1) {
            // Busy wait for 1ms
          }
        }
        return originalPerformanceNow.call(performance);
      };

      try {
        const props = createProps({
          input: 'Test input in slow environment',
        });

        expect(() => {
          render(<PreviewPanel {...props} />);
        }).not.toThrow();
      } finally {
        performance.now = originalPerformanceNow;
      }
    });

    it('should handle simulated high memory pressure', () => {
      // Create memory pressure by allocating large arrays
      const memoryPressure: string[][] = [];

      try {
        // Create some memory pressure (but not so much that we crash)
        for (let i = 0; i < 10; i++) {
          memoryPressure.push(new Array(10000).fill(`memory-pressure-${i}`));
        }

        const props = createProps({
          input: 'Test under memory pressure',
        });

        const startTime = performance.now();
        render(<PreviewPanel {...props} />);
        const endTime = performance.now();

        // Should still perform reasonably well under memory pressure
        expect(endTime - startTime).toBeLessThan(100);

      } finally {
        // Clean up memory pressure
        memoryPressure.length = 0;
      }
    });

    it('should handle multiple concurrent component instances', () => {
      const components: Array<ReturnType<typeof render>> = [];

      try {
        const startTime = performance.now();

        // Render multiple instances simultaneously
        for (let i = 0; i < 25; i++) {
          const props = createProps({
            input: `Concurrent instance ${i}`,
            intent: {
              type: i % 2 === 0 ? 'task' : 'question',
              confidence: Math.random(),
            },
          });
          components.push(render(<PreviewPanel {...props} />));
        }

        const endTime = performance.now();

        // Should handle multiple instances efficiently
        expect(endTime - startTime).toBeLessThan(500);

      } finally {
        // Clean up all components
        components.forEach(component => component.unmount());
      }
    });
  });
});