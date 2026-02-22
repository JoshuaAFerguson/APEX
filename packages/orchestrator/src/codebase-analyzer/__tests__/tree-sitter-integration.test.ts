/**
 * Integration tests for tree-sitter language parsers
 *
 * This test suite verifies:
 * 1. All tree-sitter language grammars are properly installed and functional
 * 2. Each parser can correctly parse representative code samples
 * 3. AST nodes are properly structured and accessible
 * 4. Error handling for malformed code
 */

import { describe, it, expect } from 'vitest';

describe('Tree-sitter Language Parsers Integration', () => {
  describe('JavaScript Parser', () => {
    it('should parse basic JavaScript function', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const JavaScript = (await import('tree-sitter-javascript')).default;

      const parser = new TreeSitter();
      parser.setLanguage(JavaScript);

      const sourceCode = `
function calculateArea(radius) {
  return Math.PI * radius * radius;
}

const result = calculateArea(5);
      `.trim();

      const tree = parser.parse(sourceCode);

      expect(tree).toBeDefined();
      expect(tree.rootNode.type).toBe('program');
      expect(tree.rootNode.childCount).toBeGreaterThan(0);

      // Find the function declaration
      const functionNode = tree.rootNode.children.find(node => node.type === 'function_declaration');
      expect(functionNode).toBeDefined();
      expect(functionNode?.childForFieldName('name')?.text).toBe('calculateArea');
    });

    it('should parse ES6 features', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const JavaScript = (await import('tree-sitter-javascript')).default;

      const parser = new TreeSitter();
      parser.setLanguage(JavaScript);

      const sourceCode = `
const users = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 }
];

const adults = users.filter(user => user.age >= 18);
const names = users.map(({ name }) => name);

class UserManager {
  constructor() {
    this.users = [];
  }

  async addUser(user) {
    this.users.push(user);
  }
}
      `.trim();

      const tree = parser.parse(sourceCode);

      expect(tree.rootNode.type).toBe('program');
      expect(tree.rootNode.hasError).toBe(false);

      // Check for class declaration
      const classNode = tree.rootNode.children.find(node => node.type === 'class_declaration');
      expect(classNode).toBeDefined();
    });

    it('should parse import/export statements', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const JavaScript = (await import('tree-sitter-javascript')).default;

      const parser = new TreeSitter();
      parser.setLanguage(JavaScript);

      const sourceCode = `
import React from 'react';
import { useState, useEffect } from 'react';
import * as utils from './utils';

export const Component = () => {
  return <div>Hello</div>;
};

export default Component;
      `.trim();

      const tree = parser.parse(sourceCode);

      expect(tree.rootNode.type).toBe('program');
      expect(tree.rootNode.hasError).toBe(false);

      // Find import statements
      const importNodes = tree.rootNode.children.filter(node => node.type === 'import_statement');
      expect(importNodes.length).toBeGreaterThan(0);

      // Find export statements
      const exportNodes = tree.rootNode.children.filter(node => node.type === 'export_statement');
      expect(exportNodes.length).toBeGreaterThan(0);
    });
  });

  describe('TypeScript Parser', () => {
    it('should parse TypeScript interfaces', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const { typescript } = await import('tree-sitter-typescript');

      const parser = new TreeSitter();
      parser.setLanguage(typescript);

      const sourceCode = `
interface User {
  id: number;
  name: string;
  email?: string;
  roles: string[];
}

type UserStatus = 'active' | 'inactive' | 'pending';

interface UserService {
  getUser(id: number): Promise<User>;
  createUser(user: Omit<User, 'id'>): Promise<User>;
}
      `.trim();

      const tree = parser.parse(sourceCode);

      expect(tree.rootNode.type).toBe('program');
      expect(tree.rootNode.hasError).toBe(false);

      // Find interface declarations
      const interfaceNodes = tree.rootNode.children.filter(node => node.type === 'interface_declaration');
      expect(interfaceNodes.length).toBe(2);

      // Find type alias
      const typeNodes = tree.rootNode.children.filter(node => node.type === 'type_alias_declaration');
      expect(typeNodes.length).toBe(1);
    });

    it('should parse TypeScript classes with generics', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const { typescript } = await import('tree-sitter-typescript');

      const parser = new TreeSitter();
      parser.setLanguage(typescript);

      const sourceCode = `
class Repository<T extends { id: number }> {
  private items: T[] = [];

  constructor(private validator: (item: T) => boolean) {}

  add(item: T): void {
    if (this.validator(item)) {
      this.items.push(item);
    }
  }

  findById(id: number): T | undefined {
    return this.items.find(item => item.id === id);
  }
}

const userRepo = new Repository<User>((user) => !!user.name);
      `.trim();

      const tree = parser.parse(sourceCode);

      expect(tree.rootNode.type).toBe('program');
      expect(tree.rootNode.hasError).toBe(false);

      // Find class declaration
      const classNode = tree.rootNode.children.find(node => node.type === 'class_declaration');
      expect(classNode).toBeDefined();
    });

    it('should parse TSX components', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const { tsx } = await import('tree-sitter-typescript');

      const parser = new TreeSitter();
      parser.setLanguage(tsx);

      const sourceCode = `
import React, { FC, useState } from 'react';

interface Props {
  title: string;
  count?: number;
}

const Counter: FC<Props> = ({ title, count = 0 }) => {
  const [value, setValue] = useState<number>(count);

  return (
    <div className="counter">
      <h2>{title}</h2>
      <p>Count: {value}</p>
      <button onClick={() => setValue(value + 1)}>
        Increment
      </button>
    </div>
  );
};

export default Counter;
      `.trim();

      const tree = parser.parse(sourceCode);

      expect(tree.rootNode.type).toBe('program');
      expect(tree.rootNode.hasError).toBe(false);

      // Should contain JSX elements
      const jsx = tree.rootNode.toString().includes('jsx');
      expect(jsx).toBe(true);
    });
  });

  describe('Python Parser', () => {
    it('should parse basic Python functions and classes', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const Python = (await import('tree-sitter-python')).default;

      const parser = new TreeSitter();
      parser.setLanguage(Python);

      const sourceCode = `
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

    def __str__(self):
        return f"Circle(radius={self.radius})"

# Create instance
circle = Circle(5)
print(circle.area)
      `.trim();

      const tree = parser.parse(sourceCode);

      expect(tree.rootNode.type).toBe('module');
      expect(tree.rootNode.hasError).toBe(false);

      // Find function definition
      const functionNodes = tree.rootNode.children.filter(node => node.type === 'function_definition');
      expect(functionNodes.length).toBeGreaterThan(0);

      // Find class definition
      const classNodes = tree.rootNode.children.filter(node => node.type === 'class_definition');
      expect(classNodes.length).toBe(1);
    });

    it('should parse Python decorators and type hints', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const Python = (await import('tree-sitter-python')).default;

      const parser = new TreeSitter();
      parser.setLanguage(Python);

      const sourceCode = `
from typing import List, Optional, Dict
from dataclasses import dataclass

@dataclass
class User:
    id: int
    name: str
    email: Optional[str] = None

def get_users(limit: int = 10) -> List[User]:
    """Fetch users from database."""
    return []

@staticmethod
def validate_email(email: str) -> bool:
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))
      `.trim();

      const tree = parser.parse(sourceCode);

      expect(tree.rootNode.type).toBe('module');
      expect(tree.rootNode.hasError).toBe(false);

      // Find decorated class
      const decoratedNodes = tree.rootNode.children.filter(node => node.type === 'decorated_definition');
      expect(decoratedNodes.length).toBeGreaterThan(0);
    });
  });

  describe('Go Parser', () => {
    it('should parse Go functions and structs', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const Go = (await import('tree-sitter-go')).default;

      const parser = new TreeSitter();
      parser.setLanguage(Go);

      const sourceCode = `
package main

import (
    "fmt"
    "math"
)

type Circle struct {
    Radius float64
}

func (c Circle) Area() float64 {
    return math.Pi * c.Radius * c.Radius
}

func NewCircle(radius float64) Circle {
    return Circle{Radius: radius}
}

func main() {
    circle := NewCircle(5.0)
    fmt.Printf("Area: %.2f\\n", circle.Area())
}
      `.trim();

      const tree = parser.parse(sourceCode);

      expect(tree.rootNode.type).toBe('source_file');
      expect(tree.rootNode.hasError).toBe(false);

      // Find package clause
      const packageNode = tree.rootNode.children.find(node => node.type === 'package_clause');
      expect(packageNode).toBeDefined();

      // Find type declaration
      const typeNodes = tree.rootNode.children.filter(node => node.type === 'type_declaration');
      expect(typeNodes.length).toBeGreaterThan(0);

      // Find function declarations
      const functionNodes = tree.rootNode.children.filter(node => node.type === 'function_declaration');
      expect(functionNodes.length).toBeGreaterThan(0);
    });

    it('should parse Go interfaces and methods', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const Go = (await import('tree-sitter-go')).default;

      const parser = new TreeSitter();
      parser.setLanguage(Go);

      const sourceCode = `
package shapes

type Shape interface {
    Area() float64
    Perimeter() float64
}

type Rectangle struct {
    Width, Height float64
}

func (r Rectangle) Area() float64 {
    return r.Width * r.Height
}

func (r Rectangle) Perimeter() float64 {
    return 2 * (r.Width + r.Height)
}

var _ Shape = Rectangle{}
      `.trim();

      const tree = parser.parse(sourceCode);

      expect(tree.rootNode.type).toBe('source_file');
      expect(tree.rootNode.hasError).toBe(false);
    });
  });

  describe('Rust Parser', () => {
    it('should parse Rust functions and structs', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const Rust = (await import('tree-sitter-rust')).default;

      const parser = new TreeSitter();
      parser.setLanguage(Rust);

      const sourceCode = `
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

      const tree = parser.parse(sourceCode);

      expect(tree.rootNode.type).toBe('source_file');
      expect(tree.rootNode.hasError).toBe(false);

      // Find struct declaration
      const structNodes = tree.rootNode.children.filter(node => node.type === 'struct_item');
      expect(structNodes.length).toBeGreaterThan(0);

      // Find impl block
      const implNodes = tree.rootNode.children.filter(node => node.type === 'impl_item');
      expect(implNodes.length).toBeGreaterThan(0);

      // Find function definitions
      const functionNodes = tree.rootNode.children.filter(node => node.type === 'function_item');
      expect(functionNodes.length).toBeGreaterThan(0);
    });

    it('should parse Rust enums and pattern matching', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const Rust = (await import('tree-sitter-rust')).default;

      const parser = new TreeSitter();
      parser.setLanguage(Rust);

      const sourceCode = `
#[derive(Debug, PartialEq)]
enum Shape {
    Circle { radius: f64 },
    Rectangle { width: f64, height: f64 },
    Triangle { a: f64, b: f64, c: f64 },
}

impl Shape {
    fn area(&self) -> f64 {
        match self {
            Shape::Circle { radius } => std::f64::consts::PI * radius * radius,
            Shape::Rectangle { width, height } => width * height,
            Shape::Triangle { a, b, c } => {
                let s = (a + b + c) / 2.0;
                (s * (s - a) * (s - b) * (s - c)).sqrt()
            }
        }
    }
}
      `.trim();

      const tree = parser.parse(sourceCode);

      expect(tree.rootNode.type).toBe('source_file');
      expect(tree.rootNode.hasError).toBe(false);

      // Find enum declaration
      const enumNodes = tree.rootNode.children.filter(node => node.type === 'enum_item');
      expect(enumNodes.length).toBeGreaterThan(0);
    });
  });

  describe('Java Parser', () => {
    it('should parse Java classes and methods', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const Java = (await import('tree-sitter-java')).default;

      const parser = new TreeSitter();
      parser.setLanguage(Java);

      const sourceCode = `
package com.example.shapes;

import java.util.List;
import java.util.ArrayList;

public class Circle {
    private double radius;

    public Circle(double radius) {
        this.radius = radius;
    }

    public double getRadius() {
        return radius;
    }

    public void setRadius(double radius) {
        this.radius = radius;
    }

    public double calculateArea() {
        return Math.PI * radius * radius;
    }

    @Override
    public String toString() {
        return String.format("Circle(radius=%.2f)", radius);
    }

    public static List<Circle> createCircles(double... radii) {
        List<Circle> circles = new ArrayList<>();
        for (double r : radii) {
            circles.add(new Circle(r));
        }
        return circles;
    }
}
      `.trim();

      const tree = parser.parse(sourceCode);

      expect(tree.rootNode.type).toBe('program');
      expect(tree.rootNode.hasError).toBe(false);

      // Find package declaration
      const packageNode = tree.rootNode.children.find(node => node.type === 'package_declaration');
      expect(packageNode).toBeDefined();

      // Find class declaration
      const classNodes = tree.rootNode.children.filter(node => node.type === 'class_declaration');
      expect(classNodes.length).toBeGreaterThan(0);
    });

    it('should parse Java interfaces and generics', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const Java = (await import('tree-sitter-java')).default;

      const parser = new TreeSitter();
      parser.setLanguage(Java);

      const sourceCode = `
package com.example.repository;

import java.util.Optional;
import java.util.List;

public interface Repository<T, ID> {
    Optional<T> findById(ID id);
    List<T> findAll();
    T save(T entity);
    void deleteById(ID id);
}

public abstract class BaseRepository<T, ID> implements Repository<T, ID> {
    protected abstract Class<T> getEntityClass();

    @Override
    public List<T> findAll() {
        // Default implementation
        return new ArrayList<>();
    }
}
      `.trim();

      const tree = parser.parse(sourceCode);

      expect(tree.rootNode.type).toBe('program');
      expect(tree.rootNode.hasError).toBe(false);

      // Find interface declaration
      const interfaceNodes = tree.rootNode.children.filter(node => node.type === 'interface_declaration');
      expect(interfaceNodes.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle syntax errors in JavaScript gracefully', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const JavaScript = (await import('tree-sitter-javascript')).default;

      const parser = new TreeSitter();
      parser.setLanguage(JavaScript);

      const malformedCode = `
function unclosed(param {
  return param +
}

const incomplete =
      `.trim();

      const tree = parser.parse(malformedCode);

      expect(tree).toBeDefined();
      expect(tree.rootNode).toBeDefined();
      // Tree should indicate errors but still be parseable
      expect(tree.rootNode.hasError).toBe(true);
    });

    it('should handle empty code gracefully', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const JavaScript = (await import('tree-sitter-javascript')).default;

      const parser = new TreeSitter();
      parser.setLanguage(JavaScript);

      const emptyCode = '';
      const tree = parser.parse(emptyCode);

      expect(tree).toBeDefined();
      expect(tree.rootNode).toBeDefined();
      expect(tree.rootNode.type).toBe('program');
      expect(tree.rootNode.childCount).toBe(0);
    });

    it('should handle binary content gracefully', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const JavaScript = (await import('tree-sitter-javascript')).default;

      const parser = new TreeSitter();
      parser.setLanguage(JavaScript);

      // Binary content that's not valid source code
      const binaryContent = String.fromCharCode(0, 1, 2, 3, 255, 254);
      const tree = parser.parse(binaryContent);

      expect(tree).toBeDefined();
      expect(tree.rootNode).toBeDefined();
      // Should not throw, even with invalid content
    });
  });

  describe('Performance Characteristics', () => {
    it('should parse reasonably sized files quickly', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const JavaScript = (await import('tree-sitter-javascript')).default;

      const parser = new TreeSitter();
      parser.setLanguage(JavaScript);

      // Generate a larger piece of code
      const functions = [];
      for (let i = 0; i < 100; i++) {
        functions.push(`
function func${i}(param${i}) {
  const result = param${i} * ${i};
  return result + Math.random();
}
        `);
      }

      const largeCode = functions.join('\n');
      const startTime = Date.now();

      const tree = parser.parse(largeCode);
      const endTime = Date.now();

      expect(tree).toBeDefined();
      expect(tree.rootNode.hasError).toBe(false);
      expect(endTime - startTime).toBeLessThan(1000); // Should parse in under 1 second
    });

    it('should handle multiple parsers simultaneously', async () => {
      const TreeSitter = (await import('tree-sitter')).default;
      const JavaScript = (await import('tree-sitter-javascript')).default;
      const { typescript } = await import('tree-sitter-typescript');

      const jsParser = new TreeSitter();
      jsParser.setLanguage(JavaScript);

      const tsParser = new TreeSitter();
      tsParser.setLanguage(typescript);

      const jsCode = 'const x = 5;';
      const tsCode = 'const x: number = 5;';

      const [jsTree, tsTree] = await Promise.all([
        Promise.resolve(jsParser.parse(jsCode)),
        Promise.resolve(tsParser.parse(tsCode))
      ]);

      expect(jsTree.rootNode.hasError).toBe(false);
      expect(tsTree.rootNode.hasError).toBe(false);
    });
  });
});