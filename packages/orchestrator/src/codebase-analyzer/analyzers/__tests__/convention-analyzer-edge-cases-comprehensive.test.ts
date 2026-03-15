/**
 * ConventionAnalyzer Comprehensive Edge Cases Tests
 * Extensive tests for indentation and formatting detection edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConventionAnalyzer - Comprehensive Edge Cases for Indentation & Formatting', () => {
  let analyzer: ConventionAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ConventionAnalyzer();
    testDir = join(tmpdir(), `convention-comprehensive-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Indentation Edge Cases', () => {
    it('should handle files with only one level of indentation correctly', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const singleLevelCode = `function example() {
  return 'single level';
}

class Example {
  constructor() {}
}

if (true) {
  console.log('single level');
}`;

      await fs.writeFile(join(srcDir, 'single-level.js'), singleLevelCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2);
    });

    it('should handle mixed tabs and spaces within same line correctly', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Mix of tabs and spaces - tabs followed by spaces
      const mixedLineCode = `function example() {
\t  const x = 1; // tab + 2 spaces
\t    const y = 2; // tab + 4 spaces
\t\tconst z = 3; // 2 tabs
  \tconst a = 4; // 2 spaces + tab
}`;

      await fs.writeFile(join(srcDir, 'mixed-line.js'), mixedLineCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('mixed');
    });

    it('should detect 8-space indentation accurately', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const eightSpaceCode = `function example() {
        const x = 1;
        if (x > 0) {
                console.log('eight spaces');
                if (x > 10) {
                        console.log('very deep');
                }
        }
}`;

      await fs.writeFile(join(srcDir, 'eight-spaces.js'), eightSpaceCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(8);
    });

    it('should handle files with no indentation (flat structure)', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const flatCode = `const x = 1;
const y = 2;
function add() { return x + y; }
class Calculator { constructor() {} }
export { add, Calculator };`;

      await fs.writeFile(join(srcDir, 'flat.js'), flatCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2); // Default when no samples
    });

    it('should handle files with only comment lines and whitespace', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const commentsOnlyCode = `// This file only has comments
/*
 * Multi-line comment
 * with various indentation
 */

    // Indented comment
        // More indented comment

/*
    Indented block comment
        More indentation
*/

