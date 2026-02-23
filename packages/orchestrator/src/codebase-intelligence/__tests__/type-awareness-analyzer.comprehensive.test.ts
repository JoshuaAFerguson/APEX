import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { TypeAwarenessAnalyzer, getTypeAwarenessAnalyzer } from '../type-awareness-analyzer.js';
import type {
  TypeInformation,
  TypeAnalysisOptions,
  TypeScriptInterface,
  TypeAlias,
  TypeAnnotation,
  TypeParameter,
  FunctionTypeSignature
} from '../type-awareness-analyzer.js';

// Mock the TreeSitterWrapper to control parsing behavior
vi.mock('../parsers/tree-sitter-wrapper.js', () => ({
  TreeSitterWrapper: {
    getInstance: vi.fn(() => ({
      parse: vi.fn()
    }))
  }
}));

describe('TypeAwarenessAnalyzer - Comprehensive Tests', () => {
  let analyzer: TypeAwarenessAnalyzer;

  beforeEach(() => {
    TypeAwarenessAnalyzer.resetInstance();
    analyzer = TypeAwarenessAnalyzer.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complex Interface Analysis', () => {
    test('analyzes interface with complex property types', async () => {
      const mockNode = createMockInterfaceNode('ComplexInterface', [
        {
          name: 'callback',
          type: 'function_type',
          typeText: '(data: string) => Promise<boolean>'
        },
        {
          name: 'map',
          type: 'generic_type',
          typeText: 'Map<string, Array<number>>'
        },
        {
          name: 'union',
          type: 'union_type',
          typeText: 'string | number | null'
        }
      ]);

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent('interface ComplexInterface {...}', 'complex.ts');

      expect(result.interfaces).toHaveLength(1);
      const complexInterface = result.interfaces[0];
      expect(complexInterface.name).toBe('ComplexInterface');
      expect(complexInterface.properties).toHaveLength(3);

      const callbackProp = complexInterface.properties.find(p => p.name === 'callback');
      expect(callbackProp?.type.kind).toBe('function');

      const mapProp = complexInterface.properties.find(p => p.name === 'map');
      expect(mapProp?.type.kind).toBe('generic');

      const unionProp = complexInterface.properties.find(p => p.name === 'union');
      expect(unionProp?.type.kind).toBe('union');
    });

    test('analyzes interface with generic constraints and defaults', async () => {
      const mockNode = createMockInterfaceNode('GenericInterface', [], [
        {
          name: 'T',
          constraint: 'string | number',
          defaultType: 'string'
        },
        {
          name: 'K',
          constraint: 'keyof T'
        }
      ]);

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent('interface GenericInterface<T, K> {...}', 'generic.ts');

      expect(result.interfaces).toHaveLength(1);
      const genericInterface = result.interfaces[0];
      expect(genericInterface.typeParameters).toHaveLength(2);

      const tParam = genericInterface.typeParameters[0];
      expect(tParam.name).toBe('T');
      expect(tParam.constraint?.raw).toBe('string | number');
      expect(tParam.defaultType?.raw).toBe('string');

      const kParam = genericInterface.typeParameters[1];
      expect(kParam.name).toBe('K');
      expect(kParam.constraint?.raw).toBe('keyof T');
    });

    test('analyzes interface inheritance chain', async () => {
      const mockNode = createMockProgramNode([
        createMockInterfaceNode('BaseInterface', [
          { name: 'id', type: 'predefined_type', typeText: 'string' }
        ]),
        createMockInterfaceNode('MiddleInterface', [
          { name: 'name', type: 'predefined_type', typeText: 'string' }
        ], [], ['BaseInterface']),
        createMockInterfaceNode('ExtendedInterface', [
          { name: 'value', type: 'predefined_type', typeText: 'number' }
        ], [], ['MiddleInterface'])
      ]);

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent('interface inheritance chain', 'inheritance.ts');

      expect(result.interfaces).toHaveLength(3);
      expect(result.typeDependencies.filter(d => d.kind === 'extends')).toHaveLength(2);
    });
  });

  describe('Type Alias Analysis', () => {
    test('analyzes mapped types', async () => {
      const mockNode = createMockTypeAliasNode('MappedType', 'mapped_type', '{ [K in keyof T]: T[K] | null }');

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent('type MappedType<T> = { [K in keyof T]: T[K] | null }', 'mapped.ts');

      expect(result.typeAliases).toHaveLength(1);
      const mappedType = result.typeAliases[0];
      expect(mappedType.name).toBe('MappedType');
      expect(mappedType.definition.kind).toBe('mapped');
    });

    test('analyzes conditional types', async () => {
      const mockNode = createMockTypeAliasNode('ConditionalType', 'conditional_type', 'T extends string ? true : false');

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent('type ConditionalType<T> = T extends string ? true : false', 'conditional.ts');

      expect(result.typeAliases).toHaveLength(1);
      const conditionalType = result.typeAliases[0];
      expect(conditionalType.name).toBe('ConditionalType');
      expect(conditionalType.definition.kind).toBe('conditional');
    });

    test('analyzes template literal types', async () => {
      const mockNode = createMockTypeAliasNode('TemplateType', 'template_literal_type', '`Hello ${T}`');

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent('type TemplateType<T> = `Hello ${T}`', 'template.ts');

      expect(result.typeAliases).toHaveLength(1);
      const templateType = result.typeAliases[0];
      expect(templateType.name).toBe('TemplateType');
      expect(templateType.definition.kind).toBe('template');
    });
  });

  describe('Function Type Analysis', () => {
    test('analyzes function type signatures', async () => {
      const mockNode = createMockTypeAliasNode('Handler', 'function_type', '(event: Event, data: T) => Promise<void>');

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent('type Handler<T> = (event: Event, data: T) => Promise<void>', 'function.ts');

      expect(result.typeAliases).toHaveLength(1);
      const handlerType = result.typeAliases[0];
      expect(handlerType.definition.kind).toBe('function');
      expect(handlerType.definition.functionSignature).toBeDefined();

      if (handlerType.definition.functionSignature) {
        expect(handlerType.definition.functionSignature.parameters).toHaveLength(2);
        expect(handlerType.definition.functionSignature.parameters[0].name).toBe('event');
        expect(handlerType.definition.functionSignature.parameters[1].name).toBe('data');
      }
    });

    test('analyzes async function types', async () => {
      const mockNode = createMockTypeAliasNode('AsyncHandler', 'function_type', 'async (id: string) => User');

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent('type AsyncHandler = async (id: string) => User', 'async.ts');

      expect(result.typeAliases).toHaveLength(1);
      const asyncType = result.typeAliases[0];
      expect(asyncType.definition.functionSignature?.async).toBe(true);
    });
  });

  describe('Import/Export Analysis', () => {
    test('analyzes type-only imports with aliases', async () => {
      const mockNode = createMockProgramNode([
        createMockImportNode('type', 'User as UserType', './user'),
        createMockImportNode('type', '{ Config, Settings as AppSettings }', './config'),
        createMockImportNode('type', '* as Types', './types')
      ]);

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent('type imports with aliases', 'imports.ts');

      expect(result.typeImports).toHaveLength(4); // User, Config, Settings, Types namespace

      const userImport = result.typeImports.find(i => i.typeName === 'UserType');
      expect(userImport?.originalName).toBe('User');
      expect(userImport?.typeOnly).toBe(true);
    });

    test('analyzes re-exports', async () => {
      const mockNode = createMockProgramNode([
        createMockExportNode('type', 'User', false, './user'),
        createMockExportNode('type', '{ Config as AppConfig }', false, './config'),
        createMockExportNode('type', '*', false, './types')
      ]);

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent('type re-exports', 'exports.ts');

      expect(result.typeExports).toHaveLength(3);
      expect(result.typeExports.every(e => e.fromModule)).toBe(true);
    });
  });

  describe('Type Dependency Analysis', () => {
    test('tracks complex type dependencies', async () => {
      const mockNode = createMockProgramNode([
        createMockInterfaceNode('UserService', [
          { name: 'getUser', type: 'function_type', typeText: '(id: string) => Promise<User>' },
          { name: 'users', type: 'type_reference', typeText: 'Map<string, User>' }
        ]),
        createMockInterfaceNode('User', [
          { name: 'profile', type: 'type_reference', typeText: 'UserProfile' }
        ]),
        createMockTypeAliasNode('UserProfile', 'object_type', '{ name: string; avatar?: string }')
      ]);

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent('complex dependencies', 'dependencies.ts');

      expect(result.typeDependencies).toHaveLength(3);
      expect(result.typeDependencies.some(d =>
        d.sourceType === 'UserService' && d.targetType === 'User' && d.kind === 'uses'
      )).toBe(true);
    });

    test('tracks generic type parameter usage', async () => {
      const mockNode = createMockInterfaceNode('Repository', [
        { name: 'find', type: 'function_type', typeText: '(id: K) => Promise<T | null>' },
        { name: 'save', type: 'function_type', typeText: '(entity: T) => Promise<T>' }
      ], [
        { name: 'T', constraint: 'BaseEntity' },
        { name: 'K', constraint: 'string | number', defaultType: 'string' }
      ]);

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent('generic repository', 'repository.ts');

      expect(result.typeDependencies.some(d =>
        d.sourceType === 'Repository' && d.targetType === 'BaseEntity' && d.kind === 'generic'
      )).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles circular type references', async () => {
      const mockNode = createMockProgramNode([
        createMockInterfaceNode('Node', [
          { name: 'parent', type: 'type_reference', typeText: 'Node | null' },
          { name: 'children', type: 'array_type', typeText: 'Node[]' }
        ]),
        createMockInterfaceNode('TreeNode', [
          { name: 'left', type: 'type_reference', typeText: 'TreeNode | null' },
          { name: 'right', type: 'type_reference', typeText: 'TreeNode | null' }
        ])
      ]);

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent('circular references', 'circular.ts');

      expect(result.interfaces).toHaveLength(2);
      expect(result.errors).toHaveLength(0); // Should handle circular references gracefully
    });

    test('handles malformed type annotations', async () => {
      const mockNode = createMockInterfaceNode('MalformedInterface', [
        { name: 'incomplete', type: 'missing_type', typeText: '' },
        { name: 'invalid', type: 'error_type', typeText: 'string | |' }
      ]);

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent('malformed interface', 'malformed.ts');

      expect(result.interfaces).toHaveLength(1);
      // Should still extract what it can
      expect(result.interfaces[0].properties).toHaveLength(2);
    });

    test('handles very deeply nested types', async () => {
      const deepType = 'Promise<Result<Either<Left<Error>, Right<Success<Data<User>>>>>>';
      const mockNode = createMockTypeAliasNode('DeepType', 'generic_type', deepType);

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent(`type DeepType = ${deepType}`, 'deep.ts');

      expect(result.typeAliases).toHaveLength(1);
      expect(result.typeAliases[0].definition.typeArguments).toBeDefined();
    });
  });

  describe('Performance and Caching', () => {
    test('caches file analysis results', async () => {
      const content = 'interface User { id: string; }';
      const mockNode = createMockInterfaceNode('User', [
        { name: 'id', type: 'predefined_type', typeText: 'string' }
      ]);

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      // Mock fs.readFile
      const fs = require('fs/promises');
      fs.readFile = vi.fn().mockResolvedValue(content);

      // First call
      const result1 = await analyzer.analyzeFile('/test/user.ts');
      expect(mockTreeWrapper.parse).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await analyzer.analyzeFile('/test/user.ts');
      expect(mockTreeWrapper.parse).toHaveBeenCalledTimes(1); // Should not parse again
      expect(result2).toBe(result1); // Same reference
    });

    test('handles large numbers of interfaces efficiently', async () => {
      const interfaces = Array.from({ length: 100 }, (_, i) =>
        createMockInterfaceNode(`Interface${i}`, [
          { name: 'id', type: 'predefined_type', typeText: 'string' },
          { name: 'value', type: 'predefined_type', typeText: 'number' }
        ])
      );
      const mockNode = createMockProgramNode(interfaces);

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const startTime = Date.now();
      const result = await analyzer.analyzeContent('many interfaces', 'large.ts');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.interfaces).toHaveLength(100);
    });
  });

  describe('Custom Analysis Options', () => {
    test('respects includeDependencies option', async () => {
      const mockNode = createMockInterfaceNode('User', [
        { name: 'profile', type: 'type_reference', typeText: 'UserProfile' }
      ]);

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const options: TypeAnalysisOptions = { includeDependencies: false };
      const result = await analyzer.analyzeContent('interface with dependencies', 'test.ts', options);

      expect(result.typeDependencies).toHaveLength(0);
    });

    test('respects includeImportsExports option', async () => {
      const mockNode = createMockProgramNode([
        createMockImportNode('type', 'User', './user'),
        createMockExportNode('type', 'Config', false)
      ]);

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const options: TypeAnalysisOptions = { includeImportsExports: false };
      const result = await analyzer.analyzeContent('imports and exports', 'test.ts', options);

      expect(result.typeImports).toHaveLength(0);
      expect(result.typeExports).toHaveLength(0);
    });

    test('respects maxTypeDepth option', async () => {
      const deepType = 'Promise<Result<Either<Left<Error>>>>';
      const mockNode = createMockTypeAliasNode('DeepType', 'generic_type', deepType);

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const options: TypeAnalysisOptions = { maxTypeDepth: 2 };
      const result = await analyzer.analyzeContent(`type DeepType = ${deepType}`, 'deep.ts', options);

      expect(result.typeAliases).toHaveLength(1);
      // Type analysis should be limited by depth
    });
  });
});

