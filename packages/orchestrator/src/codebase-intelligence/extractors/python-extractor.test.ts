/**
 * Tests for PythonExtractor
 *
 * Comprehensive test suite for Python symbol extraction functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PythonExtractor, getPythonExtractor } from './python-extractor.js';
import {
  SupportedLanguage,
  SymbolKind,
  ExtractionError,
  DEFAULT_EXTRACTION_OPTIONS,
  type ExtractionOptions,
  type ExtractedSymbol
} from './types.js';

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

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const extractor1 = PythonExtractor.getInstance();
      const extractor2 = PythonExtractor.getInstance();
      expect(extractor1).toBe(extractor2);
    });

    it('should return the same instance via convenience function', () => {
      const extractor1 = getPythonExtractor();
      const extractor2 = getPythonExtractor();
      expect(extractor1).toBe(extractor2);
    });

    it('should create new instance after reset', () => {
      const extractor1 = PythonExtractor.getInstance();
      PythonExtractor.resetInstance();
      const extractor2 = PythonExtractor.getInstance();
      expect(extractor1).not.toBe(extractor2);
    });
  });

  describe('Language Validation', () => {
    it('should reject non-Python languages', async () => {
      const code = 'function test() {}';
      await expect(
        extractor.extract(code, 'javascript' as SupportedLanguage)
      ).rejects.toThrow(ExtractionError);

      await expect(
        extractor.extract(code, 'javascript' as SupportedLanguage)
      ).rejects.toThrow('PythonExtractor only supports Python');
    });

    it('should accept Python language', async () => {
      const code = 'def test_function(): pass';
      await expect(
        extractor.extract(code, SupportedLanguage.Python)
      ).resolves.not.toThrow();
    });
  });

  describe('Basic Function Extraction', () => {
    it('should extract simple function', async () => {
      const code = `
def hello_world():
    """Simple greeting function."""
    print("Hello, World!")
    return "Hello"
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols).toHaveLength(1);

      const func = result.symbols[0];
      expect(func.name).toBe('hello_world');
      expect(func.kind).toBe(SymbolKind.Function);
      expect(func.exportKind).toBe('none');
      expect(func.modifiers).toEqual([]);
      expect(func.documentation).toBe('Simple greeting function.');
    });

    it('should extract function with parameters', async () => {
      const code = `
def greet_person(name: str, age: int = 25) -> str:
    return f"Hello {name}, you are {age} years old"
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols).toHaveLength(1);

      const func = result.symbols[0];
      expect(func.name).toBe('greet_person');
      expect(func.kind).toBe(SymbolKind.Function);
      expect(func.children).toBeDefined();
      expect(func.children!.length).toBeGreaterThan(0);

      // Check parameters
      const params = func.children!.filter(child => child.kind === SymbolKind.Parameter);
      expect(params).toHaveLength(2);

      expect(params[0].name).toBe('name');
      expect(params[0].typeAnnotation).toBe('str');

      expect(params[1].name).toBe('age');
      expect(params[1].typeAnnotation).toBe('int');
    });

    it('should extract async function', async () => {
      const code = `
async def fetch_data(url: str) -> dict:
    """Asynchronously fetch data from URL."""
    # Implementation would go here
    return {}
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols).toHaveLength(1);

      const func = result.symbols[0];
      expect(func.name).toBe('fetch_data');
      expect(func.kind).toBe(SymbolKind.Function);
      expect(func.modifiers).toContain('async');
      expect(func.documentation).toBe('Asynchronously fetch data from URL.');
    });

    it('should extract function with decorators', async () => {
      const code = `
@property
def my_property(self):
    return self._value

@classmethod
def create_instance(cls, data):
    return cls(data)

@staticmethod
def utility_function(x, y):
    return x + y
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols).toHaveLength(3);

      const propertyFunc = result.symbols[0];
      expect(propertyFunc.name).toBe('my_property');
      expect(propertyFunc.modifiers).toContain('property');

      const classmethodFunc = result.symbols[1];
      expect(classmethodFunc.name).toBe('create_instance');
      expect(classmethodFunc.modifiers).toContain('classmethod');

      const staticmethodFunc = result.symbols[2];
      expect(staticmethodFunc.name).toBe('utility_function');
      expect(staticmethodFunc.modifiers).toContain('staticmethod');
    });
  });

  describe('Class Extraction', () => {
    it('should extract simple class', async () => {
      const code = `
class SimpleClass:
    """A simple class example."""
    pass
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols).toHaveLength(1);

      const cls = result.symbols[0];
      expect(cls.name).toBe('SimpleClass');
      expect(cls.kind).toBe(SymbolKind.Class);
      expect(cls.documentation).toBe('A simple class example.');
    });

    it('should extract class with methods and properties', async () => {
      const code = `
class Person:
    """A person class with various methods."""

    def __init__(self, name: str, age: int):
        """Initialize a new Person."""
        self.name = name
        self.age = age

    def greet(self) -> str:
        """Return a greeting."""
        return f"Hello, I'm {self.name}"

    @property
    def is_adult(self) -> bool:
        """Check if person is an adult."""
        return self.age >= 18

    @classmethod
    def from_dict(cls, data: dict):
        """Create person from dictionary."""
        return cls(data['name'], data['age'])
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols).toHaveLength(1);

      const cls = result.symbols[0];
      expect(cls.name).toBe('Person');
      expect(cls.kind).toBe(SymbolKind.Class);
      expect(cls.documentation).toBe('A person class with various methods.');
      expect(cls.children).toBeDefined();
      expect(cls.children!.length).toBe(4); // __init__, greet, is_adult, from_dict

      // Check constructor
      const constructor = cls.children!.find(child => child.name === '__init__');
      expect(constructor).toBeDefined();
      expect(constructor!.kind).toBe(SymbolKind.Method);

      // Check regular method
      const greetMethod = cls.children!.find(child => child.name === 'greet');
      expect(greetMethod).toBeDefined();
      expect(greetMethod!.kind).toBe(SymbolKind.Method);

      // Check property
      const propertyMethod = cls.children!.find(child => child.name === 'is_adult');
      expect(propertyMethod).toBeDefined();
      expect(propertyMethod!.modifiers).toContain('property');

      // Check classmethod
      const classmethodMethod = cls.children!.find(child => child.name === 'from_dict');
      expect(classmethodMethod).toBeDefined();
      expect(classmethodMethod!.modifiers).toContain('classmethod');
    });

    it('should extract class with class variables', async () => {
      const code = `
class Configuration:
    """Configuration class with class variables."""

    DEBUG = True
    VERSION = "1.0.0"
    MAX_CONNECTIONS = 100

    def __init__(self):
        self.instance_var = "instance"
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols).toHaveLength(1);

      const cls = result.symbols[0];
      expect(cls.name).toBe('Configuration');
      expect(cls.children).toBeDefined();

      // Should have class variables and constructor
      const classVars = cls.children!.filter(child => child.kind === SymbolKind.Property);
      const methods = cls.children!.filter(child => child.kind === SymbolKind.Method);

      expect(classVars.length).toBeGreaterThanOrEqual(3);
      expect(methods.length).toBe(1); // __init__
    });
  });

  describe('Variable and Constant Extraction', () => {
    it('should extract variables and constants', async () => {
      const code = `
# Constants (uppercase naming convention)
DEBUG_MODE = True
API_URL = "https://api.example.com"
MAX_RETRIES = 3

# Variables (lowercase naming convention)
current_user = None
connection_pool = []
is_authenticated = False
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols.length).toBeGreaterThanOrEqual(6);

      // Check constants (uppercase names)
      const constants = result.symbols.filter(s => s.kind === SymbolKind.Constant);
      const variables = result.symbols.filter(s => s.kind === SymbolKind.Variable);

      expect(constants.length).toBeGreaterThanOrEqual(3);
      expect(variables.length).toBeGreaterThanOrEqual(3);

      // Verify naming convention detection
      const debugConstant = constants.find(c => c.name === 'DEBUG_MODE');
      expect(debugConstant).toBeDefined();

      const userVariable = variables.find(v => v.name === 'current_user');
      expect(userVariable).toBeDefined();
    });

    it('should extract type-annotated variables', async () => {
      const code = `
name: str = "John"
age: int = 30
scores: list[int] = [1, 2, 3]
config: dict[str, any] = {}
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbols.length).toBe(4);

      const nameVar = result.symbols.find(s => s.name === 'name');
      expect(nameVar).toBeDefined();
      expect(nameVar!.typeAnnotation).toBe('str');

      const scoresVar = result.symbols.find(s => s.name === 'scores');
      expect(scoresVar).toBeDefined();
      expect(scoresVar!.typeAnnotation).toBe('list[int]');
    });
  });

  describe('Import Extraction', () => {
    it('should extract import statements when enabled', async () => {
      const code = `
import os
import sys
from typing import List, Dict
from pathlib import Path
`;

      const options: ExtractionOptions = {
        ...DEFAULT_EXTRACTION_OPTIONS,
        includeImports: true
      };

      const result = await extractor.extract(code, SupportedLanguage.Python, options);

      const imports = result.symbols.filter(s =>
        s.kind === SymbolKind.Import || s.kind === SymbolKind.ImportFrom
      );

      expect(imports.length).toBeGreaterThanOrEqual(2);

      const osImport = imports.find(i => i.name?.includes('os'));
      expect(osImport).toBeDefined();
      expect(osImport!.kind).toBe(SymbolKind.Import);
    });

    it('should not extract imports when disabled', async () => {
      const code = `
import os
from typing import List

def test_function():
    pass
`;

      const options: ExtractionOptions = {
        ...DEFAULT_EXTRACTION_OPTIONS,
        includeImports: false
      };

      const result = await extractor.extract(code, SupportedLanguage.Python, options);

      const imports = result.symbols.filter(s =>
        s.kind === SymbolKind.Import || s.kind === SymbolKind.ImportFrom
      );

      expect(imports.length).toBe(0);

      // Should still have the function
      const functions = result.symbols.filter(s => s.kind === SymbolKind.Function);
      expect(functions.length).toBe(1);
    });
  });

  describe('Extraction Options', () => {
    it('should respect maxDepth option', async () => {
      const code = `
class OuterClass:
    def outer_method(self):
        def inner_function():
            def deeply_nested():
                pass
            return deeply_nested
        return inner_function
`;

      // Test with maxDepth = 1 (should get class and method, but not nested functions)
      const result1 = await extractor.extract(code, SupportedLanguage.Python, { maxDepth: 1 });

      expect(result1.symbols).toHaveLength(1);

      const cls = result1.symbols[0];
      expect(cls.name).toBe('OuterClass');
      expect(cls.children).toBeDefined();
      expect(cls.children!.length).toBe(1); // Just outer_method

      // Test with maxDepth = 0 (should get class only, no children)
      const result2 = await extractor.extract(code, SupportedLanguage.Python, { maxDepth: 0 });

      expect(result2.symbols).toHaveLength(1);
      const cls2 = result2.symbols[0];
      expect(cls2.children).toEqual([]);
    });

    it('should respect symbolKinds filter', async () => {
      const code = `
DEBUG = True

class TestClass:
    pass

def test_function():
    pass
`;

      // Only extract functions
      const result1 = await extractor.extract(code, SupportedLanguage.Python, {
        symbolKinds: [SymbolKind.Function]
      });

      expect(result1.symbols).toHaveLength(1);
      expect(result1.symbols[0].kind).toBe(SymbolKind.Function);
      expect(result1.symbols[0].name).toBe('test_function');

      // Only extract classes
      const result2 = await extractor.extract(code, SupportedLanguage.Python, {
        symbolKinds: [SymbolKind.Class]
      });

      expect(result2.symbols).toHaveLength(1);
      expect(result2.symbols[0].kind).toBe(SymbolKind.Class);
      expect(result2.symbols[0].name).toBe('TestClass');
    });

    it('should control documentation extraction', async () => {
      const code = `
def documented_function():
    """This function has documentation."""
    pass
`;

      // With documentation
      const result1 = await extractor.extract(code, SupportedLanguage.Python, {
        includeDocumentation: true
      });

      expect(result1.symbols[0].documentation).toBe('This function has documentation.');

      // Without documentation
      const result2 = await extractor.extract(code, SupportedLanguage.Python, {
        includeDocumentation: false
      });

      expect(result2.symbols[0].documentation).toBeUndefined();
    });

    it('should control decorator extraction', async () => {
      const code = `
@property
def test_property(self):
    return self._value
`;

      // With decorators
      const result1 = await extractor.extract(code, SupportedLanguage.Python, {
        includeDecorators: true
      });

      expect(result1.symbols[0].modifiers).toContain('property');

      // Without decorators
      const result2 = await extractor.extract(code, SupportedLanguage.Python, {
        includeDecorators: false
      });

      expect(result2.symbols[0].modifiers).not.toContain('property');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid Python syntax gracefully', async () => {
      const invalidCode = `
def incomplete_function(
    # Missing closing parenthesis and colon
`;

      const result = await extractor.extract(invalidCode, SupportedLanguage.Python);

      // Should not throw, but should indicate errors
      expect(result.hasErrors).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle empty code', async () => {
      const result = await extractor.extract('', SupportedLanguage.Python);

      expect(result.symbols).toEqual([]);
      expect(result.hasErrors).toBe(false);
    });

    it('should handle whitespace-only code', async () => {
      const result = await extractor.extract('   \n\t  \n  ', SupportedLanguage.Python);

      expect(result.symbols).toEqual([]);
    });

    it('should throw ExtractionError for file system errors', async () => {
      await expect(
        extractor.extractFromFile('/non/existent/file.py')
      ).rejects.toThrow(ExtractionError);

      await expect(
        extractor.extractFromFile('/non/existent/file.py')
      ).rejects.toThrow('Failed to extract symbols from file');
    });
  });

  describe('Complex Code Examples', () => {
    it('should extract from realistic Python module', async () => {
      const code = `
"""
A sample Python module demonstrating various language features.
"""

import os
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from abc import ABC, abstractmethod

# Module-level constants
VERSION = "1.0.0"
DEBUG_ENABLED = False

# Type aliases
UserData = Dict[str, Any]
UserList = List['User']

@dataclass
class User:
    """Represents a user in the system."""

    id: int
    name: str
    email: str
    active: bool = True

    def __post_init__(self):
        """Validate user data after initialization."""
        if not self.email:
            raise ValueError("Email is required")

    @property
    def display_name(self) -> str:
        """Get the display name for the user."""
        return f"{self.name} ({self.email})"

    @classmethod
    def from_dict(cls, data: UserData) -> 'User':
        """Create a User instance from dictionary data."""
        return cls(
            id=data['id'],
            name=data['name'],
            email=data['email'],
            active=data.get('active', True)
        )

    def to_dict(self) -> UserData:
        """Convert user to dictionary representation."""
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'active': self.active
        }

class UserRepository(ABC):
    """Abstract base class for user repositories."""

    @abstractmethod
    async def get_user(self, user_id: int) -> Optional[User]:
        """Get a user by ID."""
        pass

    @abstractmethod
    async def save_user(self, user: User) -> None:
        """Save a user to the repository."""
        pass

class InMemoryUserRepository(UserRepository):
    """In-memory implementation of user repository."""

    def __init__(self):
        self._users: Dict[int, User] = {}

    async def get_user(self, user_id: int) -> Optional[User]:
        """Get a user by ID from memory."""
        return self._users.get(user_id)

    async def save_user(self, user: User) -> None:
        """Save a user to memory."""
        self._users[user.id] = user

async def create_sample_users() -> UserList:
    """Create some sample users for testing."""
    users = []

    for i in range(1, 4):
        user = User(
            id=i,
            name=f"User {i}",
            email=f"user{i}@example.com"
        )
        users.append(user)

    return users

def main() -> None:
    """Main function to demonstrate the module."""
    print(f"Module version: {VERSION}")

    # Create repository
    repo = InMemoryUserRepository()

    # This would normally use asyncio.run in a real application
    print("Sample users created successfully")

if __name__ == "__main__":
    main()
`;

      const result = await extractor.extract(code, SupportedLanguage.Python, {
        includeImports: true,
        includeDocumentation: true,
        includeDecorators: true
      });

      // Should extract multiple top-level symbols
      expect(result.symbols.length).toBeGreaterThan(5);

      // Check for constants
      const constants = result.symbols.filter(s => s.kind === SymbolKind.Constant);
      expect(constants.length).toBeGreaterThanOrEqual(2);

      // Check for classes
      const classes = result.symbols.filter(s => s.kind === SymbolKind.Class);
      expect(classes.length).toBeGreaterThanOrEqual(3);

      // Check User class specifically
      const userClass = classes.find(c => c.name === 'User');
      expect(userClass).toBeDefined();
      expect(userClass!.documentation).toBe('Represents a user in the system.');
      expect(userClass!.children).toBeDefined();
      expect(userClass!.children!.length).toBeGreaterThan(0);

      // Check for functions
      const functions = result.symbols.filter(s => s.kind === SymbolKind.Function);
      expect(functions.length).toBeGreaterThanOrEqual(2);

      // Check async function
      const asyncFunc = functions.find(f => f.modifiers.includes('async'));
      expect(asyncFunc).toBeDefined();

      // Check imports if included
      const imports = result.symbols.filter(s =>
        s.kind === SymbolKind.Import || s.kind === SymbolKind.ImportFrom
      );
      expect(imports.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Metadata', () => {
    it('should include extraction timing', async () => {
      const code = 'def simple_function(): pass';

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.extractionTimeMs).toBeGreaterThan(0);
      expect(typeof result.extractionTimeMs).toBe('number');
    });

    it('should include symbol count', async () => {
      const code = `
class TestClass:
    def method1(self): pass
    def method2(self): pass

def function1(): pass
def function2(): pass
`;

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.symbolCount).toBeGreaterThan(0);
      expect(typeof result.symbolCount).toBe('number');

      // Should count nested symbols too
      expect(result.symbolCount).toBeGreaterThanOrEqual(4); // 1 class + 2 methods + 2 functions
    });

    it('should identify language correctly', async () => {
      const code = 'def test(): pass';

      const result = await extractor.extract(code, SupportedLanguage.Python);

      expect(result.language).toBe(SupportedLanguage.Python);
    });

    it('should handle file path in extractFromFile', async () => {
      // This test would require creating a temporary file
      // For now, we'll test the error case
      const nonExistentFile = '/tmp/non_existent_test_file.py';

      await expect(
        extractor.extractFromFile(nonExistentFile)
      ).rejects.toThrow(ExtractionError);
    });
  });
});