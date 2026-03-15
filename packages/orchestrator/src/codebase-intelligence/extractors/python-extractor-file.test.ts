/**
 * Tests for PythonExtractor file operations
 *
 * Tests the extractFromFile method with actual Python files
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { PythonExtractor } from './python-extractor.js';
import {
  SupportedLanguage,
  SymbolKind,
  ExtractionError
} from './types.js';

describe('PythonExtractor File Operations', () => {
  let extractor: PythonExtractor;
  let tempDir: string;
  let tempFile: string;

  beforeEach(async () => {
    PythonExtractor.resetInstance();
    extractor = PythonExtractor.getInstance();

    // Create a temporary directory for test files
    tempDir = join(process.cwd(), 'temp-test-files');
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    PythonExtractor.resetInstance();

    // Clean up temporary files
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('extractFromFile', () => {
    it('should extract from simple Python file', async () => {
      const pythonCode = `
def hello_world():
    """Say hello to the world."""
    print("Hello, World!")
    return "Hello"

class Greeter:
    """A class for greeting people."""

    def __init__(self, name: str):
        self.name = name

    def greet(self) -> str:
        return f"Hello, {self.name}!"
`;

      tempFile = join(tempDir, 'test.py');
      await fs.writeFile(tempFile, pythonCode);

      const result = await extractor.extractFromFile(tempFile);

      expect(result.filePath).toBe(tempFile);
      expect(result.language).toBe(SupportedLanguage.Python);
      expect(result.symbols.length).toBe(2);
      expect(result.extractionTimeMs).toBeGreaterThan(0);

      const func = result.symbols.find(s => s.kind === SymbolKind.Function);
      expect(func).toBeDefined();
      expect(func!.name).toBe('hello_world');

      const cls = result.symbols.find(s => s.kind === SymbolKind.Class);
      expect(cls).toBeDefined();
      expect(cls!.name).toBe('Greeter');
    });

    it('should handle file with imports and complex structure', async () => {
      const pythonCode = `
import os
import sys
from typing import List, Dict, Optional
from dataclasses import dataclass

# Constants
VERSION = "1.0.0"
DEBUG = True

@dataclass
class User:
    """User data class."""
    id: int
    name: str
    active: bool = True

    def to_dict(self) -> Dict[str, any]:
        return {"id": self.id, "name": self.name, "active": self.active}

class UserManager:
    """Manages users."""

    def __init__(self):
        self.users: List[User] = []

    async def add_user(self, user: User) -> None:
        self.users.append(user)

    def find_active_users(self) -> List[User]:
        return [u for u in self.users if u.active]

def main():
    print(f"Version: {VERSION}")

if __name__ == "__main__":
    main()
`;

      tempFile = join(tempDir, 'complex_test.py');
      await fs.writeFile(tempFile, pythonCode);

      const result = await extractor.extractFromFile(tempFile, {
        includeImports: true,
        includeDocumentation: true,
        includeDecorators: true
      });

      expect(result.filePath).toBe(tempFile);
      expect(result.symbols.length).toBeGreaterThan(5);

      // Check for imports
      const imports = result.symbols.filter(s =>
        s.kind === SymbolKind.Import || s.kind === SymbolKind.ImportFrom
      );
      expect(imports.length).toBeGreaterThan(0);

      // Check for constants
      const constants = result.symbols.filter(s => s.kind === SymbolKind.Constant);
      expect(constants.length).toBeGreaterThanOrEqual(2);

      // Check for classes
      const classes = result.symbols.filter(s => s.kind === SymbolKind.Class);
      expect(classes.length).toBe(2);

      // Check for User class with dataclass decorator
      const userClass = classes.find(c => c.name === 'User');
      expect(userClass).toBeDefined();
      expect(userClass!.documentation).toBe('User data class.');

      // Check for UserManager class with methods
      const managerClass = classes.find(c => c.name === 'UserManager');
      expect(managerClass).toBeDefined();
      expect(managerClass!.children).toBeDefined();
      expect(managerClass!.children!.length).toBeGreaterThan(0);
    });

    it('should handle empty Python file', async () => {
      tempFile = join(tempDir, 'empty.py');
      await fs.writeFile(tempFile, '');

      const result = await extractor.extractFromFile(tempFile);

      expect(result.filePath).toBe(tempFile);
      expect(result.symbols).toEqual([]);
      expect(result.hasErrors).toBe(false);
    });

    it('should handle file with syntax errors', async () => {
      const invalidCode = `
def valid_function():
    return "valid"

def invalid_function(
    # Missing closing parenthesis and colon

class IncompleteClass
    # Missing colon
    pass

def another_valid_function():
    return "also valid"
`;

      tempFile = join(tempDir, 'invalid.py');
      await fs.writeFile(tempFile, invalidCode);

      const result = await extractor.extractFromFile(tempFile);

      expect(result.filePath).toBe(tempFile);
      expect(result.hasErrors).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);

      // Should still extract valid symbols
      expect(result.symbols.length).toBeGreaterThanOrEqual(1);
    });

    it('should throw ExtractionError for non-existent file', async () => {
      const nonExistentFile = join(tempDir, 'does-not-exist.py');

      await expect(extractor.extractFromFile(nonExistentFile))
        .rejects.toThrow(ExtractionError);

      await expect(extractor.extractFromFile(nonExistentFile))
        .rejects.toThrow('Failed to extract symbols from file');
    });

    it('should handle file with unusual encoding', async () => {
      const unicodeCode = `# -*- coding: utf-8 -*-
"""
Module with unicode characters: ñáéíóú
"""

def función_española(parámetro: str) -> str:
    """Función con caracteres especiales."""
    return f"¡Hola {parámetro}!"

class ClaseEspañola:
    """Clase con nombre en español."""

    def método_especial(self) -> str:
        return "¡Método especial!"
`;

      tempFile = join(tempDir, 'unicode_test.py');
      await fs.writeFile(tempFile, unicodeCode, 'utf8');

      const result = await extractor.extractFromFile(tempFile, {
        includeDocumentation: true
      });

      expect(result.filePath).toBe(tempFile);
      expect(result.symbols.length).toBe(2);

      const func = result.symbols.find(s => s.kind === SymbolKind.Function);
      expect(func).toBeDefined();
      expect(func!.name).toBe('función_española');
      expect(func!.documentation).toBe('Función con caracteres especiales.');

      const cls = result.symbols.find(s => s.kind === SymbolKind.Class);
      expect(cls).toBeDefined();
      expect(cls!.name).toBe('ClaseEspañola');
      expect(cls!.children).toBeDefined();
      expect(cls!.children!.length).toBe(1);
    });

    it('should preserve extraction options in file operations', async () => {
      const codeWithDecorators = `
@property
def my_property(self):
    """A property."""
    return self._value

@classmethod
def create_instance(cls, data):
    """Create an instance."""
    return cls(data)
`;

      tempFile = join(tempDir, 'decorators.py');
      await fs.writeFile(tempFile, codeWithDecorators);

      // Test with decorators enabled
      const resultWithDecorators = await extractor.extractFromFile(tempFile, {
        includeDecorators: true
      });

      const propertyFunc = resultWithDecorators.symbols.find(s => s.name === 'my_property');
      expect(propertyFunc!.modifiers).toContain('property');

      // Test with decorators disabled
      const resultWithoutDecorators = await extractor.extractFromFile(tempFile, {
        includeDecorators: false
      });

      const propertyFuncNoDecorators = resultWithoutDecorators.symbols.find(s => s.name === 'my_property');
      expect(propertyFuncNoDecorators!.modifiers).not.toContain('property');
    });
  });

  describe('Performance with Files', () => {
    it('should handle large Python file efficiently', async () => {
      // Generate a large Python file
      const functions = Array.from({ length: 50 }, (_, i) => `
def function_${i}(param_${i}: int) -> str:
    """Function number ${i}."""
    return f"Function {i} called with {param_${i}}"
`).join('\n');

      const classes = Array.from({ length: 30 }, (_, i) => `
class Class${i}:
    """Class number ${i}."""

    def __init__(self, value: int):
        self.value = value

    def get_value(self) -> int:
        return self.value

    def process(self) -> str:
        return f"Class{i} processed with value {self.value}"
`).join('\n');

      const largeFile = `#!/usr/bin/env python3
"""Large Python file for performance testing."""

${functions}

${classes}

def main():
    print("Large file main function")

if __name__ == "__main__":
    main()
`;

      tempFile = join(tempDir, 'large_file.py');
      await fs.writeFile(tempFile, largeFile);

      const startTime = performance.now();
      const result = await extractor.extractFromFile(tempFile);
      const endTime = performance.now();

      expect(result.filePath).toBe(tempFile);
      expect(result.symbols.length).toBeGreaterThan(80); // 50 functions + 30 classes + 1 main
      expect(result.symbolCount).toBeGreaterThan(200); // Including nested methods
      expect(endTime - startTime).toBeLessThan(3000); // Should complete in less than 3 seconds
    });
  });
});