// Helper functions for creating mock AST nodes
function createMockProgramNode(children: any[]): any {
  return {
    type: 'program',
    startPosition: { row: 0, column: 0 },
    endPosition: { row: children.length, column: 0 },
    startIndex: 0,
    endIndex: 1000,
    children,
    parent: null,
    previousSibling: null,
    nextSibling: null
  };
}

function createMockInterfaceNode(
  name: string,
  properties: Array<{name: string, type: string, typeText: string}> = [],
  typeParameters: Array<{name: string, constraint?: string, defaultType?: string}> = [],
  extendsClause: string[] = []
): any {
  return {
    type: 'interface_declaration',
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 10, column: 0 },
    startIndex: 0,
    endIndex: 100,
    children: [
      {
        type: 'type_identifier',
        startPosition: { row: 0, column: 10 },
        endPosition: { row: 0, column: 10 + name.length },
        startIndex: 10,
        endIndex: 10 + name.length,
        children: [],
        parent: null,
        previousSibling: null,
        nextSibling: null
      },
      ...typeParameters.map(tp => ({
        type: 'type_parameter',
        startPosition: { row: 0, column: 20 },
        endPosition: { row: 0, column: 30 },
        startIndex: 20,
        endIndex: 30,
        children: [
          {
            type: 'type_identifier',
            startPosition: { row: 0, column: 20 },
            endPosition: { row: 0, column: 20 + tp.name.length },
            startIndex: 20,
            endIndex: 20 + tp.name.length,
            children: [],
            parent: null,
            previousSibling: null,
            nextSibling: null
          }
        ],
        parent: null,
        previousSibling: null,
        nextSibling: null
      })),
      ...properties.map((prop, i) => ({
        type: 'property_signature',
        startPosition: { row: i + 1, column: 2 },
        endPosition: { row: i + 1, column: 20 },
        startIndex: (i + 1) * 20,
        endIndex: (i + 1) * 20 + 18,
        children: [
          {
            type: 'property_identifier',
            startPosition: { row: i + 1, column: 2 },
            endPosition: { row: i + 1, column: 2 + prop.name.length },
            startIndex: (i + 1) * 20,
            endIndex: (i + 1) * 20 + prop.name.length,
            children: [],
            parent: null,
            previousSibling: null,
            nextSibling: null
          },
          {
            type: prop.type,
            startPosition: { row: i + 1, column: 2 + prop.name.length + 2 },
            endPosition: { row: i + 1, column: 20 },
            startIndex: (i + 1) * 20 + prop.name.length + 2,
            endIndex: (i + 1) * 20 + 18,
            children: [],
            parent: null,
            previousSibling: null,
            nextSibling: null
          }
        ],
        parent: null,
        previousSibling: null,
        nextSibling: null
      }))
    ],
    parent: null,
    previousSibling: null,
    nextSibling: null
  };
}

