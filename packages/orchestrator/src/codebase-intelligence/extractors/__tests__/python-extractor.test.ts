/**
 * @jest-environment node
 * @group unit
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SupportedLanguage } from '../../parsers/types.js';
import { PythonExtractor } from '../python-extractor.js';
import { SymbolKind, ExtractionError } from '../types.js';

describe('PythonExtractor', () => {
  let extractor: PythonExtractor;

  beforeEach(() => {
    // Reset singleton before each test
    PythonExtractor.resetInstance();
    extractor = PythonExtractor.getInstance();
  });

  afterEach(() => {
    // Clean up after each test
    PythonExtractor.resetInstance();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = PythonExtractor.getInstance();
      const instance2 = PythonExtractor.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should reset instance properly', () => {
      const instance1 = PythonExtractor.getInstance();
      PythonExtractor.resetInstance();
      const instance2 = PythonExtractor.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('language validation', () => {
    it('should reject non-Python languages', async () => {
      await expect(
        extractor.extract('const x = 5;', SupportedLanguage.JavaScript)
      ).rejects.toThrow(ExtractionError);
    });

    it('should accept Python language', async () => {
      const result = await extractor.extract('x = 5', SupportedLanguage.Python);
      expect(result.language).toBe(SupportedLanguage.Python);
    });
  });

  describe('function extraction', () => {
    it('should extract simple function', async () => {
      const code = `
def hello_world():
    print("Hello, World!")
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        name: 'hello_world',
        kind: SymbolKind.Function,
        modifiers: [],
        exportKind: 'none'
      });
    });

    it('should extract async function', async () => {
      const code = `
async def async_function():
    await some_operation()
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        name: 'async_function',
        kind: SymbolKind.Function,
        modifiers: ['async'],
        exportKind: 'none'
      });
    });

    it('should extract function with parameters', async () => {
      const code = `
def greet(name: str, age: int = 25) -> str:
    return f"Hello {name}, age {age}"
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols).toHaveLength(1);
      const func = result.symbols[0];
      expect(func.name).toBe('greet');
      expect(func.kind).toBe(SymbolKind.Function);
      expect(func.signature).toContain('name: str');
      expect(func.signature).toContain('age: int = 25');
    });

    it('should extract function with docstring', async () => {
      const code = `
def documented_function():
    """This is a documented function.

    It does something important.
    """
    pass
`;

      const result = await extractor.extract(code, SupportedLanguage.Python, {
        includeDocumentation: true
      });

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].documentation).toContain('This is a documented function');
    });

    it('should skip documentation when option is false', async () => {
      const code = `
def documented_function():
    """This is documentation."""
    pass
`;

      const result = await extractor.extract(code, SupportedLanguage.Python, {
        includeDocumentation: false
      });

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].documentation).toBeUndefined();
    });
  });

  describe('class extraction', () => {
    it('should extract simple class', async () => {
      const code = `
class MyClass:
    pass
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        name: 'MyClass',
        kind: SymbolKind.Class,
        modifiers: [],
        exportKind: 'none'
      });
    });

    it('should extract class with methods', async () => {
      const code = `
class Calculator:
    def add(self, a: int, b: int) -> int:
        return a + b

    def subtract(self, a: int, b: int) -> int:
        return a - b
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols).toHaveLength(1);
      const cls = result.symbols[0];
      expect(cls.name).toBe('Calculator');
      expect(cls.kind).toBe(SymbolKind.Class);
      expect(cls.children).toHaveLength(2);

      expect(cls.children![0]).toMatchObject({
        name: 'add',
        kind: SymbolKind.Method
      });

      expect(cls.children![1]).toMatchObject({
        name: 'subtract',
        kind: SymbolKind.Method
      });
    });

    it('should extract class with properties', async () => {
      const code = `
class Person:
    def __init__(self, name: str):
        self.name = name
        self.age = 0
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols).toHaveLength(1);
      const cls = result.symbols[0];
      expect(cls.name).toBe('Person');
      expect(cls.kind).toBe(SymbolKind.Class);
      expect(cls.children).toHaveLength(3); // __init__ method + 2 properties
    });

    it('should extract class with decorators', async () => {
      const code = `
@dataclass
class DataClass:
    name: str
    value: int = 0
`;

      const result = await extractor.extract(code, SupportedLanguage.Python, {
        includeDecorators: true
      });

      expect(result.symbols).toHaveLength(1);
      const cls = result.symbols[0];
      expect(cls.name).toBe('DataClass');
      expect(cls.kind).toBe(SymbolKind.Class);
    });
  });

  describe('variable extraction', () => {
    it('should extract constants (uppercase variables)', async () => {
      const code = `
MAX_SIZE = 100
API_KEY = "secret"
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols).toHaveLength(2);
      expect(result.symbols[0]).toMatchObject({
        name: 'MAX_SIZE',
        kind: SymbolKind.Constant
      });
      expect(result.symbols[1]).toMatchObject({
        name: 'API_KEY',
        kind: SymbolKind.Constant
      });
    });

    it('should extract variables (lowercase)', async () => {
      const code = `
user_name = "john"
counter = 0
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols).toHaveLength(2);
      expect(result.symbols[0]).toMatchObject({
        name: 'user_name',
        kind: SymbolKind.Variable
      });
      expect(result.symbols[1]).toMatchObject({
        name: 'counter',
        kind: SymbolKind.Variable
      });
    });

    it('should extract typed variables', async () => {
      const code = `
name: str = "John"
age: int = 25
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols).toHaveLength(2);
      expect(result.symbols[0].typeAnnotation).toBe(': str');
      expect(result.symbols[1].typeAnnotation).toBe(': int');
    });
  });

  describe('import extraction', () => {
    it('should extract imports when option is enabled', async () => {
      const code = `
import os
from sys import argv
from typing import List, Dict
`;

      const result = await extractor.extract(code, SupportedLanguage.Python, {
        includeImports: true
      });

      const imports = result.symbols.filter(s => s.kind === SymbolKind.Import || s.kind === SymbolKind.ImportFrom);
      expect(imports.length).toBeGreaterThan(0);
    });

    it('should skip imports when option is disabled', async () => {
      const code = `
import os
from sys import argv
`;

      const result = await extractor.extract(code, SupportedLanguage.Python, {
        includeImports: false
      });

      const imports = result.symbols.filter(s => s.kind === SymbolKind.Import || s.kind === SymbolKind.ImportFrom);
      expect(imports).toHaveLength(0);
    });
  });

  describe('decorator extraction', () => {
    it('should extract method decorators', async () => {
      const code = `
class MyClass:
    @property
    def value(self):
        return self._value

    @staticmethod
    def static_method():
        pass

    @classmethod
    def class_method(cls):
        pass
`;

      const result = await extractor.extract(code, SupportedLanguage.Python, {
        includeDecorators: true
      });

      expect(result.symbols).toHaveLength(1);
      const cls = result.symbols[0];
      expect(cls.children).toHaveLength(3);

      expect(cls.children![0].modifiers).toContain('property');
      expect(cls.children![1].modifiers).toContain('staticmethod');
      expect(cls.children![2].modifiers).toContain('classmethod');
    });
  });

  describe('filtering options', () => {
    it('should filter by symbol kinds', async () => {
      const code = `
class MyClass:
    def method(self):
        pass

def function():
    pass

variable = 42
`;

      const result = await extractor.extract(code, SupportedLanguage.Python, {
        symbolKinds: [SymbolKind.Function]
      });

      // Should only extract the function, not the class or variable
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].kind).toBe(SymbolKind.Function);
    });

    it('should respect max depth option', async () => {
      const code = `
class OuterClass:
    def method(self):
        pass

    class InnerClass:
        def inner_method(self):
            pass
`;

      const result = await extractor.extract(code, SupportedLanguage.Python, {
        maxDepth: 1
      });

      expect(result.symbols).toHaveLength(1);
      const outerClass = result.symbols[0];
      expect(outerClass.children).toBeDefined();

      // Inner class should have no children due to depth limit
      const innerClass = outerClass.children!.find(c => c.kind === SymbolKind.Class);
      expect(innerClass).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle syntax errors gracefully', async () => {
      const code = `
def invalid_function(
    # Missing closing parenthesis
    pass
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.hasErrors).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
      // Should still extract what it can
    });

    it('should handle empty code', async () => {
      const result = await extractor.extract('', SupportedLanguage.Python);

      expect(result.symbols).toHaveLength(0);
      expect(result.hasErrors).toBe(false);
    });

    it('should handle whitespace-only code', async () => {
      const result = await extractor.extract('   \n  \n  ', SupportedLanguage.Python);

      expect(result.symbols).toHaveLength(0);
      expect(result.hasErrors).toBe(false);
    });
  });

  describe('extraction metadata', () => {
    it('should include extraction time', async () => {
      const result = await extractor.extract('def test(): pass', SupportedLanguage.Python);

      expect(result.extractionTimeMs).toBeGreaterThan(0);
      expect(typeof result.extractionTimeMs).toBe('number');
    });

    it('should include symbol count', async () => {
      const code = `
def func1(): pass
def func2(): pass
class MyClass:
    def method(self): pass
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbolCount).toBeGreaterThan(0);
      expect(typeof result.symbolCount).toBe('number');
    });

    it('should include language information', async () => {
      const result = await extractor.extract('x = 1', SupportedLanguage.Python);

      expect(result.language).toBe(SupportedLanguage.Python);
    });
  });

  describe('file extraction', () => {
    it('should extract from file path', async () => {
      // This would require creating a temporary file
      // For now, we'll test that it rejects non-existent files
      await expect(
        extractor.extractFromFile('/nonexistent/file.py')
      ).rejects.toThrow();
    });
  });
});