/**
 * SemanticSearch - Find code by meaning using natural language queries
 *
 * This module provides intelligent code search capabilities that go beyond
 * simple text matching. It uses multiple search strategies and ranking
 * algorithms to find relevant code symbols based on natural language queries.
 *
 * @example
 * ```typescript
 * const searcher = new SemanticSearch(repositoryMap);
 *
 * // Find functions that validate email addresses
 * const results = searcher.search('function that validates email');
 *
 * // Find similar functions to a given symbol
 * const similar = searcher.findSimilar(emailValidator, { limit: 5 });
 *
 * // Search by example code pattern
 * const byExample = searcher.searchByExample('async function fetch');
 * ```
 */

import type {
  RepositoryMap,
  CodeSymbol,
  CodeFile,
  SymbolType,
} from '@apexcli/core/types';

/**
 * Configuration options for semantic search operations
 */
export interface SemanticSearchOptions {
  /** Maximum number of results to return */
  limit?: number;
  /** Minimum relevance score (0-1) to include in results */
  minScore?: number;
  /** Filter by specific symbol types */
  symbolTypes?: SymbolType[];
  /** Filter by file patterns (glob-like) */
  filePatterns?: string[];
  /** Include documentation content in search */
  includeDocumentation?: boolean;
  /** Search strategy to use */
  strategy?: 'keyword' | 'fuzzy' | 'semantic';
}

/**
 * Search result with relevance scoring and match details
 */
export interface SearchResult {
  /** The matched symbol */
  symbol: CodeSymbol;
  /** File containing the symbol */
  file: CodeFile;
  /** Relevance score (0-1, higher is better) */
  score: number;
  /** Type of match that contributed most to the score */
  matchType: 'name' | 'signature' | 'documentation' | 'context';
  /** Highlighted code snippet showing the match */
  snippet?: string;
  /** Detailed breakdown of how the score was calculated */
  scoreBreakdown?: ScoreBreakdown;
}

/**
 * Detailed breakdown of scoring factors
 */
export interface ScoreBreakdown {
  nameMatch: number;
  signatureMatch: number;
  documentationMatch: number;
  contextMatch: number;
  totalScore: number;
}

/**
 * Search index for efficient lookups
 */
interface SearchIndex {
  /** Name-based lookup */
  byName: Map<string, CodeSymbol[]>;
  /** Type-based lookup */
  byType: Map<SymbolType, CodeSymbol[]>;
  /** File-based lookup */
  byFile: Map<string, CodeSymbol[]>;
  /** Keyword index for documentation */
  keywords: Map<string, CodeSymbol[]>;
  /** All symbols for exhaustive search */
  allSymbols: CodeSymbol[];
}

/**
 * Scoring weights for different match factors
 */
const SCORING_WEIGHTS = {
  NAME_MATCH: 0.35,
  SIGNATURE_MATCH: 0.25,
  DOCUMENTATION_MATCH: 0.25,
  CONTEXT_MATCH: 0.15,
} as const;

/**
 * SemanticSearch class - Find code by meaning
 *
 * Provides intelligent search capabilities that understand the intent
 * behind natural language queries and find relevant code symbols.
 */
export class SemanticSearch {
  private repoMap: RepositoryMap;
  private searchIndex: SearchIndex;

  constructor(repoMap: RepositoryMap) {
    this.repoMap = repoMap;
    this.searchIndex = this.buildSearchIndex(repoMap);
  }

