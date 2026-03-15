/**
 * Stack Analyzer - Technology Stack Detection and Analysis
 *
 * Analyzes codebase to detect:
 * - Programming languages and their usage percentages
 * - Frameworks and libraries with version information
 * - Build tools and bundlers
 * - Runtime environments
 * - Package managers
 *
 * Returns structured StackAnalysis data validated against schema.
 */

import { promises as fs } from 'fs';
import { join, extname, basename } from 'path';
import type { StackAnalysis } from '@apexcli/core';
import type { CodebaseAnalyzer } from '../types.js';

/**
 * Language detection patterns and mappings
 */
const LANGUAGE_PATTERNS = {
  'TypeScript': ['.ts', '.tsx'],
  'JavaScript': ['.js', '.jsx', '.mjs', '.cjs'],
  'Python': ['.py', '.pyx', '.pyi'],
  'Java': ['.java'],
  'Go': ['.go'],
  'Rust': ['.rs'],
  'C++': ['.cpp', '.cxx', '.cc', '.hpp', '.hxx'],
  'C': ['.c', '.h'],
  'C#': ['.cs'],
  'PHP': ['.php', '.phtml'],
  'Ruby': ['.rb', '.rbw'],
  'Swift': ['.swift'],
  'Kotlin': ['.kt', '.kts'],
  'Dart': ['.dart'],
  'Scala': ['.scala'],
  'Clojure': ['.clj', '.cljs', '.cljc'],
  'Elixir': ['.ex', '.exs'],
  'Haskell': ['.hs', '.lhs'],
  'HTML': ['.html', '.htm'],
  'CSS': ['.css', '.scss', '.sass', '.less'],
  'JSON': ['.json'],
  'YAML': ['.yaml', '.yml'],
  'XML': ['.xml'],
  'Shell': ['.sh', '.bash', '.zsh', '.fish'],
  'SQL': ['.sql'],
  'Dockerfile': ['Dockerfile', 'Dockerfile.*'],
};

/**
 * Framework detection patterns for package.json dependencies
 */
