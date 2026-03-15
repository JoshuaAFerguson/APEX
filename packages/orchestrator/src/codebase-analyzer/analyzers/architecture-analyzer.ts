/**
 * Architecture Analyzer - Software Architecture Pattern Detection
 *
 * Analyzes codebase to detect:
 * - Architectural patterns (layered, MVC, microservices, etc.)
 * - Key components and their types
 * - Architectural layers and their dependencies
 * - Dependency analysis (external, internal, circular)
 * - Entry points and application structure
 *
 * Returns structured ArchitectureAnalysis data validated against schema.
 */

import { promises as fs } from 'fs';
import { join, relative, dirname, basename, extname } from 'path';
import type { ArchitectureAnalysis } from '@apexcli/core';
import type { CodebaseAnalyzer } from '../types.js';

/**
 * Architectural pattern detection rules
 */
const ARCHITECTURE_PATTERNS = {
  'microservices': {
    indicators: [
      /packages\/[^/]+\//, // packages/ directory structure
      /apps\/[^/]+\//, // apps/ directory structure
      /services\/[^/]+\//, // services/ directory structure
      /microservices\/[^/]+\//
    ],
    files: ['docker-compose.yml', 'lerna.json', 'nx.json', 'rush.json']
  },
  'layered': {
    indicators: [
      /controllers?\//,
      /services?\//,
      /repositories?\//,
      /models?\//,
      /layers?\//
    ],
    files: []
  },
  'mvc': {
    indicators: [
      /models?\//,
      /views?\//,
      /controllers?\//
    ],
    files: []
  },
  'component-based': {
    indicators: [
      /components?\//,
      /hooks?\//,
      /pages?\//,
      /screens?\//,
      /containers?\//
    ],
    files: []
  },
  'hexagonal': {
    indicators: [
      /domain\//,
      /adapters?\//,
      /ports?\//,
      /infrastructure\//
    ],
    files: []
  },
  'clean': {
    indicators: [
      /entities?\//,
      /use-?cases?\//,
      /interfaces?\//,
      /frameworks?\//,
      /drivers?\//
    ],
    files: []
  },
  'onion': {
    indicators: [
      /core\//,
      /infrastructure\//,
      /application\//,
      /domain\//
    ],
    files: []
  },
  'modular': {
    indicators: [
      /modules?\//,
      /features?\//,
      /domains?\//
    ],
    files: []
  }
};

/**
 * Component type detection patterns
 */
const COMPONENT_TYPE_PATTERNS = [
  { pattern: /controller|ctrl/i, type: 'controller' as const },
  { pattern: /service|svc/i, type: 'service' as const },
  { pattern: /model|entity/i, type: 'model' as const },
  { pattern: /view|template/i, type: 'view' as const },
  { pattern: /repository|repo|dao/i, type: 'repository' as const },
  { pattern: /factory/i, type: 'factory' as const },
  { pattern: /util|helper/i, type: 'utility' as const },
  { pattern: /middleware|interceptor/i, type: 'middleware' as const },
  { pattern: /hook|use[A-Z]/i, type: 'hook' as const },
  { pattern: /store|state/i, type: 'store' as const },
  { pattern: /component|comp/i, type: 'component' as const },
];

/**
 * Entry point detection patterns
 */
