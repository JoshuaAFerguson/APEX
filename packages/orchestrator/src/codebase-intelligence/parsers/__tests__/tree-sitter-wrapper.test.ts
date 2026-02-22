/**
 * Tests for TreeSitterWrapper
 *
 * Verifies:
 * - Multi-language parsing (TypeScript, JavaScript, Python, Go, Java, Rust)
 * - Language detection from file extensions
 * - Error handling and collection
 * - Singleton pattern and caching
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TreeSitterWrapper,
  SupportedLanguage,
  ParserError,
  UnsupportedLanguageError,
  getTreeSitterWrapper,
  getLanguageForExtension,
  isExtensionSupported,
  getSupportedExtensions
} from '../index.js';

describe('TreeSitterWrapper', () => {
  let wrapper: TreeSitterWrapper;

  beforeEach(() => {
    // Reset singleton before each test
    TreeSitterWrapper.resetInstance();
    wrapper = TreeSitterWrapper.getInstance();
  });

  afterEach(() => {
    wrapper.clearCache();
    TreeSitterWrapper.resetInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = TreeSitterWrapper.getInstance();
      const instance2 = TreeSitterWrapper.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should provide a convenience function', () => {
      const instance = getTreeSitterWrapper();
      expect(instance).toBe(TreeSitterWrapper.getInstance());
    });

    it('should create new instance after reset', () => {
      const instance1 = TreeSitterWrapper.getInstance();
      TreeSitterWrapper.resetInstance();
      const instance2 = TreeSitterWrapper.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Language Detection', () => {
    it('should detect TypeScript files', () => {
      expect(wrapper.detectLanguage('file.ts')).toBe(SupportedLanguage.TypeScript);
      expect(wrapper.detectLanguage('/path/to/file.ts')).toBe(SupportedLanguage.TypeScript);
      expect(wrapper.detectLanguage('file.mts')).toBe(SupportedLanguage.TypeScript);
      expect(wrapper.detectLanguage('file.cts')).toBe(SupportedLanguage.TypeScript);
    });

    it('should detect TSX files', () => {
      expect(wrapper.detectLanguage('Component.tsx')).toBe(SupportedLanguage.TSX);
    });

    it('should detect JavaScript files', () => {
      expect(wrapper.detectLanguage('file.js')).toBe(SupportedLanguage.JavaScript);
      expect(wrapper.detectLanguage('file.jsx')).toBe(SupportedLanguage.JavaScript);
      expect(wrapper.detectLanguage('file.mjs')).toBe(SupportedLanguage.JavaScript);
      expect(wrapper.detectLanguage('file.cjs')).toBe(SupportedLanguage.JavaScript);
    });

    it('should detect Python files', () => {
      expect(wrapper.detectLanguage('script.py')).toBe(SupportedLanguage.Python);
      expect(wrapper.detectLanguage('script.pyw')).toBe(SupportedLanguage.Python);
      expect(wrapper.detectLanguage('script.pyi')).toBe(SupportedLanguage.Python);
    });

    it('should detect Go files', () => {
      expect(wrapper.detectLanguage('main.go')).toBe(SupportedLanguage.Go);
    });

    it('should detect Java files', () => {
      expect(wrapper.detectLanguage('Main.java')).toBe(SupportedLanguage.Java);
    });

    it('should detect Rust files', () => {
      expect(wrapper.detectLanguage('main.rs')).toBe(SupportedLanguage.Rust);
    });

    it('should return null for unsupported extensions', () => {
      expect(wrapper.detectLanguage('file.txt')).toBeNull();
      expect(wrapper.detectLanguage('file.c')).toBeNull();
      expect(wrapper.detectLanguage('file.cpp')).toBeNull();
      expect(wrapper.detectLanguage('file')).toBeNull();
    });

    it('should handle case-insensitive extensions', () => {
      expect(wrapper.detectLanguage('file.TS')).toBe(SupportedLanguage.TypeScript);
      expect(wrapper.detectLanguage('file.PY')).toBe(SupportedLanguage.Python);
    });
  });

  describe('Supported Languages', () => {
    it('should list all supported languages', () => {
      const languages = wrapper.getSupportedLanguages();
      expect(languages).toContain(SupportedLanguage.TypeScript);
      expect(languages).toContain(SupportedLanguage.TSX);
      expect(languages).toContain(SupportedLanguage.JavaScript);
      expect(languages).toContain(SupportedLanguage.Python);
      expect(languages).toContain(SupportedLanguage.Go);
      expect(languages).toContain(SupportedLanguage.Java);
      expect(languages).toContain(SupportedLanguage.Rust);
      expect(languages.length).toBe(7);
    });

    it('should check if a language is supported', () => {
      expect(wrapper.isLanguageSupported('typescript')).toBe(true);
      expect(wrapper.isLanguageSupported('tsx')).toBe(true);
      expect(wrapper.isLanguageSupported('python')).toBe(true);
      expect(wrapper.isLanguageSupported('cpp')).toBe(false);
      expect(wrapper.isLanguageSupported('ruby')).toBe(false);
    });

    it('should list all supported extensions', () => {
      const extensions = wrapper.getSupportedExtensions();
      expect(extensions).toContain('.ts');
      expect(extensions).toContain('.tsx');
      expect(extensions).toContain('.js');
      expect(extensions).toContain('.py');
      expect(extensions).toContain('.go');
      expect(extensions).toContain('.java');
      expect(extensions).toContain('.rs');
    });
  });

  describe('TypeScript Parsing', () => {
    it('should parse TypeScript code', async () => {
      const code = `
interface User {
  id: number;
  name: string;
}

function greet(user: User): string {
  return \`Hello, \${user.name}!\`;
}
      `.trim();

      const result = await wrapper.parse(code, SupportedLanguage.TypeScript);

      expect(result.tree).toBeDefined();
      expect(result.rootNode).toBeDefined();
      expect(result.rootNode.type).toBe('program');
      expect(result.hasErrors).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.language).toBe(SupportedLanguage.TypeScript);
      expect(result.sourceCode).toBe(code);
    });

    it('should parse TypeScript with generics', async () => {
      const code = `
class Container<T> {
  private value: T;

  constructor(value: T) {
    this.value = value;
  }

  getValue(): T {
    return this.value;
  }
}
      `.trim();

      const result = await wrapper.parse(code, SupportedLanguage.TypeScript);
      expect(result.hasErrors).toBe(false);

      // Find class declaration
      const classNode = result.rootNode.children.find(n => n.type === 'class_declaration');
      expect(classNode).toBeDefined();
    });
  });

  describe('TSX Parsing', () => {
    it('should parse TSX code', async () => {
      const code = `
import React from 'react';

interface Props {
  name: string;
}

const Greeting: React.FC<Props> = ({ name }) => {
  return <div>Hello, {name}!</div>;
};

export default Greeting;
      `.trim();

      const result = await wrapper.parse(code, SupportedLanguage.TSX);

      expect(result.hasErrors).toBe(false);
      expect(result.rootNode.type).toBe('program');
      // Should contain JSX
      expect(result.rootNode.toString()).toContain('jsx');
    });
  });

  describe('JavaScript Parsing', () => {
    it('should parse JavaScript code', async () => {
      const code = `
function calculateArea(radius) {
  return Math.PI * radius * radius;
}

const circle = {
  radius: 5,
  get area() {
    return calculateArea(this.radius);
  }
};
      `.trim();

      const result = await wrapper.parse(code, SupportedLanguage.JavaScript);

      expect(result.hasErrors).toBe(false);
      expect(result.rootNode.type).toBe('program');

      // Find function declaration
      const funcNode = result.rootNode.children.find(n => n.type === 'function_declaration');
      expect(funcNode).toBeDefined();
    });

    it('should parse ES6 features', async () => {
      const code = `
import { useState } from 'react';

const App = () => {
  const [count, setCount] = useState(0);
  return count;
};

export default App;
      `.trim();

      const result = await wrapper.parse(code, SupportedLanguage.JavaScript);
      expect(result.hasErrors).toBe(false);
    });
  });

  describe('Python Parsing', () => {
    it('should parse Python code', async () => {
      const code = `
def calculate_area(radius):
    """Calculate the area of a circle."""
    import math
    return math.pi * radius ** 2

class Circle:
    def __init__(self, radius):
        self.radius = radius

    @property
    def area(self):
        return calculate_area(self.radius)
      `.trim();

      const result = await wrapper.parse(code, SupportedLanguage.Python);

      expect(result.hasErrors).toBe(false);
      expect(result.rootNode.type).toBe('module');

      // Find function definition
      const funcNode = result.rootNode.children.find(n => n.type === 'function_definition');
      expect(funcNode).toBeDefined();

      // Find class definition
      const classNode = result.rootNode.children.find(n => n.type === 'class_definition');
      expect(classNode).toBeDefined();
    });

    it('should parse Python type hints', async () => {
      const code = `
from typing import List, Optional

def get_users(limit: int = 10) -> List[str]:
    return []

def find_user(id: int) -> Optional[str]:
    return None
      `.trim();

      const result = await wrapper.parse(code, SupportedLanguage.Python);
      expect(result.hasErrors).toBe(false);
    });
  });

  describe('Go Parsing', () => {
    it('should parse Go code', async () => {
      const code = `
package main

import "fmt"

type Circle struct {
    Radius float64
}

func (c Circle) Area() float64 {
    return 3.14159 * c.Radius * c.Radius
}

func main() {
    circle := Circle{Radius: 5.0}
    fmt.Println(circle.Area())
}
      `.trim();

      const result = await wrapper.parse(code, SupportedLanguage.Go);

      expect(result.hasErrors).toBe(false);
      expect(result.rootNode.type).toBe('source_file');

      // Find package clause
      const packageNode = result.rootNode.children.find(n => n.type === 'package_clause');
      expect(packageNode).toBeDefined();

      // Find type declaration
      const typeNode = result.rootNode.children.find(n => n.type === 'type_declaration');
      expect(typeNode).toBeDefined();
    });

    it('should parse Go interfaces', async () => {
      const code = `
package shapes

type Shape interface {
    Area() float64
    Perimeter() float64
}
      `.trim();

      const result = await wrapper.parse(code, SupportedLanguage.Go);
      expect(result.hasErrors).toBe(false);
    });
  });

  describe('Java Parsing', () => {
    it('should parse Java code', async () => {
      const code = `
package com.example;

import java.util.List;

public class Circle {
    private double radius;

    public Circle(double radius) {
        this.radius = radius;
    }

    public double getArea() {
        return Math.PI * radius * radius;
    }
}
      `.trim();

      const result = await wrapper.parse(code, SupportedLanguage.Java);

      expect(result.hasErrors).toBe(false);
      expect(result.rootNode.type).toBe('program');

      // Find package declaration
      const packageNode = result.rootNode.children.find(n => n.type === 'package_declaration');
      expect(packageNode).toBeDefined();

      // Find class declaration
      const classNode = result.rootNode.children.find(n => n.type === 'class_declaration');
      expect(classNode).toBeDefined();
    });

    it('should parse Java generics', async () => {
      const code = `
import java.util.Optional;
import java.util.List;

public interface Repository<T, ID> {
    Optional<T> findById(ID id);
    List<T> findAll();
    T save(T entity);
}
      `.trim();

      const result = await wrapper.parse(code, SupportedLanguage.Java);
      expect(result.hasErrors).toBe(false);
    });
  });

  describe('Rust Parsing', () => {
    it('should parse Rust code', async () => {
      const code = `
use std::f64::consts::PI;

#[derive(Debug, Clone)]
struct Circle {
    radius: f64,
}

impl Circle {
    fn new(radius: f64) -> Self {
        Circle { radius }
    }

    fn area(&self) -> f64 {
        PI * self.radius * self.radius
    }
}

fn main() {
    let circle = Circle::new(5.0);
    println!("Area: {:.2}", circle.area());
}
      `.trim();

      const result = await wrapper.parse(code, SupportedLanguage.Rust);

      expect(result.hasErrors).toBe(false);
      expect(result.rootNode.type).toBe('source_file');

      // Find struct declaration
      const structNode = result.rootNode.children.find(n => n.type === 'struct_item');
      expect(structNode).toBeDefined();

      // Find impl block
      const implNode = result.rootNode.children.find(n => n.type === 'impl_item');
      expect(implNode).toBeDefined();
    });

    it('should parse Rust enums', async () => {
      const code = `
#[derive(Debug, PartialEq)]
enum Shape {
    Circle { radius: f64 },
    Rectangle { width: f64, height: f64 },
}
      `.trim();

      const result = await wrapper.parse(code, SupportedLanguage.Rust);
      expect(result.hasErrors).toBe(false);

      const enumNode = result.rootNode.children.find(n => n.type === 'enum_item');
      expect(enumNode).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should collect syntax errors', async () => {
      const malformedCode = `
function unclosed(param {
  return param +
}
      `.trim();

      const result = await wrapper.parse(malformedCode, SupportedLanguage.JavaScript);

      expect(result.hasErrors).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toHaveProperty('message');
      expect(result.errors[0]).toHaveProperty('startPosition');
      expect(result.errors[0]).toHaveProperty('endPosition');
    });

    it('should handle empty code', async () => {
      const result = await wrapper.parse('', SupportedLanguage.JavaScript);

      expect(result.hasErrors).toBe(false);
      expect(result.rootNode.type).toBe('program');
      expect(result.rootNode.childCount).toBe(0);
    });

    it('should throw UnsupportedLanguageError for invalid language', async () => {
      await expect(
        wrapper.parse('code', 'cpp' as SupportedLanguage)
      ).rejects.toThrow(UnsupportedLanguageError);
    });

    it('should limit collected errors', async () => {
      // Create code with many errors
      const badCode = Array(150).fill('{ {').join('\n');

      const result = await wrapper.parse(badCode, SupportedLanguage.JavaScript, {
        maxErrors: 10
      });

      expect(result.hasErrors).toBe(true);
      expect(result.errors.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Caching', () => {
    it('should cache loaded languages', async () => {
      // First parse
      await wrapper.parse('const x = 1;', SupportedLanguage.JavaScript);
      const stats1 = wrapper.getCacheStats();
      expect(stats1.size).toBe(1);
      expect(stats1.loadedLanguages).toContain(SupportedLanguage.JavaScript);

      // Second parse with same language
      await wrapper.parse('const y = 2;', SupportedLanguage.JavaScript);
      const stats2 = wrapper.getCacheStats();
      expect(stats2.size).toBe(1); // Should still be 1

      // Parse different language
      await wrapper.parse('x = 1', SupportedLanguage.Python);
      const stats3 = wrapper.getCacheStats();
      expect(stats3.size).toBe(2);
      expect(stats3.loadedLanguages).toContain(SupportedLanguage.Python);
    });

    it('should clear cache', async () => {
      await wrapper.parse('const x = 1;', SupportedLanguage.JavaScript);
      expect(wrapper.getCacheStats().size).toBe(1);

      wrapper.clearCache();
      expect(wrapper.getCacheStats().size).toBe(0);
    });
  });

  describe('Type Utilities', () => {
    it('getLanguageForExtension should work correctly', () => {
      expect(getLanguageForExtension('.ts')).toBe(SupportedLanguage.TypeScript);
      expect(getLanguageForExtension('ts')).toBe(SupportedLanguage.TypeScript);
      expect(getLanguageForExtension('.py')).toBe(SupportedLanguage.Python);
      expect(getLanguageForExtension('.unknown')).toBeNull();
    });

    it('isExtensionSupported should work correctly', () => {
      expect(isExtensionSupported('.ts')).toBe(true);
      expect(isExtensionSupported('ts')).toBe(true);
      expect(isExtensionSupported('.py')).toBe(true);
      expect(isExtensionSupported('.unknown')).toBe(false);
    });

    it('getSupportedExtensions should return all extensions', () => {
      const extensions = getSupportedExtensions();
      expect(extensions.length).toBeGreaterThan(10); // We have many extensions
      expect(extensions).toContain('.ts');
      expect(extensions).toContain('.tsx');
      expect(extensions).toContain('.js');
    });
  });
});
