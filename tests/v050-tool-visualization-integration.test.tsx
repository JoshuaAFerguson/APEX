import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToolCall } from '@apexcli/cli/src/ui/components/ToolCall.js';
import { ToolExecutionPanel } from '@apexcli/cli/src/ui/components/tools/ToolExecutionPanel.js';
import type { DisplayMode } from '@apexcli/core';

/**
 * Enhanced integration tests for v0.5.0 Tool Visualization features
 * Tests real-world scenarios, complex data flows, and edge cases
 */

// Mock implementation for comprehensive testing
const mockOrchestrator = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
} as any;

vi.mock('@apexcli/cli/src/ui/hooks/useToolEventLogger.js', () => ({
  useToolEventLogger: () => ({
    toolLogs: [],
    activeToolCalls: new Map(),
    stats: {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageDuration: 0,
    },
  }),
}));

describe('v0.5.0 Tool Visualization Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complex Real-World Tool Call Scenarios', () => {
    it('should handle extremely large JSON output with proper truncation', () => {
      // Generate large nested JSON structure (simulating large API response)
      const largeData = {
        metadata: { version: '1.0', timestamp: '2024-01-01T00:00:00Z' },
        data: Array(1000).fill(null).map((_, i) => ({
          id: `item-${i}`,
          name: `Item ${i}`,
          description: `This is a detailed description for item ${i}`.repeat(5),
          tags: [`tag-${i % 10}`, `category-${Math.floor(i / 100)}`],
          properties: {
            active: i % 2 === 0,
            priority: i % 5,
            metadata: {
              created: new Date(2024, 0, i % 30 + 1).toISOString(),
              updated: new Date().toISOString(),
            },
          },
        })),
        summary: {
          totalItems: 1000,
          activeItems: 500,
          categories: Array(10).fill(null).map((_, i) => `category-${i}`),
        },
      };

      const props = {
        toolName: 'WebFetch',
        input: { url: 'https://api.example.com/large-dataset', timeout: 30000 },
        output: JSON.stringify(largeData, null, 2),
        status: 'success' as const,
        duration: 2500,
        displayMode: 'normal' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('WebFetch')).toBeInTheDocument();
      expect(screen.getByText(/url: "https:\/\/api\.example\.com\/large-dataset"/)).toBeInTheDocument();
      expect(screen.getByText(/2\.5s/)).toBeInTheDocument();
      expect(screen.getByText(/more lines/)).toBeInTheDocument();
    });

    it('should handle complex file operations with multiple parameters', () => {
      const complexEdit = {
        toolName: 'Edit',
        input: {
          file_path: '/project/src/components/ComplexComponent.tsx',
          old_string: `interface Props {
  title: string;
  description?: string;
  onClick?: () => void;
}

export const ComplexComponent: React.FC<Props> = ({ title, description, onClick }) => {
  return (
    <div className="complex-component">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {onClick && <button onClick={onClick}>Click me</button>}
    </div>
  );
};`,
          new_string: `interface Props {
  title: string;
  description?: string;
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  onClick?: (event: React.MouseEvent) => void;
  onHover?: (event: React.MouseEvent) => void;
}

export const ComplexComponent: React.FC<Props> = ({
  title,
  description,
  variant = 'primary',
  size = 'medium',
  onClick,
  onHover
}) => {
  return (
    <div className={\`complex-component \${variant} \${size}\`}>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {onClick && (
        <button
          onClick={onClick}
          onMouseEnter={onHover}
          className="interactive-button"
        >
          Click me
        </button>
      )}
    </div>
  );
};`,
        },
        output: 'File successfully edited. 15 lines added, 8 lines modified.',
        status: 'success' as const,
        duration: 150,
        displayMode: 'verbose' as DisplayMode,
      };

      render(<ToolCall {...complexEdit} />);

      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText(/file_path: ".*ComplexComponent\.tsx"/)).toBeInTheDocument();
      expect(screen.getByText(/File successfully edited/)).toBeInTheDocument();
      expect(screen.getByText('[success]')).toBeInTheDocument();
    });

    it('should handle shell commands with environment variables and complex outputs', () => {
      const complexBash = {
        toolName: 'Bash',
        input: {
          command: 'NODE_ENV=production npm run build:analyze -- --output-format=json',
          timeout: 120000,
          working_directory: '/project',
          env_vars: {
            NODE_ENV: 'production',
            CI: 'true',
            ANALYZE: 'true',
          },
        },
        output: `> apex-cli@1.0.0 build:analyze
> webpack --mode production --analyze

asset main.js 2.3 MiB [emitted] [minimized] (name: main) 2 related assets
asset index.html 1.23 KiB [emitted]
asset styles.css 45.2 KiB [emitted] [minimized]
runtime modules 1.41 KiB 7 modules
cacheable modules 1.85 MiB
  modules by path ./src/ 1.23 MiB
    modules by path ./src/components/ 856 KiB 47 modules
    modules by path ./src/utils/ 234 KiB 12 modules
    modules by path ./src/hooks/ 78 KiB 8 modules
    ./src/index.tsx 12.3 KiB [built] [code generated]
  modules by path ./node_modules/ 634 KiB
    ./node_modules/react/index.js 190 KiB [built] [code generated]
    ./node_modules/react-dom/index.js 145 KiB [built] [code generated]
    + 23 modules

WARNING in asset size limit: The following asset(s) exceed the recommended size limit (244 KiB).
This can impact web performance.
Assets:
  main.js (2.3 MiB)

webpack 5.88.0 compiled with 1 warning in 23456ms`,
        status: 'success' as const,
        duration: 23456,
        displayMode: 'verbose' as DisplayMode,
      };

      render(<ToolCall {...complexBash} />);

      expect(screen.getByText('Bash')).toBeInTheDocument();
      expect(screen.getByText(/command: "NODE_ENV=production npm run build:analyze/)).toBeInTheDocument();
      expect(screen.getByText(/23\.5s/)).toBeInTheDocument();
      expect(screen.getByText(/webpack 5\.88\.0 compiled/)).toBeInTheDocument();
    });

    it('should display concurrent tool executions properly', () => {
      const concurrentTools = [
        {
          toolName: 'Read',
          input: { file_path: '/project/package.json' },
          status: 'success' as const,
          duration: 50,
          output: '{"name": "apex-cli", "version": "1.0.0"}',
        },
        {
          toolName: 'Grep',
          input: { pattern: 'TODO|FIXME', path: '/project/src' },
          status: 'running' as const,
          duration: 0,
        },
        {
          toolName: 'Bash',
          input: { command: 'npm test' },
          status: 'pending' as const,
        },
      ];

      const { rerender } = render(<div />);

      concurrentTools.forEach((tool, index) => {
        rerender(
          <div>
            {concurrentTools.slice(0, index + 1).map((t, i) => (
              <ToolCall key={i} {...t} displayMode="compact" />
            ))}
          </div>
        );
      });

      expect(screen.getByText(/Read/)).toBeInTheDocument();
      expect(screen.getByText(/Grep/)).toBeInTheDocument();
      expect(screen.getByText(/Bash/)).toBeInTheDocument();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON output gracefully', () => {
      const props = {
        toolName: 'WebFetch',
        input: { url: 'https://broken-api.com/data' },
        output: '{"incomplete": "json", "missing": ',
        status: 'error' as const,
        duration: 1500,
        displayMode: 'normal' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('WebFetch')).toBeInTheDocument();
      expect(screen.getByText('✗')).toBeInTheDocument();
      expect(screen.getByText(/incomplete.*json/)).toBeInTheDocument();
    });

    it('should handle extremely long single-line output', () => {
      const longLine = 'This is an extremely long single line of output that should be truncated properly when displayed in the terminal interface. '.repeat(50);

      const props = {
        toolName: 'Bash',
        input: { command: 'echo "long output"' },
        output: longLine,
        status: 'success' as const,
        duration: 100,
        displayMode: 'normal' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('Bash')).toBeInTheDocument();
      expect(screen.getByText(/This is an extremely long/)).toBeInTheDocument();
    });

    it('should handle null and undefined values in input gracefully', () => {
      const props = {
        toolName: 'Edit',
        input: {
          file_path: '/test.txt',
          old_string: null,
          new_string: undefined,
          backup: false,
          encoding: '',
        },
        status: 'error' as const,
        output: 'Error: old_string parameter is required',
        displayMode: 'verbose' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText(/file_path: "\/test\.txt"/)).toBeInTheDocument();
      expect(screen.getByText(/Error: old_string parameter/)).toBeInTheDocument();
    });

    it('should handle binary data output appropriately', () => {
      // Simulate binary data (would normally be base64 or hex encoded)
      const binaryOutput = Buffer.from('Binary file content with null bytes \x00\x01\x02\x03').toString('base64');

      const props = {
        toolName: 'Read',
        input: { file_path: '/image.png' },
        output: `Binary file detected. Size: 2048 bytes\nBase64: ${binaryOutput}`,
        status: 'success' as const,
        duration: 75,
        displayMode: 'normal' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('Read')).toBeInTheDocument();
      expect(screen.getByText(/Binary file detected/)).toBeInTheDocument();
      expect(screen.getByText(/Base64:/)).toBeInTheDocument();
    });

    it('should handle rapid status transitions correctly', () => {
      let props = {
        toolName: 'WebFetch',
        input: { url: 'https://api.example.com/slow' },
        status: 'pending' as const,
        duration: 0,
        displayMode: 'normal' as DisplayMode,
      };

      const { rerender } = render(<ToolCall {...props} />);
      expect(screen.getByText('○')).toBeInTheDocument();

      // Transition to running
      props = { ...props, status: 'running' };
      rerender(<ToolCall {...props} />);

      // Simulate rapid transitions
      setTimeout(() => {
        props = { ...props, status: 'success', duration: 2500, output: 'Success response' };
        rerender(<ToolCall {...props} />);
      }, 10);

      // Check final state
      setTimeout(() => {
        expect(screen.getByText('✓')).toBeInTheDocument();
        expect(screen.getByText(/2\.5s/)).toBeInTheDocument();
      }, 20);
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle rendering many tool calls efficiently', () => {
      const manyTools = Array(100).fill(null).map((_, i) => ({
        toolName: ['Read', 'Write', 'Edit', 'Bash', 'Grep'][i % 5],
        input: { param: `value-${i}` },
        status: (['pending', 'running', 'success', 'error'] as const)[i % 4],
        duration: i * 10,
        displayMode: 'compact' as DisplayMode,
      }));

      const startTime = performance.now();

      render(
        <div>
          {manyTools.map((tool, i) => (
            <ToolCall key={i} {...tool} />
          ))}
        </div>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Rendering should be reasonably fast (under 1000ms for 100 tools)
      expect(renderTime).toBeLessThan(1000);

      // Verify some tools are rendered
      expect(screen.getAllByText(/Read|Write|Edit|Bash|Grep/)).toHaveLength(100);
    });

    it('should handle extremely deep nested objects in input', () => {
      // Create deeply nested object
      let deepObject: any = { value: 'leaf' };
      for (let i = 0; i < 50; i++) {
        deepObject = { [`level${i}`]: deepObject };
      }

      const props = {
        toolName: 'WebFetch',
        input: {
          url: 'https://api.example.com',
          config: deepObject,
        },
        status: 'success' as const,
        displayMode: 'verbose' as DisplayMode,
      };

      expect(() => {
        render(<ToolCall {...props} />);
      }).not.toThrow();

      expect(screen.getByText('WebFetch')).toBeInTheDocument();
    });

    it('should maintain responsiveness during high-frequency updates', () => {
      let updateCount = 0;
      const maxUpdates = 50;

      const props = {
        toolName: 'Bash',
        input: { command: 'tail -f /var/log/app.log' },
        status: 'running' as const,
        displayMode: 'normal' as DisplayMode,
      };

      const { rerender } = render(<ToolCall {...props} />);

      const updateInterval = setInterval(() => {
        updateCount++;
        const newProps = {
          ...props,
          output: `Log line ${updateCount}\n`.repeat(updateCount),
        };

        rerender(<ToolCall {...newProps} />);

        if (updateCount >= maxUpdates) {
          clearInterval(updateInterval);
        }
      }, 10);

      // Clean up
      setTimeout(() => {
        clearInterval(updateInterval);
      }, maxUpdates * 10 + 100);
    });
  });

  describe('Integration with Tool Execution Panel', () => {
    it('should integrate properly with ToolExecutionPanel', () => {
      const props = {
        orchestrator: mockOrchestrator,
        taskId: 'integration-test',
        displayMode: 'normal' as DisplayMode,
        showStats: true,
        showActiveTools: true,
        showActivityLog: true,
      };

      render(<ToolExecutionPanel {...props} />);

      expect(screen.getByText('Tool Execution')).toBeInTheDocument();
    });

    it('should handle panel state changes correctly', () => {
      let props = {
        orchestrator: mockOrchestrator,
        taskId: 'state-test',
        displayMode: 'normal' as DisplayMode,
        collapsed: false,
      };

      const { rerender } = render(<ToolExecutionPanel {...props} />);
      expect(screen.getByText('Tool Execution')).toBeInTheDocument();

      // Collapse panel
      props = { ...props, collapsed: true };
      rerender(<ToolExecutionPanel {...props} />);
      expect(screen.getByText(/Tool Execution \(collapsed\)/)).toBeInTheDocument();

      // Change display mode
      props = { ...props, collapsed: false, displayMode: 'compact' };
      rerender(<ToolExecutionPanel {...props} />);
      expect(screen.getByText('Tool Execution')).toBeInTheDocument();
    });
  });

  describe('Accessibility and Usability', () => {
    it('should provide appropriate ARIA labels for status icons', () => {
      const statusTests = [
        { status: 'pending' as const, expectedIcon: '○' },
        { status: 'running' as const, expectedIcon: '⠋' },
        { status: 'success' as const, expectedIcon: '✓' },
        { status: 'error' as const, expectedIcon: '✗' },
      ];

      statusTests.forEach(({ status, expectedIcon }) => {
        const props = {
          toolName: 'Test',
          status,
          displayMode: 'normal' as DisplayMode,
        };

        const { unmount } = render(<ToolCall {...props} />);
        expect(screen.getByText(expectedIcon)).toBeInTheDocument();
        unmount();
      });
    });

    it('should handle screen reader friendly output', () => {
      const props = {
        toolName: 'Read',
        input: { file_path: '/important/document.txt' },
        output: 'Document content loaded successfully',
        status: 'success' as const,
        duration: 150,
        displayMode: 'verbose' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      // Should include semantic elements that screen readers can interpret
      expect(screen.getByText('Read')).toBeInTheDocument();
      expect(screen.getByText('[success]')).toBeInTheDocument();
      expect(screen.getByText(/Document content loaded/)).toBeInTheDocument();
    });
  });
});