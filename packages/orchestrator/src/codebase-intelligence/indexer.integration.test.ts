/**
 * Integration Tests for CodebaseIndexer
 *
 * Tests the complete workflow from directory discovery through symbol extraction
 * to RepositoryMap generation, including real-world scenarios and cross-language support.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { CodebaseIndexer, type IndexingOptions } from './indexer.js';
import type { RepositoryMap } from '@apexcli/core/types';

describe('CodebaseIndexer Integration', () => {
  let tempDir: string;
  let indexer: CodebaseIndexer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codebase-indexer-integration-'));
    indexer = CodebaseIndexer.getInstance();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    CodebaseIndexer.resetInstance();
  });

  describe('Real-world project structure', () => {
    beforeEach(async () => {
      // Create a realistic project structure similar to APEX itself
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.mkdir(path.join(tempDir, 'src', 'utils'));
      await fs.mkdir(path.join(tempDir, 'src', 'types'));
      await fs.mkdir(path.join(tempDir, 'tests'));
      await fs.mkdir(path.join(tempDir, 'docs'));
      await fs.mkdir(path.join(tempDir, 'node_modules'));
      await fs.mkdir(path.join(tempDir, 'dist'));

      // Main application files
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), `
/**
 * Main application entry point
 */
import { ConfigManager } from './utils/config.js';
import { Logger } from './utils/logger.js';
import type { AppConfig } from './types/config.js';

export class Application {
  private config: AppConfig;
  private logger: Logger;

  constructor(config: AppConfig) {
    this.config = config;
    this.logger = new Logger(config.logLevel);
  }

  async start(): Promise<void> {
    this.logger.info('Starting application');
    // Implementation here
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping application');
    // Implementation here
  }
}

export default Application;
      `);

      // Utility files
      await fs.writeFile(path.join(tempDir, 'src', 'utils', 'config.ts'), `
import * as fs from 'fs/promises';
import type { AppConfig } from '../types/config.js';

export class ConfigManager {
  static async load(path: string): Promise<AppConfig> {
    const content = await fs.readFile(path, 'utf-8');
    return JSON.parse(content) as AppConfig;
  }

  static async save(config: AppConfig, path: string): Promise<void> {
    await fs.writeFile(path, JSON.stringify(config, null, 2));
  }
}
      `);

      await fs.writeFile(path.join(tempDir, 'src', 'utils', 'logger.ts'), `
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  constructor(private level: LogLevel = LogLevel.INFO) {}

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(message, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(message, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(message, ...args);
    }
  }
}
      `);

      // Type definitions
      await fs.writeFile(path.join(tempDir, 'src', 'types', 'config.ts'), `
import type { LogLevel } from '../utils/logger.js';

export interface AppConfig {
  name: string;
  version: string;
  logLevel: LogLevel;
  database?: DatabaseConfig;
  server?: ServerConfig;
}

interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  credentials?: {
    username: string;
    password: string;
  };
}

interface ServerConfig {
  host: string;
  port: number;
  ssl: boolean;
}

export type { DatabaseConfig, ServerConfig };
      `);

      // JavaScript files
      await fs.writeFile(path.join(tempDir, 'src', 'legacy.js'), `
/**
 * Legacy JavaScript module
 */
const Utils = {
  formatString: function(str, ...args) {
    return str.replace(/{(\d+)}/g, (match, index) => {
      return typeof args[index] !== 'undefined' ? args[index] : match;
    });
  },

  isArray: Array.isArray,

  deepClone: function(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => Utils.deepClone(item));
    if (typeof obj === 'object') {
      const cloned = {};
      for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = Utils.deepClone(obj[key]);
        }
      }
      return cloned;
    }
  }
};

const AsyncUtils = {
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  timeout: (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
  ])
};

module.exports = { Utils, AsyncUtils };
      `);

      // Python files
      await fs.writeFile(path.join(tempDir, 'scripts', 'build.py'), `
#!/usr/bin/env python3
"""
Build script for the project
"""
import os
import sys
import subprocess
from pathlib import Path
from typing import List, Optional

class BuildConfig:
    """Configuration for build process"""

    def __init__(self,
                 target_dir: str = "dist",
                 clean_build: bool = False,
                 optimize: bool = True):
        self.target_dir = Path(target_dir)
        self.clean_build = clean_build
        self.optimize = optimize