function createMockTypeAliasNode(name: string, defType: string, definition: string): any {
  return {
    type: 'type_alias_declaration',
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 1, column: 0 },
    startIndex: 0,
    endIndex: 50,
    children: [
      {
        type: 'type_identifier',
        startPosition: { row: 0, column: 5 },
        endPosition: { row: 0, column: 5 + name.length },
        startIndex: 5,
        endIndex: 5 + name.length,
        children: [],
        parent: null,
        previousSibling: null,
        nextSibling: null
      },
      {
        type: defType,
        startPosition: { row: 0, column: 5 + name.length + 3 },
        endPosition: { row: 0, column: 50 },
        startIndex: 5 + name.length + 3,
        endIndex: 50,
        children: [],
        parent: null,
        previousSibling: null,
        nextSibling: null
      }
    ],
    parent: null,
    previousSibling: null,
    nextSibling: null
  };
}

function createMockImportNode(importType: string, names: string, fromModule: string): any {
  return {
    type: 'import_statement',
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 50 },
    startIndex: 0,
    endIndex: 50,
    children: [
      {
        type: 'import_clause',
        startPosition: { row: 0, column: 7 },
        endPosition: { row: 0, column: 30 },
        startIndex: 7,
        endIndex: 30,
        children: [],
        parent: null,
        previousSibling: null,
        nextSibling: null
      },
      {
        type: 'string_literal',
        startPosition: { row: 0, column: 36 },
        endPosition: { row: 0, column: 36 + fromModule.length + 2 },
        startIndex: 36,
        endIndex: 36 + fromModule.length + 2,
        children: [],
        parent: null,
        previousSibling: null,
        nextSibling: null
      }
    ],
    parent: null,
    previousSibling: null,
    nextSibling: null
  };
}

function createMockExportNode(exportType: string, names: string, isDefault: boolean, fromModule?: string): any {
  return {
    type: isDefault ? 'export_statement' : 'export_statement',
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 50 },
    startIndex: 0,
    endIndex: 50,
    children: [
      {
        type: 'export_clause',
        startPosition: { row: 0, column: 7 },
        endPosition: { row: 0, column: 30 },
        startIndex: 7,
        endIndex: 30,
        children: [],
        parent: null,
        previousSibling: null,
        nextSibling: null
      }
    ],
    parent: null,
    previousSibling: null,
    nextSibling: null
  };
}