// Final comment`;

      await fs.writeFile(join(srcDir, 'comments-only.js'), commentsOnlyCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2); // Default for no samples
    });

    it('should handle very large indentation sizes correctly', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create code with 16 space indentation but should cap at 8
      const largeIndentCode = `function example() {
                const x = 1; // 16 spaces
                if (x > 0) {
                                console.log('32 spaces'); // 32 spaces
                }
}`;

      await fs.writeFile(join(srcDir, 'large-indent.js'), largeIndentCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      // Should be within valid range as per schema
      expect(result.indentation.size).toBeGreaterThanOrEqual(1);
      expect(result.indentation.size).toBeLessThanOrEqual(8);
    });

    it('should prefer the most common indentation pattern across files', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Most files use 2 spaces
      const twoSpaceCode = `function example() {
  const x = 1;
  if (x > 0) {
    console.log('two spaces');
  }
}`;

      // One file uses 4 spaces
      const fourSpaceCode = `function example() {
    const x = 1;
    if (x > 0) {
        console.log('four spaces');
    }
}`;

      // Create multiple files with 2 spaces (majority)
      await fs.writeFile(join(srcDir, 'file1.js'), twoSpaceCode);
      await fs.writeFile(join(srcDir, 'file2.js'), twoSpaceCode);
      await fs.writeFile(join(srcDir, 'file3.js'), twoSpaceCode);
      await fs.writeFile(join(srcDir, 'file4.js'), twoSpaceCode);

      // One outlier with 4 spaces
      await fs.writeFile(join(srcDir, 'outlier.js'), fourSpaceCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2); // Should prefer the majority
    });
  });

  describe('Formatting Edge Cases', () => {
    it('should handle mixed semicolon usage with structural code', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const mixedSemicolonCode = `const config = {
  api: 'url',
  port: 3000
}; // Object with semicolon

const items = [
  'item1',
  'item2',
  'item3'
] // Array without semicolon

function process() {
  return config.api;
} // Function without semicolon

const result = process(); // Statement with semicolon

export default result; // Export with semicolon

export const helper = () => {
  return 'helper'
} // Arrow function without semicolon`;

      await fs.writeFile(join(srcDir, 'mixed-semicolons.js'), mixedSemicolonCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.formatting?.semicolons).toBe('mixed');
    });

    it('should handle complex quote escaping correctly', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const complexQuotesCode = `const message1 = 'It\\'s a single quoted string';
const message2 = "He said \\"Hello\\" to me";
const message3 = \`Template with \${message1} and 'quotes'\`;
const regex = /pattern with 'quotes' and "double quotes"/;
const json = '{"key": "value", "nested": {"prop": "val"}}';
const html = '<div class="container">Content</div>';
const escaped = 'String with \\' escaped quote';`;

      await fs.writeFile(join(srcDir, 'complex-quotes.js'), complexQuotesCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.formatting?.quotes).toBe('mixed');
    });

    it('should detect trailing commas in complex nested structures', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const complexTrailingCommaCode = `const config = {
  api: {
    baseUrl: 'https://api.example.com',
    version: 'v1',
    endpoints: {
      users: '/users',
      posts: '/posts',
      comments: '/comments',
    },
  },
  auth: {
    type: 'bearer',
    tokenExpiry: 3600,
  },
  features: [
    'darkMode',
    'notifications',
    'analytics',
  ],
};

const functions = [
  async function fetchData() {
    return await fetch('/api/data');
  },
  function processData(data) {
    return data.map(item => ({
      id: item.id,
      name: item.name,
      processed: true,
    }));
  },
];`;

      await fs.writeFile(join(srcDir, 'complex-trailing.js'), complexTrailingCommaCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.formatting?.trailingCommas).toBe('always');
    });

    it('should handle function parameters with trailing commas', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const functionTrailingCommaCode = `function longParameterFunction(
  param1,
  param2,
  param3,
  param4,
) {
  return param1 + param2 + param3 + param4;
}

const arrowFunction = (
  a,
  b,
  c,
) => {
  return a * b * c;
};

class Example {
  constructor(
    name,
    age,
    email,
  ) {
    this.name = name;
    this.age = age;
    this.email = email;
  }

  method(
    param1,
    param2,
  ) {
    return { param1, param2 };
  }
}`;

      await fs.writeFile(join(srcDir, 'function-trailing.js'), functionTrailingCommaCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.formatting?.trailingCommas).toBe('always');
    });

    it('should handle very long lines and calculate appropriate line length limits', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const longLinesCode = `// This line is exactly 80 characters long and should be within limits
const shortVariable = 'short value';

// This line is much longer than typical line length limits and should affect the calculated maximum line length for the project
const veryLongVariableNameThatExceedsTypicalLineLengthLimitsBecauseItDemonstratesProjectConventions = 'This is a very long string that also contributes to the overall line length and helps determine what the project considers acceptable';

const anotherExtremelyLongVariableNameThatContinuesTheTrendOfVerboseNamingConventionsAndDemonstratesConsistentlyLongLineUsageThroughoutTheCodebase = {
  propertyWithVeryLongNameThatContributesToOverallLineLength: 'value',
  anotherPropertyWithEvenLongerNameThatPushesLineLengthBoundaries: 'another value that makes the line even longer',
};

function functionWithVeryLongNameAndParametersThatExceedsRecommendedLineLengthLimits(parameterWithLongName, anotherParameterWithEvenLongerName, thirdParameterThatMakesLineExtremelyLong) {
  return parameterWithLongName + anotherParameterWithEvenLongerName + thirdParameterThatMakesLineExtremelyLong;
}`;

      await fs.writeFile(join(srcDir, 'long-lines.js'), longLinesCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.formatting?.lineLength).toBeGreaterThan(120);
      expect(result.formatting?.lineLength).toBeLessThanOrEqual(200);
    });

    it('should handle minified code correctly', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const minifiedCode = `function a(b,c){return b+c}const d=a(1,2);const e=[1,2,3,4,5];const f={a:1,b:2,c:3};export{a,d,e,f};`;

      await fs.writeFile(join(srcDir, 'minified.js'), minifiedCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      // Minified code should still be analyzable
      expect(result.formatting?.semicolons).toBe('required');
      expect(result.formatting?.quotes).toBeUndefined(); // No string literals to analyze
      expect(result.formatting?.lineLength).toBeLessThanOrEqual(200);
    });
  });

  describe('Malformed Code Handling', () => {
    it('should handle syntax errors gracefully', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const syntaxErrorCode = `function broken() {
  const x = 1;
  if (x > 0 { // Missing closing parenthesis
    console.log('broken');
  }
  return x;;; // Multiple semicolons
}

// Unclosed string
const badString = 'This string is not closed properly

function normalFunction() {
  return 'this one is fine';
}`;

      await fs.writeFile(join(srcDir, 'syntax-error.js'), syntaxErrorCode);

      const result = await analyzer.analyze(testDir);

      // Should not throw, but analyze what it can
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2);
    });

    it('should handle files with unusual encodings and characters', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const unicodeCode = `// Unicode characters in comments: ñáéíóú 中文 العربية
const message = '🎉 Hello World! 🌍';
const unicode = 'Héllo wörld with àccénts';
const emoji = '😀😃😄😁😆';
const mathSymbols = '∀x∈ℝ: x² ≥ 0';

function processUnicode() {
  const data = {
    name: 'José María',
    city: 'São Paulo',
    country: 'Brasil',
  };
  return data;
}

/* Multi-line comment with unicode
 * ═══════════════════════════════
 * │ Box drawing characters      │
 * ╞═════════════════════════════╡
 * │ And other symbols: ™ © ®   │
 * └─────────────────────────────┘
 */
class UnicodeHandler {
  constructor() {
    this.symbols = '★☆☮☯☸☺☻♠♣♥♦';
  }
}`;

      await fs.writeFile(join(srcDir, 'unicode.js'), unicodeCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.formatting?.quotes).toBe('single');
      expect(result.formatting?.trailingCommas).toBe('always');
    });

    it('should handle completely empty files', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      await fs.writeFile(join(srcDir, 'empty.js'), '');
      await fs.writeFile(join(srcDir, 'whitespace-only.js'), '   \n  \n\t\n   ');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2); // Default
    });
  });

  describe('Binary and Non-Text Files', () => {
    it('should handle binary files gracefully', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create a binary-like file (will be treated as text but with binary content)
      const binaryLikeContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      await fs.writeFile(join(srcDir, 'binary-like.js'), binaryLikeContent);

      // Also add a normal file so analysis doesn't fail completely
      await fs.writeFile(join(srcDir, 'normal.js'), 'const x = 1;');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      // Should analyze what it can from readable files
      expect(result.indentation.type).toBe('spaces');
    });
  });

  describe('Real-world Complex Scenarios', () => {
    it('should handle mixed file types with different conventions', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // JavaScript file with one style
      const jsCode = `function jsExample() {
  const config = {
    api: 'url',
    timeout: 5000,
  };
  return config;
}`;

      // TypeScript file with different style
      const tsCode = `interface Config {
    api: string;
    timeout: number;
}

function tsExample(): Config {
    return {
        api: "different-url",
        timeout: 10000
    };
}`;

      // Vue file with another style
      const vueCode = `<template>
\t<div class="component">
\t\t<p>{{ message }}</p>
\t</div>
</template>

<script>
export default {
\tname: 'TestComponent',
\tdata() {
\t\treturn {
\t\t\tmessage: 'Hello Vue!'
\t\t};
\t}
};
</script>`;

      await fs.writeFile(join(srcDir, 'example.js'), jsCode);
      await fs.writeFile(join(srcDir, 'example.ts'), tsCode);
      await fs.writeFile(join(srcDir, 'Component.vue'), vueCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('mixed'); // Should detect mixed patterns
      expect(result.formatting?.quotes).toBe('mixed'); // Mixed quote styles
    });

    it('should handle project with modern JavaScript features', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const modernJsCode = `// Modern JavaScript with various features
import { debounce, throttle } from 'lodash-es';
import type { User } from './types.js';

const API_BASE_URL = 'https://api.example.com';

class UserService {
  #privateField = new Map();

  constructor(private readonly config: Config) {}

  async fetchUser(id: string): Promise<User | null> {
    try {
      const response = await fetch(\`\${API_BASE_URL}/users/\${id}\`);

      if (!response.ok) {
        throw new Error(\`Failed to fetch user: \${response.status}\`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }

  // Arrow function with destructuring
  processUsers = async (users: User[]) => {
    return users
      .filter(({ active }) => active)
      .map(user => ({
        ...user,
        displayName: \`\${user.firstName} \${user.lastName}\`,
        avatar: user.avatar ?? '/default-avatar.png',
      }));
  };

  // Generator function
  *generateUserIds(): Generator<string> {
    let index = 0;
    while (true) {
      yield \`user-\${++index}\`;
    }
  }
}

// Async arrow function with optional chaining and nullish coalescing
const processUserData = async (userId?: string) => {
  const user = await userService.fetchUser(userId ?? '');
  const preferences = user?.preferences ?? {};

  return {
    theme: preferences.theme ?? 'light',
    language: preferences.language ?? 'en',
    notifications: preferences.notifications?.enabled ?? true,
  };
};

// Template literal with complex expressions
const createWelcomeMessage = (user: User) => \`
  Welcome back, \${user.firstName}!
  You have \${user.notifications?.length ?? 0} new notification\${
    (user.notifications?.length ?? 0) === 1 ? '' : 's'
  }.
  Last login: \${user.lastLogin?.toLocaleDateString() ?? 'Never'}
\`;

export { UserService, processUserData, createWelcomeMessage };`;

      await fs.writeFile(join(srcDir, 'modern-features.ts'), modernJsCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2);
      expect(result.formatting?.quotes).toBe('single');
      expect(result.formatting?.semicolons).toBe('required');
      expect(result.formatting?.trailingCommas).toBe('always');
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle files with many repeated patterns efficiently', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Generate code with many repeated indentation patterns
      let repeatedCode = '// File with many repeated patterns\n\n';

      for (let i = 0; i < 200; i++) {
        repeatedCode += `function func${i}() {
  const data${i} = {
    prop1: 'value${i}',
    prop2: {
      nested: 'nested${i}',
      deep: {
        deeper: 'deeper${i}',
      },
    },
  };

  if (data${i}.prop1) {
    console.log(\`Processing \${data${i}.prop1}\`);

    if (data${i}.prop2.nested) {
      console.log(\`Nested: \${data${i}.prop2.nested}\`);
    }
  }

  return data${i};
}

`;
      }

      await fs.writeFile(join(srcDir, 'repeated-patterns.js'), repeatedCode);

      const startTime = Date.now();
      const result = await analyzer.analyze(testDir);
      const analysisTime = Date.now() - startTime;

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2);
      expect(analysisTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});