class Builder:
    """Main builder class"""

    def __init__(self, config: BuildConfig):
        self.config = config
        self.logger = self._setup_logger()

    def _setup_logger(self):
        import logging
        logging.basicConfig(level=logging.INFO)
        return logging.getLogger(__name__)

    async def build(self) -> bool:
        """Execute the build process"""
        try:
            if self.config.clean_build:
                self._clean()

            self._compile()
            self._optimize()
            return True
        except Exception as e:
            self.logger.error(f"Build failed: {e}")
            return False

    def _clean(self) -> None:
        """Clean build directory"""
        if self.config.target_dir.exists():
            import shutil
            shutil.rmtree(self.config.target_dir)

    def _compile(self) -> None:
        """Compile source files"""
        self.logger.info("Compiling source files...")
        # Implementation here

    def _optimize(self) -> None:
        """Optimize build output"""
        if self.config.optimize:
            self.logger.info("Optimizing build...")
            # Implementation here

def main(args: Optional[List[str]] = None) -> int:
    """Main entry point"""
    config = BuildConfig(clean_build=True)
    builder = Builder(config)

    try:
        import asyncio
        success = asyncio.run(builder.build())
        return 0 if success else 1
    except KeyboardInterrupt:
        print("Build cancelled by user")
        return 1

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
      `);

      await fs.mkdir(path.join(tempDir, 'scripts'), { recursive: true });

      // Test files
      await fs.writeFile(path.join(tempDir, 'tests', 'integration.test.ts'), `
import { describe, it, expect } from 'vitest';
import { Application } from '../src/index.js';
import { ConfigManager } from '../src/utils/config.js';
import { Logger, LogLevel } from '../src/utils/logger.js';

describe('Application Integration', () => {
  it('should initialize properly', async () => {
    const config = {
      name: 'test-app',
      version: '1.0.0',
      logLevel: LogLevel.INFO
    };

    const app = new Application(config);
    expect(app).toBeDefined();
  });

  it('should start and stop gracefully', async () => {
    const config = {
      name: 'test-app',
      version: '1.0.0',
      logLevel: LogLevel.DEBUG
    };

    const app = new Application(config);
    await app.start();
    await app.stop();
  });
});
      `);

      // Files that should be ignored
      await fs.writeFile(path.join(tempDir, 'node_modules', 'some-dep.js'), 'module.exports = {};');
      await fs.writeFile(path.join(tempDir, 'dist', 'compiled.js'), 'console.log("compiled");');
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test Project\nThis is a test project.');
      await fs.writeFile(path.join(tempDir, '.env'), 'SECRET_KEY=test123');
    });

    it('should index a realistic project structure', async () => {
      const result = await indexer.indexDirectory(tempDir);

      // Should find TypeScript, JavaScript, and Python files
      expect(result.files.length).toBeGreaterThan(0);

      // Check that we have files from different languages
      const languages = new Set(result.files.map(f => f.language));
      expect(languages.has('typescript')).toBe(true);
      expect(languages.has('javascript')).toBe(true);
      expect(languages.has('python')).toBe(true);

      // Verify excluded files are not present
      expect(result.files.find(f => f.path.includes('node_modules'))).toBeUndefined();
      expect(result.files.find(f => f.path.includes('dist'))).toBeUndefined();
      expect(result.files.find(f => f.path.endsWith('.md'))).toBeUndefined();
      expect(result.files.find(f => f.path.endsWith('.env'))).toBeUndefined();

      // Check statistics
      expect(result.stats!.totalFiles).toBeGreaterThan(5);
      expect(result.stats!.totalSymbols).toBeGreaterThan(10);
      expect(result.stats!.languageBreakdown.typescript).toBeGreaterThan(0);
      expect(result.stats!.languageBreakdown.javascript).toBeGreaterThan(0);
      expect(result.stats!.languageBreakdown.python).toBeGreaterThan(0);
    });

    it('should extract complex symbols correctly', async () => {
      const result = await indexer.indexDirectory(tempDir);

      // Find the main application file
      const mainFile = result.files.find(f => f.path.includes('index.ts'));
      expect(mainFile).toBeDefined();

      // Should have extracted the Application class and its methods
      const applicationClass = mainFile!.symbols.find(s => s.name === 'Application' && s.type === 'class');
      expect(applicationClass).toBeDefined();
      expect(applicationClass!.exported).toBe(true);

      // Should have constructor and methods
      const constructor = mainFile!.symbols.find(s => s.name === 'constructor');
      const startMethod = mainFile!.symbols.find(s => s.name === 'start');
      const stopMethod = mainFile!.symbols.find(s => s.name === 'stop');

      expect(constructor).toBeDefined();
      expect(startMethod).toBeDefined();
      expect(stopMethod).toBeDefined();
    });

    it('should handle cross-file type references', async () => {
      const result = await indexer.indexDirectory(tempDir);

      // Find files that should have type imports
      const configManagerFile = result.files.find(f => f.path.includes('utils/config.ts'));
      const indexFile = result.files.find(f => f.path.includes('index.ts'));

      expect(configManagerFile).toBeDefined();
      expect(indexFile).toBeDefined();

      // Both should have symbols extracted
      expect(configManagerFile!.symbols.length).toBeGreaterThan(0);
      expect(indexFile!.symbols.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-language project support', () => {
    beforeEach(async () => {
      // Create a polyglot project
      await fs.writeFile(path.join(tempDir, 'main.ts'), `