  /**
   * Search for code matching a natural language query
   *
   * @param query Natural language query (e.g., "function that validates email")
   * @param options Search configuration options
   * @returns Array of search results sorted by relevance
   *
   * @example
   * ```typescript
   * const results = searcher.search('async function that fetches user data', {
   *   symbolTypes: ['function'],
   *   limit: 10,
   *   minScore: 0.3
   * });
   * ```
   */
  search(query: string, options: SemanticSearchOptions = {}): SearchResult[] {
    // Handle null/undefined query
    if (!query || typeof query !== 'string') {
      return [];
    }

    const {
      limit = 20,
      minScore = 0.1,
      symbolTypes,
      filePatterns,
      includeDocumentation = true,
      strategy = 'semantic',
    } = options;

    // Normalize and tokenize the query
    const queryTokens = this.tokenizeQuery(query);

    // Get candidate symbols based on filters
    const candidates = this.getCandidateSymbols(symbolTypes, filePatterns);

    // Score all candidates
    const scoredResults: SearchResult[] = [];

    for (const symbol of candidates) {
      const file = this.findFileForSymbol(symbol);
      if (!file) continue;

      const scoreBreakdown = this.getScoreBreakdown(symbol, queryTokens, includeDocumentation);

      if (scoreBreakdown.totalScore < minScore) continue;

      scoredResults.push({
        symbol,
        file,
        score: scoreBreakdown.totalScore,
        matchType: this.getPrimaryMatchType(scoreBreakdown),
        snippet: this.generateSnippet(symbol, file),
        scoreBreakdown,
      });
    }

    // Sort by score (descending) and limit results
    return scoredResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Find symbols similar to a given symbol
   *
   * @param symbol Reference symbol to find similar ones
   * @param options Search configuration options
   * @returns Array of similar symbols sorted by similarity
   *
   * @example
   * ```typescript
   * const similar = searcher.findSimilar(myFunction, {
   *   symbolTypes: ['function'],
   *   limit: 5
   * });
   * ```
   */
  findSimilar(symbol: CodeSymbol, options: SemanticSearchOptions = {}): SearchResult[] {
    // Create a query from the symbol's characteristics
    const query = this.symbolToQuery(symbol);

    // Search using the generated query, excluding the original symbol
    const results = this.search(query, options);

    return results.filter(result =>
      result.symbol.name !== symbol.name || result.symbol.filePath !== symbol.filePath
    );
  }

  /**
   * Search by example code snippet
   *
   * @param codeSnippet Example code to find similar patterns
   * @param options Search configuration options
   * @returns Array of matching symbols
   *
   * @example
   * ```typescript
   * const results = searcher.searchByExample('async function fetchData()', {
   *   symbolTypes: ['function'],
   *   limit: 10
   * });
   * ```
   */
  searchByExample(codeSnippet: string, options: SemanticSearchOptions = {}): SearchResult[] {
    // Extract patterns from the code snippet
    const patterns = this.extractCodePatterns(codeSnippet);

    // Convert patterns to query terms
    const query = patterns.join(' ');

    return this.search(query, { ...options, strategy: 'fuzzy' });
  }

  /**
   * Build search index for efficient lookups
   */
  private buildSearchIndex(repoMap: RepositoryMap): SearchIndex {
    const index: SearchIndex = {
      byName: new Map(),
      byType: new Map(),
      byFile: new Map(),
      keywords: new Map(),
      allSymbols: [],
    };

    // Index all symbols
    for (const file of repoMap.files) {
      for (const symbol of file.symbols) {
        // Add to all symbols
        index.allSymbols.push(symbol);

        // Index by name
        const nameLower = symbol.name.toLowerCase();
        if (!index.byName.has(nameLower)) {
          index.byName.set(nameLower, []);
        }
        index.byName.get(nameLower)!.push(symbol);

        // Index by type
        if (!index.byType.has(symbol.type)) {
          index.byType.set(symbol.type, []);
        }
        index.byType.get(symbol.type)!.push(symbol);

        // Index by file
        if (!index.byFile.has(file.filePath)) {
          index.byFile.set(file.filePath, []);
        }
        index.byFile.get(file.filePath)!.push(symbol);

        // Index keywords from documentation
        if (symbol.documentation) {
          const keywords = this.extractKeywords(symbol.documentation);
          for (const keyword of keywords) {
            if (!index.keywords.has(keyword)) {
              index.keywords.set(keyword, []);
            }
            index.keywords.get(keyword)!.push(symbol);
          }
        }
      }
    }

    return index;
  }

  /**
   * Get candidate symbols based on filters
   */
  private getCandidateSymbols(
    symbolTypes?: SymbolType[],
    filePatterns?: string[]
  ): CodeSymbol[] {
    let candidates = this.searchIndex.allSymbols;

    // Filter by symbol types
    if (symbolTypes && symbolTypes.length > 0) {
      candidates = candidates.filter(symbol => symbolTypes.includes(symbol.type));
    }

    // Filter by file patterns
    if (filePatterns && filePatterns.length > 0) {
      candidates = candidates.filter(symbol =>
        filePatterns.some(pattern => this.matchesPattern(symbol.filePath, pattern))
      );
    }

    return candidates;
  }

  /**
   * Calculate relevance score for a symbol against query tokens
   */
  private calculateScore(
    symbol: CodeSymbol,
    queryTokens: string[],
    includeDocumentation: boolean,
    strategy: string
  ): ScoreBreakdown {
    const nameScore = this.calculateNameScore(symbol.name, queryTokens, strategy);
    const signatureScore = this.calculateSignatureScore(symbol.signature || '', queryTokens, strategy);
    const documentationScore = includeDocumentation
      ? this.calculateDocumentationScore(symbol.documentation || '', queryTokens, strategy)
      : 0;
    const contextScore = this.calculateContextScore(symbol, queryTokens);

    const totalScore =
      nameScore * SCORING_WEIGHTS.NAME_MATCH +
      signatureScore * SCORING_WEIGHTS.SIGNATURE_MATCH +
      documentationScore * SCORING_WEIGHTS.DOCUMENTATION_MATCH +
      contextScore * SCORING_WEIGHTS.CONTEXT_MATCH;

    return {
      nameMatch: nameScore,
      signatureMatch: signatureScore,
      documentationMatch: documentationScore,
      contextMatch: contextScore,
      totalScore: Math.min(1, totalScore), // Cap at 1.0
    };
  }

  /**
   * Calculate name matching score
   */
  private calculateNameScore(name: string, queryTokens: string[], strategy: string): number {
    const nameLower = name.toLowerCase();
    let maxScore = 0;

    for (const token of queryTokens) {
      const tokenLower = token.toLowerCase();

      // Exact match
      if (nameLower === tokenLower) {
        return 1.0;
      }

      // Case-insensitive match
      if (nameLower.includes(tokenLower)) {
        maxScore = Math.max(maxScore, 0.7);
      }

      // Fuzzy matching for strategies that support it
      if (strategy === 'fuzzy' || strategy === 'semantic') {
        const fuzzyScore = this.calculateFuzzyScore(nameLower, tokenLower);
        maxScore = Math.max(maxScore, fuzzyScore * 0.6);
      }

      // Camel case matching (e.g., "calc" matches "calculateTotal")
      if (this.matchesCamelCase(nameLower, tokenLower)) {
        maxScore = Math.max(maxScore, 0.5);
      }
    }

    return maxScore;
  }

  /**
   * Calculate signature matching score
   */
  private calculateSignatureScore(signature: string, queryTokens: string[], strategy: string): number {
    if (!signature) return 0;

    const signatureLower = signature.toLowerCase();
    let score = 0;
    let matchCount = 0;

    for (const token of queryTokens) {
      const tokenLower = token.toLowerCase();

      if (signatureLower.includes(tokenLower)) {
        matchCount++;
        // Parameter names contribute more
        if (this.isParameterName(signature, token)) {
          score += 0.5;
        }
        // Type names contribute moderately
        else if (this.isTypeName(signature, token)) {
          score += 0.3;
        }
        // General matches contribute less
        else {
          score += 0.2;
        }
      }
    }

    // Normalize by query token count
    return queryTokens.length > 0 ? score / queryTokens.length : 0;
  }

  /**
   * Calculate documentation matching score using TF-IDF
   */
  private calculateDocumentationScore(documentation: string, queryTokens: string[], strategy: string): number {
    if (!documentation) return 0;

    const docLower = documentation.toLowerCase();
    const docTokens = this.tokenizeQuery(documentation);
    let score = 0;

    for (const token of queryTokens) {
      const tokenLower = token.toLowerCase();

      if (docLower.includes(tokenLower)) {
        // Calculate TF-IDF like score
        const tf = this.calculateTermFrequency(docTokens, tokenLower);
        const idf = this.calculateInverseDocumentFrequency(tokenLower);
        score += tf * idf;
      }
    }

    // Normalize and cap
    return queryTokens.length > 0 ? Math.min(1, score / queryTokens.length) : 0;
  }

  /**
   * Calculate context matching score
   */
  private calculateContextScore(symbol: CodeSymbol, queryTokens: string[]): number {
    let score = 0;

    // File path relevance
    const pathScore = this.calculatePathScore(symbol.filePath, queryTokens);
    score += pathScore * 0.6;

    // Parent context (for nested symbols)
    if (symbol.parent) {
      const parentScore = this.calculateNameScore(symbol.parent, queryTokens, 'semantic');
      score += parentScore * 0.4;
    }

    return Math.min(1, score);
  }

  /**
   * Get the score breakdown for detailed analysis
   */
  private getScoreBreakdown(
    symbol: CodeSymbol,
    queryTokens: string[],
    includeDocumentation: boolean
  ): ScoreBreakdown {
    return this.calculateScore(symbol, queryTokens, includeDocumentation, 'semantic');
  }

  /**
   * Determine the primary match type from score breakdown
   */
  private getPrimaryMatchType(breakdown: ScoreBreakdown): SearchResult['matchType'] {
    const scores: Record<SearchResult['matchType'], number> = {
      name: breakdown.nameMatch,
      signature: breakdown.signatureMatch,
      documentation: breakdown.documentationMatch,
      context: breakdown.contextMatch,
    };

    // Find the match type with the highest score
    let maxScore = -1;
    let primaryType: SearchResult['matchType'] = 'name';

    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        primaryType = type as SearchResult['matchType'];
      }
    }

