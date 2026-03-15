import { SymbolResolver } from './symbol-resolver';
import { RepositoryMap, RepositoryMapSchema } from './types';

describe('SymbolResolver', () => {
  let mockRepositoryMap: RepositoryMap;
  let resolver: SymbolResolver;

  beforeEach(() => {
    // Create a comprehensive test repository map
    mockRepositoryMap = RepositoryMapSchema.parse({
      rootPath: '/test/project',
      name: 'Test Project',
      files: [
        {
          path: 'src/utils/math.ts',
          language: 'typescript',
          symbols: [
            {
              name: 'calculateTotal',
              type: 'function',
              filePath: 'src/utils/math.ts',
              startLine: 10,
              endLine: 15,
              startColumn: 0,
              endColumn: 1,
              exported: true,
              signature: 'function calculateTotal(items: number[]): number'
            },
            {
              name: 'formatPrice',
              type: 'function',
              filePath: 'src/utils/math.ts',
              startLine: 20,
              endLine: 25,
              startColumn: 0,
              endColumn: 1,
              exported: true,
              signature: 'function formatPrice(amount: number): string'
            },
            {
              name: 'PI_CONSTANT',
              type: 'constant',
              filePath: 'src/utils/math.ts',
              startLine: 5,
              endLine: 5,
              startColumn: 0,
              endColumn: 20,
              exported: true
            }
          ]
        },
        {
          path: 'src/services/UserService.ts',
          language: 'typescript',
          symbols: [
            {
              name: 'UserService',
              type: 'class',
              filePath: 'src/services/UserService.ts',
              startLine: 5,
              endLine: 50,
              startColumn: 0,
              endColumn: 1,
              exported: true
            },
            {
              name: 'getUser',
              type: 'method',
              filePath: 'src/services/UserService.ts',
              startLine: 10,
              endLine: 15,
              startColumn: 2,
              endColumn: 3,
              parent: 'UserService'
            },
            {
              name: 'updateUser',
              type: 'method',
              filePath: 'src/services/UserService.ts',
              startLine: 20,
              endLine: 30,
              startColumn: 2,
              endColumn: 3,
              parent: 'UserService'
            }
          ]
        },
        {
          path: 'src/types/User.ts',
          language: 'typescript',
          symbols: [
            {
              name: 'User',
              type: 'interface',
              filePath: 'src/types/User.ts',
              startLine: 3,
              endLine: 10,
              startColumn: 0,
              endColumn: 1,
              exported: true
            },
            {
              name: 'UserRole',
              type: 'enum',
              filePath: 'src/types/User.ts',
              startLine: 15,
              endLine: 20,
              startColumn: 0,
              endColumn: 1,
              exported: true
            }
          ]
        },
        {
          path: 'src/components/Cart.tsx',
          language: 'typescript',
          symbols: [
            {
              name: 'Cart',
              type: 'function',
              filePath: 'src/components/Cart.tsx',
              startLine: 8,
              endLine: 25,
              startColumn: 0,
              endColumn: 1,
              exported: true,
              isDefault: true
            }
          ]
        }
      ],
      references: [
        // References from Cart.tsx to math.ts functions
        {
          symbolName: 'calculateTotal',
          sourceFile: 'src/components/Cart.tsx',
          sourceLine: 15,
          sourceColumn: 20,
          targetFile: 'src/utils/math.ts',
          targetLine: 10,
          targetColumn: 0,
          symbolType: 'function',
          referenceType: 'call'
        },
        {
          symbolName: 'formatPrice',
          sourceFile: 'src/components/Cart.tsx',
          sourceLine: 18,
          sourceColumn: 15,
          targetFile: 'src/utils/math.ts',
          targetLine: 20,
          targetColumn: 0,
          symbolType: 'function',
          referenceType: 'call'
        },
        // References from UserService to User interface
        {
          symbolName: 'User',
          sourceFile: 'src/services/UserService.ts',
          sourceLine: 8,
          sourceColumn: 25,
          targetFile: 'src/types/User.ts',
          targetLine: 3,
          targetColumn: 0,
          symbolType: 'interface',
          referenceType: 'type'
        },
        {
          symbolName: 'UserRole',
          sourceFile: 'src/services/UserService.ts',
          sourceLine: 12,
          sourceColumn: 15,
          targetFile: 'src/types/User.ts',
          targetLine: 15,
          targetColumn: 0,
          symbolType: 'enum',
          referenceType: 'type'
        },
        // Self-reference within UserService (method calling another method)
        {
          symbolName: 'updateUser',
          sourceFile: 'src/services/UserService.ts',
          sourceLine: 14,
          sourceColumn: 10,
          targetFile: 'src/services/UserService.ts',
          targetLine: 20,
          targetColumn: 2,
          symbolType: 'method',
          referenceType: 'call'
        }
      ]
    });

    resolver = new SymbolResolver(mockRepositoryMap);
  });

  describe('findDefinition', () => {
    it('should find definition for a function symbol', () => {
      const definition = resolver.findDefinition('calculateTotal');

      expect(definition).not.toBeNull();
      expect(definition!.symbol.name).toBe('calculateTotal');
      expect(definition!.symbol.type).toBe('function');
      expect(definition!.filePath).toBe('src/utils/math.ts');
      expect(definition!.line).toBe(10);
      expect(definition!.column).toBe(0);
    });

    it('should find definition for a class symbol', () => {
      const definition = resolver.findDefinition('UserService');

      expect(definition).not.toBeNull();
      expect(definition!.symbol.name).toBe('UserService');
      expect(definition!.symbol.type).toBe('class');
      expect(definition!.filePath).toBe('src/services/UserService.ts');
      expect(definition!.line).toBe(5);
      expect(definition!.column).toBe(0);
    });

    it('should find definition for an interface symbol', () => {
      const definition = resolver.findDefinition('User');

      expect(definition).not.toBeNull();
      expect(definition!.symbol.name).toBe('User');
      expect(definition!.symbol.type).toBe('interface');
      expect(definition!.filePath).toBe('src/types/User.ts');
      expect(definition!.line).toBe(3);
      expect(definition!.column).toBe(0);
    });

    it('should find definition for an enum symbol', () => {
      const definition = resolver.findDefinition('UserRole');

      expect(definition).not.toBeNull();
      expect(definition!.symbol.name).toBe('UserRole');
      expect(definition!.symbol.type).toBe('enum');
      expect(definition!.filePath).toBe('src/types/User.ts');
      expect(definition!.line).toBe(15);
      expect(definition!.column).toBe(0);
    });

    it('should find definition for a method symbol', () => {
      const definition = resolver.findDefinition('getUser');

      expect(definition).not.toBeNull();
      expect(definition!.symbol.name).toBe('getUser');
      expect(definition!.symbol.type).toBe('method');
      expect(definition!.filePath).toBe('src/services/UserService.ts');
      expect(definition!.line).toBe(10);
      expect(definition!.column).toBe(2);
      expect(definition!.symbol.parent).toBe('UserService');
    });

    it('should find definition for a constant symbol', () => {
      const definition = resolver.findDefinition('PI_CONSTANT');

      expect(definition).not.toBeNull();
      expect(definition!.symbol.name).toBe('PI_CONSTANT');
      expect(definition!.symbol.type).toBe('constant');
      expect(definition!.filePath).toBe('src/utils/math.ts');
      expect(definition!.line).toBe(5);
      expect(definition!.column).toBe(0);
    });

    it('should return null for non-existent symbol', () => {
      const definition = resolver.findDefinition('nonExistentFunction');

      expect(definition).toBeNull();
    });

    it('should handle empty symbol name', () => {
      const definition = resolver.findDefinition('');

      expect(definition).toBeNull();
    });

    it('should be case-sensitive', () => {
      const definition = resolver.findDefinition('CALCULATETOTAL');

      expect(definition).toBeNull();
    });
  });

  describe('findReferences', () => {
    it('should find all references to a function symbol', () => {
      const result = resolver.findReferences('calculateTotal');

      expect(result).not.toBeNull();
      expect(result!.symbol.name).toBe('calculateTotal');
      expect(result!.references).toHaveLength(1);

      const ref = result!.references[0];
      expect(ref.reference.symbolName).toBe('calculateTotal');
      expect(ref.filePath).toBe('src/components/Cart.tsx');
      expect(ref.line).toBe(15);
      expect(ref.column).toBe(20);
    });

    it('should find all references to an interface symbol', () => {
      const result = resolver.findReferences('User');

      expect(result).not.toBeNull();
      expect(result!.symbol.name).toBe('User');
      expect(result!.references).toHaveLength(1);

      const ref = result!.references[0];
      expect(ref.reference.symbolName).toBe('User');
      expect(ref.filePath).toBe('src/services/UserService.ts');
      expect(ref.line).toBe(8);
      expect(ref.column).toBe(25);
    });

    it('should find multiple references to the same symbol', () => {
      // Add another reference to formatPrice for this test
      const additionalRef = {
        symbolName: 'formatPrice',
        sourceFile: 'src/services/UserService.ts',
        sourceLine: 25,
        sourceColumn: 10,
        targetFile: 'src/utils/math.ts',
        targetLine: 20,
        targetColumn: 0,
        symbolType: 'function' as const,
        referenceType: 'call' as const
      };
      mockRepositoryMap.references.push(additionalRef);
      resolver = new SymbolResolver(mockRepositoryMap);

      const result = resolver.findReferences('formatPrice');

      expect(result).not.toBeNull();
      expect(result!.references).toHaveLength(2);

      const filePaths = result!.references.map(ref => ref.filePath);
      expect(filePaths).toContain('src/components/Cart.tsx');
      expect(filePaths).toContain('src/services/UserService.ts');
    });

    it('should find self-references within same file', () => {
      const result = resolver.findReferences('updateUser');

      expect(result).not.toBeNull();
      expect(result!.symbol.name).toBe('updateUser');
      expect(result!.references).toHaveLength(1);

      const ref = result!.references[0];
      expect(ref.reference.symbolName).toBe('updateUser');
      expect(ref.filePath).toBe('src/services/UserService.ts');
      expect(ref.line).toBe(14);
      expect(ref.column).toBe(10);
    });

    it('should return null for symbol without definition', () => {
      const result = resolver.findReferences('nonExistentSymbol');

      expect(result).toBeNull();
    });

    it('should return empty references array for symbol with no references', () => {
      const result = resolver.findReferences('Cart');

      expect(result).not.toBeNull();
      expect(result!.symbol.name).toBe('Cart');
      expect(result!.references).toHaveLength(0);
    });
  });

  describe('findSymbolsInFile', () => {
    it('should find all symbols in a specific file', () => {
      const symbols = resolver.findSymbolsInFile('src/utils/math.ts');

      expect(symbols).toHaveLength(3);

      const symbolNames = symbols.map(def => def.symbol.name);
      expect(symbolNames).toContain('calculateTotal');
      expect(symbolNames).toContain('formatPrice');
      expect(symbolNames).toContain('PI_CONSTANT');

      // Verify structure of one symbol
      const calculateTotalDef = symbols.find(def => def.symbol.name === 'calculateTotal');
      expect(calculateTotalDef!.filePath).toBe('src/utils/math.ts');
      expect(calculateTotalDef!.line).toBe(10);
      expect(calculateTotalDef!.column).toBe(0);
    });

    it('should return empty array for non-existent file', () => {
      const symbols = resolver.findSymbolsInFile('src/nonexistent.ts');

      expect(symbols).toHaveLength(0);
    });

    it('should return empty array for file with no symbols', () => {
      // Add a file with no symbols to the repository map
      mockRepositoryMap.files.push({
        path: 'src/empty.ts',
        language: 'typescript',
        symbols: []
      });
      resolver = new SymbolResolver(mockRepositoryMap);

      const symbols = resolver.findSymbolsInFile('src/empty.ts');

      expect(symbols).toHaveLength(0);
    });
  });

  describe('findReferencesFromFile', () => {
    it('should find all references originating from a specific file', () => {
      const references = resolver.findReferencesFromFile('src/components/Cart.tsx');

      expect(references).toHaveLength(2);

      const symbolNames = references.map(ref => ref.reference.symbolName);
      expect(symbolNames).toContain('calculateTotal');
      expect(symbolNames).toContain('formatPrice');

      // Verify structure
      const calculateTotalRef = references.find(ref => ref.reference.symbolName === 'calculateTotal');
      expect(calculateTotalRef!.filePath).toBe('src/components/Cart.tsx');
      expect(calculateTotalRef!.line).toBe(15);
      expect(calculateTotalRef!.column).toBe(20);
    });

    it('should return empty array for file with no outgoing references', () => {
      const references = resolver.findReferencesFromFile('src/types/User.ts');

      expect(references).toHaveLength(0);
    });

    it('should return empty array for non-existent file', () => {
      const references = resolver.findReferencesFromFile('src/nonexistent.ts');

      expect(references).toHaveLength(0);
    });
  });

  describe('findReferencesToFile', () => {
    it('should find all references targeting a specific file', () => {
      const references = resolver.findReferencesToFile('src/utils/math.ts');

      expect(references).toHaveLength(2);

      const symbolNames = references.map(ref => ref.reference.symbolName);
      expect(symbolNames).toContain('calculateTotal');
      expect(symbolNames).toContain('formatPrice');

      // All should originate from Cart.tsx for math.ts
      references.forEach(ref => {
        expect(ref.filePath).toBe('src/components/Cart.tsx');
      });
    });

    it('should find references to interface file', () => {
      const references = resolver.findReferencesToFile('src/types/User.ts');

      expect(references).toHaveLength(2);

      const symbolNames = references.map(ref => ref.reference.symbolName);
      expect(symbolNames).toContain('User');
      expect(symbolNames).toContain('UserRole');

      // All should originate from UserService.ts
      references.forEach(ref => {
        expect(ref.filePath).toBe('src/services/UserService.ts');
      });
    });

    it('should return empty array for file with no incoming references', () => {
      const references = resolver.findReferencesToFile('src/components/Cart.tsx');

      expect(references).toHaveLength(0);
    });

    it('should return empty array for non-existent file', () => {
      const references = resolver.findReferencesToFile('src/nonexistent.ts');

      expect(references).toHaveLength(0);
    });
  });

  describe('findSymbolsByType', () => {
    it('should find all function symbols', () => {
      const functions = resolver.findSymbolsByType('function');

      expect(functions).toHaveLength(3); // calculateTotal, formatPrice, Cart

      const functionNames = functions.map(def => def.symbol.name);
      expect(functionNames).toContain('calculateTotal');
      expect(functionNames).toContain('formatPrice');
      expect(functionNames).toContain('Cart');

      // Verify all are actually functions
      functions.forEach(func => {
        expect(func.symbol.type).toBe('function');
      });
    });

    it('should find all class symbols', () => {
      const classes = resolver.findSymbolsByType('class');

      expect(classes).toHaveLength(1);
      expect(classes[0].symbol.name).toBe('UserService');
      expect(classes[0].filePath).toBe('src/services/UserService.ts');
    });

    it('should find all interface symbols', () => {
      const interfaces = resolver.findSymbolsByType('interface');

      expect(interfaces).toHaveLength(1);
      expect(interfaces[0].symbol.name).toBe('User');
      expect(interfaces[0].filePath).toBe('src/types/User.ts');
    });

    it('should find all method symbols', () => {
      const methods = resolver.findSymbolsByType('method');

      expect(methods).toHaveLength(2); // getUser, updateUser

      const methodNames = methods.map(def => def.symbol.name);
      expect(methodNames).toContain('getUser');
      expect(methodNames).toContain('updateUser');

      // Verify all belong to UserService
      methods.forEach(method => {
        expect(method.symbol.parent).toBe('UserService');
      });
    });

    it('should find all enum symbols', () => {
      const enums = resolver.findSymbolsByType('enum');

      expect(enums).toHaveLength(1);
      expect(enums[0].symbol.name).toBe('UserRole');
      expect(enums[0].filePath).toBe('src/types/User.ts');
    });

    it('should find all constant symbols', () => {
      const constants = resolver.findSymbolsByType('constant');

      expect(constants).toHaveLength(1);
      expect(constants[0].symbol.name).toBe('PI_CONSTANT');
      expect(constants[0].filePath).toBe('src/utils/math.ts');
    });

    it('should return empty array for non-existent symbol type', () => {
      const unknowns = resolver.findSymbolsByType('unknown');

      expect(unknowns).toHaveLength(0);
    });
  });

  describe('getStatistics', () => {
    it('should return accurate statistics', () => {
      const stats = resolver.getStatistics();

      expect(stats.totalSymbols).toBe(9); // All symbols across all files
      expect(stats.totalReferences).toBe(5); // All references
      expect(stats.totalFiles).toBe(4); // All files
      expect(stats.filesWithSymbols).toBe(4); // All files have symbols
      expect(stats.filesWithReferences).toBe(2); // Cart.tsx and UserService.ts have outgoing references

      // Check symbol breakdown
      expect(stats.symbolsByType['function']).toBe(3);
      expect(stats.symbolsByType['class']).toBe(1);
      expect(stats.symbolsByType['interface']).toBe(1);
      expect(stats.symbolsByType['method']).toBe(2);
      expect(stats.symbolsByType['enum']).toBe(1);
      expect(stats.symbolsByType['constant']).toBe(1);
    });

    it('should handle empty repository', () => {
      const emptyRepo = RepositoryMapSchema.parse({
        rootPath: '/empty/project'
      });
      const emptyResolver = new SymbolResolver(emptyRepo);

      const stats = emptyResolver.getStatistics();

      expect(stats.totalSymbols).toBe(0);
      expect(stats.totalReferences).toBe(0);
      expect(stats.totalFiles).toBe(0);
      expect(stats.filesWithSymbols).toBe(0);
      expect(stats.filesWithReferences).toBe(0);
      expect(Object.keys(stats.symbolsByType)).toHaveLength(0);
    });

    it('should handle repository with files but no symbols', () => {
      const repoWithNoSymbols = RepositoryMapSchema.parse({
        rootPath: '/test/project',
        files: [
          { path: 'empty1.ts', language: 'typescript' },
          { path: 'empty2.ts', language: 'typescript' }
        ]
      });
      const resolver = new SymbolResolver(repoWithNoSymbols);

      const stats = resolver.getStatistics();

      expect(stats.totalSymbols).toBe(0);
      expect(stats.totalReferences).toBe(0);
      expect(stats.totalFiles).toBe(2);
      expect(stats.filesWithSymbols).toBe(0);
      expect(stats.filesWithReferences).toBe(0);
      expect(Object.keys(stats.symbolsByType)).toHaveLength(0);
    });
  });

  describe('cross-file resolution', () => {
    it('should correctly resolve symbols across multiple files', () => {
      // Test that we can find a symbol in one file and its references in another
      const definition = resolver.findDefinition('calculateTotal');
      const references = resolver.findReferences('calculateTotal');

      expect(definition).not.toBeNull();
      expect(references).not.toBeNull();

      // Definition should be in math.ts
      expect(definition!.filePath).toBe('src/utils/math.ts');

      // Reference should be in Cart.tsx
      expect(references!.references).toHaveLength(1);
      expect(references!.references[0].filePath).toBe('src/components/Cart.tsx');

      // The definition and reference should point to the same symbol
      expect(definition!.symbol.name).toBe(references!.symbol.name);
    });

    it('should handle complex cross-file type relationships', () => {
      // Test interface usage across files
      const userDefinition = resolver.findDefinition('User');
      const userReferences = resolver.findReferences('User');

      expect(userDefinition!.filePath).toBe('src/types/User.ts');
      expect(userReferences!.references[0].filePath).toBe('src/services/UserService.ts');

      // Test enum usage across files
      const roleDefinition = resolver.findDefinition('UserRole');
      const roleReferences = resolver.findReferences('UserRole');

      expect(roleDefinition!.filePath).toBe('src/types/User.ts');
      expect(roleReferences!.references[0].filePath).toBe('src/services/UserService.ts');
    });

    it('should track dependencies between files accurately', () => {
      // UserService.ts depends on types from User.ts
      const referencesFromUserService = resolver.findReferencesFromFile('src/services/UserService.ts');
      const referencesToUserTypes = resolver.findReferencesToFile('src/types/User.ts');

      expect(referencesFromUserService).toHaveLength(3); // User, UserRole, updateUser
      expect(referencesToUserTypes).toHaveLength(2); // User, UserRole

      // Cart.tsx depends on functions from math.ts
      const referencesFromCart = resolver.findReferencesFromFile('src/components/Cart.tsx');
      const referencesToMath = resolver.findReferencesToFile('src/utils/math.ts');

      expect(referencesFromCart).toHaveLength(2); // calculateTotal, formatPrice
      expect(referencesToMath).toHaveLength(2); // calculateTotal, formatPrice
    });
  });

  describe('edge cases', () => {
    it('should handle repository with no files', () => {
      const emptyRepo = RepositoryMapSchema.parse({
        rootPath: '/empty/project',
        files: []
      });
      const emptyResolver = new SymbolResolver(emptyRepo);

      expect(emptyResolver.findDefinition('anything')).toBeNull();
      expect(emptyResolver.findReferences('anything')).toBeNull();
      expect(emptyResolver.findSymbolsInFile('any/file.ts')).toHaveLength(0);
      expect(emptyResolver.findReferencesFromFile('any/file.ts')).toHaveLength(0);
      expect(emptyResolver.findReferencesToFile('any/file.ts')).toHaveLength(0);
      expect(emptyResolver.findSymbolsByType('function')).toHaveLength(0);
    });

    it('should handle symbols with undefined optional properties', () => {
      const repoWithMinimalSymbol = RepositoryMapSchema.parse({
        rootPath: '/test/project',
        files: [
          {
            path: 'minimal.ts',
            language: 'typescript',
            symbols: [
              {
                name: 'minimalFunction',
                type: 'function',
                filePath: 'minimal.ts',
                startLine: 1,
                endLine: 1
                // No startColumn, endColumn, or other optional properties
              }
            ]
          }
        ]
      });
      const resolver = new SymbolResolver(repoWithMinimalSymbol);

      const definition = resolver.findDefinition('minimalFunction');
      expect(definition).not.toBeNull();
      expect(definition!.column).toBeUndefined();
    });

    it('should handle references with undefined optional properties', () => {
      const repoWithMinimalReference = RepositoryMapSchema.parse({
        rootPath: '/test/project',
        files: [
          {
            path: 'source.ts',
            symbols: [
              { name: 'test', type: 'function', filePath: 'source.ts', startLine: 1, endLine: 1 }
            ]
          }
        ],
        references: [
          {
            symbolName: 'test',
            sourceFile: 'source.ts',
            sourceLine: 5,
            targetFile: 'source.ts'
            // No sourceColumn, targetLine, targetColumn
          }
        ]
      });
      const resolver = new SymbolResolver(repoWithMinimalReference);

      const references = resolver.findReferences('test');
      expect(references).not.toBeNull();
      expect(references!.references[0].column).toBeUndefined();
    });

    it('should handle duplicate symbol names in different files', () => {
      const repoWithDuplicates = RepositoryMapSchema.parse({
        rootPath: '/test/project',
        files: [
          {
            path: 'file1.ts',
            symbols: [
              { name: 'duplicateSymbol', type: 'function', filePath: 'file1.ts', startLine: 1, endLine: 1 }
            ]
          },
          {
            path: 'file2.ts',
            symbols: [
              { name: 'duplicateSymbol', type: 'class', filePath: 'file2.ts', startLine: 1, endLine: 1 }
            ]
          }
        ]
      });
      const resolver = new SymbolResolver(repoWithDuplicates);

      // findDefinition should return the first match found
      const definition = resolver.findDefinition('duplicateSymbol');
      expect(definition).not.toBeNull();
      // This will depend on file processing order, but should return one of them
      expect(['file1.ts', 'file2.ts']).toContain(definition!.filePath);
    });

    it('should handle circular references', () => {
      const repoWithCircularRefs = RepositoryMapSchema.parse({
        rootPath: '/test/project',
        files: [
          {
            path: 'moduleA.ts',
            symbols: [
              { name: 'functionA', type: 'function', filePath: 'moduleA.ts', startLine: 1, endLine: 1 }
            ]
          },
          {
            path: 'moduleB.ts',
            symbols: [
              { name: 'functionB', type: 'function', filePath: 'moduleB.ts', startLine: 1, endLine: 1 }
            ]
          }
        ],
        references: [
          {
            symbolName: 'functionB',
            sourceFile: 'moduleA.ts',
            sourceLine: 5,
            targetFile: 'moduleB.ts'
          },
          {
            symbolName: 'functionA',
            sourceFile: 'moduleB.ts',
            sourceLine: 5,
            targetFile: 'moduleA.ts'
          }
        ]
      });
      const resolver = new SymbolResolver(repoWithCircularRefs);

      const refsA = resolver.findReferences('functionA');
      const refsB = resolver.findReferences('functionB');

      expect(refsA).not.toBeNull();
      expect(refsB).not.toBeNull();
      expect(refsA!.references).toHaveLength(1);
      expect(refsB!.references).toHaveLength(1);
      expect(refsA!.references[0].filePath).toBe('moduleB.ts');
      expect(refsB!.references[0].filePath).toBe('moduleA.ts');
    });

    it('should handle large symbol names and special characters', () => {
      const longSymbolName = 'a'.repeat(1000);
      const specialCharSymbol = '__special$symbol_123__';

      const repoWithSpecialNames = RepositoryMapSchema.parse({
        rootPath: '/test/project',
        files: [
          {
            path: 'special.ts',
            symbols: [
              { name: longSymbolName, type: 'variable', filePath: 'special.ts', startLine: 1, endLine: 1 },
              { name: specialCharSymbol, type: 'function', filePath: 'special.ts', startLine: 5, endLine: 5 }
            ]
          }
        ]
      });
      const resolver = new SymbolResolver(repoWithSpecialNames);

      const longSymbolDef = resolver.findDefinition(longSymbolName);
      const specialSymbolDef = resolver.findDefinition(specialCharSymbol);

      expect(longSymbolDef).not.toBeNull();
      expect(longSymbolDef!.symbol.name).toBe(longSymbolName);
      expect(specialSymbolDef).not.toBeNull();
      expect(specialSymbolDef!.symbol.name).toBe(specialCharSymbol);
    });
  });

  describe('functionality verification', () => {
    it('should correctly implement findDefinition method requirements', () => {
      // Verify the method signature and behavior as specified in acceptance criteria
      const definition = resolver.findDefinition('calculateTotal');

      // Should return SymbolDefinition interface with correct structure
      expect(definition).toHaveProperty('symbol');
      expect(definition).toHaveProperty('filePath');
      expect(definition).toHaveProperty('line');
      expect(definition).toHaveProperty('column');

      // Should resolve symbols across files using RepositoryMap
      expect(definition!.symbol.name).toBe('calculateTotal');
      expect(definition!.filePath).toBe('src/utils/math.ts');
      expect(typeof definition!.line).toBe('number');
    });

    it('should correctly implement findReferences method requirements', () => {
      // Verify the method signature and behavior as specified in acceptance criteria
      const references = resolver.findReferences('calculateTotal');

      // Should return SymbolReferencesResult interface with correct structure
      expect(references).toHaveProperty('symbol');
      expect(references).toHaveProperty('references');
      expect(Array.isArray(references!.references)).toBe(true);

      // Should resolve symbol references across files using RepositoryMap
      expect(references!.symbol.name).toBe('calculateTotal');
      expect(references!.references).toHaveLength(1);
      expect(references!.references[0]).toHaveProperty('reference');
      expect(references!.references[0]).toHaveProperty('filePath');
      expect(references!.references[0]).toHaveProperty('line');
      expect(references!.references[0]).toHaveProperty('column');
    });

    it('should demonstrate cross-file resolution capability', () => {
      // Core requirement: verify cross-file resolution works correctly
      const mathSymbols = resolver.findSymbolsInFile('src/utils/math.ts');
      const cartReferences = resolver.findReferencesFromFile('src/components/Cart.tsx');

      // Should find symbols defined in math.ts
      expect(mathSymbols.length).toBeGreaterThan(0);
      const calculateTotalSymbol = mathSymbols.find(s => s.symbol.name === 'calculateTotal');
      expect(calculateTotalSymbol).not.toBeNull();

      // Should find references from Cart.tsx to math.ts symbols
      expect(cartReferences.length).toBeGreaterThan(0);
      const calculateTotalRef = cartReferences.find(r => r.reference.symbolName === 'calculateTotal');
      expect(calculateTotalRef).not.toBeNull();
      expect(calculateTotalRef!.reference.targetFile).toBe('src/utils/math.ts');
    });

    it('should verify SymbolResolver class instantiation', () => {
      // Should create instance with RepositoryMap
      expect(resolver).toBeInstanceOf(SymbolResolver);
      expect(resolver).toHaveProperty('findDefinition');
      expect(resolver).toHaveProperty('findReferences');

      // Methods should be functions
      expect(typeof resolver.findDefinition).toBe('function');
      expect(typeof resolver.findReferences).toBe('function');
      expect(typeof resolver.findSymbolsInFile).toBe('function');
      expect(typeof resolver.findReferencesFromFile).toBe('function');
      expect(typeof resolver.findReferencesToFile).toBe('function');
      expect(typeof resolver.findSymbolsByType).toBe('function');
      expect(typeof resolver.getStatistics).toBe('function');
    });

    it('should handle all symbol types correctly', () => {
      // Test that all supported symbol types from SymbolTypeSchema work
      const symbolTypes = ['function', 'class', 'interface', 'enum', 'method', 'constant'];

      symbolTypes.forEach(symbolType => {
        const symbols = resolver.findSymbolsByType(symbolType);
        symbols.forEach(symbolDef => {
          expect(symbolDef.symbol.type).toBe(symbolType);
          expect(symbolDef).toHaveProperty('filePath');
          expect(symbolDef).toHaveProperty('line');
        });
      });
    });

    it('should maintain referential integrity between symbols and references', () => {
      // For each reference, the target symbol should exist
      mockRepositoryMap.references.forEach(ref => {
        const targetSymbol = resolver.findDefinition(ref.symbolName);
        expect(targetSymbol).not.toBeNull();
        expect(targetSymbol!.filePath).toBe(ref.targetFile);
      });
    });

    it('should provide accurate statistics', () => {
      const stats = resolver.getStatistics();

      // Verify statistics match actual data
      const allSymbols = mockRepositoryMap.files.flatMap(f => f.symbols || []);
      expect(stats.totalSymbols).toBe(allSymbols.length);
      expect(stats.totalReferences).toBe(mockRepositoryMap.references.length);
      expect(stats.totalFiles).toBe(mockRepositoryMap.files.length);

      // Verify symbol type breakdown
      const actualBreakdown = allSymbols.reduce((acc, symbol) => {
        acc[symbol.type] = (acc[symbol.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(actualBreakdown).forEach(([type, count]) => {
        expect(stats.symbolsByType[type]).toBe(count);
      });
    });
  });

  describe('integration tests', () => {
    it('should handle complex nested class hierarchies', () => {
      const complexRepo = RepositoryMapSchema.parse({
        rootPath: '/complex/project',
        files: [
          {
            path: 'base/Animal.ts',
            symbols: [
              { name: 'Animal', type: 'class', filePath: 'base/Animal.ts', startLine: 1, endLine: 10 },
              { name: 'move', type: 'method', filePath: 'base/Animal.ts', startLine: 5, endLine: 7, parent: 'Animal' }
            ]
          },
          {
            path: 'mammals/Dog.ts',
            symbols: [
              { name: 'Dog', type: 'class', filePath: 'mammals/Dog.ts', startLine: 1, endLine: 15 },
              { name: 'bark', type: 'method', filePath: 'mammals/Dog.ts', startLine: 8, endLine: 10, parent: 'Dog' },
              { name: 'move', type: 'method', filePath: 'mammals/Dog.ts', startLine: 12, endLine: 14, parent: 'Dog' }
            ]
          }
        ],
        references: [
          {
            symbolName: 'Animal',
            sourceFile: 'mammals/Dog.ts',
            sourceLine: 1,
            targetFile: 'base/Animal.ts',
            referenceType: 'extension'
          },
          {
            symbolName: 'move',
            sourceFile: 'mammals/Dog.ts',
            sourceLine: 13,
            targetFile: 'base/Animal.ts',
            referenceType: 'call'
          }
        ]
      });
      const resolver = new SymbolResolver(complexRepo);

      // Should find base class
      const animalDef = resolver.findDefinition('Animal');
      expect(animalDef!.filePath).toBe('base/Animal.ts');

      // Should find derived class
      const dogDef = resolver.findDefinition('Dog');
      expect(dogDef!.filePath).toBe('mammals/Dog.ts');

      // Should track inheritance reference
      const animalRefs = resolver.findReferences('Animal');
      expect(animalRefs!.references).toHaveLength(1);
      expect(animalRefs!.references[0].filePath).toBe('mammals/Dog.ts');

      // Should handle method overriding (multiple methods with same name)
      const moveMethods = resolver.findSymbolsByType('method').filter(s => s.symbol.name === 'move');
      expect(moveMethods).toHaveLength(2);
      expect(moveMethods.map(m => m.filePath)).toContain('base/Animal.ts');
      expect(moveMethods.map(m => m.filePath)).toContain('mammals/Dog.ts');
    });

    it('should handle complex module import/export scenarios', () => {
      const moduleRepo = RepositoryMapSchema.parse({
        rootPath: '/module/project',
        files: [
          {
            path: 'utils/index.ts',
            symbols: [
              { name: 'exported1', type: 'function', filePath: 'utils/index.ts', startLine: 1, endLine: 1, exported: true },
              { name: 'exported2', type: 'constant', filePath: 'utils/index.ts', startLine: 3, endLine: 3, exported: true },
              { name: 'internal', type: 'variable', filePath: 'utils/index.ts', startLine: 5, endLine: 5, exported: false }
            ]
          },
          {
            path: 'components/Component1.tsx',
            symbols: [
              { name: 'Component1', type: 'function', filePath: 'components/Component1.tsx', startLine: 1, endLine: 10, exported: true }
            ]
          },
          {
            path: 'components/Component2.tsx',
            symbols: [
              { name: 'Component2', type: 'function', filePath: 'components/Component2.tsx', startLine: 1, endLine: 10, exported: true }
            ]
          },
          {
            path: 'main.ts',
            symbols: [
              { name: 'main', type: 'function', filePath: 'main.ts', startLine: 1, endLine: 20 }
            ]
          }
        ],
        references: [
          // Multiple imports from same file
          {
            symbolName: 'exported1',
            sourceFile: 'main.ts',
            sourceLine: 5,
            targetFile: 'utils/index.ts',
            referenceType: 'import'
          },
          {
            symbolName: 'exported2',
            sourceFile: 'main.ts',
            sourceLine: 5,
            targetFile: 'utils/index.ts',
            referenceType: 'import'
          },
          // Component cross-references
          {
            symbolName: 'Component1',
            sourceFile: 'components/Component2.tsx',
            sourceLine: 8,
            targetFile: 'components/Component1.tsx',
            referenceType: 'call'
          }
        ]
      });
      const resolver = new SymbolResolver(moduleRepo);

      // Should track multiple imports from same file
      const utilsRefs = resolver.findReferencesToFile('utils/index.ts');
      expect(utilsRefs).toHaveLength(2);
      expect(utilsRefs.every(ref => ref.filePath === 'main.ts')).toBe(true);

      // Should track component cross-references
      const component1Refs = resolver.findReferences('Component1');
      expect(component1Refs!.references).toHaveLength(1);
      expect(component1Refs!.references[0].filePath).toBe('components/Component2.tsx');

      // Should distinguish exported vs internal symbols
      const exportedSymbols = resolver.findSymbolsInFile('utils/index.ts')
        .filter(s => s.symbol.exported === true);
      const internalSymbols = resolver.findSymbolsInFile('utils/index.ts')
        .filter(s => s.symbol.exported === false);

      expect(exportedSymbols).toHaveLength(2);
      expect(internalSymbols).toHaveLength(1);
      expect(internalSymbols[0].symbol.name).toBe('internal');
    });

    it('should handle generic type relationships', () => {
      const genericRepo = RepositoryMapSchema.parse({
        rootPath: '/generic/project',
        files: [
          {
            path: 'types/Generic.ts',
            symbols: [
              { name: 'Container', type: 'interface', filePath: 'types/Generic.ts', startLine: 1, endLine: 5 },
              { name: 'T', type: 'generic', filePath: 'types/Generic.ts', startLine: 1, endLine: 1, parent: 'Container' },
              { name: 'Repository', type: 'interface', filePath: 'types/Generic.ts', startLine: 7, endLine: 15 },
              { name: 'E', type: 'generic', filePath: 'types/Generic.ts', startLine: 7, endLine: 7, parent: 'Repository' }
            ]
          },
          {
            path: 'impl/UserRepo.ts',
            symbols: [
              { name: 'UserRepository', type: 'class', filePath: 'impl/UserRepo.ts', startLine: 1, endLine: 20 }
            ]
          }
        ],
        references: [
          {
            symbolName: 'Repository',
            sourceFile: 'impl/UserRepo.ts',
            sourceLine: 1,
            targetFile: 'types/Generic.ts',
            referenceType: 'type'
          },
          {
            symbolName: 'Container',
            sourceFile: 'impl/UserRepo.ts',
            sourceLine: 10,
            targetFile: 'types/Generic.ts',
            referenceType: 'type'
          }
        ]
      });
      const resolver = new SymbolResolver(genericRepo);

      // Should find generic type parameters
      const generics = resolver.findSymbolsByType('generic');
      expect(generics).toHaveLength(2);
      expect(generics.map(g => g.symbol.name)).toContain('T');
      expect(generics.map(g => g.symbol.name)).toContain('E');

      // Should track generic type usage
      const repositoryRefs = resolver.findReferences('Repository');
      expect(repositoryRefs!.references).toHaveLength(1);
      expect(repositoryRefs!.references[0].filePath).toBe('impl/UserRepo.ts');
    });
  });

  describe('performance tests', () => {
    it('should handle large repository efficiently', () => {
      const startTime = Date.now();

      // Create a large repository with many files and symbols
      const largeFiles = Array.from({ length: 100 }, (_, i) => ({
        path: `file${i}.ts`,
        language: 'typescript',
        symbols: Array.from({ length: 10 }, (_, j) => ({
          name: `symbol${i}_${j}`,
          type: 'function' as const,
          filePath: `file${i}.ts`,
          startLine: j + 1,
          endLine: j + 1,
          exported: j % 2 === 0
        }))
      }));

      // Create cross-references between files
      const largeReferences = Array.from({ length: 500 }, (_, i) => ({
        symbolName: `symbol${i % 100}_${i % 10}`,
        sourceFile: `file${(i + 1) % 100}.ts`,
        sourceLine: 1,
        targetFile: `file${i % 100}.ts`,
        referenceType: 'call' as const
      }));

      const largeRepo = RepositoryMapSchema.parse({
        rootPath: '/large/project',
        files: largeFiles,
        references: largeReferences
      });

      const resolver = new SymbolResolver(largeRepo);
      const setupTime = Date.now() - startTime;

      // Test findDefinition performance
      const defStartTime = Date.now();
      const definition = resolver.findDefinition('symbol50_5');
      const defTime = Date.now() - defStartTime;

      expect(definition).not.toBeNull();
      expect(defTime).toBeLessThan(100); // Should complete in under 100ms

      // Test findReferences performance
      const refStartTime = Date.now();
      const references = resolver.findReferences('symbol50_5');
      const refTime = Date.now() - refStartTime;

      expect(references).not.toBeNull();
      expect(refTime).toBeLessThan(200); // Should complete in under 200ms

      // Test statistics generation performance
      const statsStartTime = Date.now();
      const stats = resolver.getStatistics();
      const statsTime = Date.now() - statsStartTime;

      expect(stats.totalSymbols).toBe(1000); // 100 files * 10 symbols each
      expect(stats.totalReferences).toBe(500);
      expect(statsTime).toBeLessThan(50); // Statistics should be very fast

      // Overall performance should be reasonable
      expect(setupTime + defTime + refTime + statsTime).toBeLessThan(500);
    });

    it('should scale linearly with repository size', () => {
      // Test with small repository
      const smallRepo = RepositoryMapSchema.parse({
        rootPath: '/small/project',
        files: Array.from({ length: 10 }, (_, i) => ({
          path: `file${i}.ts`,
          symbols: [{ name: `symbol${i}`, type: 'function' as const, filePath: `file${i}.ts`, startLine: 1, endLine: 1 }]
        }))
      });

      // Test with medium repository
      const mediumRepo = RepositoryMapSchema.parse({
        rootPath: '/medium/project',
        files: Array.from({ length: 50 }, (_, i) => ({
          path: `file${i}.ts`,
          symbols: [{ name: `symbol${i}`, type: 'function' as const, filePath: `file${i}.ts`, startLine: 1, endLine: 1 }]
        }))
      });

      const smallResolver = new SymbolResolver(smallRepo);
      const mediumResolver = new SymbolResolver(mediumRepo);

      // Measure findSymbolsByType performance
      const smallStart = Date.now();
      const smallFunctions = smallResolver.findSymbolsByType('function');
      const smallTime = Date.now() - smallStart;

      const mediumStart = Date.now();
      const mediumFunctions = mediumResolver.findSymbolsByType('function');
      const mediumTime = Date.now() - mediumStart;

      expect(smallFunctions).toHaveLength(10);
      expect(mediumFunctions).toHaveLength(50);

      // Performance should scale reasonably (not exponentially)
      // Use Math.max to avoid division by zero when both complete in <1ms
      const scaleFactor = mediumTime / Math.max(smallTime, 1);
      expect(scaleFactor).toBeLessThan(10); // Should not be more than 10x slower for 5x more data
    });

    it('should handle pathological cases efficiently', () => {
      // Test with many symbols having the same name (worst case for findDefinition)
      const pathologicalRepo = RepositoryMapSchema.parse({
        rootPath: '/pathological/project',
        files: Array.from({ length: 50 }, (_, i) => ({
          path: `file${i}.ts`,
          symbols: [
            { name: 'commonName', type: 'function' as const, filePath: `file${i}.ts`, startLine: 1, endLine: 1 },
            { name: `unique${i}`, type: 'function' as const, filePath: `file${i}.ts`, startLine: 3, endLine: 3 }
          ]
        })),
        references: Array.from({ length: 100 }, (_, i) => ({
          symbolName: 'commonName',
          sourceFile: `file${i % 50}.ts`,
          sourceLine: 5,
          targetFile: `file${(i + 1) % 50}.ts`,
          referenceType: 'call' as const
        }))
      });

      const resolver = new SymbolResolver(pathologicalRepo);

      // Finding first occurrence should still be fast
      const defStart = Date.now();
      const definition = resolver.findDefinition('commonName');
      const defTime = Date.now() - defStart;

      expect(definition).not.toBeNull();
      expect(defTime).toBeLessThan(50);

      // Finding all references should be reasonable even with many matches
      const refStart = Date.now();
      const references = resolver.findReferences('commonName');
      const refTime = Date.now() - refStart;

      expect(references).not.toBeNull();
      expect(references!.references).toHaveLength(100);
      expect(refTime).toBeLessThan(100);
    });
  });
});