/**
 * Context Enrichment Bridge - Connects CodebaseIntelligenceService to the prompt system
 *
 * This module bridges the gap between the CodebaseIntelligenceService (which provides
 * code indexing, semantic search, import graph analysis, and type analysis) and the
 * prompt system used by the orchestrator to build task-specific prompts for agents.
 *
 * @example
 * ```typescript
 * const intelligence = new CodebaseIntelligenceService();
 * await intelligence.initialize('/path/to/project');
 *
 * const context = await enrichTaskContext(
 *   'Implement user authentication with JWT tokens',
 *   intelligence,
 *   { maxTokens: 4000 }
 * );
 *
 * const promptSection = formatEnrichedContext(context);
 * // Returns markdown sections for relevant files, symbols, imports, types
 * ```
 */

import { CodebaseIntelligenceService } from './codebase-intelligence/codebase-intelligence-service.js';

/**
 * Enriched context data from codebase intelligence analysis
 */
export interface EnrichedContext {
  /** High-level repository structure summary */
  repositoryMap: string;
  /** Files most relevant to the current task */
  relevantFiles: RelevantFile[];
  /** Symbols relevant to the task */
  relevantSymbols: RelevantSymbol[];
  /** Import graph info for relevant files */
  importGraph: string;
  /** Type relationship info */
  typeInfo: string;
}

export interface RelevantFile {
  path: string;
  relevanceScore: number;
  symbolCount: number;
  language: string;
}

export interface RelevantSymbol {
  name: string;
  type: string;
  file: string;
  line: number;
  signature?: string;
}

/**
 * Enrich task context using CodebaseIntelligenceService.
 * Searches the codebase for files and symbols relevant to the task description.
 */
export async function enrichTaskContext(
  taskDescription: string,
  intelligence: CodebaseIntelligenceService,
  options: { maxTokens?: number } = {}
): Promise<EnrichedContext> {
  const maxTokens = options.maxTokens || 4000;
  const estimatedCharsPerToken = 4;
  const maxChars = maxTokens * estimatedCharsPerToken;

  // Get repository map
  const repoMap = intelligence.getRepositoryMap();
  let repositoryMapStr = '';
  if (repoMap) {
    // Build a compact file listing from the repository map
    const fileEntries: string[] = [];
    for (const file of repoMap.files) {
      const symbolNames = file.symbols
        .filter(s => s.exported)
        .map(s => `${s.type}:${s.name}`)
        .slice(0, 5);
      const symbolSuffix = symbolNames.length > 0 ? ` [${symbolNames.join(', ')}]` : '';
      fileEntries.push(`  ${file.path}${symbolSuffix}`);
    }
    // Limit to keep within budget
    repositoryMapStr = fileEntries.slice(0, 50).join('\n');
    if (fileEntries.length > 50) {
      repositoryMapStr += `\n  ... and ${fileEntries.length - 50} more files`;
    }
  }

  // Search for relevant code
  let relevantFiles: RelevantFile[] = [];
  let relevantSymbols: RelevantSymbol[] = [];
  try {
    const searchResults = intelligence.searchCode(taskDescription, {
      limit: 15,
      minScore: 0.2,
    });

    // Extract relevant files (deduplicated)
    const seenFiles = new Set<string>();
    for (const result of searchResults) {
      if (!seenFiles.has(result.file.path)) {
        seenFiles.add(result.file.path);
        relevantFiles.push({
          path: result.file.path,
          relevanceScore: result.score,
          symbolCount: result.file.symbols?.length || 0,
          language: result.file.language || 'unknown',
        });
      }
    }

    // Extract relevant symbols
    relevantSymbols = searchResults
      .filter(r => r.symbol)
      .map(r => ({
        name: r.symbol.name,
        type: r.symbol.type,
        file: r.file.path,
        line: r.symbol.startLine,
        signature: r.symbol.signature,
      }))
      .slice(0, 20);
  } catch {
    // Semantic search may fail if index isn't ready
  }

  // Build import graph summary for relevant files
  let importGraph = '';
  try {
    const analysis = intelligence.getAnalysis();
    if (analysis && (analysis as any).importGraph) {
      const graph = (analysis as any).importGraph;
      const graphEdges = relevantFiles
        .slice(0, 5)
        .map(f => {
          const node = graph?.nodes?.find((n: any) => n.path === f.path || n.relativePath === f.path);
          if (!node) return null;
          const imports = graph?.edges
            ?.filter((e: any) => e.from === node.id || e.source === node.path)
            ?.map((e: any) => e.toPath || e.target)
            ?.slice(0, 5);
          if (!imports || imports.length === 0) return null;
          return `  ${f.path} → ${imports.join(', ')}`;
        })
        .filter(Boolean);
      if (graphEdges.length > 0) {
        importGraph = graphEdges.join('\n');
      }
    }
  } catch {
    // Import graph may not be available
  }

  // Build type info summary
  let typeInfo = '';
  try {
    const analysis = intelligence.getAnalysis();
    if (analysis && (analysis as any).typeRelationships) {
      const relevantTypes = (analysis as any).typeRelationships
        .filter((rel: any) =>
          relevantFiles.some(f =>
            f.path === rel.sourceFile || f.path === rel.targetFile
          )
        )
        .slice(0, 10)
        .map((rel: any) => `  ${rel.sourceType} ${rel.kind} ${rel.targetType}`);
      if (relevantTypes.length > 0) {
        typeInfo = relevantTypes.join('\n');
      }
    }
  } catch {
    // Type info may not be available
  }

  // Truncate to fit token budget
  const totalChars = repositoryMapStr.length + importGraph.length + typeInfo.length;
  if (totalChars > maxChars) {
    // Prioritize: symbols > files > repo map > graph > types
    const budgetPerSection = Math.floor(maxChars / 3);
    if (repositoryMapStr.length > budgetPerSection) {
      repositoryMapStr = repositoryMapStr.substring(0, budgetPerSection) + '\n  ...truncated';
    }
  }

  return {
    repositoryMap: repositoryMapStr,
    relevantFiles,
    relevantSymbols,
    importGraph,
    typeInfo,
  };
}

/**
 * Format enriched context into a prompt section string
 */
export function formatEnrichedContext(context: EnrichedContext): string {
  const sections: string[] = [];

  if (context.relevantFiles.length > 0) {
    const fileList = context.relevantFiles
      .slice(0, 10)
      .map(f => `  - \`${f.path}\` (${f.language}, ${f.symbolCount} symbols, relevance: ${(f.relevanceScore * 100).toFixed(0)}%)`)
      .join('\n');
    sections.push(`### Relevant Files\n${fileList}`);
  }

  if (context.relevantSymbols.length > 0) {
    const symbolList = context.relevantSymbols
      .slice(0, 10)
      .map(s => {
        const sig = s.signature ? `: ${s.signature.substring(0, 80)}` : '';
        return `  - \`${s.name}\` (${s.type} in ${s.file}:${s.line})${sig}`;
      })
      .join('\n');
    sections.push(`### Relevant Symbols\n${symbolList}`);
  }

  if (context.repositoryMap) {
    sections.push(`### Repository Structure\n${context.repositoryMap}`);
  }

  if (context.importGraph) {
    sections.push(`### Import Dependencies\n${context.importGraph}`);
  }

  if (context.typeInfo) {
    sections.push(`### Type Relationships\n${context.typeInfo}`);
  }

  return sections.join('\n\n');
}
