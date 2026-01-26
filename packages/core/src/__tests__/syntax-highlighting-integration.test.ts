/**
 * Integration tests for syntax highlighting utilities in real-world scenarios
 */
import { describe, it, expect } from 'vitest';
import {
  highlightSyntax,
  highlightToolOutput,
  detectContentType,
  stripColors,
  ANSI_COLORS,
  DARK_THEME,
  LIGHT_THEME,
} from '../syntax-highlighter.js';

describe('Syntax Highlighting Integration Tests', () => {
  describe('Real-world code examples', () => {
    it('should highlight complex TypeScript interface', () => {
      const tsCode = `interface DatabaseConfig {
  host: string;
  port: number;
  credentials: {
    username: string;
    password: string;
    ssl?: boolean;
  };
  retries?: number;
  timeout?: number;
}

export class DatabaseManager {
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async connect(): Promise<boolean> {
    try {
      // Implementation here
      return true;
    } catch (error) {
      console.error('Connection failed:', error);
      return false;
    }
  }
}`;

      const result = highlightSyntax(tsCode, {
        contentType: 'typescript',
        showLineNumbers: true,
        theme: DARK_THEME
      });

      expect(result.highlighted).toBe(true);
      expect(result.contentType).toBe('typescript');
      expect(result.lineCount).toBeGreaterThan(20);

      // Check TypeScript-specific highlighting
      expect(result.content).toContain(DARK_THEME.keyword); // interface, class, etc.
      expect(result.content).toContain(DARK_THEME.type); // string, number, boolean
      expect(result.content).toContain(DARK_THEME.comment); // // Implementation here
      expect(result.content).toContain('│'); // line numbers
    });

    it('should highlight Python class with decorators and type hints', () => {
      const pythonCode = `from typing import List, Optional, Dict
import asyncio
from dataclasses import dataclass

@dataclass
class User:
    id: int
    name: str
    email: Optional[str] = None
    roles: List[str] = None

    def __post_init__(self):
        if self.roles is None:
            self.roles = []

class UserManager:
    def __init__(self):
        self.users: Dict[int, User] = {}

    async def create_user(self, name: str, email: str = None) -> User:
        """Create a new user"""
        user_id = len(self.users) + 1
        user = User(id=user_id, name=name, email=email)
        self.users[user_id] = user
        return user

    def get_user(self, user_id: int) -> Optional[User]:
        return self.users.get(user_id)`;

      const result = highlightSyntax(pythonCode, {
        contentType: 'python',
        maxLines: 50
      });

      expect(result.highlighted).toBe(true);
      expect(result.contentType).toBe('python');
      expect(result.content).toContain(DARK_THEME.keyword); // from, import, class, def, async, etc.
      expect(result.content).toContain(DARK_THEME.string); // docstring
      expect(result.content).toContain(DARK_THEME.comment); // # comments if any
      expect(result.content).toContain(DARK_THEME.function); // function names
    });

    it('should highlight Go code with goroutines and channels', () => {
      const goCode = `package main

import (
    "context"
    "fmt"
    "sync"
    "time"
)

type WorkerPool struct {
    workers    int
    jobQueue   chan Job
    wg         sync.WaitGroup
    ctx        context.Context
    cancelFunc context.CancelFunc
}

type Job func() error

func NewWorkerPool(workers int) *WorkerPool {
    ctx, cancel := context.WithCancel(context.Background())

    return &WorkerPool{
        workers:    workers,
        jobQueue:   make(chan Job, workers*2),
        ctx:        ctx,
        cancelFunc: cancel,
    }
}

func (wp *WorkerPool) Start() {
    for i := 0; i < wp.workers; i++ {
        wp.wg.Add(1)
        go wp.worker(i)
    }
}

func (wp *WorkerPool) worker(id int) {
    defer wp.wg.Done()

    for {
        select {
        case job := <-wp.jobQueue:
            if err := job(); err != nil {
                fmt.Printf("Worker %d error: %v\n", id, err)
            }
        case <-wp.ctx.Done():
            fmt.Printf("Worker %d shutting down\n", id)
            return
        }
    }
}`;

      const result = highlightSyntax(goCode, {
        contentType: 'go',
        showLineNumbers: true
      });

      expect(result.highlighted).toBe(true);
      expect(result.contentType).toBe('go');
      expect(result.content).toContain(DARK_THEME.keyword); // package, import, type, func, go, select, etc.
      expect(result.content).toContain(DARK_THEME.type); // struct types
      expect(result.content).toContain(DARK_THEME.function); // function calls
    });

    it('should highlight JSON with various data types', () => {
      const jsonData = {
        "apiVersion": "v1",
        "kind": "ConfigMap",
        "metadata": {
          "name": "app-config",
          "namespace": "production",
          "labels": {
            "app": "my-app",
            "version": "1.2.3"
          },
          "annotations": {
            "deployed": "2024-01-15T10:30:00Z"
          }
        },
        "data": {
          "database.host": "localhost",
          "database.port": 5432,
          "cache.enabled": true,
          "cache.ttl": 3600,
          "features": ["auth", "logging", "metrics"],
          "limits": null,
          "debug": false
        }
      };

      const jsonString = JSON.stringify(jsonData, null, 2);
      const result = highlightSyntax(jsonString, { contentType: 'json' });

      expect(result.highlighted).toBe(true);
      expect(result.contentType).toBe('json');
      expect(result.content).toContain(DARK_THEME.property); // property names
      expect(result.content).toContain(DARK_THEME.string); // string values
      expect(result.content).toContain(DARK_THEME.number); // numeric values
      expect(result.content).toContain(DARK_THEME.boolean); // true/false
      expect(result.content).toContain(DARK_THEME.null); // null values
    });
  });

  describe('Tool output scenarios', () => {
    it('should handle git diff output', () => {
      const gitDiff = `diff --git a/src/utils.ts b/src/utils.ts
index 1234567..abcdefg 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -10,8 +10,9 @@ export function formatDate(date: Date): string {
   return date.toISOString().split('T')[0];
 }

-export function validateEmail(email: string): boolean {
-  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
+export function validateEmail(email: string): boolean {
+  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
+  return emailRegex.test(email);
 }

 export function slugify(text: string): string {`;

      const result = highlightSyntax(gitDiff, { contentType: 'diff' });

      expect(result.highlighted).toBe(true);
      expect(result.contentType).toBe('diff');
      expect(result.content).toContain(DARK_THEME.diff_header); // header lines
      expect(result.content).toContain(DARK_THEME.diff_added); // + lines
      expect(result.content).toContain(DARK_THEME.diff_removed); // - lines
    });

    it('should handle compiler error output', () => {
      const compilerErrors = `ERROR in src/components/UserForm.tsx:15:7
TS2339: Property 'username' does not exist on type '{ email: string; password: string; }'.

ERROR in src/utils/validation.ts:42:3
TS2304: Cannot find name 'isEmail'.

WARNING in src/hooks/useAuth.ts:8:21
TS2531: Object is possibly 'null'.

INFO: TypeScript compilation completed with 2 errors, 1 warning.`;

      const result = highlightSyntax(compilerErrors, { contentType: 'error' });

      expect(result.highlighted).toBe(true);
      expect(result.contentType).toBe('error');
      expect(result.content).toContain(DARK_THEME.error); // ERROR lines
      expect(result.content).toContain(DARK_THEME.warning); // WARNING lines
      expect(result.content).toContain(DARK_THEME.info); // INFO lines
    });

    it('should handle package.json with comments (JSON5-like)', () => {
      const packageJson = `{
  "name": "my-awesome-project",
  "version": "1.0.0",
  "description": "An awesome project built with TypeScript",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^6.1.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "typescript": "^5.0.4",
    "vitest": "^0.31.1",
    "eslint": "^8.42.0",
    "prettier": "^2.8.8"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}`;

      const result = highlightToolOutput(packageJson, {
        contentType: 'json',
        maxLength: 2000,
        showLineNumbers: true
      });

      expect(result.highlighted).toBe(true);
      expect(result.contentType).toBe('json');
      expect(result.originalLength).toBe(packageJson.length);
      expect(result.content).toContain('│'); // line numbers
    });
  });

  describe('Edge cases and performance', () => {
    it('should handle extremely large files with truncation', () => {
      const hugeContent = Array(10000).fill('console.log("This is line " + i);').join('\n');

      const result = highlightToolOutput(hugeContent, {
        contentType: 'javascript',
        maxLength: 50000,
        maxLines: 100
      });

      expect(result.highlighted).toBe(true);
      expect(result.truncated).toBe(true);
      expect(result.originalLength).toBe(hugeContent.length);
      expect(result.content.length).toBeLessThan(hugeContent.length);
    });

    it('should handle mixed content types in markdown', () => {
      const markdownContent = `# Code Examples

Here's some JavaScript:

\`\`\`javascript
function hello(name) {
  console.log(\`Hello, \${name}!\`);
}
\`\`\`

And some Python:

\`\`\`python
def hello(name):
    print(f"Hello, {name}!")
\`\`\`

And some JSON data:

\`\`\`json
{
  "users": [
    {"id": 1, "name": "Alice"},
    {"id": 2, "name": "Bob"}
  ]
}
\`\`\``;

      const result = highlightSyntax(markdownContent, { contentType: 'markdown' });

      expect(result.highlighted).toBe(true);
      expect(result.contentType).toBe('markdown');
      // Markdown highlighting is basic, so just check it doesn't crash
      expect(result.content).toContain('# Code Examples');
    });

    it('should preserve original content when colors are disabled', () => {
      const originalCode = 'const message = "Hello"; console.log(message);';

      const result = highlightSyntax(originalCode, {
        contentType: 'javascript',
        colors: false
      });

      expect(result.highlighted).toBe(false);
      expect(result.content).toBe(originalCode);
      expect(stripColors(result.content)).toBe(originalCode);
    });

    it('should handle unicode and emoji in code', () => {
      const unicodeCode = `const messages = {
  greeting: "¡Hola! 👋",
  success: "✅ Operation completed successfully",
  error: "❌ Something went wrong",
  progress: "🔄 Processing...",
  celebration: "🎉 All tests passed!"
};

function displayMessage(type) {
  console.log(messages[type] || "🤷 Unknown message type");
}

// Support for various languages
const multilingual = {
  english: "Hello World",
  spanish: "Hola Mundo",
  japanese: "こんにちは世界",
  chinese: "你好世界",
  arabic: "مرحبا بالعالم",
  russian: "Привет мир"
};`;

      const result = highlightSyntax(unicodeCode, {
        contentType: 'javascript',
        showLineNumbers: true
      });

      expect(result.highlighted).toBe(true);
      expect(result.content).toContain('👋');
      expect(result.content).toContain('✅');
      expect(result.content).toContain('こんにちは世界');
      expect(result.content).toContain('你好世界');
      expect(result.content).toContain('مرحبا بالعالم');
      expect(result.content).toContain('Привет мир');
    });
  });

  describe('Theme consistency and performance', () => {
    it('should maintain consistent theming across different content types', () => {
      const testContent = 'const value = 42;';

      const darkResult = highlightSyntax(testContent, {
        contentType: 'javascript',
        theme: DARK_THEME
      });

      const lightResult = highlightSyntax(testContent, {
        contentType: 'javascript',
        theme: LIGHT_THEME
      });

      // Both should be highlighted
      expect(darkResult.highlighted).toBe(true);
      expect(lightResult.highlighted).toBe(true);

      // Should use different colors
      expect(darkResult.content).not.toBe(lightResult.content);
      expect(darkResult.content).toContain(DARK_THEME.keyword);
      expect(lightResult.content).toContain(LIGHT_THEME.keyword);

      // Should both contain the original content
      expect(stripColors(darkResult.content)).toContain('const value = 42');
      expect(stripColors(lightResult.content)).toContain('const value = 42');
    });

    it('should handle rapid successive highlighting calls', () => {
      const codes = [
        'function test() { return true; }',
        '{ "key": "value", "number": 42 }',
        'def test():\n    return True',
        'package main\nfunc main() { }',
        'fn main() { println!("Hello"); }'
      ];

      const types = ['javascript', 'json', 'python', 'go', 'rust'];

      const startTime = Date.now();

      const results = codes.map((code, index) =>
        highlightSyntax(code, { contentType: types[index] as any })
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500); // Should complete quickly
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.highlighted).toBe(true);
        expect(result.contentType).toBe(types[index]);
      });
    });
  });
});