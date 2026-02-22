/**
 * ConventionAnalyzer Enhanced Indentation and Formatting Tests
 * Tests for the improved indentation and formatting detection capabilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConventionAnalyzer - Enhanced Indentation and Formatting', () => {
  let analyzer: ConventionAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ConventionAnalyzer();
    testDir = join(tmpdir(), `convention-indent-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Enhanced Indentation Detection', () => {
    it('should detect 2-space indentation accurately', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const twoSpaceCode = `function example() {
  const x = 1;
  if (x > 0) {
    console.log('positive');
    if (x > 10) {
      console.log('large');
    }
  }
}`;

      await fs.writeFile(join(srcDir, 'example.js'), twoSpaceCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2);
    });

    it('should detect 4-space indentation accurately', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const fourSpaceCode = `function example() {
    const x = 1;
    if (x > 0) {
        console.log('positive');
        if (x > 10) {
            console.log('large');
        }
    }
}`;

      await fs.writeFile(join(srcDir, 'example.js'), fourSpaceCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(4);
    });

    it('should detect tab indentation accurately', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const tabCode = `function example() {
\tconst x = 1;
\tif (x > 0) {
\t\tconsole.log('positive');
\t\tif (x > 10) {
\t\t\tconsole.log('large');
\t\t}
\t}
}`;

      await fs.writeFile(join(srcDir, 'example.js'), tabCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('tabs');
      expect(result.indentation.size).toBe(1);
    });

    it('should detect mixed indentation', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const mixedCode1 = `function spaces() {
  const x = 1;
  if (x > 0) {
    console.log('spaces');
  }
}`;

      const mixedCode2 = `function tabs() {
\tconst x = 1;
\tif (x > 0) {
\t\tconsole.log('tabs');
\t}
}`;

      await fs.writeFile(join(srcDir, 'spaces.js'), mixedCode1);
      await fs.writeFile(join(srcDir, 'tabs.js'), mixedCode2);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('mixed');
    });

    it('should handle inconsistent space sizes within same file', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const inconsistentCode = `function example() {
  const x = 1; // 2 spaces
  if (x > 0) {
      console.log('4 spaces');
      if (x > 10) {
        console.log('2 more spaces, total 6');
      }
  }
}`;

      await fs.writeFile(join(srcDir, 'inconsistent.js'), inconsistentCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      // Should detect the most common size
      expect([2, 4, 6]).toContain(result.indentation.size);
    });

    it('should skip empty and comment-only lines during detection', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const codeWithComments = `function example() {
  // This is a comment
  const x = 1;

  /* Another comment */
  if (x > 0) {
    console.log('positive');
    // Yet another comment

    if (x > 10) {
      console.log('large');
    }
  }

}`;

      await fs.writeFile(join(srcDir, 'comments.js'), codeWithComments);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2);
    });

    it('should handle default for empty files', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      await fs.writeFile(join(srcDir, 'empty.js'), '');
      await fs.writeFile(join(srcDir, 'comments-only.js'), '// Just a comment\n/* Another comment */');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2);
    });
  });

  describe('Enhanced Formatting Detection', () => {
    describe('Semicolon Detection', () => {
      it('should detect semicolon-required style', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const semicolonCode = `const x = 1;
const y = 2;
function add(a, b) {
  return a + b;
}
const result = add(x, y);`;

        await fs.writeFile(join(srcDir, 'semicolons.js'), semicolonCode);

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.formatting?.semicolons).toBe('required');
      });

      it('should detect optional semicolon style', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const noSemicolonCode = `const x = 1
const y = 2
function add(a, b) {
  return a + b
}
const result = add(x, y)`;

        await fs.writeFile(join(srcDir, 'no-semicolons.js'), noSemicolonCode);

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.formatting?.semicolons).toBe('optional');
      });

      it('should detect mixed semicolon usage', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const mixedSemicolon1 = `const x = 1;
const y = 2;
function test() {
  return x + y;
}`;

        const mixedSemicolon2 = `const a = 3
const b = 4
function test2() {
  return a + b
}`;

        await fs.writeFile(join(srcDir, 'semi.js'), mixedSemicolon1);
        await fs.writeFile(join(srcDir, 'no-semi.js'), mixedSemicolon2);

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.formatting?.semicolons).toBe('mixed');
      });
    });

    describe('Quote Style Detection', () => {
      it('should detect single quote preference', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const singleQuoteCode = `const message = 'Hello World';
const greeting = 'Welcome to the app';
console.log('Single quotes everywhere');
const template = 'User: \\{name\\}';`;

        await fs.writeFile(join(srcDir, 'single-quotes.js'), singleQuoteCode);

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.formatting?.quotes).toBe('single');
      });

      it('should detect double quote preference', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const doubleQuoteCode = `const message = "Hello World";
