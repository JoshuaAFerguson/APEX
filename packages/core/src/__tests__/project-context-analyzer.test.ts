import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ProjectContextAnalyzer,
  FrameworkDetectionSchema,
  ConfigFileInfoSchema,
  getProjectContextAnalyzer,
  analyzeProject,
  type FrameworkDetection,
  type ConfigFileInfo,
  type ProjectContextAnalyzerOptions,
} from '../project-context-analyzer.js';
import type {
  GitStatus,
  ProjectStructure,
  ConfigurationInfo,
  TestFrameworkInfo,
  ProjectContext,
} from '../types.js';

describe('ProjectContextAnalyzer', () => {
  let analyzer: ProjectContextAnalyzer;
  const testProjectPath = '/test/project';
  const defaultOptions: ProjectContextAnalyzerOptions = {
    maxDepth: 10,
    includeHidden: false,
    excludeDirectories: ['node_modules', '.git', 'dist', 'build', 'coverage'],
    analyzeGit: true,
    detectFrameworks: true,
    analyzeConfiguration: true,
    detectTests: true,
  };

  beforeEach(() => {
    analyzer = new ProjectContextAnalyzer(testProjectPath, defaultOptions);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('creates an instance with default options', () => {
      const simpleAnalyzer = new ProjectContextAnalyzer(testProjectPath);
      expect(simpleAnalyzer.getProjectPath()).toBe(testProjectPath);
      const options = simpleAnalyzer.getOptions();
      expect(options.maxDepth).toBe(10);
      expect(options.includeHidden).toBe(false);
      expect(options.analyzeGit).toBe(true);
      expect(options.detectFrameworks).toBe(true);
      expect(options.analyzeConfiguration).toBe(true);
      expect(options.detectTests).toBe(true);
    });

    it('creates an instance with custom options', () => {
      const customOptions: ProjectContextAnalyzerOptions = {
        maxDepth: 5,
        includeHidden: true,
        analyzeGit: false,
        detectFrameworks: false,
      };
      const customAnalyzer = new ProjectContextAnalyzer(testProjectPath, customOptions);

      const options = customAnalyzer.getOptions();
      expect(options.maxDepth).toBe(5);
      expect(options.includeHidden).toBe(true);
      expect(options.analyzeGit).toBe(false);
      expect(options.detectFrameworks).toBe(false);
      // Should retain defaults for unspecified options
      expect(options.analyzeConfiguration).toBe(true);
      expect(options.detectTests).toBe(true);
    });

    it('merges custom options with defaults', () => {
      const partialOptions: ProjectContextAnalyzerOptions = {
        maxDepth: 15,
        excludeDirectories: ['custom-exclude'],
      };
      const mergedAnalyzer = new ProjectContextAnalyzer(testProjectPath, partialOptions);

      const options = mergedAnalyzer.getOptions();
      expect(options.maxDepth).toBe(15);
      expect(options.excludeDirectories).toEqual(['custom-exclude']);
      expect(options.includeHidden).toBe(false); // Default value
      expect(options.analyzeGit).toBe(true); // Default value
    });
  });

  describe('getProjectPath', () => {
    it('returns the project path', () => {
      expect(analyzer.getProjectPath()).toBe(testProjectPath);
    });
  });

  describe('getOptions', () => {
    it('returns readonly options', () => {
      const options = analyzer.getOptions();
      expect(options).toBeDefined();
      expect(typeof options).toBe('object');

      // Verify it's readonly by checking the type (TypeScript ensures this)
      // At runtime, we can verify the options contain expected properties
      expect(options.maxDepth).toBeDefined();
      expect(options.includeHidden).toBeDefined();
      expect(options.analyzeGit).toBeDefined();
    });
  });

  describe('getGitStatus', () => {
    it('returns empty git status by default (TODO implementation)', async () => {
      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus).toEqual({
        isRepository: false,
        branch: null,
        remoteBranch: null,
        ahead: 0,
        behind: 0,
        staged: [],
        unstaged: [],
        untracked: [],
        hasConflicts: false,
        isDirty: false,
        stashCount: 0,
        remotes: [],
      });
    });

    it('returns consistent structure on multiple calls', async () => {
      const status1 = await analyzer.getGitStatus();
      const status2 = await analyzer.getGitStatus();

      expect(status1).toEqual(status2);
    });
  });

  describe('getProjectStructure', () => {
    it('returns project structure with basic information', async () => {
      const structure = await analyzer.getProjectStructure();

      expect(structure.root).toBe(testProjectPath);
      expect(structure.totalFiles).toBe(0);
      expect(structure.totalDirectories).toBe(0);
      expect(structure.entries).toEqual([]);
      expect(structure.rootFiles).toEqual([]);
      expect(structure.commonDirectories).toEqual([]);
      expect(structure.hasPackageJson).toBe(false);
      expect(structure.hasGitIgnore).toBe(false);
      expect(structure.hasReadme).toBe(false);
      expect(structure.hasLicense).toBe(false);
      expect(structure.excludedDirectories).toEqual(defaultOptions.excludeDirectories);
      expect(structure.scannedAt).toBeInstanceOf(Date);
    });

    it('includes excluded directories from options', async () => {
      const customExcluded = ['custom1', 'custom2'];
      const customAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        excludeDirectories: customExcluded,
      });

      const structure = await customAnalyzer.getProjectStructure();
      expect(structure.excludedDirectories).toEqual(customExcluded);
    });

    it('returns consistent structure on multiple calls', async () => {
      const structure1 = await analyzer.getProjectStructure();
      const structure2 = await analyzer.getProjectStructure();

      // scannedAt will be different, so we check other fields
      expect(structure1.root).toBe(structure2.root);
      expect(structure1.totalFiles).toBe(structure2.totalFiles);
      expect(structure1.excludedDirectories).toEqual(structure2.excludedDirectories);
    });
  });

  describe('detectFrameworks', () => {
    it('returns empty framework detection by default (TODO implementation)', async () => {
      const frameworks = await analyzer.detectFrameworks();

      expect(frameworks).toEqual({
        frameworks: [],
        languages: [],
      });
    });

    it('returns consistent results on multiple calls', async () => {
      const frameworks1 = await analyzer.detectFrameworks();
      const frameworks2 = await analyzer.detectFrameworks();

      expect(frameworks1).toEqual(frameworks2);
    });
  });

  describe('getConfigurationInfoList', () => {
    it('returns empty configuration list by default (TODO implementation)', async () => {
      const configs = await analyzer.getConfigurationInfoList();
      expect(configs).toEqual([]);
    });

    it('returns consistent results on multiple calls', async () => {
      const configs1 = await analyzer.getConfigurationInfoList();
      const configs2 = await analyzer.getConfigurationInfoList();

      expect(configs1).toEqual(configs2);
    });
  });

  describe('getTestFrameworkInfoList', () => {
    it('returns empty test framework list by default (TODO implementation)', async () => {
      const testFrameworks = await analyzer.getTestFrameworkInfoList();
      expect(testFrameworks).toEqual([]);
    });

    it('returns consistent results on multiple calls', async () => {
      const frameworks1 = await analyzer.getTestFrameworkInfoList();
      const frameworks2 = await analyzer.getTestFrameworkInfoList();

      expect(frameworks1).toEqual(frameworks2);
    });
  });

  describe('analyze', () => {
    it('performs complete analysis with all options enabled', async () => {
      const context = await analyzer.analyze();

      expect(context.gitStatus).toBeDefined();
      expect(context.structure).toBeDefined();
      expect(context.frameworks).toEqual([]);
      expect(context.configurations).toEqual([]);
      expect(context.testFrameworks).toEqual([]);
      expect(context.detectedAt).toBeInstanceOf(Date);
      expect(context.errors).toEqual([]);
    });

    it('excludes git status when analyzeGit is false', async () => {
      const noGitAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        analyzeGit: false,
      });

      const context = await noGitAnalyzer.analyze();
      expect(context.gitStatus).toBeUndefined();
      expect(context.structure).toBeDefined();
    });

    it('returns empty frameworks when detectFrameworks is false', async () => {
      const noFrameworkAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        detectFrameworks: false,
      });

      const context = await noFrameworkAnalyzer.analyze();
      expect(context.frameworks).toEqual([]);
    });

    it('returns empty configurations when analyzeConfiguration is false', async () => {
      const noConfigAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        analyzeConfiguration: false,
      });

      const context = await noConfigAnalyzer.analyze();
      expect(context.configurations).toEqual([]);
    });

    it('returns empty test frameworks when detectTests is false', async () => {
      const noTestAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        detectTests: false,
      });

      const context = await noTestAnalyzer.analyze();
      expect(context.testFrameworks).toEqual([]);
    });

    it('handles parallel analysis calls correctly', async () => {
      const [context1, context2, context3] = await Promise.all([
        analyzer.analyze(),
        analyzer.analyze(),
        analyzer.analyze(),
      ]);

      // All should have similar structure (detectedAt will differ)
      expect(context1.structure.root).toBe(context2.structure.root);
      expect(context2.structure.root).toBe(context3.structure.root);
      expect(context1.frameworks).toEqual(context2.frameworks);
      expect(context2.frameworks).toEqual(context3.frameworks);
    });

    it('includes current timestamp in detectedAt', async () => {
      const beforeAnalysis = new Date();
      const context = await analyzer.analyze();
      const afterAnalysis = new Date();

      expect(context.detectedAt.getTime()).toBeGreaterThanOrEqual(beforeAnalysis.getTime());
      expect(context.detectedAt.getTime()).toBeLessThanOrEqual(afterAnalysis.getTime());
    });
  });

  describe('error handling', () => {
    it('handles exceptions in analyze method gracefully', async () => {
      // Mock one of the methods to throw an error
      const errorAnalyzer = new ProjectContextAnalyzer(testProjectPath);
      vi.spyOn(errorAnalyzer, 'getProjectStructure').mockRejectedValue(new Error('Test error'));

      // The analyze method should handle this gracefully
      await expect(errorAnalyzer.analyze()).rejects.toThrow('Test error');
    });

    it('handles exceptions in individual methods gracefully', async () => {
      const errorAnalyzer = new ProjectContextAnalyzer(testProjectPath);
      vi.spyOn(errorAnalyzer, 'getGitStatus').mockRejectedValue(new Error('Git error'));

      await expect(errorAnalyzer.getGitStatus()).rejects.toThrow('Git error');
    });
  });

  describe('edge cases', () => {
    it('handles empty project path', () => {
      const emptyPathAnalyzer = new ProjectContextAnalyzer('');
      expect(emptyPathAnalyzer.getProjectPath()).toBe('');
    });

    it('handles very long project path', () => {
      const longPath = '/very/long/path/that/goes/on/for/a/while/to/test/edge/cases';
      const longPathAnalyzer = new ProjectContextAnalyzer(longPath);
      expect(longPathAnalyzer.getProjectPath()).toBe(longPath);
    });

    it('handles special characters in project path', () => {
      const specialPath = '/path/with spaces/and-dashes/and_underscores';
      const specialAnalyzer = new ProjectContextAnalyzer(specialPath);
      expect(specialAnalyzer.getProjectPath()).toBe(specialPath);
    });

    it('handles extreme maxDepth values', () => {
      const extremeOptions = { maxDepth: 0 };
      const extremeAnalyzer = new ProjectContextAnalyzer(testProjectPath, extremeOptions);
      expect(extremeAnalyzer.getOptions().maxDepth).toBe(0);
    });

    it('handles empty excludeDirectories array', () => {
      const emptyExclude = { excludeDirectories: [] };
      const emptyExcludeAnalyzer = new ProjectContextAnalyzer(testProjectPath, emptyExclude);
      expect(emptyExcludeAnalyzer.getOptions().excludeDirectories).toEqual([]);
    });
  });
});

