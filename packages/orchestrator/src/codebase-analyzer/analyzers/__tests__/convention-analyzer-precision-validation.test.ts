/**
 * ConventionAnalyzer Precision Validation Tests
 * Tests to ensure accurate detection of indentation and formatting patterns
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConventionAnalyzer - Precision Validation for Indentation & Formatting', () => {
  let analyzer: ConventionAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ConventionAnalyzer();
    testDir = join(tmpdir(), `convention-precision-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Precise Indentation Detection', () => {
    it('should accurately detect 2-space indentation in pure 2-space project', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const files = [
        `function example1() {
  const config = {
    api: 'url',
    timeout: 5000,
  };

  if (config.api) {
    return config;
  }

  return null;
}`,
        `class UserService {
  constructor(config) {
    this.config = config;
  }

  async getUser(id) {
    try {
      const user = await fetch(\`/users/\${id}\`);
      return await user.json();
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  }
}`,
        `const utils = {
  formatName(first, last) {
    if (!first || !last) {
      return 'Unknown';
    }

    return \`\${first} \${last}\`;
  },

  validateEmail(email) {
    const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return regex.test(email);
  },
};`
      ];

      for (let i = 0; i < files.length; i++) {
        await fs.writeFile(join(srcDir, `file${i + 1}.js`), files[i]);
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2);
    });

    it('should accurately detect 4-space indentation in pure 4-space project', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const files = [
        `function example1() {
    const config = {
        api: 'url',
        timeout: 5000,
    };

    if (config.api) {
        return config;
    }

    return null;
}`,
        `class UserService {
    constructor(config) {
        this.config = config;
    }

    async getUser(id) {
        try {
            const user = await fetch(\`/users/\${id}\`);
            return await user.json();
        } catch (error) {
            console.error('Error:', error);
            return null;
        }
    }
}`,
        `const utils = {
    formatName(first, last) {
        if (!first || !last) {
            return 'Unknown';
        }

        return \`\${first} \${last}\`;
    },

    validateEmail(email) {
        const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
        return regex.test(email);
    },
};`
      ];

      for (let i = 0; i < files.length; i++) {
        await fs.writeFile(join(srcDir, `file${i + 1}.js`), files[i]);
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(4);
    });

    it('should accurately detect tab indentation in pure tab project', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const files = [
        `function example1() {
\tconst config = {
\t\tapi: 'url',
\t\ttimeout: 5000,
\t};
\t
\tif (config.api) {
\t\treturn config;
\t}
\t
\treturn null;
}`,
        `class UserService {
\tconstructor(config) {
\t\tthis.config = config;
\t}
\t
\tasync getUser(id) {
\t\ttry {
\t\t\tconst user = await fetch(\`/users/\${id}\`);
\t\t\treturn await user.json();
\t\t} catch (error) {
\t\t\tconsole.error('Error:', error);
\t\t\treturn null;
\t\t}
\t}
}`,
        `const utils = {
\tformatName(first, last) {
\t\tif (!first || !last) {
\t\t\treturn 'Unknown';
\t\t}
\t\t
\t\treturn \`\${first} \${last}\`;
\t},
\t
\tvalidateEmail(email) {
\t\tconst regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
\t\treturn regex.test(email);
\t},
};`
      ];

      for (let i = 0; i < files.length; i++) {
        await fs.writeFile(join(srcDir, `file${i + 1}.js`), files[i]);
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('tabs');
      expect(result.indentation.size).toBe(1);
    });

    it('should detect mixed indentation when threshold is exceeded', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // 3 files with spaces (60%)
      const spaceFiles = [
        `function spaces1() {
  const x = 1;
  if (x > 0) {
    console.log('spaces');
  }
}`,
        `function spaces2() {
  const y = 2;
  if (y > 0) {
    console.log('spaces');
  }
}`,
        `function spaces3() {
  const z = 3;
  if (z > 0) {
    console.log('spaces');
  }
}`
      ];

      // 2 files with tabs (40%)
      const tabFiles = [
        `function tabs1() {
\tconst x = 1;
\tif (x > 0) {
\t\tconsole.log('tabs');
\t}
}`,
        `function tabs2() {
\tconst y = 2;
\tif (y > 0) {
\t\tconsole.log('tabs');
\t}
}`
      ];

      for (let i = 0; i < spaceFiles.length; i++) {
        await fs.writeFile(join(srcDir, `spaces${i + 1}.js`), spaceFiles[i]);
      }

      for (let i = 0; i < tabFiles.length; i++) {
        await fs.writeFile(join(srcDir, `tabs${i + 1}.js`), tabFiles[i]);
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('mixed');
    });
  });

  describe('Precise Semicolon Detection', () => {
    it('should detect semicolon-required style with high accuracy', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const semicolonCode = `const API_BASE = 'https://api.example.com';
const TIMEOUT = 5000;

function fetchUser(id) {
  const url = \`\${API_BASE}/users/\${id}\`;
  return fetch(url);
}

const userService = {
  async getUser(id) {
    const response = await fetchUser(id);
    return await response.json();
  },

  async getUsers() {
    const response = await fetch(\`\${API_BASE}/users\`);
    return await response.json();
  }
};

class UserManager {
  constructor() {
    this.cache = new Map();
  }

  async loadUser(id) {
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }

    const user = await userService.getUser(id);
    this.cache.set(id, user);
    return user;
  }
}

export { userService, UserManager };`;

      await fs.writeFile(join(srcDir, 'semicolons.js'), semicolonCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.formatting?.semicolons).toBe('required');
    });

    it('should detect semicolon-optional style with high accuracy', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const noSemicolonCode = `const API_BASE = 'https://api.example.com'
const TIMEOUT = 5000

function fetchUser(id) {
  const url = \`\${API_BASE}/users/\${id}\`
  return fetch(url)
}

const userService = {
  async getUser(id) {
    const response = await fetchUser(id)
    return await response.json()
  },

  async getUsers() {
    const response = await fetch(\`\${API_BASE}/users\`)
    return await response.json()
  }
}

class UserManager {
  constructor() {
    this.cache = new Map()
  }

  async loadUser(id) {
    if (this.cache.has(id)) {
      return this.cache.get(id)
    }

    const user = await userService.getUser(id)
    this.cache.set(id, user)
    return user
  }
}

export { userService, UserManager }`;

      await fs.writeFile(join(srcDir, 'no-semicolons.js'), noSemicolonCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.formatting?.semicolons).toBe('optional');
    });

    it('should not count structural characters as semicolon statements', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Code with lots of structural elements but clear semicolon pattern
      const structuralCode = `const config = {
  database: {
    host: 'localhost',
    port: 5432,
    name: 'myapp'
  },
  server: {
    port: 3000,
    cors: true
  }
};

const handlers = [
  function(req, res) {
    res.json({ status: 'ok' });
  },
  function(req, res) {
    res.json({ error: 'not found' });
  }
];

if (config.server.cors) {
  app.use(cors());
}

for (const handler of handlers) {
  app.use(handler);
}`;

      await fs.writeFile(join(srcDir, 'structural.js'), structuralCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.formatting?.semicolons).toBe('required');
    });
  });

  describe('Precise Quote Style Detection', () => {
    it('should detect single quote preference accurately', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const singleQuoteCode = `const message = 'Hello, world!';
const greeting = 'Welcome to our application';
const template = 'User name: {name}';
const error = 'Something went wrong';
const success = 'Operation completed successfully';

function formatMessage(text) {
  return \`Message: \${text}\`; // Template literal doesn't count
}

const config = {
  api: 'https://api.example.com',
  version: 'v1',
  timeout: 'medium',
  env: 'production'
};

console.log('Application started');
console.log('Configuration loaded');`;

      await fs.writeFile(join(srcDir, 'single-quotes.js'), singleQuoteCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.formatting?.quotes).toBe('single');
    });

    it('should detect double quote preference accurately', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const doubleQuoteCode = `const message = "Hello, world!";
const greeting = "Welcome to our application";
const template = "User name: {name}";
const error = "Something went wrong";
const success = "Operation completed successfully";

function formatMessage(text) {
  return \`Message: \${text}\`; // Template literal doesn't count
}

const config = {
  api: "https://api.example.com",
  version: "v1",
  timeout: "medium",
  env: "production"
};

console.log("Application started");
console.log("Configuration loaded");`;

      await fs.writeFile(join(srcDir, 'double-quotes.js'), doubleQuoteCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.formatting?.quotes).toBe('double');
    });

    it('should detect template literal preference accurately', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const templateCode = `const message = \`Hello, world!\`;
const greeting = \`Welcome to our application\`;
const template = \`User name: \${userName}\`;
const error = \`Something went wrong at \${timestamp}\`;
const success = \`Operation completed successfully in \${duration}ms\`;

function formatMessage(text, context) {
  return \`Message: \${text} (Context: \${context})\`;
}

const config = {
  api: \`https://\${host}.example.com\`,
  version: \`v\${apiVersion}\`,
  timeout: \`\${timeoutValue}s\`,
  env: \`\${environment}\`
};

console.log(\`Application started at \${new Date()}\`);
console.log(\`Configuration loaded from \${configPath}\`);`;

      await fs.writeFile(join(srcDir, 'template-literals.js'), templateCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.formatting?.quotes).toBe('backtick');
    });
  });

  describe('Precise Trailing Comma Detection', () => {
    it('should detect trailing comma "always" preference accurately', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const trailingCommaCode = `const config = {
  api: 'https://api.example.com',
  timeout: 5000,
  retries: 3,
  features: {
    auth: true,
    logging: true,
    metrics: false,
  },
};

const supportedFormats = [
  'json',
  'xml',
  'yaml',
  'toml',
];

const handlers = [
  function handleSuccess(data) {
    return { success: true, data };
  },
  function handleError(error) {
    return { success: false, error: error.message };
  },
  function handleTimeout() {
    return { success: false, error: 'timeout' };
  },
];

function processData(
  input,
  options,
  callback,
) {
  const result = {
    processed: true,
    timestamp: Date.now(),
    data: input,
  };

  return callback(result);
}`;

      await fs.writeFile(join(srcDir, 'trailing-always.js'), trailingCommaCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.formatting?.trailingCommas).toBe('always');
    });

    it('should detect trailing comma "never" preference accurately', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const noTrailingCommaCode = `const config = {
  api: 'https://api.example.com',
  timeout: 5000,
  retries: 3,
  features: {
    auth: true,
    logging: true,
    metrics: false
  }
};

const supportedFormats = [
  'json',
  'xml',
  'yaml',
  'toml'
];

const handlers = [
  function handleSuccess(data) {
    return { success: true, data };
  },
  function handleError(error) {
    return { success: false, error: error.message };
  },
  function handleTimeout() {
    return { success: false, error: 'timeout' };
  }
];

function processData(
  input,
  options,
  callback
) {
  const result = {
    processed: true,
    timestamp: Date.now(),
    data: input
  };

  return callback(result);
}`;

      await fs.writeFile(join(srcDir, 'trailing-never.js'), noTrailingCommaCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.formatting?.trailingCommas).toBe('never');
    });

    it('should not count single-line structures as trailing comma candidates', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const singleLineCode = `const simple = { a: 1, b: 2, c: 3 };
const array = [1, 2, 3, 4, 5];
const func = (a, b, c) => a + b + c;

// Only multi-line structures should count for trailing comma detection
const multiLine = {
  first: 'value',
  second: 'another',
  third: 'final',
};

const multiArray = [
  'item1',
  'item2',
  'item3',
];`;

      await fs.writeFile(join(srcDir, 'single-line.js'), singleLineCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.formatting?.trailingCommas).toBe('always');
    });
  });

  describe('Line Length Calculation Precision', () => {
    it('should calculate line length based on 95th percentile to avoid outliers', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create file with mostly 80-character lines and a few outliers
      let codeLines = [];

      // 95 lines of exactly 80 characters
      for (let i = 0; i < 95; i++) {
        const padding = ''.padEnd(60, ' ');
        codeLines.push(\`const var\${i.toString().padStart(3, '0')} = 'value\${i}'\${padding}; // 80 chars\`);
      }

      // 5 outlier lines with 150+ characters
      for (let i = 95; i < 100; i++) {
        const longPadding = ''.padEnd(120, ' ');
        codeLines.push(\`const veryLongVariableName\${i} = 'very long value that makes this line extremely long'\${longPadding}; // 150+ chars\`);
      }

      const codeWithOutliers = codeLines.join('\\n');

      await fs.writeFile(join(srcDir, 'line-lengths.js'), codeWithOutliers);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.formatting?.lineLength).toBe(100); // Should be close to 80, not 150+
    });

    it('should map calculated lengths to common standard limits', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Test different common line length standards
      const testCases = [
        { maxLength: 75, expectedLimit: 80 },
        { maxLength: 95, expectedLimit: 100 },
        { maxLength: 115, expectedLimit: 120 },
        { maxLength: 135, expectedLimit: 140 }
      ];

      for (const testCase of testCases) {
        const lines = [];
        for (let i = 0; i < 20; i++) {
          const content = 'x'.repeat(testCase.maxLength - 20); // Leave room for line structure
          lines.push(\`const variable\${i} = '\${content}';\`);
        }

        await fs.writeFile(join(srcDir, \`length-\${testCase.expectedLimit}.js\`), lines.join('\\n'));
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      // Should be one of the common limits
      const commonLimits = [80, 100, 120, 140, 160, 200];
      expect(commonLimits).toContain(result.formatting?.lineLength);
    });
  });

  describe('Complex Real-world Validation', () => {
    it('should maintain accuracy with complex modern JavaScript patterns', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const complexModernCode = \`// Modern JavaScript with consistent 2-space, single quotes, semicolons, trailing commas
import { debounce, throttle } from 'lodash-es';
import type { User, Config } from './types.js';

const API_CONFIG = {
  baseUrl: 'https://api.example.com',
  timeout: 5000,
  retries: 3,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

class ApiService {
  #cache = new WeakMap();

  constructor(private config: Config) {
    this.config = { ...API_CONFIG, ...config };
  }

  async fetchUser(id: string): Promise<User | null> {
    try {
      const response = await fetch(\\\`\\\${this.config.baseUrl}/users/\\\${id}\\\`, {
        method: 'GET',
        headers: this.config.headers,
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(\\\`HTTP error: \\\${response.status}\\\`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch user:', error);
      return null;
    }
  }

  processUsers = async (users: User[]): Promise<ProcessedUser[]> => {
    return users
      .filter(user => user.active)
      .map(user => ({
        id: user.id,
        name: \\\`\\\${user.firstName} \\\${user.lastName}\\\`,
        email: user.email?.toLowerCase() ?? '',
        avatar: user.avatar ?? '/default-avatar.png',
        lastActive: user.lastActive ?? new Date(),
      }))
      .sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());
  };

  *userIdGenerator(start = 1): Generator<string> {
    let current = start;
    while (true) {
      yield \\\`user-\\\${current++}\\\`;
    }
  }
}\`;

      await fs.writeFile(join(srcDir, 'modern-complex.ts'), complexModernCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2);
      expect(result.formatting?.quotes).toBe('single');
      expect(result.formatting?.semicolons).toBe('required');
      expect(result.formatting?.trailingCommas).toBe('always');
    });
  });
});