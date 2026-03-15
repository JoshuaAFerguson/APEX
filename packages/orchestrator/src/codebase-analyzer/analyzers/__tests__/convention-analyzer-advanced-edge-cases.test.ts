/**
 * ConventionAnalyzer Advanced Edge Cases Tests
 * Additional tests for complex scenarios and edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConventionAnalyzer - Advanced Edge Cases', () => {
  let analyzer: ConventionAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ConventionAnalyzer();
    testDir = join(tmpdir(), `convention-advanced-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complex Indentation Edge Cases', () => {
    it('should handle extremely mixed indentation with different languages', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // JavaScript with 2 spaces
      const jsCode = `function jsFunction() {
  const data = {
    prop1: 'value1',
    prop2: {
      nested: 'value2'
    }
  };
  return data;
}`;

      // TypeScript with tabs
      const tsCode = `interface Config {
\tapi: string;
\tport: number;
\toptions: {
\t\ttimeout: number;
\t\tretries: number;
\t};
}

class Service {
\tprivate config: Config;

\tconstructor(config: Config) {
\t\tthis.config = config;
\t}
}`;

      // Python with 4 spaces (should be ignored in main analysis but test robustness)
      const pyCode = `def python_function():
    data = {
        'prop1': 'value1',
        'prop2': {
            'nested': 'value2'
        }
    }
    return data

class PythonClass:
    def __init__(self):
        self.value = 'test'`;

      await fs.writeFile(join(srcDir, 'jsFile.js'), jsCode);
      await fs.writeFile(join(srcDir, 'tsFile.ts'), tsCode);
      await fs.writeFile(join(srcDir, 'pyFile.py'), pyCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('mixed');
    });

    it('should handle files with extreme indentation levels', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const deeplyNestedCode = `function extremeNesting() {
  if (condition1) {
    if (condition2) {
      if (condition3) {
        if (condition4) {
          if (condition5) {
            if (condition6) {
              if (condition7) {
                if (condition8) {
                  return 'deeply nested';
                }
              }
            }
          }
        }
      }
    }
  }
}`;

      await fs.writeFile(join(srcDir, 'deepNesting.js'), deeplyNestedCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2);
    });

    it('should handle mixed tab and space indentation within single file', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const mixedIndentCode = `function mixedIndents() {
\tconst obj = {
  \t\tprop1: 'value1',  // tab + 2 spaces
\t  prop2: 'value2',    // tab + 2 spaces
    prop3: 'value3',      // 4 spaces
\t\t\tprop4: 'value4'   // 3 tabs
\t};
  return obj;               // 2 spaces
}`;

      await fs.writeFile(join(srcDir, 'mixed.js'), mixedIndentCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('mixed');
    });
  });

  describe('Complex Formatting Detection', () => {
    it('should handle files with multiline strings and template literals', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const complexStringCode = `const multilineString = \`
  This is a multiline
  template literal with
  embedded \${variable} expressions
  and "quotes" and 'apostrophes'
\`;

const jsonString = "{\\n  \\"key\\": \\"value\\",\\n  \\"nested\\": {\\n    \\"prop\\": true\\n  }\\n}";

const regexPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;

const complexObject = {
  template: \`Hello \${name}, welcome to \${app}\`,
  message: 'This is a single quoted string',
  description: "This is a double quoted string",
  data: [
    'item1',
    "item2",
    \`item3 with \${variable}\`,
  ],
};`;

      await fs.writeFile(join(srcDir, 'complex-strings.js'), complexStringCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.formatting).toBeDefined();
      expect(['single', 'double', 'backtick', 'mixed']).toContain(result.formatting?.quotes);
      expect(['always', 'never', 'mixed']).toContain(result.formatting?.trailingCommas);
    });

    it('should handle complex function declarations and arrow functions', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const complexFunctionCode = `// Traditional function declarations
function traditionalFunction(param1, param2) {
  return param1 + param2;
}

// Arrow functions with various formats
const arrowFunction1 = (a, b) => a + b;

const arrowFunction2 = (param) => {
  const result = param * 2;
  return result;
};

const arrowFunction3 = async (data) => {
  const processed = await processData(data);
  return processed;
};

// Class methods
class Calculator {
  add(a, b) {
    return a + b;
  }

  multiply = (a, b) => {
    return a * b;
  };

  async fetchData(url) {
    const response = await fetch(url);
    return response.json();
  }
}

// Generic functions
function genericFunction<T>(items: T[]): T[] {
  return items.filter(item => item !== null);
}

// Destructured parameters
const destructuredParams = ({name, age, ...rest}) => {
  return {name, age, ...rest};
};`;

      await fs.writeFile(join(srcDir, 'complex-functions.ts'), complexFunctionCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.functionNaming).toBe('camelCase');
      expect(result.formatting?.semicolons).toBeDefined();
    });
  });

  describe('Malformed and Edge Case Files', () => {
    it('should handle files with syntax errors gracefully', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const validCode = `function validFunction() {
  return 'this works';
}`;

      const syntaxErrorCode = `function brokenFunction() {
  return 'missing closing bracket'
  // Missing closing brace intentionally
`;

      const incompleteCode = `const incomplete = {
  prop1: 'value'
  // Missing closing brace and semicolon
`;

      await fs.writeFile(join(srcDir, 'valid.js'), validCode);
      await fs.writeFile(join(srcDir, 'broken.js'), syntaxErrorCode);
      await fs.writeFile(join(srcDir, 'incomplete.js'), incompleteCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      // Should still analyze patterns from valid parts
      expect(result.functionNaming).toBe('camelCase');
    });

    it('should handle very long lines gracefully', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const veryLongLine = 'const extremelyLongVariableNameThatExceedsAnyReasonableLineLengthLimitAndShouldBeDetectedByTheFormattingAnalysisAlgorithmAsAnEdgeCaseScenarioThatNeedsToBeHandledGracefully = "This is also a very long string literal that contains a lot of text and should test the line length detection algorithm to see how it handles extremely long content that might appear in real-world codebases";';

      const normalCode = `function normalFunction() {
  const short = 'normal';
  return short;
}`;

      const codeWithVeryLongLines = `${normalCode}\n\n${veryLongLine}\n\n${normalCode}`;

      await fs.writeFile(join(srcDir, 'long-lines.js'), codeWithVeryLongLines);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.formatting?.lineLength).toBeGreaterThan(100);
      expect(result.formatting?.lineLength).toBeLessThanOrEqual(200);
    });

    it('should handle empty and whitespace-only files', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Completely empty file
      await fs.writeFile(join(srcDir, 'empty.js'), '');

      // File with only whitespace
      await fs.writeFile(join(srcDir, 'whitespace.ts'), '   \n\n\t\t\n   ');

      // File with only comments
      await fs.writeFile(join(srcDir, 'comments-only.js'), `
// This file only has comments
/*
 * Multi-line comment
 * with multiple lines
 */