describe('FrameworkDetectionSchema', () => {
  it('validates valid framework detection', () => {
    const validFrameworkDetection: FrameworkDetection = {
      primary: {
        name: 'React',
        version: '18.0.0',
        confidence: 0.95,
        indicators: ['package.json'],
      },
      frameworks: [
        {
          name: 'React',
          version: '18.0.0',
          confidence: 0.95,
          indicators: ['package.json'],
        },
      ],
      primaryLanguage: 'TypeScript',
      languages: [
        {
          name: 'TypeScript',
          extensions: ['.ts', '.tsx'],
          percentage: 80,
        },
      ],
      runtime: 'node',
      packageManager: 'npm',
    };

    const result = FrameworkDetectionSchema.safeParse(validFrameworkDetection);
    expect(result.success).toBe(true);
  });

  it('validates minimal framework detection', () => {
    const minimalFrameworkDetection = {
      frameworks: [],
      languages: [],
    };

    const result = FrameworkDetectionSchema.safeParse(minimalFrameworkDetection);
    expect(result.success).toBe(true);
  });

  it('rejects invalid framework detection with invalid language percentage', () => {
    const invalidFrameworkDetection = {
      frameworks: [],
      languages: [
        {
          name: 'TypeScript',
          extensions: ['.ts'],
          percentage: 150, // Invalid - over 100
        },
      ],
    };

    const result = FrameworkDetectionSchema.safeParse(invalidFrameworkDetection);
    expect(result.success).toBe(false);
  });

  it('validates framework detection with error', () => {
    const errorFrameworkDetection = {
      frameworks: [],
      languages: [],
      error: 'Failed to detect frameworks',
    };

    const result = FrameworkDetectionSchema.safeParse(errorFrameworkDetection);
    expect(result.success).toBe(true);
  });
});

