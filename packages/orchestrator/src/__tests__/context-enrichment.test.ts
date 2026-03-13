/**
 * Unit tests for Context Enrichment Service
 *
 * Tests the context enrichment bridge that connects CodebaseIntelligenceService
 * to the prompt system, including:
 * - Task context enrichment
 * - Relevant file detection
 * - Symbol relevance scoring
 * - Token budget management
 * - Content formatting and truncation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  enrichTaskContext,
  formatEnrichedContext,
  type EnrichedContext,
  type RelevantFile,
  type RelevantSymbol
} from '../context-enrichment.js';
import type { CodebaseIntelligenceService } from '../codebase-intelligence/codebase-intelligence-service.js';

// Mock CodebaseIntelligenceService
const mockIntelligenceService = {
  getRepositoryMap: vi.fn(),
  searchCode: vi.fn(),
  getAnalysis: vi.fn()
} as unknown as CodebaseIntelligenceService;

describe('Context Enrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enrichTaskContext', () => {
    it('should handle empty repository map', async () => {
      mockIntelligenceService.getRepositoryMap = vi.fn().mockReturnValue(null);
      mockIntelligenceService.searchCode = vi.fn().mockReturnValue([]);
      mockIntelligenceService.getAnalysis = vi.fn().mockReturnValue(null);

      const context = await enrichTaskContext(
        'Test task',
        mockIntelligenceService
      );

      expect(context.repositoryMap).toBe('');
      expect(context.relevantFiles).toEqual([]);
      expect(context.relevantSymbols).toEqual([]);
      expect(context.importGraph).toBe('');
      expect(context.typeInfo).toBe('');
    });

    it('should build repository map from files with symbols', async () => {
      const mockRepoMap = {
        files: [
          {
            path: 'src/auth.ts',
            symbols: [
              { name: 'authenticate', type: 'function', exported: true },
              { name: 'validateToken', type: 'function', exported: true },
              { name: 'privateHelper', type: 'function', exported: false }
            ]
          },
          {
            path: 'src/types.ts',
            symbols: [
              { name: 'User', type: 'interface', exported: true }
            ]
          },
          {
            path: 'src/utils.ts',
            symbols: []
          }
        ]
      };

      mockIntelligenceService.getRepositoryMap = vi.fn().mockReturnValue(mockRepoMap);
      mockIntelligenceService.searchCode = vi.fn().mockReturnValue([]);
      mockIntelligenceService.getAnalysis = vi.fn().mockReturnValue(null);

      const context = await enrichTaskContext(
        'Implement authentication',
        mockIntelligenceService
      );

      expect(context.repositoryMap).toContain('src/auth.ts [function:authenticate, function:validateToken]');
      expect(context.repositoryMap).toContain('src/types.ts [interface:User]');
      expect(context.repositoryMap).toContain('src/utils.ts');
    });

    it('should limit exported symbols in repository map to 5 per file', async () => {
      const mockRepoMap = {
        files: [
          {
            path: 'src/many-exports.ts',
            symbols: Array.from({ length: 10 }, (_, i) => ({
              name: `export${i}`,
              type: 'function',
              exported: true
            }))
          }
        ]
      };

      mockIntelligenceService.getRepositoryMap = vi.fn().mockReturnValue(mockRepoMap);
      mockIntelligenceService.searchCode = vi.fn().mockReturnValue([]);
      mockIntelligenceService.getAnalysis = vi.fn().mockReturnValue(null);

      const context = await enrichTaskContext(
        'Test task',
        mockIntelligenceService
      );

      // Should only show first 5 exported symbols
      const matches = context.repositoryMap.match(/function:export\d+/g);
      expect(matches).toHaveLength(5);
      expect(context.repositoryMap).toContain('function:export0');
      expect(context.repositoryMap).toContain('function:export4');
      expect(context.repositoryMap).not.toContain('function:export5');
    });

    it('should limit repository map to 50 files and show truncation', async () => {
      const mockRepoMap = {
        files: Array.from({ length: 75 }, (_, i) => ({
          path: `src/file${i}.ts`,
          symbols: []
        }))
      };

      mockIntelligenceService.getRepositoryMap = vi.fn().mockReturnValue(mockRepoMap);
      mockIntelligenceService.searchCode = vi.fn().mockReturnValue([]);
      mockIntelligenceService.getAnalysis = vi.fn().mockReturnValue(null);

      const context = await enrichTaskContext(
        'Test task',
        mockIntelligenceService
      );

      expect(context.repositoryMap).toContain('src/file0.ts');
      expect(context.repositoryMap).toContain('src/file49.ts');
      expect(context.repositoryMap).toContain('... and 25 more files');
      expect(context.repositoryMap).not.toContain('src/file50.ts');
    });

    it('should extract relevant files from search results', async () => {
      const mockSearchResults = [
        {
          file: {
            path: 'src/auth.ts',
            symbols: [
              { name: 'authenticate' },
              { name: 'validateToken' }
            ],
            language: 'typescript'
          },
          score: 0.8,
          symbol: { name: 'authenticate', type: 'function' }
        },
        {
          file: {
            path: 'src/auth.ts', // Same file, should deduplicate
            symbols: [
              { name: 'authenticate' },
              { name: 'validateToken' }
            ],
            language: 'typescript'
          },
          score: 0.7,
          symbol: { name: 'validateToken', type: 'function' }
        },
        {
          file: {
            path: 'src/user.ts',
            symbols: [{ name: 'User' }],
            language: 'typescript'
          },
          score: 0.6,
          symbol: { name: 'User', type: 'interface' }
        }
      ];

      mockIntelligenceService.getRepositoryMap = vi.fn().mockReturnValue(null);
      mockIntelligenceService.searchCode = vi.fn().mockReturnValue(mockSearchResults);
      mockIntelligenceService.getAnalysis = vi.fn().mockReturnValue(null);

      const context = await enrichTaskContext(
        'Implement authentication',
        mockIntelligenceService
      );

      expect(context.relevantFiles).toHaveLength(2); // Deduplicated
      expect(context.relevantFiles[0]).toEqual({
        path: 'src/auth.ts',
        relevanceScore: 0.8,
        symbolCount: 2,
        language: 'typescript'
      });
      expect(context.relevantFiles[1]).toEqual({
        path: 'src/user.ts',
        relevanceScore: 0.6,
        symbolCount: 1,
        language: 'typescript'
      });
    });

    it('should extract relevant symbols from search results', async () => {
      const mockSearchResults = [
        {
          file: { path: 'src/auth.ts', language: 'typescript' },
          score: 0.8,
          symbol: {
            name: 'authenticate',
            type: 'function',
            startLine: 10,
            signature: 'authenticate(token: string): Promise<boolean>'
          }
        },
        {
          file: { path: 'src/user.ts', language: 'typescript' },
          score: 0.6,
          symbol: {
            name: 'User',
            type: 'interface',
            startLine: 5
          }
        },
        {
          file: { path: 'src/utils.ts', language: 'typescript' },
          score: 0.4,
          symbol: null // No symbol
        }
      ];

      mockIntelligenceService.getRepositoryMap = vi.fn().mockReturnValue(null);
      mockIntelligenceService.searchCode = vi.fn().mockReturnValue(mockSearchResults);
      mockIntelligenceService.getAnalysis = vi.fn().mockReturnValue(null);

      const context = await enrichTaskContext(
        'Implement authentication',
        mockIntelligenceService
      );

      expect(context.relevantSymbols).toHaveLength(2);
      expect(context.relevantSymbols[0]).toEqual({
        name: 'authenticate',
        type: 'function',
        file: 'src/auth.ts',
        line: 10,
        signature: 'authenticate(token: string): Promise<boolean>'
      });
      expect(context.relevantSymbols[1]).toEqual({
        name: 'User',
        type: 'interface',
        file: 'src/user.ts',
        line: 5,
        signature: undefined
      });
    });

    it('should limit relevant symbols to 20', async () => {
      const mockSearchResults = Array.from({ length: 25 }, (_, i) => ({
        file: { path: `src/file${i}.ts`, language: 'typescript' },
        score: 0.5,
        symbol: {
          name: `symbol${i}`,
          type: 'function',
          startLine: 1
        }
      }));

      mockIntelligenceService.getRepositoryMap = vi.fn().mockReturnValue(null);
      mockIntelligenceService.searchCode = vi.fn().mockReturnValue(mockSearchResults);
      mockIntelligenceService.getAnalysis = vi.fn().mockReturnValue(null);

      const context = await enrichTaskContext(
        'Test task',
        mockIntelligenceService
      );

      expect(context.relevantSymbols).toHaveLength(20);
      expect(context.relevantSymbols[0].name).toBe('symbol0');
      expect(context.relevantSymbols[19].name).toBe('symbol19');
    });

    it('should build import graph for relevant files', async () => {
      const mockRelevantFiles = [
        { path: 'src/auth.ts', relevanceScore: 0.8, symbolCount: 2, language: 'typescript' },
        { path: 'src/user.ts', relevanceScore: 0.6, symbolCount: 1, language: 'typescript' }
      ];

      const mockAnalysis = {
        importGraph: {
          nodes: [
            { id: 'auth', path: 'src/auth.ts' },
            { id: 'user', path: 'src/user.ts' },
            { id: 'crypto', path: 'crypto' }
          ],
          edges: [
            { from: 'auth', toPath: 'crypto' },
            { from: 'auth', toPath: 'src/user.ts' },
            { from: 'user', toPath: 'uuid' }
          ]
        }
      };

      mockIntelligenceService.getRepositoryMap = vi.fn().mockReturnValue(null);
      mockIntelligenceService.searchCode = vi.fn().mockReturnValue([
        { file: mockRelevantFiles[0], score: 0.8 },
        { file: mockRelevantFiles[1], score: 0.6 }
      ]);
      mockIntelligenceService.getAnalysis = vi.fn().mockReturnValue(mockAnalysis);

      const context = await enrichTaskContext(
        'Implement authentication',
        mockIntelligenceService
      );

      expect(context.importGraph).toContain('src/auth.ts → crypto, src/user.ts');
      expect(context.importGraph).toContain('src/user.ts → uuid');
    });

    it('should handle alternative import graph structure', async () => {
      const mockRelevantFiles = [
        { path: 'src/main.ts', relevanceScore: 0.9, symbolCount: 3, language: 'typescript' }
      ];

      const mockAnalysis = {
        importGraph: {
          nodes: [
            { id: '1', relativePath: 'src/main.ts' }
          ],
          edges: [
            { source: 'src/main.ts', target: 'react' },
            { source: 'src/main.ts', target: 'src/utils.ts' }
          ]
        }
      };

      mockIntelligenceService.getRepositoryMap = vi.fn().mockReturnValue(null);
      mockIntelligenceService.searchCode = vi.fn().mockReturnValue([
        { file: mockRelevantFiles[0], score: 0.9 }
      ]);
      mockIntelligenceService.getAnalysis = vi.fn().mockReturnValue(mockAnalysis);

      const context = await enrichTaskContext(
        'Test task',
        mockIntelligenceService
      );

      expect(context.importGraph).toContain('src/main.ts → react, src/utils.ts');
    });

    it('should build type relationships for relevant files', async () => {
      const mockRelevantFiles = [
        { path: 'src/auth.ts', relevanceScore: 0.8, symbolCount: 2, language: 'typescript' },
        { path: 'src/user.ts', relevanceScore: 0.6, symbolCount: 1, language: 'typescript' }
      ];

      const mockAnalysis = {
        typeRelationships: [
          {
            sourceType: 'User',
            kind: 'extends',
            targetType: 'BaseEntity',
            sourceFile: 'src/user.ts',
            targetFile: 'src/base.ts'
          },
          {
            sourceType: 'AuthService',
            kind: 'implements',
            targetType: 'IAuthService',
            sourceFile: 'src/auth.ts',
            targetFile: 'src/interfaces.ts'
          },
          {
            sourceType: 'Config',
            kind: 'uses',
            targetType: 'DatabaseConfig',
            sourceFile: 'src/config.ts', // Not in relevant files
            targetFile: 'src/db.ts'
          }
        ]
      };

      mockIntelligenceService.getRepositoryMap = vi.fn().mockReturnValue(null);
      mockIntelligenceService.searchCode = vi.fn().mockReturnValue([
        { file: mockRelevantFiles[0], score: 0.8 },
        { file: mockRelevantFiles[1], score: 0.6 }
      ]);
      mockIntelligenceService.getAnalysis = vi.fn().mockReturnValue(mockAnalysis);

      const context = await enrichTaskContext(
        'Implement authentication',
        mockIntelligenceService
      );

      expect(context.typeInfo).toContain('User extends BaseEntity');
      expect(context.typeInfo).toContain('AuthService implements IAuthService');
      expect(context.typeInfo).not.toContain('Config uses DatabaseConfig'); // Not relevant
    });

    it('should limit type relationships to 10', async () => {
      const mockRelevantFiles = [
        { path: 'src/test.ts', relevanceScore: 0.8, symbolCount: 15, language: 'typescript' }
      ];

      const mockAnalysis = {
        typeRelationships: Array.from({ length: 15 }, (_, i) => ({
          sourceType: `Type${i}`,
          kind: 'extends',
          targetType: `BaseType${i}`,
          sourceFile: 'src/test.ts',
          targetFile: 'src/base.ts'
        }))
      };

      mockIntelligenceService.getRepositoryMap = vi.fn().mockReturnValue(null);
      mockIntelligenceService.searchCode = vi.fn().mockReturnValue([
        { file: mockRelevantFiles[0], score: 0.8 }
      ]);
      mockIntelligenceService.getAnalysis = vi.fn().mockReturnValue(mockAnalysis);

      const context = await enrichTaskContext(
        'Test task',
        mockIntelligenceService
      );

      const typeLines = context.typeInfo.split('\n').filter(line => line.trim());
      expect(typeLines).toHaveLength(10);
      expect(context.typeInfo).toContain('Type0 extends BaseType0');
      expect(context.typeInfo).toContain('Type9 extends BaseType9');
      expect(context.typeInfo).not.toContain('Type10 extends BaseType10');
    });

    it('should handle search errors gracefully', async () => {
      mockIntelligenceService.getRepositoryMap = vi.fn().mockReturnValue(null);
      mockIntelligenceService.searchCode = vi.fn().mockImplementation(() => {
        throw new Error('Search index not ready');
      });
      mockIntelligenceService.getAnalysis = vi.fn().mockReturnValue(null);

      const context = await enrichTaskContext(
        'Test task',
        mockIntelligenceService
      );

      expect(context.relevantFiles).toEqual([]);
      expect(context.relevantSymbols).toEqual([]);
      // Should not throw
    });

    it('should handle analysis errors gracefully', async () => {
      mockIntelligenceService.getRepositoryMap = vi.fn().mockReturnValue(null);
      mockIntelligenceService.searchCode = vi.fn().mockReturnValue([]);
      mockIntelligenceService.getAnalysis = vi.fn().mockImplementation(() => {
        throw new Error('Analysis not available');
      });

      const context = await enrichTaskContext(
        'Test task',
        mockIntelligenceService
      );

      expect(context.importGraph).toBe('');
      expect(context.typeInfo).toBe('');
      // Should not throw
    });

    it('should respect token budget with truncation', async () => {
      // Create large repository map
      const mockRepoMap = {
        files: Array.from({ length: 100 }, (_, i) => ({
          path: `src/very-long-file-name-that-takes-up-space-${i}.ts`,
          symbols: []
        }))
      };

      mockIntelligenceService.getRepositoryMap = vi.fn().mockReturnValue(mockRepoMap);
      mockIntelligenceService.searchCode = vi.fn().mockReturnValue([]);
      mockIntelligenceService.getAnalysis = vi.fn().mockReturnValue(null);

      const context = await enrichTaskContext(
        'Test task',
        mockIntelligenceService,
        { maxTokens: 100 } // Very small budget
      );

      // Should fit within ~400 characters (100 tokens * 4 chars/token)
      const totalChars = context.repositoryMap.length + context.importGraph.length + context.typeInfo.length;
      expect(totalChars).toBeLessThan(500); // Some tolerance

      // Should show truncation message
      expect(context.repositoryMap).toContain('...truncated');
    });

    it('should use default token limit when not specified', async () => {
      mockIntelligenceService.getRepositoryMap = vi.fn().mockReturnValue(null);
      mockIntelligenceService.searchCode = vi.fn().mockReturnValue([]);
      mockIntelligenceService.getAnalysis = vi.fn().mockReturnValue(null);

      const context = await enrichTaskContext(
        'Test task',
        mockIntelligenceService
        // No options provided
      );

      // Should work with default (no errors)
      expect(context).toBeDefined();
      expect(context.repositoryMap).toBe('');
    });

    it('should handle files without symbols or language', async () => {
      const mockSearchResults = [
        {
          file: {
            path: 'README.md',
            symbols: null, // No symbols
            language: undefined // No language
          },
          score: 0.5
        }
      ];

      mockIntelligenceService.getRepositoryMap = vi.fn().mockReturnValue(null);
      mockIntelligenceService.searchCode = vi.fn().mockReturnValue(mockSearchResults);
      mockIntelligenceService.getAnalysis = vi.fn().mockReturnValue(null);

      const context = await enrichTaskContext(
        'Test task',
        mockIntelligenceService
      );

      expect(context.relevantFiles[0]).toEqual({
        path: 'README.md',
        relevanceScore: 0.5,
        symbolCount: 0,
        language: 'unknown'
      });
    });
  });

  describe('formatEnrichedContext', () => {
    it('should format empty context', () => {
      const context: EnrichedContext = {
        repositoryMap: '',
        relevantFiles: [],
        relevantSymbols: [],
        importGraph: '',
        typeInfo: ''
      };

      const formatted = formatEnrichedContext(context);
      expect(formatted).toBe('');
    });

    it('should format relevant files section', () => {
      const context: EnrichedContext = {
        repositoryMap: '',
        relevantFiles: [
          {
            path: 'src/auth.ts',
            relevanceScore: 0.85,
            symbolCount: 5,
            language: 'typescript'
          },
          {
            path: 'src/user.ts',
            relevanceScore: 0.67,
            symbolCount: 3,
            language: 'typescript'
          }
        ],
        relevantSymbols: [],
        importGraph: '',
        typeInfo: ''
      };

      const formatted = formatEnrichedContext(context);

      expect(formatted).toContain('### Relevant Files');
      expect(formatted).toContain('- `src/auth.ts` (typescript, 5 symbols, relevance: 85%)');
      expect(formatted).toContain('- `src/user.ts` (typescript, 3 symbols, relevance: 67%)');
    });

    it('should limit relevant files to 10', () => {
      const context: EnrichedContext = {
        repositoryMap: '',
        relevantFiles: Array.from({ length: 15 }, (_, i) => ({
          path: `src/file${i}.ts`,
          relevanceScore: 0.5,
          symbolCount: 2,
          language: 'typescript'
        })),
        relevantSymbols: [],
        importGraph: '',
        typeInfo: ''
      };

      const formatted = formatEnrichedContext(context);
      const fileLines = formatted.split('\n').filter(line => line.includes('src/file'));
      expect(fileLines).toHaveLength(10);
      expect(formatted).toContain('src/file0.ts');
      expect(formatted).toContain('src/file9.ts');
      expect(formatted).not.toContain('src/file10.ts');
    });

    it('should format relevant symbols section', () => {
      const context: EnrichedContext = {
        repositoryMap: '',
        relevantFiles: [],
        relevantSymbols: [
          {
            name: 'authenticate',
            type: 'function',
            file: 'src/auth.ts',
            line: 10,
            signature: 'authenticate(token: string): Promise<boolean>'
          },
          {
            name: 'User',
            type: 'interface',
            file: 'src/user.ts',
            line: 5
          }
        ],
        importGraph: '',
        typeInfo: ''
      };

      const formatted = formatEnrichedContext(context);

      expect(formatted).toContain('### Relevant Symbols');
      expect(formatted).toContain('- `authenticate` (function in src/auth.ts:10): authenticate(token: string): Promise<boolean>');
      expect(formatted).toContain('- `User` (interface in src/user.ts:5)');
    });

    it('should limit relevant symbols to 10', () => {
      const context: EnrichedContext = {
        repositoryMap: '',
        relevantFiles: [],
        relevantSymbols: Array.from({ length: 15 }, (_, i) => ({
          name: `symbol${i}`,
          type: 'function',
          file: `src/file${i}.ts`,
          line: i + 1
        })),
        importGraph: '',
        typeInfo: ''
      };

      const formatted = formatEnrichedContext(context);
      const symbolLines = formatted.split('\n').filter(line => line.includes('symbol'));
      expect(symbolLines).toHaveLength(10);
      expect(formatted).toContain('symbol0');
      expect(formatted).toContain('symbol9');
      expect(formatted).not.toContain('symbol10');
    });

    it('should truncate long signatures to 80 characters', () => {
      const longSignature = 'veryLongFunctionName(param1: VeryLongTypeName, param2: AnotherVeryLongTypeName): Promise<VeryLongReturnType>';

      const context: EnrichedContext = {
        repositoryMap: '',
        relevantFiles: [],
        relevantSymbols: [
          {
            name: 'longFunction',
            type: 'function',
            file: 'src/long.ts',
            line: 1,
            signature: longSignature
          }
        ],
        importGraph: '',
        typeInfo: ''
      };

      const formatted = formatEnrichedContext(context);
      const truncatedSig = longSignature.substring(0, 80);
      expect(formatted).toContain(truncatedSig);
      expect(formatted).not.toContain(longSignature);
    });

    it('should format all sections when present', () => {
      const context: EnrichedContext = {
        repositoryMap: 'src/\n  auth.ts\n  user.ts',
        relevantFiles: [
          {
            path: 'src/auth.ts',
            relevanceScore: 0.8,
            symbolCount: 3,
            language: 'typescript'
          }
        ],
        relevantSymbols: [
          {
            name: 'authenticate',
            type: 'function',
            file: 'src/auth.ts',
            line: 10
          }
        ],
        importGraph: 'src/auth.ts → crypto, jwt',
        typeInfo: 'User extends BaseEntity'
      };

      const formatted = formatEnrichedContext(context);

      expect(formatted).toContain('### Relevant Files');
      expect(formatted).toContain('### Relevant Symbols');
      expect(formatted).toContain('### Repository Structure');
      expect(formatted).toContain('### Import Dependencies');
      expect(formatted).toContain('### Type Relationships');

      expect(formatted).toContain('src/auth.ts → crypto, jwt');
      expect(formatted).toContain('User extends BaseEntity');
    });

    it('should handle symbols without signatures', () => {
      const context: EnrichedContext = {
        repositoryMap: '',
        relevantFiles: [],
        relevantSymbols: [
          {
            name: 'NoSignature',
            type: 'interface',
            file: 'src/types.ts',
            line: 5
            // no signature property
          }
        ],
        importGraph: '',
        typeInfo: ''
      };

      const formatted = formatEnrichedContext(context);

      expect(formatted).toContain('- `NoSignature` (interface in src/types.ts:5)');
      expect(formatted).not.toContain(': '); // No colon for signature
    });

    it('should preserve section order', () => {
      const context: EnrichedContext = {
        repositoryMap: 'repo map',
        relevantFiles: [{ path: 'test.ts', relevanceScore: 0.5, symbolCount: 1, language: 'ts' }],
        relevantSymbols: [{ name: 'test', type: 'function', file: 'test.ts', line: 1 }],
        importGraph: 'import graph',
        typeInfo: 'type info'
      };

      const formatted = formatEnrichedContext(context);
      const sections = formatted.split('\n\n');

      expect(sections[0]).toContain('### Relevant Files');
      expect(sections[1]).toContain('### Relevant Symbols');
      expect(sections[2]).toContain('### Repository Structure');
      expect(sections[3]).toContain('### Import Dependencies');
      expect(sections[4]).toContain('### Type Relationships');
    });
  });
});