// Another comment
`);

      // Valid file to ensure analysis still works
      await fs.writeFile(join(srcDir, 'valid.js'), `
function validFunction() {
  return 'works';
}
`);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.functionNaming).toBe('camelCase');
      expect(result.indentation.type).toBe('spaces');
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle files with many repeated patterns efficiently', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Generate file with many repeated patterns to test efficiency
      let repeatedCode = '// File with many patterns\n';

      for (let i = 0; i < 100; i++) {
        repeatedCode += `
function func${i}(param${i}) {
  const var${i} = 'value${i}';
  const obj${i} = {
    prop${i}: var${i},
    method${i}: () => {
      return var${i}.toUpperCase();
    },
  };
  return obj${i};
}

class Class${i} {
  constructor(value${i}) {
    this.value${i} = value${i};
  }

  getValue${i}() {
    return this.value${i};
  }
}
`;
      }

      await fs.writeFile(join(srcDir, 'repeated-patterns.js'), repeatedCode);

      const startTime = Date.now();
      const result = await analyzer.analyze(testDir);
      const duration = Date.now() - startTime;

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.functionNaming).toBe('camelCase');
      expect(result.classNaming).toBe('PascalCase');
      expect(result.variableNaming).toBe('camelCase');
    });
  });

  describe('Real-world Complex Scenarios', () => {
    it('should handle React/JSX components with mixed conventions', async () => {
      const srcDir = join(testDir, 'src/components');
      await fs.mkdir(srcDir, { recursive: true });

      const reactComponentCode = `import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { formatDate } from '../utils/dateUtils';

/**
 * User profile component
 * @param props - Component props
 */
export const UserProfile = ({ user, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    email: user.email || '',
    birthDate: user.birthDate || null,
  });

  useEffect(() => {
    const validateForm = () => {
      const errors = {};

      if (!formData.firstName.trim()) {
        errors.firstName = 'First name is required';
      }

      if (!formData.email.includes('@')) {
        errors.email = 'Valid email is required';
      }

      return errors;
    };

    const errors = validateForm();
    console.log('Form validation:', errors);
  }, [formData]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const updatedUser = {
        ...user,
        ...formData,
        lastModified: new Date().toISOString(),
      };

      await onUpdate(updatedUser);
      setIsEditing(false);
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  return (
    <div className="user-profile">
      <div className="profile-header">
        <h2>{user.firstName} {user.lastName}</h2>
        <p className="user-email">{user.email}</p>
        {user.birthDate && (
          <p className="birth-date">
            Born: {formatDate(user.birthDate)}
          </p>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit} className="edit-form">
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              firstName: e.target.value
            }))}
            placeholder="First Name"
          />
          <Button type="submit">Save Changes</Button>
        </form>
      ) : (
        <Button onClick={() => setIsEditing(true)}>
          Edit Profile
        </Button>
      )}
    </div>
  );
};

export default UserProfile;`;

      await fs.writeFile(join(srcDir, 'UserProfile.jsx'), reactComponentCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.fileNaming).toBe('PascalCase');
      expect(result.functionNaming).toBe('camelCase');
      expect(result.variableNaming).toBe('camelCase');
      expect(result.imports.style).toBe('es6');
      expect(result.imports.quotes).toBe('single');
      expect(result.formatting?.semicolons).toBe('required');
      expect(result.formatting?.trailingCommas).toBe('never');
    });
  });
});