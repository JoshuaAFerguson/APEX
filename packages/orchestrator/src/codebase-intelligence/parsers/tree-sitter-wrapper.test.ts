/**
 * Comprehensive tests for TreeSitterWrapper class
 *
 * Tests all functionality including:
 * - Basic parsing across all supported languages
 * - Error handling and edge cases
 * - File parsing with language detection
 * - Singleton pattern and caching behavior
 * - Type safety and validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { TreeSitterWrapper, SupportedLanguage, UnsupportedLanguageError, ParserError } from './tree-sitter-wrapper.js';

describe('TreeSitterWrapper', () => {
  beforeEach(() => {
    // Reset singleton instance before each test
    TreeSitterWrapper.resetInstance();
  });

  afterEach(() => {
    // Clean up after each test
    TreeSitterWrapper.resetInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls to getInstance', () => {
      const instance1 = TreeSitterWrapper.getInstance();
      const instance2 = TreeSitterWrapper.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(TreeSitterWrapper);
    });

    it('should create a new instance after resetInstance', () => {
      const instance1 = TreeSitterWrapper.getInstance();
      TreeSitterWrapper.resetInstance();
      const instance2 = TreeSitterWrapper.getInstance();

      expect(instance1).not.toBe(instance2);
      expect(instance2).toBeInstanceOf(TreeSitterWrapper);
    });

    it('should clear cache when resetting instance', async () => {
      const wrapper = TreeSitterWrapper.getInstance();

      // Parse something to populate cache
      await wrapper.parse('const x = 5;', SupportedLanguage.JavaScript);

      TreeSitterWrapper.resetInstance();
      const newWrapper = TreeSitterWrapper.getInstance();

      // Cache should be empty
      expect(newWrapper.getCacheStats().size).toBe(0);
    });
  });

  describe('Basic Parsing - All Languages', () => {
    let wrapper: TreeSitterWrapper;

    beforeEach(() => {
      wrapper = TreeSitterWrapper.getInstance();
    });

    it('should parse TypeScript code successfully', async () => {
      const code = 'const greeting: string = "Hello, TypeScript!";';
      const result = await wrapper.parse(code, SupportedLanguage.TypeScript);

      expect(result.hasErrors).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.rootNode.type).toBe('program');
      expect(result.language).toBe(SupportedLanguage.TypeScript);
      expect(result.sourceCode).toBe(code);
      expect(result.tree).toBeDefined();
    });

    it('should parse TSX code successfully', async () => {
      const code = 'const element = <div>Hello, TSX!</div>;';
      const result = await wrapper.parse(code, SupportedLanguage.TSX);

      expect(result.hasErrors).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.rootNode.type).toBe('program');
      expect(result.language).toBe(SupportedLanguage.TSX);
      expect(result.sourceCode).toBe(code);
    });

    it('should parse JavaScript code successfully', async () => {
      const code = 'function hello() { return "Hello, JavaScript!"; }';
      const result = await wrapper.parse(code, SupportedLanguage.JavaScript);

      expect(result.hasErrors).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.rootNode.type).toBe('program');
      expect(result.language).toBe(SupportedLanguage.JavaScript);
      expect(result.sourceCode).toBe(code);
    });

    it('should parse Python code successfully', async () => {
      const code = 'def hello():\n    return "Hello, Python!"';
      const result = await wrapper.parse(code, SupportedLanguage.Python);

      expect(result.hasErrors).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.rootNode.type).toBe('module');
      expect(result.language).toBe(SupportedLanguage.Python);
      expect(result.sourceCode).toBe(code);
    });

    it('should parse Go code successfully', async () => {
      const code = 'package main\n\nfunc main() {\n\tprintln("Hello, Go!")\n}';
      const result = await wrapper.parse(code, SupportedLanguage.Go);

      expect(result.hasErrors).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.rootNode.type).toBe('source_file');
      expect(result.language).toBe(SupportedLanguage.Go);
      expect(result.sourceCode).toBe(code);
    });

    it('should parse Java code successfully', async () => {
      const code = 'public class Hello {\n    public static void main(String[] args) {\n        System.out.println("Hello, Java!");\n    }\n}';
      const result = await wrapper.parse(code, SupportedLanguage.Java);

      expect(result.hasErrors).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.rootNode.type).toBe('program');
      expect(result.language).toBe(SupportedLanguage.Java);
      expect(result.sourceCode).toBe(code);
    });

    it('should parse Rust code successfully', async () => {
      const code = 'fn main() {\n    println!("Hello, Rust!");\n}';
      const result = await wrapper.parse(code, SupportedLanguage.Rust);

      expect(result.hasErrors).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.rootNode.type).toBe('source_file');
      expect(result.language).toBe(SupportedLanguage.Rust);
      expect(result.sourceCode).toBe(code);
    });
  });

  describe('Error Handling', () => {
    let wrapper: TreeSitterWrapper;

    beforeEach(() => {
      wrapper = TreeSitterWrapper.getInstance();
    });

    it('should throw UnsupportedLanguageError for invalid language', async () => {
      await expect(
        wrapper.parse('const x = 5;', 'invalid-language' as SupportedLanguage)
      ).rejects.toThrow(UnsupportedLanguageError);
    });

    it('should collect syntax errors in malformed code', async () => {
      const code = 'const x = ;'; // Missing value
      const result = await wrapper.parse(code, SupportedLanguage.JavaScript);

      expect(result.hasErrors).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('ERROR');
      expect(result.errors[0].message).toContain('Syntax error');
      expect(result.errors[0].startPosition).toBeDefined();
      expect(result.errors[0].endPosition).toBeDefined();
    });

    it('should handle empty source code', async () => {
      const result = await wrapper.parse('', SupportedLanguage.JavaScript);

      expect(result.hasErrors).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.rootNode.type).toBe('program');
      expect(result.sourceCode).toBe('');
    });

    it('should handle very large source code', async () => {
      const largeCode = 'const x = 1;\n'.repeat(10000);
      const result = await wrapper.parse(largeCode, SupportedLanguage.JavaScript);

      expect(result.hasErrors).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.rootNode.type).toBe('program');
    });

    it('should respect maxErrors option', async () => {
      const code = 'const x = ;\nconst y = ;\nconst z = ;'; // Multiple syntax errors
      const result = await wrapper.parse(code, SupportedLanguage.JavaScript, { maxErrors: 2 });

      expect(result.hasErrors).toBe(true);
      expect(result.errors.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Language Detection', () => {
    let wrapper: TreeSitterWrapper;

    beforeEach(() => {
      wrapper = TreeSitterWrapper.getInstance();
    });

    it('should detect TypeScript from .ts extension', () => {
      expect(wrapper.detectLanguage('file.ts')).toBe(SupportedLanguage.TypeScript);
      expect(wrapper.detectLanguage('/path/to/file.ts')).toBe(SupportedLanguage.TypeScript);
      expect(wrapper.detectLanguage('file.mts')).toBe(SupportedLanguage.TypeScript);
      expect(wrapper.detectLanguage('file.cts')).toBe(SupportedLanguage.TypeScript);
    });

    it('should detect TSX from .tsx extension', () => {
      expect(wrapper.detectLanguage('component.tsx')).toBe(SupportedLanguage.TSX);
      expect(wrapper.detectLanguage('/path/to/component.tsx')).toBe(SupportedLanguage.TSX);
    });

    it('should detect JavaScript from various extensions', () => {
      expect(wrapper.detectLanguage('script.js')).toBe(SupportedLanguage.JavaScript);
      expect(wrapper.detectLanguage('component.jsx')).toBe(SupportedLanguage.JavaScript);
      expect(wrapper.detectLanguage('module.mjs')).toBe(SupportedLanguage.JavaScript);
      expect(wrapper.detectLanguage('config.cjs')).toBe(SupportedLanguage.JavaScript);
    });

    it('should detect Python from .py extension', () => {
      expect(wrapper.detectLanguage('script.py')).toBe(SupportedLanguage.Python);
      expect(wrapper.detectLanguage('script.pyw')).toBe(SupportedLanguage.Python);
      expect(wrapper.detectLanguage('types.pyi')).toBe(SupportedLanguage.Python);
    });

    it('should detect Go from .go extension', () => {
      expect(wrapper.detectLanguage('main.go')).toBe(SupportedLanguage.Go);
      expect(wrapper.detectLanguage('/src/main.go')).toBe(SupportedLanguage.Go);
    });

    it('should detect Java from .java extension', () => {
      expect(wrapper.detectLanguage('Main.java')).toBe(SupportedLanguage.Java);
      expect(wrapper.detectLanguage('/com/example/Main.java')).toBe(SupportedLanguage.Java);
    });

    it('should detect Rust from .rs extension', () => {
      expect(wrapper.detectLanguage('main.rs')).toBe(SupportedLanguage.Rust);
      expect(wrapper.detectLanguage('/src/main.rs')).toBe(SupportedLanguage.Rust);
    });

    it('should return null for unsupported extensions', () => {
      expect(wrapper.detectLanguage('file.txt')).toBeNull();
      expect(wrapper.detectLanguage('file.md')).toBeNull();
      expect(wrapper.detectLanguage('file')).toBeNull();
      expect(wrapper.detectLanguage('.gitignore')).toBeNull();
    });

    it('should handle case-insensitive extensions', () => {
      expect(wrapper.detectLanguage('file.TS')).toBe(SupportedLanguage.TypeScript);
      expect(wrapper.detectLanguage('file.JS')).toBe(SupportedLanguage.JavaScript);
      expect(wrapper.detectLanguage('file.PY')).toBe(SupportedLanguage.Python);
    });
  });

  describe('File Parsing', () => {
    let wrapper: TreeSitterWrapper;
    const tempDir = path.join(__dirname, '__temp_test_files__');

    beforeEach(async () => {
      wrapper = TreeSitterWrapper.getInstance();
      // Create temp directory
      await fs.mkdir(tempDir, { recursive: true });
    });

    afterEach(async () => {
      // Clean up temp files
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should parse TypeScript file with automatic language detection', async () => {
      const filePath = path.join(tempDir, 'test.ts');
      const code = 'interface User { name: string; age: number; }';

      await fs.writeFile(filePath, code);
      const result = await wrapper.parseFile(filePath);

      expect(result.hasErrors).toBe(false);
      expect(result.language).toBe(SupportedLanguage.TypeScript);
      expect(result.sourceCode).toBe(code);
      expect(result.rootNode.type).toBe('program');
    });

    it('should parse JavaScript file with automatic language detection', async () => {
      const filePath = path.join(tempDir, 'test.js');
      const code = 'const sum = (a, b) => a + b;';

      await fs.writeFile(filePath, code);
      const result = await wrapper.parseFile(filePath);

      expect(result.hasErrors).toBe(false);
      expect(result.language).toBe(SupportedLanguage.JavaScript);
      expect(result.sourceCode).toBe(code);
      expect(result.rootNode.type).toBe('program');
    });

    it('should parse Python file with automatic language detection', async () => {
      const filePath = path.join(tempDir, 'test.py');
      const code = 'def fibonacci(n):\n    return n if n <= 1 else fibonacci(n-1) + fibonacci(n-2)';

      await fs.writeFile(filePath, code);
      const result = await wrapper.parseFile(filePath);

      expect(result.hasErrors).toBe(false);
      expect(result.language).toBe(SupportedLanguage.Python);
      expect(result.sourceCode).toBe(code);
      expect(result.rootNode.type).toBe('module');
    });

    it('should throw UnsupportedLanguageError for unsupported file extensions', async () => {
      const filePath = path.join(tempDir, 'test.txt');

      await fs.writeFile(filePath, 'Hello World');

      await expect(wrapper.parseFile(filePath)).rejects.toThrow(UnsupportedLanguageError);
    });

    it('should throw ParserError for non-existent files', async () => {
      const filePath = path.join(tempDir, 'non-existent.ts');

      await expect(wrapper.parseFile(filePath)).rejects.toThrow(ParserError);
    });

    it('should handle empty files', async () => {
      const filePath = path.join(tempDir, 'empty.js');

      await fs.writeFile(filePath, '');
      const result = await wrapper.parseFile(filePath);

      expect(result.hasErrors).toBe(false);
      expect(result.language).toBe(SupportedLanguage.JavaScript);
      expect(result.sourceCode).toBe('');
      expect(result.rootNode.type).toBe('program');
    });
  });

  describe('Caching Behavior', () => {
    let wrapper: TreeSitterWrapper;

    beforeEach(() => {
      wrapper = TreeSitterWrapper.getInstance();
    });

    it('should start with empty cache', () => {
      const stats = wrapper.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.loadedLanguages).toHaveLength(0);
    });

    it('should cache language grammars after first use', async () => {
      await wrapper.parse('const x = 5;', SupportedLanguage.JavaScript);

      const stats = wrapper.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.loadedLanguages).toContain(SupportedLanguage.JavaScript);
    });

    it('should reuse cached language grammars', async () => {
      // First parse
      await wrapper.parse('const x = 5;', SupportedLanguage.JavaScript);
      const statsAfterFirst = wrapper.getCacheStats();

      // Second parse
      await wrapper.parse('const y = 10;', SupportedLanguage.JavaScript);
      const statsAfterSecond = wrapper.getCacheStats();

      // Cache should not grow
      expect(statsAfterFirst.size).toBe(statsAfterSecond.size);
      expect(statsAfterFirst.loadedLanguages).toEqual(statsAfterSecond.loadedLanguages);
    });

    it('should cache multiple languages', async () => {
      await wrapper.parse('const x = 5;', SupportedLanguage.JavaScript);
      await wrapper.parse('const y: number = 10;', SupportedLanguage.TypeScript);

      const stats = wrapper.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.loadedLanguages).toContain(SupportedLanguage.JavaScript);
      expect(stats.loadedLanguages).toContain(SupportedLanguage.TypeScript);
    });

    it('should clear cache when requested', async () => {
      await wrapper.parse('const x = 5;', SupportedLanguage.JavaScript);
      expect(wrapper.getCacheStats().size).toBe(1);

      wrapper.clearCache();
      expect(wrapper.getCacheStats().size).toBe(0);
      expect(wrapper.getCacheStats().loadedLanguages).toHaveLength(0);
    });
  });

  describe('Utility Methods', () => {
    let wrapper: TreeSitterWrapper;

    beforeEach(() => {
      wrapper = TreeSitterWrapper.getInstance();
    });

    it('should return all supported languages', () => {
      const languages = wrapper.getSupportedLanguages();

      expect(languages).toContain(SupportedLanguage.TypeScript);
      expect(languages).toContain(SupportedLanguage.TSX);
      expect(languages).toContain(SupportedLanguage.JavaScript);
      expect(languages).toContain(SupportedLanguage.Python);
      expect(languages).toContain(SupportedLanguage.Go);
      expect(languages).toContain(SupportedLanguage.Java);
      expect(languages).toContain(SupportedLanguage.Rust);
      expect(languages).toHaveLength(7);
    });

    it('should check if languages are supported', () => {
      expect(wrapper.isLanguageSupported('typescript')).toBe(true);
      expect(wrapper.isLanguageSupported('javascript')).toBe(true);
      expect(wrapper.isLanguageSupported('python')).toBe(true);
      expect(wrapper.isLanguageSupported('go')).toBe(true);
      expect(wrapper.isLanguageSupported('java')).toBe(true);
      expect(wrapper.isLanguageSupported('rust')).toBe(true);
      expect(wrapper.isLanguageSupported('tsx')).toBe(true);

      expect(wrapper.isLanguageSupported('c++')).toBe(false);
      expect(wrapper.isLanguageSupported('php')).toBe(false);
      expect(wrapper.isLanguageSupported('invalid')).toBe(false);
    });

    it('should return all supported file extensions', () => {
      const extensions = wrapper.getSupportedExtensions();

      expect(extensions).toContain('.ts');
      expect(extensions).toContain('.tsx');
      expect(extensions).toContain('.js');
      expect(extensions).toContain('.jsx');
      expect(extensions).toContain('.py');
      expect(extensions).toContain('.go');
      expect(extensions).toContain('.java');
      expect(extensions).toContain('.rs');
      expect(extensions).toContain('.mjs');
      expect(extensions).toContain('.cjs');
      expect(extensions).toContain('.mts');
      expect(extensions).toContain('.cts');
      expect(extensions).toContain('.pyw');
      expect(extensions).toContain('.pyi');
    });
  });

  describe('Parse Options', () => {
    let wrapper: TreeSitterWrapper;

    beforeEach(() => {
      wrapper = TreeSitterWrapper.getInstance();
    });

    it('should use default options when none provided', async () => {
      const code = 'const x = ;'; // Syntax error
      const result = await wrapper.parse(code, SupportedLanguage.JavaScript);

      expect(result.hasErrors).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.length).toBeLessThanOrEqual(100); // Default maxErrors
    });

    it('should respect custom maxErrors option', async () => {
      const code = 'const x = ;\nconst y = ;\nconst z = ;'; // Multiple syntax errors
      const result = await wrapper.parse(code, SupportedLanguage.JavaScript, { maxErrors: 1 });

      expect(result.hasErrors).toBe(true);
      expect(result.errors.length).toBeLessThanOrEqual(1);
    });

    it('should handle zero maxErrors', async () => {
      const code = 'const x = ;'; // Syntax error
      const result = await wrapper.parse(code, SupportedLanguage.JavaScript, { maxErrors: 0 });

      expect(result.hasErrors).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Complex Language Features', () => {
    let wrapper: TreeSitterWrapper;

    beforeEach(() => {
      wrapper = TreeSitterWrapper.getInstance();
    });

    it('should parse complex TypeScript with generics and interfaces', async () => {
      const code = `
        interface GenericInterface<T, U> {
          process<V>(input: T, transform: (value: T) => V): Promise<U>;
        }

        class Implementation<T> implements GenericInterface<T, string> {
          async process<V>(input: T, transform: (value: T) => V): Promise<string> {
            const result = transform(input);
            return String(result);
          }
        }
      `;

      const result = await wrapper.parse(code, SupportedLanguage.TypeScript);

      expect(result.hasErrors).toBe(false);
      expect(result.rootNode.type).toBe('program');
    });

    it('should parse complex JSX with nested components', async () => {
      const code = `
        const MyComponent = ({ data, onSelect }: Props) => {
          return (
            <div className="container">
              <Header title="My App" />
              <List
                items={data.map(item => ({
                  ...item,
                  selected: item.id === selectedId
                }))}
                onItemClick={(item) => {
                  onSelect(item);
                  track('item_selected', { id: item.id });
                }}
              />
            </div>
          );
        };
      `;

      const result = await wrapper.parse(code, SupportedLanguage.TSX);

      expect(result.hasErrors).toBe(false);
      expect(result.rootNode.type).toBe('program');
    });

    it('should parse complex Python with decorators and async/await', async () => {
      const code = `
        from typing import AsyncGenerator, Optional
        import asyncio

        @dataclass
        class DataProcessor:
            config: ProcessorConfig

            @cached_property
            def client(self) -> HttpClient:
                return HttpClient(self.config.endpoint)

            async def process_stream(
                self,
                data: AsyncGenerator[bytes, None]
            ) -> AsyncGenerator[ProcessedData, None]:
                async for chunk in data:
                    try:
                        processed = await self._process_chunk(chunk)
                        if processed:
                            yield processed
                    except ProcessingError as e:
                        logger.error(f"Failed to process chunk: {e}")
      `;

      const result = await wrapper.parse(code, SupportedLanguage.Python);

      expect(result.hasErrors).toBe(false);
      expect(result.rootNode.type).toBe('module');
    });
  });

  describe('Error Types and Details', () => {
    let wrapper: TreeSitterWrapper;

    beforeEach(() => {
      wrapper = TreeSitterWrapper.getInstance();
    });

    it('should create UnsupportedLanguageError with correct properties', () => {
      const error = new UnsupportedLanguageError('cpp');

      expect(error.name).toBe('UnsupportedLanguageError');
      expect(error.language).toBe('cpp');
      expect(error.supportedLanguages).toEqual(Object.values(SupportedLanguage));
      expect(error.message).toContain('Unsupported language: \'cpp\'');
      expect(error.message).toContain('Supported languages:');
    });

    it('should create ParserError with correct properties', () => {
      const cause = new Error('Original error');
      const error = new ParserError('Parse failed', SupportedLanguage.JavaScript, cause);

      expect(error.name).toBe('ParserError');
      expect(error.message).toBe('Parse failed');
      expect(error.language).toBe(SupportedLanguage.JavaScript);
      expect(error.cause).toBe(cause);
    });
  });

  describe('Performance and Memory', () => {
    let wrapper: TreeSitterWrapper;

    beforeEach(() => {
      wrapper = TreeSitterWrapper.getInstance();
    });

    it('should handle parsing multiple files efficiently', async () => {
      const codes = [
        'const x = 1;',
        'const y = 2;',
        'const z = 3;',
        'const a = 4;',
        'const b = 5;'
      ];

      const startTime = Date.now();
      const results = await Promise.all(
        codes.map(code => wrapper.parse(code, SupportedLanguage.JavaScript))
      );
      const endTime = Date.now();

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.hasErrors).toBe(false);
      });

      // Should complete reasonably quickly (within 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should maintain reasonable cache size', async () => {
      // Parse with all supported languages
      const languages = wrapper.getSupportedLanguages();
      const parseTasks = languages.map(language => {
        const code = language === SupportedLanguage.Python ?
          'def hello(): pass' :
          language === SupportedLanguage.Go ?
            'package main\nfunc main() {}' :
            language === SupportedLanguage.Java ?
              'class Test {}' :
              language === SupportedLanguage.Rust ?
                'fn main() {}' :
                'const x = 1;';
        return wrapper.parse(code, language);
      });

      await Promise.all(parseTasks);

      const stats = wrapper.getCacheStats();
      expect(stats.size).toBe(languages.length);
      expect(stats.loadedLanguages.sort()).toEqual(languages.sort());
    });
  });
});

describe('TreeSitterWrapper Integration', () => {
  beforeEach(() => {
    TreeSitterWrapper.resetInstance();
  });

  afterEach(() => {
    TreeSitterWrapper.resetInstance();
  });

  it('should work with the convenience function', async () => {
    const { getTreeSitterWrapper } = await import('./tree-sitter-wrapper.js');
    const wrapper1 = getTreeSitterWrapper();
    const wrapper2 = getTreeSitterWrapper();

    expect(wrapper1).toBe(wrapper2);
    expect(wrapper1).toBeInstanceOf(TreeSitterWrapper);
  });
});