const FRAMEWORK_PATTERNS = [
  // Frontend frameworks
  { pattern: /^react$/, name: 'React', category: 'frontend' as const },
  { pattern: /^@angular\/core$/, name: 'Angular', category: 'frontend' as const },
  { pattern: /^vue$/, name: 'Vue', category: 'frontend' as const },
  { pattern: /^svelte$/, name: 'Svelte', category: 'frontend' as const },
  { pattern: /^solid-js$/, name: 'SolidJS', category: 'frontend' as const },
  { pattern: /^preact$/, name: 'Preact', category: 'frontend' as const },

  // Meta-frameworks
  { pattern: /^next$/, name: 'Next.js', category: 'frontend' as const },
  { pattern: /^nuxt$/, name: 'Nuxt.js', category: 'frontend' as const },
  { pattern: /^gatsby$/, name: 'Gatsby', category: 'frontend' as const },
  { pattern: /^@remix-run\//, name: 'Remix', category: 'frontend' as const },
  { pattern: /^vitepress$/, name: 'VitePress', category: 'frontend' as const },

  // Backend frameworks
  { pattern: /^express$/, name: 'Express', category: 'backend' as const },
  { pattern: /^fastify$/, name: 'Fastify', category: 'backend' as const },
  { pattern: /^@nestjs\/core$/, name: 'NestJS', category: 'backend' as const },
  { pattern: /^koa$/, name: 'Koa', category: 'backend' as const },
  { pattern: /^@hapi\/hapi$/, name: 'Hapi', category: 'backend' as const },
  { pattern: /^apollo-server/, name: 'Apollo Server', category: 'backend' as const },

  // Testing frameworks
  { pattern: /^jest$/, name: 'Jest', category: 'testing' as const },
  { pattern: /^vitest$/, name: 'Vitest', category: 'testing' as const },
  { pattern: /^mocha$/, name: 'Mocha', category: 'testing' as const },
  { pattern: /^@playwright\/test$/, name: 'Playwright', category: 'testing' as const },
  { pattern: /^cypress$/, name: 'Cypress', category: 'testing' as const },
  { pattern: /^@testing-library\//, name: 'Testing Library', category: 'testing' as const },

  // Build tools
  { pattern: /^vite$/, name: 'Vite', category: 'build' as const },
  { pattern: /^webpack$/, name: 'Webpack', category: 'build' as const },
  { pattern: /^rollup$/, name: 'Rollup', category: 'build' as const },
  { pattern: /^parcel$/, name: 'Parcel', category: 'build' as const },
  { pattern: /^esbuild$/, name: 'ESBuild', category: 'build' as const },
  { pattern: /^turbopack$/, name: 'Turbopack', category: 'build' as const },

  // UI libraries
  { pattern: /^@mui\/material$/, name: 'Material-UI', category: 'ui' as const },
  { pattern: /^antd$/, name: 'Ant Design', category: 'ui' as const },
  { pattern: /^@chakra-ui\//, name: 'Chakra UI', category: 'ui' as const },
  { pattern: /^@mantine\//, name: 'Mantine', category: 'ui' as const },
  { pattern: /^react-bootstrap$/, name: 'React Bootstrap', category: 'ui' as const },
  { pattern: /^tailwindcss$/, name: 'Tailwind CSS', category: 'ui' as const },

  // State management
  { pattern: /^redux$/, name: 'Redux', category: 'state-management' as const },
  { pattern: /^@reduxjs\/toolkit$/, name: 'Redux Toolkit', category: 'state-management' as const },
  { pattern: /^zustand$/, name: 'Zustand', category: 'state-management' as const },
  { pattern: /^mobx$/, name: 'MobX', category: 'state-management' as const },
  { pattern: /^recoil$/, name: 'Recoil', category: 'state-management' as const },
  { pattern: /^@tanstack\/react-query$/, name: 'React Query', category: 'state-management' as const },

  // Database ORMs
  { pattern: /^prisma$/, name: 'Prisma', category: 'database' as const },
  { pattern: /^typeorm$/, name: 'TypeORM', category: 'database' as const },
  { pattern: /^sequelize$/, name: 'Sequelize', category: 'database' as const },
  { pattern: /^mongoose$/, name: 'Mongoose', category: 'database' as const },
  { pattern: /^drizzle-orm$/, name: 'Drizzle ORM', category: 'database' as const },
];

/**
 * Build tool detection patterns from config files
 */
const BUILD_TOOL_PATTERNS = [
  { file: 'vite.config.*', tool: 'Vite' },
  { file: 'webpack.config.*', tool: 'Webpack' },
  { file: 'rollup.config.*', tool: 'Rollup' },
  { file: 'parcel.config.*', tool: 'Parcel' },
  { file: 'turbo.json', tool: 'Turbo' },
  { file: 'nx.json', tool: 'Nx' },
  { file: 'lerna.json', tool: 'Lerna' },
  { file: 'rush.json', tool: 'Rush' },
  { file: 'pnpm-workspace.yaml', tool: 'pnpm workspaces' },
  { file: 'yarn.lock', tool: 'Yarn' },
  { file: 'package-lock.json', tool: 'npm' },
  { file: 'bun.lockb', tool: 'Bun' },
  { file: 'tsconfig.json', tool: 'TypeScript' },
  { file: 'babel.config.*', tool: 'Babel' },
  { file: '.eslintrc.*', tool: 'ESLint' },
  { file: '.prettierrc.*', tool: 'Prettier' },
  { file: 'jest.config.*', tool: 'Jest' },
  { file: 'vitest.config.*', tool: 'Vitest' },
  { file: 'playwright.config.*', tool: 'Playwright' },
  { file: 'cypress.config.*', tool: 'Cypress' },
];

export class StackAnalyzer implements CodebaseAnalyzer<StackAnalysis> {
  /**
   * Analyze technology stack in a codebase
   */
  async analyze(projectPath: string): Promise<StackAnalysis> {
    try {
      // Find all files in the project
      const files = await this.findAllFiles(projectPath);

      if (files.length === 0) {
        return this.createEmptyAnalysis();
      }

      // 1. Detect languages from file extensions
      const languages = this.detectLanguages(files);

      // 2. Parse package.json for frameworks (if it exists)
      const frameworks = await this.detectFrameworks(projectPath);

      // 3. Detect build tools from config files
      const buildTools = await this.detectBuildTools(projectPath, files);

      // 4. Detect runtime from package.json engines or config
      const runtimes = await this.detectRuntimes(projectPath);

      // 5. Detect package managers
      const packageManagers = this.detectPackageManagers(files);

      const primaryLanguage = languages.length > 0 ? languages[0].name : 'Unknown';

      return {
        primaryLanguage,
        languages,
        frameworks,
        buildTools,
        runtimes,
        packageManagers,
      };
    } catch (error) {
      throw new Error(`Stack analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Find all files in the project directory
   */
  private async findAllFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        throw new Error(`Project path is not a directory: ${projectPath}`);
      }

      await this.walkDirectory(projectPath, files);
      return files;
    } catch (error) {
      throw new Error(`Failed to scan project directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Recursively walk directory tree to find files
   */
  private async walkDirectory(dirPath: string, files: string[]): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        // Skip common directories that shouldn't be analyzed
        if (entry.isDirectory()) {
          const skipDirs = new Set([
            'node_modules', '.git', 'dist', 'build', 'coverage',
            '.next', '.nuxt', 'target', '.venv', 'venv', '__pycache__',
            'vendor', '.gradle', '.mvn'
          ]);
          if (!skipDirs.has(entry.name)) {
            await this.walkDirectory(fullPath, files);
          }
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read (permissions, etc.)
      console.warn(`Skipping directory ${dirPath}: ${error}`);
    }
  }

  /**
   * Detect programming languages from file extensions
   */
  private detectLanguages(files: string[]): StackAnalysis['languages'] {
    const languageCounts = new Map<string, { files: number; extensions: Set<string> }>();
    const totalFiles = files.length;

    // Count files by language
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      const fileName = basename(file);

      // Handle special file names like Dockerfile
      let detectedLanguage = null;

      if (fileName.startsWith('Dockerfile')) {
        detectedLanguage = 'Dockerfile';
      } else {
        // Find language by extension
        for (const [language, extensions] of Object.entries(LANGUAGE_PATTERNS)) {
          if (Array.isArray(extensions) && extensions.includes(ext)) {
            detectedLanguage = language;
            break;
          }
        }
      }

      if (detectedLanguage) {
        if (!languageCounts.has(detectedLanguage)) {
          languageCounts.set(detectedLanguage, { files: 0, extensions: new Set() });
        }
        const langInfo = languageCounts.get(detectedLanguage)!;
        langInfo.files++;
        if (ext) langInfo.extensions.add(ext);
      }
    }

    // Convert to analysis format and sort by usage
    const languages = Array.from(languageCounts.entries())
      .map(([name, { files, extensions }]) => ({
        name,
        percentage: Math.round((files / totalFiles) * 100 * 10) / 10,
        files,
        extensions: Array.from(extensions),
      }))
      .sort((a, b) => b.percentage - a.percentage);

    return languages;
  }

  /**
   * Detect frameworks and libraries from package.json
   */
  private async detectFrameworks(projectPath: string): Promise<StackAnalysis['frameworks']> {
    const frameworks: StackAnalysis['frameworks'] = [];

    try {
      const packageJsonPath = join(projectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies,
        ...packageJson.optionalDependencies,
      };

      // Check each dependency against framework patterns
      for (const [depName, version] of Object.entries(allDeps)) {
        for (const framework of FRAMEWORK_PATTERNS) {
          if (framework.pattern.test(depName)) {
            const cleanVersion = String(version).replace(/^[\^~]/, '').split(' ')[0];
            frameworks.push({
              name: framework.name,
              version: cleanVersion,
              category: framework.category,
              confidence: 1,
            });
            break; // Only match the first pattern to avoid duplicates
          }
        }
      }

      return frameworks;
    } catch (error) {
      // No package.json or can't read it - not an error for non-JS projects
      return [];
    }
  }

  /**
   * Detect build tools from config files
   */
  private async detectBuildTools(projectPath: string, files: string[]): Promise<StackAnalysis['buildTools']> {
    const buildTools = new Set<string>();

    // Check for specific config files
    for (const { file, tool } of BUILD_TOOL_PATTERNS) {
      const pattern = file.replace('*', '');
      const hasConfigFile = files.some(filePath => {
        const fileName = basename(filePath);
        return fileName.startsWith(pattern) || fileName === file;
      });

      if (hasConfigFile) {
        buildTools.add(tool);
      }
    }

    return Array.from(buildTools);
  }

  /**
   * Detect runtime environments from package.json engines or Dockerfiles
   */
  private async detectRuntimes(projectPath: string): Promise<StackAnalysis['runtimes']> {
    const runtimes: StackAnalysis['runtimes'] = [];

    try {
      // Check package.json engines
      const packageJsonPath = join(projectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      if (packageJson.engines) {
        if (packageJson.engines.node) {
          runtimes.push({
            name: 'Node.js',
            version: packageJson.engines.node,
            type: 'node',
          });
        }

        if (packageJson.engines.npm) {
          runtimes.push({
            name: 'npm',
            version: packageJson.engines.npm,
            type: 'other',
          });
        }

        if (packageJson.engines.bun) {
          runtimes.push({
            name: 'Bun',
            version: packageJson.engines.bun,
            type: 'bun',
          });
        }
      }

      // Check for browser targets in browserlist or config
      if (packageJson.browserslist || packageJson.babel?.presets) {
        runtimes.push({
          name: 'Browser',
          type: 'browser',
        });
      }
    } catch (error) {
      // No package.json - check for other runtime indicators
    }

    // Check for other language runtimes based on files present
    try {
      const files = await fs.readdir(projectPath);

      if (files.includes('requirements.txt') || files.includes('setup.py') || files.includes('pyproject.toml')) {
        runtimes.push({
          name: 'Python',
          type: 'other',
        });
      }

      if (files.includes('Cargo.toml')) {
        runtimes.push({
          name: 'Rust',
          type: 'other',
        });
      }

      if (files.includes('go.mod')) {
        runtimes.push({
          name: 'Go',
          type: 'other',
        });
      }

      if (files.includes('pom.xml') || files.includes('build.gradle')) {
        runtimes.push({
          name: 'JVM',
          type: 'other',
        });
      }
    } catch (error) {
      // Ignore errors in runtime detection
    }

    return runtimes;
  }

  /**
   * Detect package managers from lock files
   */
  private detectPackageManagers(files: string[]): StackAnalysis['packageManagers'] {
    const packageManagers: StackAnalysis['packageManagers'] = [];
    const fileNames = files.map(file => basename(file));

    if (fileNames.includes('package-lock.json')) {
      packageManagers.push('npm');
    }

    if (fileNames.includes('yarn.lock')) {
      packageManagers.push('yarn');
    }

    if (fileNames.includes('pnpm-lock.yaml')) {
      packageManagers.push('pnpm');
    }

    if (fileNames.includes('bun.lockb')) {
      packageManagers.push('bun');
    }

    // If no lock files found but package.json exists, assume npm
    if (packageManagers.length === 0 && fileNames.includes('package.json')) {
      packageManagers.push('npm');
    }

    return packageManagers;
  }

  /**
   * Create empty analysis for projects with no detectable technology stack
   */
  private createEmptyAnalysis(): StackAnalysis {
    return {
      primaryLanguage: 'Unknown',
      languages: [],
      frameworks: [],
      buildTools: [],
      runtimes: [],
      packageManagers: [],
    };
  }
}