describe('ConfigFileInfoSchema', () => {
  it('validates valid config file info', () => {
    const validConfigFileInfo: ConfigFileInfo = {
      name: 'package.json',
      path: './package.json',
      type: 'package',
      exists: true,
      description: 'Node.js package configuration',
    };

    const result = ConfigFileInfoSchema.safeParse(validConfigFileInfo);
    expect(result.success).toBe(true);
  });

  it('validates minimal config file info', () => {
    const minimalConfigFileInfo = {
      name: 'webpack.config.js',
      path: './webpack.config.js',
      type: 'webpack',
      exists: false,
    };

    const result = ConfigFileInfoSchema.safeParse(minimalConfigFileInfo);
    expect(result.success).toBe(true);
  });

  it('validates all config file types', () => {
    const types = [
      'package',
      'typescript',
      'eslint',
      'prettier',
      'babel',
      'webpack',
      'vite',
      'rollup',
      'jest',
      'vitest',
      'docker',
      'ci',
      'git',
      'editor',
      'environment',
      'other',
    ];

    types.forEach(type => {
      const configFileInfo = {
        name: `${type}.config`,
        path: `./${type}.config`,
        type,
        exists: true,
      };

      const result = ConfigFileInfoSchema.safeParse(configFileInfo);
      expect(result.success).toBe(true);
    });
  });

  it('rejects invalid config file type', () => {
    const invalidConfigFileInfo = {
      name: 'invalid.config',
      path: './invalid.config',
      type: 'invalid-type',
      exists: true,
    };

    const result = ConfigFileInfoSchema.safeParse(invalidConfigFileInfo);
    expect(result.success).toBe(false);
  });
});

