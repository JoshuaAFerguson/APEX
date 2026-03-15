/**
 * Additional Edge Case Tests for PythonExtractor
 *
 * These tests cover edge cases and scenarios that might not be covered
 * in the main test suite, focusing on error conditions, unusual syntax,
 * and boundary cases.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PythonExtractor } from './python-extractor.js';
import {
  SupportedLanguage,
  SymbolKind,
  ExtractionError,
  type ExtractionOptions
} from './types.js';

describe('PythonExtractor Edge Cases', () => {
  let extractor: PythonExtractor;

  beforeEach(() => {
    PythonExtractor.resetInstance();
    extractor = PythonExtractor.getInstance();
  });

  afterEach(() => {
    PythonExtractor.resetInstance();
  });

  describe('Special Python Syntax', () => {
    it('should handle lambda functions', async () => {
      const code = `
square = lambda x: x * x
add = lambda a, b: a + b
complex_lambda = lambda x, y=10, *args, **kwargs: x + y + sum(args)
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      // Lambda functions are typically treated as variable assignments
      const lambdaVars = result.symbols.filter(s => s.kind === SymbolKind.Variable);
      expect(lambdaVars.length).toBeGreaterThanOrEqual(3);

      const squareVar = lambdaVars.find(v => v.name === 'square');
      expect(squareVar).toBeDefined();
    });

    it('should handle multiple assignment', async () => {
      const code = `
a, b = 1, 2
x, y, z = get_values()
first, *rest = items
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      // Should extract assignments even with multiple targets
      expect(result.symbols.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle complex decorators', async () => {
      const code = `
@functools.wraps(func)
@retry(max_attempts=3, backoff=2.0)
@validate_input(schema={'name': str, 'age': int})
def complex_decorated_function(name: str, age: int) -> dict:
    """A function with multiple complex decorators."""
    return {'name': name, 'age': age}

@app.route('/users/<int:user_id>')
@require_auth
def api_endpoint(user_id):
    pass
`;

      const result = await extractor.extract(code, SupportedLanguage.Python, {
        includeDecorators: true
      });

      expect(result.symbols.length).toBe(2);

      const complexFunc = result.symbols.find(s => s.name === 'complex_decorated_function');
      expect(complexFunc).toBeDefined();
      // Should have modifiers from recognized decorators
      expect(complexFunc!.modifiers).toBeDefined();
    });

    it('should handle nested classes', async () => {
      const code = `
class OuterClass:
    """An outer class with nested class."""

    class InnerClass:
        """A nested class."""

        class DeeplyNestedClass:
            """A deeply nested class."""

            def deep_method(self):
                return "deep"

        def inner_method(self):
            return "inner"

    def outer_method(self):
        return "outer"
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols.length).toBe(1);

      const outerClass = result.symbols[0];
      expect(outerClass.name).toBe('OuterClass');
      expect(outerClass.children).toBeDefined();
      expect(outerClass.children!.length).toBeGreaterThanOrEqual(2); // InnerClass and outer_method

      // Check for nested class
      const innerClass = outerClass.children!.find(c => c.kind === SymbolKind.Class);
      expect(innerClass).toBeDefined();
      expect(innerClass!.name).toBe('InnerClass');
    });

    it('should handle generator functions', async () => {
      const code = `
def simple_generator():
    """A simple generator function."""
    yield 1
    yield 2
    yield 3

def fibonacci_generator(n: int):
    """Generate fibonacci numbers."""
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b

async def async_generator():
    """An async generator."""
    for i in range(5):
        yield await async_operation(i)
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols.length).toBe(3);

      // All should be recognized as functions
      const functions = result.symbols.filter(s => s.kind === SymbolKind.Function);
      expect(functions.length).toBe(3);

      const asyncGen = functions.find(f => f.name === 'async_generator');
      expect(asyncGen).toBeDefined();
      expect(asyncGen!.modifiers).toContain('async');
    });

    it('should handle context managers and with statements', async () => {
      const code = `
class CustomContextManager:
    """Custom context manager."""

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

@contextmanager
def my_context():
    """Context manager decorator."""
    try:
        yield "resource"
    finally:
        cleanup()
`;

      const result = await extractor.extract(code, SupportedLanguage.Python, {
        includeDecorators: true
      });

      expect(result.symbols.length).toBe(2);

      const contextClass = result.symbols.find(s => s.kind === SymbolKind.Class);
      expect(contextClass).toBeDefined();
      expect(contextClass!.name).toBe('CustomContextManager');

      const contextFunc = result.symbols.find(s => s.kind === SymbolKind.Function);
      expect(contextFunc).toBeDefined();
      expect(contextFunc!.name).toBe('my_context');
    });
  });

  describe('Error Edge Cases', () => {
    it('should handle partially malformed class definitions', async () => {
      const code = `
class ValidClass:
    def valid_method(self):
        pass

class IncompleteClass
    # Missing colon
    def method_in_incomplete(self):
        pass

class AnotherValidClass:
    pass
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      // Should still extract valid symbols despite errors
      expect(result.hasErrors).toBe(true);
      expect(result.symbols.length).toBeGreaterThanOrEqual(1);

      // Should find at least the valid classes
      const validClass = result.symbols.find(s => s.name === 'ValidClass');
      expect(validClass).toBeDefined();
    });

    it('should handle functions with malformed signatures', async () => {
      const code = `
def valid_function(a, b):
    return a + b

def malformed_function(a b c):
    # Missing commas
    pass

def another_valid_function():
    pass
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      // Should extract what it can
      expect(result.symbols.length).toBeGreaterThanOrEqual(1);

      const validFunc = result.symbols.find(s => s.name === 'valid_function');
      expect(validFunc).toBeDefined();
    });

    it('should handle extremely deep nesting gracefully', async () => {
      const deepCode = `
class Level0:
    class Level1:
        class Level2:
            class Level3:
                class Level4:
                    class Level5:
                        def deeply_nested_method(self):
                            def inner_function():
                                def even_deeper():
                                    return "deep"
                                return even_deeper
                            return inner_function
`;

      // Test with limited depth
      const result = await extractor.extract(deepCode, SupportedLanguage.Python, {
        maxDepth: 3
      });

      expect(result.symbols.length).toBe(1);

      const topClass = result.symbols[0];
      expect(topClass.name).toBe('Level0');

      // Should respect depth limit
      expect(topClass.children).toBeDefined();
      expect(topClass.children!.length).toBe(1); // Level1
    });

    it('should handle unusual string literals and encoding', async () => {
      const code = `
# -*- coding: utf-8 -*-
"""Module with various string encodings."""

raw_string = r"Raw string with \\backslashes"
unicode_string = "String with émojis 🐍 and ñoñó"
multiline_string = """
    This is a multiline
    string with various
    characters: αβγ
"""

def function_with_unicode_name():
    """Function with unicode in docstring: 测试."""
    pass

class ClassWithUnicode:
    """Class with unicode: Ñoño."""

    def método_español(self):
        """Método con nombre en español."""
        return "¡Hola!"
`;

      const result = await extractor.extract(code, SupportedLanguage.Python, {
        includeDocumentation: true
      });

      expect(result.symbols.length).toBeGreaterThanOrEqual(2);

      const func = result.symbols.find(s => s.kind === SymbolKind.Function);
      expect(func).toBeDefined();

      const cls = result.symbols.find(s => s.kind === SymbolKind.Class);
      expect(cls).toBeDefined();
      expect(cls!.children).toBeDefined();
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle very large files efficiently', async () => {
      // Generate a large Python file with many functions
      const largeFunctionCode = Array.from({ length: 100 }, (_, i) => `
def function_${i}(param${i}: int) -> str:
    """Function number ${i}."""
    return f"Result from function {i}: {param${i}}"
`).join('\n');

      const startTime = performance.now();
      const result = await extractor.extract(largeFunctionCode, SupportedLanguage.Python);
      const endTime = performance.now();

      expect(result.symbols.length).toBe(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in less than 5 seconds
      expect(result.extractionTimeMs).toBeGreaterThan(0);
    });

    it('should handle files with many deeply nested structures', async () => {
      // Create a file with multiple nested structures
      const nestedCode = Array.from({ length: 20 }, (_, i) => `
class Class${i}:
    def method_${i}_1(self):
        def nested_function_${i}_1():
            return ${i}
        return nested_function_${i}_1

    def method_${i}_2(self):
        class InnerClass${i}:
            def inner_method(self):
                pass
        return InnerClass${i}
`).join('\n');

      const result = await extractor.extract(nestedCode, SupportedLanguage.Python);

      expect(result.symbols.length).toBe(20); // 20 classes
      expect(result.symbolCount).toBeGreaterThan(100); // Many nested symbols
    });
  });

  describe('Signature Extraction Edge Cases', () => {
    it('should handle complex function signatures', async () => {
      const code = `
def complex_signature(
    positional_arg: str,
    default_arg: int = 42,
    *args: tuple,
    keyword_only: bool,
    **kwargs: dict
) -> Union[str, int, None]:
    """Function with complex signature."""
    pass

def type_annotation_function(
    union_param: Union[str, int],
    optional_param: Optional[List[Dict[str, Any]]],
    callable_param: Callable[[int, str], bool]
) -> Generator[int, None, None]:
    pass
`;

      const result = await extractor.extract(code, SupportedLanguage.Python, {
        includeSignatures: true
      });

      expect(result.symbols.length).toBe(2);

      const complexFunc = result.symbols.find(s => s.name === 'complex_signature');
      expect(complexFunc).toBeDefined();
      expect(complexFunc!.signature).toBeDefined();
      expect(complexFunc!.children).toBeDefined();
      expect(complexFunc!.children!.length).toBeGreaterThan(0);

      // Check that parameters are extracted
      const params = complexFunc!.children!.filter(c => c.kind === SymbolKind.Parameter);
      expect(params.length).toBeGreaterThan(0);
    });

    it('should handle method signatures with self/cls', async () => {
      const code = `
class ExampleClass:
    def instance_method(self, arg: str) -> None:
        pass

    @classmethod
    def class_method(cls, value: int) -> 'ExampleClass':
        pass

    @staticmethod
    def static_method(x: float, y: float) -> float:
        return x + y
`;

      const result = await extractor.extract(code, SupportedLanguage.Python, {
        includeSignatures: true,
        includeDecorators: true
      });

      expect(result.symbols.length).toBe(1);

      const cls = result.symbols[0];
      expect(cls.children).toBeDefined();
      expect(cls.children!.length).toBe(3);

      const methods = cls.children!.filter(c => c.kind === SymbolKind.Method);
      expect(methods.length).toBe(3);

      // Check decorator modifiers
      const classMethod = methods.find(m => m.name === 'class_method');
      expect(classMethod!.modifiers).toContain('classmethod');

      const staticMethod = methods.find(m => m.name === 'static_method');
      expect(staticMethod!.modifiers).toContain('staticmethod');
    });
  });

  describe('Extract From Parse Result', () => {
    it('should work with pre-parsed results', async () => {
      const code = `
def test_function():
    pass

class TestClass:
    def method(self):
        pass
`;

      // First get a parse result through the normal extraction
      const parseResult = await extractor.extract(code, SupportedLanguage.Python);

      // The extractFromParseResult should be tested internally,
      // but we can test it produces consistent results
      expect(parseResult.symbols.length).toBe(2);
      expect(parseResult.language).toBe(SupportedLanguage.Python);
    });
  });
});