    return primaryType;
  }

  /**
   * Generate a code snippet for display
   */
  private generateSnippet(symbol: CodeSymbol, file: CodeFile): string {
    // Use signature if available, otherwise show name with type
    if (symbol.signature) {
      return symbol.signature;
    }

    return `${symbol.type} ${symbol.name}${symbol.parent ? ` (in ${symbol.parent})` : ''}`;
  }

  /**
   * Find the file containing a symbol
   */
  private findFileForSymbol(symbol: CodeSymbol): CodeFile | undefined {
    return this.repoMap.files.find(file => file.filePath === symbol.filePath);
  }

  /**
   * Convert symbol to query string for similarity search
   */
  private symbolToQuery(symbol: CodeSymbol): string {
    const parts = [symbol.name, symbol.type];

    if (symbol.signature) {
      parts.push(...this.extractSignatureKeywords(symbol.signature));
    }

    if (symbol.documentation) {
      parts.push(...this.extractKeywords(symbol.documentation).slice(0, 3));
    }

    return parts.join(' ');
  }

  /**
   * Extract code patterns from a snippet
   */
  private extractCodePatterns(codeSnippet: string): string[] {
    const patterns: string[] = [];

    // Look for function patterns
    const funcMatch = codeSnippet.match(/(async\s+)?function\s+(\w+)/);
    if (funcMatch) {
      patterns.push('function');
      if (funcMatch[1]) patterns.push('async');
      if (funcMatch[2]) patterns.push(funcMatch[2]);
    }

    // Look for class patterns
    const classMatch = codeSnippet.match(/class\s+(\w+)/);
    if (classMatch) {
      patterns.push('class');
      if (classMatch[1]) patterns.push(classMatch[1]);
    }

    // Look for variable patterns
    const varMatch = codeSnippet.match(/(const|let|var)\s+(\w+)/);
    if (varMatch) {
      patterns.push(varMatch[1]);
      if (varMatch[2]) patterns.push(varMatch[2]);
    }

    return patterns;
  }

  /**
   * Tokenize query into searchable terms
   */
  private tokenizeQuery(query: string): string[] {
    // Split on whitespace and punctuation, filter empty strings
    return query
      .toLowerCase()
      .split(/[\s\-_.,;:()[\]{}<>!?'"]+/)
      .filter(token => token.length > 1) // Skip single characters
      .filter(token => !this.isStopWord(token));
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    return this.tokenizeQuery(text)
      .filter(word => word.length >= 3) // Longer words are better keywords
      .slice(0, 10); // Limit keyword count
  }

  /**
   * Extract keywords from function signatures
   */
  private extractSignatureKeywords(signature: string): string[] {
    // Extract parameter names and types
    const keywords: string[] = [];

    // Match parameter patterns like "name: string" or "count: number"
    const paramMatches = signature.match(/(\w+):\s*(\w+)/g);
    if (paramMatches) {
      for (const match of paramMatches) {
        const [, name, type] = match.match(/(\w+):\s*(\w+)/) || [];
        if (name) keywords.push(name);
        if (type) keywords.push(type);
      }
    }

    // Extract return type
    const returnMatch = signature.match(/:\s*(\w+)\s*$/);
    if (returnMatch && returnMatch[1]) {
      keywords.push(returnMatch[1]);
    }

    return keywords;
  }

  /**
   * Calculate fuzzy string similarity using Levenshtein distance
   */
  private calculateFuzzyScore(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength > 0 ? 1 - (distance / maxLength) : 0;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Check if a query token matches camelCase pattern
   */
  private matchesCamelCase(name: string, token: string): boolean {
    // Extract capital letters and check if they match the token
    const capitals = name.match(/[A-Z]/g);
    if (!capitals) return false;

    const acronym = capitals.join('').toLowerCase();
    return acronym.includes(token) || token.includes(acronym);
  }

  /**
   * Check if a token is a parameter name in a signature
   */
  private isParameterName(signature: string, token: string): boolean {
    const paramPattern = new RegExp(`\\b${token}\\s*:`, 'i');
    return paramPattern.test(signature);
  }

  /**
   * Check if a token is a type name in a signature
   */
  private isTypeName(signature: string, token: string): boolean {
    const typePattern = new RegExp(`:\\s*${token}\\b`, 'i');
    return typePattern.test(signature);
  }

  /**
   * Calculate term frequency for TF-IDF
   */
  private calculateTermFrequency(tokens: string[], term: string): number {
    const count = tokens.filter(token => token === term).length;
    return tokens.length > 0 ? count / tokens.length : 0;
  }

  /**
   * Calculate inverse document frequency (simplified)
   */
  private calculateInverseDocumentFrequency(term: string): number {
    const docsWithTerm = this.searchIndex.keywords.get(term)?.length || 1;
    const totalDocs = this.repoMap.files.length;
    return Math.log(totalDocs / docsWithTerm);
  }

  /**
   * Calculate path relevance score
   */
  private calculatePathScore(filePath: string, queryTokens: string[]): number {
    const pathLower = filePath.toLowerCase();
    let score = 0;

    for (const token of queryTokens) {
      if (pathLower.includes(token.toLowerCase())) {
        // Higher score for matches in file name vs directory
        if (pathLower.endsWith(token.toLowerCase())) {
          score += 0.8;
        } else {
          score += 0.4;
        }
      }
    }

    return queryTokens.length > 0 ? Math.min(1, score / queryTokens.length) : 0;
  }

  /**
   * Check if a file path matches a pattern
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple glob pattern matching
    const regex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    return new RegExp(`^${regex}$`).test(filePath);
  }

  /**
   * Check if a word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'this', 'these', 'they', 'them'
    ]);

    return stopWords.has(word.toLowerCase());
  }
}

/**
 * Create a new SemanticSearch instance
 *
 * @param repoMap Repository map to search
 * @returns SemanticSearch instance
 */
export function createSemanticSearch(repoMap: RepositoryMap): SemanticSearch {
  return new SemanticSearch(repoMap);
}