const greeting = "Welcome to the app";
console.log("Double quotes everywhere");
const template = "User: {name}";`;

        await fs.writeFile(join(srcDir, 'double-quotes.js'), doubleQuoteCode);

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.formatting?.quotes).toBe('double');
      });

      it('should detect backtick preference for template literals', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const backtickCode = `const message = \`Hello World\`;
const greeting = \`Welcome to the app\`;
const template = \`User: \${name}\`;
console.log(\`Backticks are used\`);`;

        await fs.writeFile(join(srcDir, 'backticks.js'), backtickCode);

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.formatting?.quotes).toBe('backtick');
      });

      it('should detect mixed quote usage', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const mixedQuote1 = `const single = 'Single quotes';
const template = \`Template: \${single}\`;`;

        const mixedQuote2 = `const double = "Double quotes";
console.log("Using double quotes");`;

        await fs.writeFile(join(srcDir, 'mixed1.js'), mixedQuote1);
        await fs.writeFile(join(srcDir, 'mixed2.js'), mixedQuote2);

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.formatting?.quotes).toBe('mixed');
      });
    });

    describe('Trailing Comma Detection', () => {
      it('should detect trailing comma preference', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const trailingCommaCode = `const config = {
  api: 'https://api.example.com',
  timeout: 5000,
  retries: 3,
};

const items = [
  'first',
  'second',
  'third',
];

function example(
  param1,
  param2,
  param3,
) {
  return { param1, param2, param3 };
}`;

        await fs.writeFile(join(srcDir, 'trailing-commas.js'), trailingCommaCode);

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.formatting?.trailingCommas).toBe('always');
      });

      it('should detect no trailing comma preference', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const noTrailingCommaCode = `const config = {
  api: 'https://api.example.com',
  timeout: 5000,
  retries: 3
};

const items = [
  'first',
  'second',
  'third'
];

const simple = { a: 1, b: 2 };`;

        await fs.writeFile(join(srcDir, 'no-trailing-commas.js'), noTrailingCommaCode);

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.formatting?.trailingCommas).toBe('never');
      });

      it('should detect mixed trailing comma usage', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const mixedTrailing1 = `const config = {
  api: 'url',
  timeout: 5000,
};`;

        const mixedTrailing2 = `const items = [
  'first',
  'second',
  'third'
];`;

        await fs.writeFile(join(srcDir, 'mixed-trailing1.js'), mixedTrailing1);
        await fs.writeFile(join(srcDir, 'mixed-trailing2.js'), mixedTrailing2);

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.formatting?.trailingCommas).toBe('mixed');
      });
    });

    describe('Line Length Detection', () => {
      it('should detect appropriate line length limits', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const shortLinesCode = `const short = 1;
function example() {
  return 'short lines';
}
const config = {
  api: 'url',
  timeout: 5000
};`;

        await fs.writeFile(join(srcDir, 'short-lines.js'), shortLinesCode);

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.formatting?.lineLength).toBeLessThanOrEqual(100);
      });

      it('should detect longer line length limits for code with longer lines', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const longLinesCode = `const veryLongVariableNameThatExceedsTypicalLineLengthLimitsBecauseItIsIntentionallyVerbose = 'value';
function functionWithVeryLongNameAndParametersList(parameterOne, parameterTwo, parameterThree, parameterFour) {
  const anotherVeryLongVariableNameThatDemonstratesLongerLineLengthConventionsInThisCodebase = 'another value';
  return anotherVeryLongVariableNameThatDemonstratesLongerLineLengthConventionsInThisCodebase;
}`;

        await fs.writeFile(join(srcDir, 'long-lines.js'), longLinesCode);

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.formatting?.lineLength).toBeGreaterThanOrEqual(120);
      });
    });

    it('should skip non-JavaScript files for detailed formatting analysis', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Add some non-JS files
      await fs.writeFile(join(srcDir, 'styles.css'), `
.class {
  color: red;
  margin: 0;
}
`);
      await fs.writeFile(join(srcDir, 'data.json'), `{
  "key": "value",
  "number": 123
}`);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      // Should return undefined for formatting since no JS files were analyzed
      expect(result.formatting).toBeUndefined();
    });
  });

  describe('Integration Tests', () => {
    it('should return complete analysis with all enhanced features', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const comprehensiveCode = `/**
 * Enhanced formatting example with various patterns
 */
function processUserData(users, options = {}) {
  const config = {
    batchSize: 100,
    timeout: 5000,
    retries: 3,
  };

  const results = [];

  for (const user of users) {
    if (user.active) {
      const processedUser = {
        id: user.id,
        name: user.name,
        email: user.email,
      };

      results.push(processedUser);
    }
  }

  return results;
}

const userList = [
  { id: 1, name: 'Alice', email: 'alice@example.com', active: true },
  { id: 2, name: 'Bob', email: 'bob@example.com', active: false },
  { id: 3, name: 'Charlie', email: 'charlie@example.com', active: true },
];`;

      await fs.writeFile(join(srcDir, 'comprehensive.js'), comprehensiveCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Verify all fields are present and valid
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2);

      expect(result.formatting).toBeDefined();
      expect(result.formatting?.semicolons).toBe('required');
      expect(result.formatting?.quotes).toBe('single');
      expect(result.formatting?.trailingCommas).toBe('always');
      expect(result.formatting?.lineLength).toBeDefined();
      expect(result.formatting?.lineLength).toBeGreaterThan(0);
      expect(result.formatting?.lineLength).toBeLessThanOrEqual(200);

      // Verify other convention analysis still works
      expect(result.functionNaming).toBeDefined();
      expect(result.variableNaming).toBeDefined();
      expect(result.documentation).toBeDefined();
    });
  });
});