const ENTRY_POINT_PATTERNS = [
  { pattern: /^index\.(js|ts|jsx|tsx)$/, type: 'main' as const },
  { pattern: /^main\.(js|ts)$/, type: 'main' as const },
  { pattern: /^app\.(js|ts|jsx|tsx)$/, type: 'main' as const },
  { pattern: /^server\.(js|ts)$/, type: 'server' as const },
  { pattern: /^cli\.(js|ts)$/, type: 'cli' as const },
  { pattern: /^bin\//, type: 'cli' as const },
  { pattern: /worker\.(js|ts)$/, type: 'worker' as const },
  { pattern: /\.test\.(js|ts|jsx|tsx)$/, type: 'test' as const },
  { pattern: /\.spec\.(js|ts|jsx|tsx)$/, type: 'test' as const },
];

export class ArchitectureAnalyzer implements CodebaseAnalyzer<ArchitectureAnalysis> {
  /**
   * Analyze software architecture patterns in a codebase
   */
  async analyze(projectPath: string): Promise<ArchitectureAnalysis> {
    try {
      // Find all relevant files
      const files = await this.findRelevantFiles(projectPath);

      if (files.length === 0) {
        return this.createEmptyAnalysis();
      }

      // Get relative paths for analysis
      const relativePaths = files.map(file => relative(projectPath, file));

      // 1. Detect architectural pattern
      const pattern = this.detectArchitecturalPattern(relativePaths, projectPath);

      // 2. Identify components
      const components = await this.identifyComponents(files, projectPath);

      // 3. Identify architectural layers
      const layers = this.identifyLayers(relativePaths);

      // 4. Analyze dependencies
      const dependencies = await this.analyzeDependencies(files, projectPath);

      // 5. Find entry points
      const entryPoints = this.findEntryPoints(relativePaths);

      return {
        pattern,
        components,
        layers,
        dependencies,
        entryPoints,
      };
    } catch (error) {
      throw new Error(`Architecture analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Find relevant source files for architecture analysis
   */
  private async findRelevantFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];
    const relevantExtensions = new Set([
      '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte',
      '.py', '.rb', '.go', '.rs', '.java', '.kt',
      '.php', '.cs', '.cpp', '.c', '.swift', '.dart'
    ]);

    try {
      await this.walkDirectory(projectPath, files, relevantExtensions);
      return files;
    } catch (error) {
      throw new Error(`Failed to scan project files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Recursively walk directory to find source files
   */
  private async walkDirectory(dirPath: string, files: string[], relevantExtensions: Set<string>): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          const skipDirs = new Set([
            'node_modules', '.git', 'dist', 'build', 'coverage',
            '.next', '.nuxt', 'target', '.venv', 'venv', '__pycache__',
            'vendor', '.gradle', '.mvn'
          ]);
          if (!skipDirs.has(entry.name)) {
            await this.walkDirectory(fullPath, files, relevantExtensions);
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (relevantExtensions.has(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be read
      console.warn(`Skipping directory ${dirPath}: ${error}`);
    }
  }

  /**
   * Detect architectural pattern from directory structure
   */
  private detectArchitecturalPattern(
    relativePaths: string[],
    projectPath: string
  ): ArchitectureAnalysis['pattern'] {
    const scores = new Map<string, number>();

    // Check each pattern against the file paths
    for (const [patternName, { indicators, files }] of Object.entries(ARCHITECTURE_PATTERNS)) {
      let score = 0;

      // Check path indicators
      for (const indicator of indicators) {
        const matches = relativePaths.filter(path => indicator.test(path));
        score += matches.length;
      }

      // Check for specific config files
      for (const file of files) {
        if (relativePaths.some(path => basename(path) === file)) {
          score += 10; // High weight for specific architecture files
        }
      }

      if (score > 0) {
        scores.set(patternName, score);
      }
    }

    if (scores.size === 0) {
      return 'monolithic'; // Default fallback
    }

    // Return the pattern with the highest score
    const sortedScores = Array.from(scores.entries()).sort(([,a], [,b]) => b - a);
    return sortedScores[0][0] as ArchitectureAnalysis['pattern'];
  }

  /**
   * Identify components from source files
   */
  private async identifyComponents(files: string[], projectPath: string): Promise<ArchitectureAnalysis['components']> {
    const components: ArchitectureAnalysis['components'] = [];

    for (const file of files) {
      try {
        const relativePath = relative(projectPath, file);
        const fileName = basename(file, extname(file));
        const content = await fs.readFile(file, 'utf-8');

        // Determine component type
        const componentType = this.determineComponentType(fileName, relativePath, content);

        // Extract dependencies and exports
        const { dependencies, exports } = this.extractDependenciesAndExports(content, extname(file));

        // Count lines of code
        const loc = content.split('\n').length;

        components.push({
          name: fileName,
          type: componentType,
          path: relativePath,
          dependencies,
          exports,
          loc,
        });
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return components;
  }

  /**
   * Determine component type based on naming and content patterns
   */
  private determineComponentType(
    fileName: string,
    relativePath: string,
    content: string
  ): ArchitectureAnalysis['components'][0]['type'] {
    const fullPath = `${relativePath}/${fileName}`.toLowerCase();

    // Check file name and path patterns
    for (const { pattern, type } of COMPONENT_TYPE_PATTERNS) {
      if (pattern.test(fileName) || pattern.test(relativePath)) {
        return type;
      }
    }

    // Check content patterns for more sophisticated detection
    if (/class.*Controller|@Controller|router\./i.test(content)) {
      return 'controller';
    }
    if (/class.*Service|@Service|@Injectable/i.test(content)) {
      return 'service';
    }
    if (/class.*Model|@Entity|@Table|schema/i.test(content)) {
      return 'model';
    }
    if (/React\.Component|function.*Component|export default function|const.*=.*=>/i.test(content)) {
      return 'component';
    }
    if (/class.*Repository|@Repository|findBy|save|delete/i.test(content)) {
      return 'repository';
    }

    return 'other';
  }

  /**
   * Extract import dependencies and exports from file content
   */
  private extractDependenciesAndExports(content: string, fileExt: string): {
    dependencies: string[];
    exports: string[];
  } {
    const dependencies: string[] = [];
    const exports: string[] = [];

    if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(fileExt)) {
      // Extract ES6 imports
      const importMatches = content.matchAll(/import.*?from\s+['"`]([^'"`]+)['"`]/g);
      for (const match of importMatches) {
        if (!match[1].startsWith('.')) { // External dependencies only
          dependencies.push(match[1]);
        }
      }

      // Extract CommonJS requires
      const requireMatches = content.matchAll(/require\(['"`]([^'"`]+)['"`]\)/g);
      for (const match of requireMatches) {
        if (!match[1].startsWith('.')) { // External dependencies only
          dependencies.push(match[1]);
        }
      }

      // Extract exports
      const exportMatches = content.matchAll(/export\s+(?:(?:const|let|var|function|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:default\s+([a-zA-Z_$][a-zA-Z0-9_$]*))|\{([^}]+)\})/g);
      for (const match of exportMatches) {
        if (match[1]) {
          exports.push(match[1]);
        } else if (match[2]) {
          exports.push(match[2]);
        } else if (match[3]) {
          // Parse named exports from braces
          const namedExports = match[3].split(',').map(exp => exp.trim().split(/\s+as\s+/)[0].trim());
          exports.push(...namedExports);
        }
      }
    }

    return { dependencies: [...new Set(dependencies)], exports: [...new Set(exports)] };
  }

  /**
   * Identify architectural layers from directory structure
   */
  private identifyLayers(relativePaths: string[]): ArchitectureAnalysis['layers'] {
    const layerMap = new Map<string, {
      paths: Set<string>;
      dependencies: Set<string>;
      description?: string;
    }>();

    // Common layer patterns
    const layerPatterns = [
      { pattern: /^(src\/)?presentation\//i, name: 'presentation', description: 'UI and presentation logic' },
      { pattern: /^(src\/)?ui\//i, name: 'presentation', description: 'User interface components' },
      { pattern: /^(src\/)?components?\//i, name: 'presentation', description: 'UI components' },
      { pattern: /^(src\/)?pages?\//i, name: 'presentation', description: 'Application pages' },
      { pattern: /^(src\/)?views?\//i, name: 'presentation', description: 'View templates' },

      { pattern: /^(src\/)?business\//i, name: 'business', description: 'Business logic layer' },
      { pattern: /^(src\/)?domain\//i, name: 'business', description: 'Domain models and logic' },
      { pattern: /^(src\/)?services?\//i, name: 'business', description: 'Business services' },
      { pattern: /^(src\/)?use-?cases?\//i, name: 'business', description: 'Application use cases' },

      { pattern: /^(src\/)?data\//i, name: 'data', description: 'Data access layer' },
      { pattern: /^(src\/)?repositories?\//i, name: 'data', description: 'Data repositories' },
      { pattern: /^(src\/)?models?\//i, name: 'data', description: 'Data models' },
      { pattern: /^(src\/)?entities?\//i, name: 'data', description: 'Data entities' },
      { pattern: /^(src\/)?database\//i, name: 'data', description: 'Database layer' },

      { pattern: /^(src\/)?infrastructure\//i, name: 'infrastructure', description: 'Infrastructure concerns' },
      { pattern: /^(src\/)?adapters?\//i, name: 'infrastructure', description: 'External adapters' },
      { pattern: /^(src\/)?external\//i, name: 'infrastructure', description: 'External integrations' },

      { pattern: /^(src\/)?controllers?\//i, name: 'api', description: 'API controllers' },
      { pattern: /^(src\/)?routes?\//i, name: 'api', description: 'API routes' },
      { pattern: /^(src\/)?middleware\//i, name: 'api', description: 'API middleware' },

      { pattern: /^(src\/)?utils?\//i, name: 'utilities', description: 'Utility functions' },
      { pattern: /^(src\/)?helpers?\//i, name: 'utilities', description: 'Helper functions' },
      { pattern: /^(src\/)?shared\//i, name: 'utilities', description: 'Shared utilities' },
      { pattern: /^(src\/)?common\//i, name: 'utilities', description: 'Common utilities' },
    ];

    // Group paths by layer
    for (const path of relativePaths) {
      for (const { pattern, name, description } of layerPatterns) {
        if (pattern.test(path)) {
          if (!layerMap.has(name)) {
            layerMap.set(name, {
              paths: new Set(),
              dependencies: new Set(),
              description,
            });
          }
          layerMap.get(name)!.paths.add(dirname(path));
          break; // Match first pattern only
        }
      }
    }

    // Convert to result format
    return Array.from(layerMap.entries()).map(([name, { paths, dependencies, description }]) => ({
      name,
      description: description || `${name} layer`,
      paths: [...new Set(Array.from(paths))],
      dependencies: Array.from(dependencies),
    }));
  }

  /**
   * Analyze dependency structure
   */
  private async analyzeDependencies(files: string[], projectPath: string): Promise<ArchitectureAnalysis['dependencies']> {
    let external = 0;
    let internal = 0;
    let circular = 0;
    let unused = 0;

    // Track internal dependencies for circular detection
    const internalDeps = new Map<string, Set<string>>();

    try {
      // Check for package.json to count external dependencies
      const packageJsonPath = join(projectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      external = Object.keys({
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies,
        ...packageJson.optionalDependencies,
      }).length;
    } catch (error) {
      // No package.json found
    }

    // Analyze internal dependencies from source files
    for (const file of files.slice(0, 100)) { // Limit for performance
      try {
        const content = await fs.readFile(file, 'utf-8');
        const relativePath = relative(projectPath, file);

        // Extract internal imports (relative paths)
        const internalImports = this.extractInternalImports(content);
        if (internalImports.length > 0) {
          internalDeps.set(relativePath, new Set(internalImports));
          internal += internalImports.length;
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    // Simple circular dependency detection
    circular = this.detectCircularDependencies(internalDeps);

    return {
      external,
      internal,
      circular,
      unused,
    };
  }

  /**
   * Extract internal import paths from file content
   */
  private extractInternalImports(content: string): string[] {
    const imports: string[] = [];

    // ES6 imports
    const importMatches = content.matchAll(/import.*?from\s+['"`]([^'"`]+)['"`]/g);
    for (const match of importMatches) {
      if (match[1].startsWith('.') || match[1].startsWith('/')) {
        imports.push(match[1]);
      }
    }

    // CommonJS requires
    const requireMatches = content.matchAll(/require\(['"`]([^'"`]+)['"`]\)/g);
    for (const match of requireMatches) {
      if (match[1].startsWith('.') || match[1].startsWith('/')) {
        imports.push(match[1]);
      }
    }

    return imports;
  }

  /**
   * Detect circular dependencies (simplified implementation)
   */
  private detectCircularDependencies(depGraph: Map<string, Set<string>>): number {
    let circularCount = 0;
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (node: string): boolean => {
      if (stack.has(node)) {
        return true; // Circular dependency found
      }
      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      stack.add(node);

      const deps = depGraph.get(node) || new Set();
      for (const dep of deps) {
        if (dfs(dep)) {
          circularCount++;
          return true;
        }
      }

      stack.delete(node);
      return false;
    };

    for (const node of depGraph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return circularCount;
  }

  /**
   * Find application entry points
   */
  private findEntryPoints(relativePaths: string[]): ArchitectureAnalysis['entryPoints'] {
    const entryPoints: ArchitectureAnalysis['entryPoints'] = [];

    for (const path of relativePaths) {
      const fileName = basename(path);

      for (const { pattern, type } of ENTRY_POINT_PATTERNS) {
        if (pattern.test(fileName) || pattern.test(path)) {
          entryPoints.push({
            path,
            type,
            description: this.getEntryPointDescription(type, fileName),
          });
          break; // Match first pattern only
        }
      }
    }

    return entryPoints;
  }

  /**
   * Get description for entry point type
   */
  private getEntryPointDescription(type: string, fileName: string): string {
    switch (type) {
      case 'main':
        return `Main application entry point (${fileName})`;
      case 'server':
        return `Server application entry (${fileName})`;
      case 'cli':
        return `Command-line interface (${fileName})`;
      case 'worker':
        return `Background worker (${fileName})`;
      case 'test':
        return `Test file (${fileName})`;
      default:
        return `Application entry point (${fileName})`;
    }
  }

  /**
   * Create empty analysis for projects with no detectable architecture
   */
  private createEmptyAnalysis(): ArchitectureAnalysis {
    return {
      pattern: 'other',
      components: [],
      layers: [],
      dependencies: {
        external: 0,
        internal: 0,
        circular: 0,
        unused: 0,
      },
      entryPoints: [],
    };
  }
}