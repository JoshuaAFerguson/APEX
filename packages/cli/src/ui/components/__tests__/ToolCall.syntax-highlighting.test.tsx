/**
 * Syntax highlighting tests for ToolCall component
 *
 * Tests cover syntax highlighting functionality for different content types:
 * - JSON output highlighting
 * - Code syntax highlighting (JavaScript, TypeScript, Python, etc.)
 * - Error and log output highlighting
 * - Shell command output highlighting
 * - Plain text handling
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import { ToolCall, type ToolCallProps } from '../ToolCall.js';

// Mock the ink-spinner component
vi.mock('ink-spinner', () => ({
  default: () => '⠋',
}));

describe('ToolCall Syntax Highlighting', () => {
  const defaultProps: ToolCallProps = {
    toolName: 'Read',
    status: 'success',
  };

  describe('JSON Content Highlighting', () => {
    it('should render JSON output without crashing', () => {
      const jsonOutput = JSON.stringify({
        success: true,
        data: { items: [1, 2, 3], message: "test" },
        timestamp: "2024-01-01T00:00:00Z"
      }, null, 2);

      const props = {
        ...defaultProps,
        output: jsonOutput
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('success');
      expect(lastFrame()).toContain('data');
      expect(lastFrame()).toContain('timestamp');
    });

    it('should handle malformed JSON gracefully', () => {
      const malformedJson = '{"key": value, "missing": quote}';

      const props = {
        ...defaultProps,
        output: malformedJson
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('key');
    });

    it('should handle nested JSON objects', () => {
      const nestedJson = JSON.stringify({
        level1: {
          level2: {
            level3: {
              value: "deep nesting",
              array: [1, 2, 3]
            }
          }
        }
      }, null, 2);

      const props = {
        ...defaultProps,
        output: nestedJson
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('level1');
      expect(lastFrame()).toContain('deep nesting');
    });
  });

  describe('Code Syntax Highlighting', () => {
    it('should render JavaScript code without crashing', () => {
      const jsCode = `
function calculateSum(a, b) {
  const result = a + b;
  console.log(\`Sum is: \${result}\`);
  return result;
}

const numbers = [1, 2, 3, 4, 5];
const sum = numbers.reduce((acc, num) => acc + num, 0);
      `;

      const props = {
        ...defaultProps,
        output: jsCode.trim()
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('function');
      expect(lastFrame()).toContain('calculateSum');
    });

    it('should render TypeScript code without crashing', () => {
      const tsCode = `
interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

function getUserById(id: number): User | null {
  const users: User[] = getUsers();
  return users.find(user => user.id === id) || null;
}

type UserStatus = 'active' | 'inactive' | 'pending';
      `;

      const props = {
        ...defaultProps,
        output: tsCode.trim()
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('interface');
      expect(lastFrame()).toContain('User');
    });

    it('should render Python code without crashing', () => {
      const pythonCode = `
def calculate_fibonacci(n):
    if n <= 1:
        return n
    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

class DataProcessor:
    def __init__(self, data):
        self.data = data

    def process(self):
        result = []
        for item in self.data:
            if isinstance(item, str):
                result.append(item.upper())
        return result
      `;

      const props = {
        ...defaultProps,
        output: pythonCode.trim()
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('def');
      expect(lastFrame()).toContain('calculate_fibonacci');
    });
  });

  describe('Shell Command Output Highlighting', () => {
    it('should render shell commands without crashing', () => {
      const shellOutput = `
$ ls -la
total 48
drwxr-xr-x  8 user staff  256 Jan  1 00:00 .
drwxr-xr-x  3 user staff   96 Jan  1 00:00 ..
-rw-r--r--  1 user staff 1234 Jan  1 00:00 package.json
-rw-r--r--  1 user staff  567 Jan  1 00:00 README.md

$ npm install
npm WARN deprecated package@1.0.0: This package is deprecated
added 234 packages from 123 contributors
      `;

      const props = {
        ...defaultProps,
        output: shellOutput.trim()
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('ls -la');
      expect(lastFrame()).toContain('npm install');
    });

    it('should handle git command output', () => {
      const gitOutput = `
$ git status
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   src/components/ToolCall.tsx
        modified:   tests/ToolCall.test.tsx

Untracked files:
  (use "git add <file>..." to include in what will be committed)
        new-feature.md

no changes added to commit (use "git add" and/or "git commit")
      `;

      const props = {
        ...defaultProps,
        output: gitOutput.trim()
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('git status');
      expect(lastFrame()).toContain('modified');
    });
  });

  describe('Error and Log Output Highlighting', () => {
    it('should render error messages without crashing', () => {
      const errorOutput = `
Error: ENOENT: no such file or directory, open 'missing-file.txt'
    at Object.openSync (fs.js:476:3)
    at Object.readFileSync (fs.js:377:35)
    at readConfig (/app/src/config.js:15:23)
    at main (/app/src/index.js:8:18)
    at Object.<anonymous> (/app/src/index.js:25:1)
    at Module._compile (internal/modules/cjs/loader.js:1063:30)
      `;

      const props = {
        ...defaultProps,
        status: 'error' as const,
        output: errorOutput.trim()
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Error');
      expect(lastFrame()).toContain('ENOENT');
    });

    it('should handle log levels and timestamps', () => {
      const logOutput = `
[2024-01-01 10:30:00] INFO: Application starting up
[2024-01-01 10:30:01] DEBUG: Loading configuration from config.yaml
[2024-01-01 10:30:02] WARN: Using default timeout value (5000ms)
[2024-01-01 10:30:03] ERROR: Failed to connect to database
[2024-01-01 10:30:04] FATAL: Application shutting down due to critical error
      `;

      const props = {
        ...defaultProps,
        output: logOutput.trim()
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('INFO');
      expect(lastFrame()).toContain('ERROR');
      expect(lastFrame()).toContain('WARN');
    });
  });

  describe('Diff Output Highlighting', () => {
    it('should render git diff output without crashing', () => {
      const diffOutput = `
--- a/src/components/ToolCall.tsx
+++ b/src/components/ToolCall.tsx
@@ -25,7 +25,7 @@ export function ToolCall({
   const getStatusIcon = () => {
     switch (status) {
       case 'pending':
-        return <Text color="gray">○</Text>;
+        return <Text color="yellow">○</Text>;
       case 'running':
         return (
           <Text color="yellow">
@@ -45,6 +45,7 @@ export function ToolCall({
       Write: 'green',
       Edit: 'yellow',
       Bash: 'magenta',
+      Read: 'cyan',
       Glob: 'blue',
       Grep: 'blue',
       WebFetch: 'cyan',
      `;

      const props = {
        ...defaultProps,
        output: diffOutput.trim()
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('---');
      expect(lastFrame()).toContain('+++');
      expect(lastFrame()).toContain('@@');
    });
  });

  describe('YAML Content Highlighting', () => {
    it('should render YAML configuration without crashing', () => {
      const yamlOutput = `
name: apex-project
version: 1.0.0
description: AI-powered development automation

dependencies:
  - name: typescript
    version: "^5.0.0"
  - name: react
    version: "^18.0.0"

scripts:
  build: "tsc"
  test: "vitest run"
  dev: "tsc --watch"

config:
  database:
    host: localhost
    port: 5432
    name: apex_db
  logging:
    level: info
    format: json
      `;

      const props = {
        ...defaultProps,
        output: yamlOutput.trim()
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('name');
      expect(lastFrame()).toContain('dependencies');
      expect(lastFrame()).toContain('config');
    });
  });

  describe('Plain Text and Mixed Content', () => {
    it('should handle plain text without highlighting', () => {
      const plainText = `
This is just plain text output from a tool.
It contains no special syntax or formatting.
Just regular sentences and paragraphs.

Sometimes tools output simple status messages
or human-readable descriptions.
      `;

      const props = {
        ...defaultProps,
        output: plainText.trim()
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('plain text output');
      expect(lastFrame()).toContain('regular sentences');
    });

    it('should handle mixed content types', () => {
      const mixedOutput = `
Tool execution completed successfully.

Configuration loaded:
{
  "environment": "development",
  "debug": true,
  "features": ["auth", "logging", "monitoring"]
}

Shell commands executed:
$ npm install
$ npm run build

Results: All operations completed without errors.
      `;

      const props = {
        ...defaultProps,
        output: mixedOutput.trim()
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Tool execution');
      expect(lastFrame()).toContain('Configuration');
      expect(lastFrame()).toContain('npm install');
    });
  });

  describe('Special Characters and Unicode', () => {
    it('should handle Unicode characters and emojis', () => {
      const unicodeOutput = `
🚀 Deployment started
✅ Build successful
📦 Package created: my-app-v1.0.0.tar.gz
🔧 Running post-deployment scripts...
💾 Database migration completed
🌐 Service available at: https://api.example.com
⚡ Performance: 95% improvement
🎉 Deployment completed successfully!

Multi-language support:
- English: Hello World
- Spanish: Hola Mundo
- Chinese: 你好世界
- Japanese: こんにちは世界
- Arabic: مرحبا بالعالم
- Russian: Привет мир
      `;

      const props = {
        ...defaultProps,
        output: unicodeOutput.trim()
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('🚀');
      expect(lastFrame()).toContain('你好世界');
      expect(lastFrame()).toContain('Привет мир');
    });

    it('should handle special control characters', () => {
      const specialCharsOutput = `
File processing results:
- Files with tabs:\t\tconfig.ts
- Files with newlines:\n\treadme.md
- Files with quotes: "test.js" and 'style.css'
- Files with backslashes: C:\\Windows\\System32\\file.exe
- Files with forward slashes: /usr/local/bin/node
      `;

      const props = {
        ...defaultProps,
        output: specialCharsOutput.trim()
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('File processing');
      expect(lastFrame()).toContain('config.ts');
    });
  });

  describe('Large Content and Performance', () => {
    it('should handle large JSON output efficiently', () => {
      const largeData = {
        users: Array(100).fill(null).map((_, i) => ({
          id: i + 1,
          name: `User ${i + 1}`,
          email: `user${i + 1}@example.com`,
          metadata: {
            createdAt: `2024-01-${String(i % 30 + 1).padStart(2, '0')}T00:00:00Z`,
            tags: [`tag${i}`, `category${i % 10}`],
            preferences: {
              notifications: i % 2 === 0,
              theme: i % 3 === 0 ? 'dark' : 'light',
              language: ['en', 'es', 'fr'][i % 3]
            }
          }
        }))
      };

      const props = {
        ...defaultProps,
        output: JSON.stringify(largeData, null, 2)
      };

      const startTime = Date.now();
      const { lastFrame } = render(<ToolCall {...props} />);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(500); // Should render in < 500ms
      expect(lastFrame()).toContain('users');
    });

    it('should handle very long single lines', () => {
      const longLine = 'A'.repeat(5000);

      const props = {
        ...defaultProps,
        output: `Short line\n${longLine}\nAnother short line`
      };

      const { lastFrame } = render(<ToolCall {...props} />);
      expect(lastFrame()).toContain('Short line');
      expect(lastFrame()).toContain('Another short line');
    });
  });
});