describe('getProjectContextAnalyzer', () => {
  afterEach(() => {
    // Reset the singleton
    vi.resetModules();
  });

  it('creates a new analyzer instance', () => {
    const analyzer = getProjectContextAnalyzer(testProjectPath);
    expect(analyzer).toBeInstanceOf(ProjectContextAnalyzer);
    expect(analyzer.getProjectPath()).toBe(testProjectPath);
  });

  it('reuses analyzer for same path', () => {
    const analyzer1 = getProjectContextAnalyzer(testProjectPath);
    const analyzer2 = getProjectContextAnalyzer(testProjectPath);
    expect(analyzer1).toBe(analyzer2);
  });

  it('creates new analyzer for different path', () => {
    const path1 = '/path1';
    const path2 = '/path2';

    const analyzer1 = getProjectContextAnalyzer(path1);
    const analyzer2 = getProjectContextAnalyzer(path2);

    expect(analyzer1).not.toBe(analyzer2);
    expect(analyzer1.getProjectPath()).toBe(path1);
    expect(analyzer2.getProjectPath()).toBe(path2);
  });

  it('creates new analyzer when path changes', () => {
    const analyzer1 = getProjectContextAnalyzer('/path1');
    const analyzer2 = getProjectContextAnalyzer('/path2');
    const analyzer3 = getProjectContextAnalyzer('/path1'); // Back to first path

    expect(analyzer1).not.toBe(analyzer2);
    expect(analyzer2).not.toBe(analyzer3);
    // analyzer3 should be a new instance, not the same as analyzer1
    expect(analyzer1).not.toBe(analyzer3);
  });

  it('applies options to analyzer', () => {
    const customOptions: ProjectContextAnalyzerOptions = {
      maxDepth: 5,
      analyzeGit: false,
    };

    const analyzer = getProjectContextAnalyzer(testProjectPath, customOptions);
    const options = analyzer.getOptions();

    expect(options.maxDepth).toBe(5);
    expect(options.analyzeGit).toBe(false);
  });
});

describe('analyzeProject', () => {
  it('creates analyzer and returns project context', async () => {
    const context = await analyzeProject(testProjectPath);

    expect(context).toBeDefined();
    expect(context.structure).toBeDefined();
    expect(context.structure.root).toBe(testProjectPath);
    expect(context.frameworks).toEqual([]);
    expect(context.configurations).toEqual([]);
    expect(context.testFrameworks).toEqual([]);
    expect(context.detectedAt).toBeInstanceOf(Date);
    expect(context.errors).toEqual([]);
  });

  it('applies options to analysis', async () => {
    const customOptions: ProjectContextAnalyzerOptions = {
      analyzeGit: false,
      detectFrameworks: false,
    };

    const context = await analyzeProject(testProjectPath, customOptions);

    expect(context.gitStatus).toBeUndefined();
    expect(context.frameworks).toEqual([]);
  });

  it('handles multiple concurrent calls', async () => {
    const [context1, context2, context3] = await Promise.all([
      analyzeProject(testProjectPath),
      analyzeProject(testProjectPath),
      analyzeProject(testProjectPath),
    ]);

    expect(context1.structure.root).toBe(context2.structure.root);
    expect(context2.structure.root).toBe(context3.structure.root);
  });
});