export interface Config {
  apiUrl: string;
  timeout: number;
}

export class ApiClient {
  constructor(private config: Config) {}

  async get(endpoint: string): Promise<any> {
    // Implementation
  }
}
      `);

      await fs.writeFile(path.join(tempDir, 'utils.js'), `
const crypto = require('crypto');

function generateId() {
  return crypto.randomUUID();
}

function hash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

const validators = {
  email: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  url: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
};

module.exports = { generateId, hash, validators };
      `);

      await fs.writeFile(path.join(tempDir, 'analyzer.py'), `
"""
Data analysis utilities
"""
import json
import statistics
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime

@dataclass
class DataPoint:
    timestamp: datetime
    value: float
    metadata: Optional[Dict[str, Any]] = None

class DataAnalyzer:
    """Analyzes time series data"""

    def __init__(self, data_points: List[DataPoint]):
        self.data_points = data_points
        self._cache = {}

    def mean(self) -> float:
        """Calculate mean of all data points"""
        if 'mean' not in self._cache:
            values = [dp.value for dp in self.data_points]
            self._cache['mean'] = statistics.mean(values)
        return self._cache['mean']

    def median(self) -> float:
        """Calculate median of all data points"""
        if 'median' not in self._cache:
            values = [dp.value for dp in self.data_points]
            self._cache['median'] = statistics.median(values)
        return self._cache['median']

    @staticmethod
    def from_json(json_data: str) -> 'DataAnalyzer':
        """Create analyzer from JSON data"""
        data = json.loads(json_data)
        data_points = [
            DataPoint(
                timestamp=datetime.fromisoformat(item['timestamp']),
                value=item['value'],
                metadata=item.get('metadata')
            )
            for item in data['points']
        ]
        return DataAnalyzer(data_points)

def process_batch(analyzers: List[DataAnalyzer]) -> Dict[str, float]:
    """Process multiple analyzers in batch"""
    return {
        f'analyzer_{i}': analyzer.mean()
        for i, analyzer in enumerate(analyzers)
    }
      `);
    });

    it('should handle mixed-language projects correctly', async () => {
      const result = await indexer.indexDirectory(tempDir);

      expect(result.files).toHaveLength(3);

      const tsFile = result.files.find(f => f.path === 'main.ts');
      const jsFile = result.files.find(f => f.path === 'utils.js');
      const pyFile = result.files.find(f => f.path === 'analyzer.py');

      expect(tsFile!.language).toBe('typescript');
      expect(jsFile!.language).toBe('javascript');
      expect(pyFile!.language).toBe('python');

      // TypeScript file should have interface and class
      const configInterface = tsFile!.symbols.find(s => s.name === 'Config' && s.type === 'interface');
      const apiClientClass = tsFile!.symbols.find(s => s.name === 'ApiClient' && s.type === 'class');
      expect(configInterface).toBeDefined();
      expect(apiClientClass).toBeDefined();

      // JavaScript file should have functions
      const generateIdFunc = jsFile!.symbols.find(s => s.name === 'generateId' && s.type === 'function');
      expect(generateIdFunc).toBeDefined();

      // Python file should have classes and functions
      const dataPointClass = pyFile!.symbols.find(s => s.name === 'DataPoint' && s.type === 'class');
      const analyzerClass = pyFile!.symbols.find(s => s.name === 'DataAnalyzer' && s.type === 'class');
      const processBatchFunc = pyFile!.symbols.find(s => s.name === 'process_batch' && s.type === 'function');

      expect(dataPointClass).toBeDefined();
      expect(analyzerClass).toBeDefined();
      expect(processBatchFunc).toBeDefined();

      // Verify statistics
      expect(result.stats!.languageBreakdown).toEqual({
        typescript: 1,
        javascript: 1,
        python: 1
      });

      expect(result.stats!.symbolTypeBreakdown).toEqual(
        expect.objectContaining({
          interface: expect.any(Number),
          class: expect.any(Number),
          function: expect.any(Number)
        })
      );
    });
  });

  describe('Performance and scalability', () => {
    it('should handle moderate-sized projects efficiently', async () => {
      // Create 20 files with varying complexity
      for (let i = 0; i < 20; i++) {
        const functionCount = 5 + (i % 10); // 5-14 functions per file
        const functions = Array.from({ length: functionCount }, (_, j) =>
          `export function func${i}_${j}(param: number): string { return param.toString(); }`
        ).join('\n\n');

        await fs.writeFile(path.join(tempDir, `file${i}.ts`), functions);
      }

      const startTime = Date.now();
      const result = await indexer.indexDirectory(tempDir);
      const endTime = Date.now();

      // Should complete within reasonable time (less than 10 seconds)
      expect(endTime - startTime).toBeLessThan(10000);

      // Should have processed all files
      expect(result.files).toHaveLength(20);
      expect(result.stats!.totalSymbols).toBeGreaterThan(100);

      // All files should have been processed without errors
      expect(result.errors).toHaveLength(0);
    });

    it('should handle concurrent processing correctly', async () => {
      // Create files that will be processed in parallel
      const filePromises = Array.from({ length: 10 }, async (_, i) => {
        const content = `
export class Class${i} {
  private value${i}: number = ${i};

  getValue${i}(): number {
    return this.value${i};
  }

  async asyncMethod${i}(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ${i}));
  }
}

export function utilFunc${i}(): Class${i} {
  return new Class${i}();
}
        `;
        await fs.writeFile(path.join(tempDir, `concurrent${i}.ts`), content);
      });

      await Promise.all(filePromises);

      const result = await indexer.indexDirectory(tempDir, { concurrency: 3 });

      expect(result.files).toHaveLength(10);
      expect(result.stats!.totalSymbols).toBeGreaterThan(30); // At least 3 symbols per file

      // Should maintain consistency despite concurrent processing
      for (let i = 0; i < 10; i++) {
        const file = result.files.find(f => f.path === `concurrent${i}.ts`);
        expect(file).toBeDefined();
        expect(file!.symbols.some(s => s.name === `Class${i}`)).toBe(true);
        expect(file!.symbols.some(s => s.name === `utilFunc${i}`)).toBe(true);
      }
    });
  });

  describe('Error recovery and resilience', () => {
    beforeEach(async () => {
      // Mix of valid and problematic files
      await fs.writeFile(path.join(tempDir, 'valid.ts'), `
export const valid = true;
export function validFunction(): void {}
      `);

      await fs.writeFile(path.join(tempDir, 'syntax-error.ts'), `
function broken( {
  // Missing closing parenthesis and brace
      `);

      await fs.writeFile(path.join(tempDir, 'empty.ts'), '');

      await fs.writeFile(path.join(tempDir, 'comments-only.js'), `
// This file only has comments
/* And some block comments */
/**
 * JSDoc comment
 */
      `);

      await fs.writeFile(path.join(tempDir, 'another-valid.py'), `
def valid_python_function():
    """A valid Python function"""
    return "hello"

class ValidPythonClass:
    def __init__(self):
        self.value = 42
      `);
    });

    it('should recover gracefully from individual file errors', async () => {
      const result = await indexer.indexDirectory(tempDir, { continueOnError: true });

      // Should have processed valid files despite errors in others
      const validFiles = result.files.filter(f =>
        f.path === 'valid.ts' || f.path === 'another-valid.py'
      );

      expect(validFiles).toHaveLength(2);
      expect(validFiles[0].symbols.length).toBeGreaterThan(0);
      expect(validFiles[1].symbols.length).toBeGreaterThan(0);

      // Should track errors but continue processing
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });

    it('should maintain data integrity despite partial failures', async () => {
      const result = await indexer.indexDirectory(tempDir, { continueOnError: true });

      // Statistics should be accurate for processed files only
      const processedFiles = result.files.length;
      expect(result.stats!.totalFiles).toBe(processedFiles);

      // Language breakdown should be consistent
      const actualLanguages = new Set(result.files.map(f => f.language));
      const reportedLanguages = new Set(Object.keys(result.stats!.languageBreakdown));

      for (const lang of actualLanguages) {
        expect(reportedLanguages.has(lang)).toBe(true);
      }

      // Symbol counts should match
      const actualSymbolCount = result.files.reduce((sum, file) => sum + file.symbols.length, 0);
      expect(result.stats!.totalSymbols).toBe(actualSymbolCount);
    });
  });
});