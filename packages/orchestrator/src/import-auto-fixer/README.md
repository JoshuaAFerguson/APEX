# ImportAutoFixer Service

The ImportAutoFixer is a comprehensive service that automatically detects and fixes missing imports in TypeScript and JavaScript projects. It uses multiple detection strategies (ESLint, TypeScript compiler) and intelligent resolution algorithms to find the correct import sources.

## Features

- **Multi-Strategy Detection**: Uses ESLint rules, TypeScript compiler API, or custom AST analysis
- **Intelligent Resolution**: Resolves imports from local files, TypeScript path aliases, and npm packages
- **Configuration Driven**: Highly configurable with sane defaults
- **Event-Based**: Emits events for progress tracking and integration
- **Batch Processing**: Efficiently handles multiple files
- **Type-Aware**: Supports TypeScript type-only imports
- **Dry Run Mode**: Preview changes before applying them

## Quick Start

```typescript
import { ImportAutoFixer } from '@apex/orchestrator';

const fixer = new ImportAutoFixer({
  projectPath: '/path/to/your/project',
  detector: 'auto', // ESLint preferred, fallback to TypeScript
});

// Analyze files for missing imports
const analysis = await fixer.analyze(['src/components/Button.tsx']);
console.log(`Found ${analysis[0].missingImports.length} missing imports`);

// Fix missing imports
const results = await fixer.fix(['src/components/Button.tsx']);
console.log(`Added ${results[0].importsAdded.length} imports`);
```

## Core Components

### Detectors

Detectors find missing imports by analyzing code:

- **ESLintDetector**: Uses ESLint's `no-undef` rule (recommended)
- **BaseDetector**: Abstract base class for custom detectors

### Resolvers

Resolvers determine where missing symbols should be imported from:

- **LocalResolver**: Finds exports in local project files
- **AliasResolver**: Resolves TypeScript path aliases (@/* patterns)
- **PackageResolver**: Maps to npm packages (React, lodash, etc.)

### Configuration

```typescript
interface ImportAutoFixerOptions {
  projectPath: string;                    // Root project directory
  detector?: 'eslint' | 'typescript' | 'auto';
  dryRun?: boolean;                       // Preview mode
  preferredImportStyle?: ImportStyle;     // 'named' | 'default' | 'namespace' | 'auto'
  organizeImports?: boolean;              // Sort and group imports
  respectExistingStyle?: boolean;         // Match file's existing style
  resolvers?: Partial<ResolversConfig>;   // Customize resolution behavior
}
```

## Usage Examples

### Basic Analysis and Fixing

```typescript
const fixer = new ImportAutoFixer({
  projectPath: process.cwd(),
});

// Check service availability
if (!(await fixer.isAvailable())) {
  console.log('ESLint not found - install eslint to use this service');
  return;
}

// Analyze without modifying files
const analysis = await fixer.analyze(['src/utils.ts']);
for (const file of analysis) {
  console.log(`${file.filePath}: ${file.missingImports.length} missing imports`);
}

// Fix imports
const results = await fixer.fix(['src/utils.ts']);
const summary = fixer.getSummary(results);
console.log(`Modified ${summary.filesModified} files, added ${summary.totalImportsAdded} imports`);
```

### Custom Configuration

```typescript
const fixer = new ImportAutoFixer({
  projectPath: '/my/project',
  detector: 'eslint',
  dryRun: false,
  preferredImportStyle: 'named',
  organizeImports: true,
  resolvers: {
    local: {
      searchPaths: ['src', 'lib', 'components'],
      excludePatterns: ['**/*.test.*', '**/__mocks__/**'],
    },
    package: {
      preferredPackages: {
        '_': 'lodash',
        'React': 'react',
        '$': 'jquery',
      },
      excludePackages: ['unsafe-package'],
    },
    alias: {
      enabled: true, // Uses tsconfig.json paths by default
      customMappings: {
        '@components/*': ['src/components/*'],
        '@utils/*': ['src/utils/*'],
      },
    },
  },
});

// Runtime configuration changes
fixer.configure({
  style: {
    quoteStyle: 'double',
    semicolons: false,
    useTypeImports: true,
  },
});
```

### Event Handling

```typescript
// Track progress and errors
fixer.on('analysis:started', ({ files }) => {
  console.log(`Analyzing ${files.length} files...`);
});

fixer.on('fix:import-added', ({ filePath, import: imp }) => {
  console.log(`Added: ${imp.specifier} from '${imp.source}' to ${filePath}`);
});

fixer.on('fix:error', ({ filePath, error }) => {
  console.error(`Error in ${filePath}: ${error.message}`);
  if (error.suggestion) {
    console.log(`Suggestion: ${error.suggestion}`);
  }
});

const results = await fixer.fix(['**/*.ts', '**/*.tsx']);
```

### Batch Processing

```typescript
const files = ['src/components/*.tsx', 'src/hooks/*.ts', 'src/utils/*.ts'];
const batchSize = 5;

for (let i = 0; i < files.length; i += batchSize) {
  const batch = files.slice(i, i + batchSize);
  const results = await fixer.fix(batch);

  console.log(`Batch ${Math.floor(i / batchSize) + 1} complete`);
  await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
}
```

## Advanced Features

### Type-Only Imports (TypeScript)

```typescript
const fixer = new ImportAutoFixer({
  projectPath: '/ts/project',
});

fixer.configure({
  style: {
    useTypeImports: true, // Generates "import type { User } from './types'"
  },
});

// For TypeScript interfaces, types, and type-only usage
const results = await fixer.fix(['src/api.ts']);
```

### Custom Import Resolution

```typescript
// Extend BaseResolver for custom logic
class CustomResolver extends BaseResolver {
  readonly id = 'custom';
  readonly priority = 10;

  async canResolve(identifier: string, context: ResolverContext): Promise<boolean> {
    return identifier.startsWith('Custom');
  }

  async resolve(identifier: string, context: ResolverContext): Promise<ImportResolution | null> {
    return this.createResolution({
      source: `./custom/${identifier.toLowerCase()}`,
      importType: 'default',
      confidence: 0.8,
    });
  }
}

// Add to fixer (this requires extending the constructor or using dependency injection)
```

### Integration with Build Tools

```typescript
// Webpack plugin
class ImportAutoFixerPlugin {
  apply(compiler) {
    compiler.hooks.beforeCompile.tapAsync('ImportAutoFixer', async (params, callback) => {
      const fixer = new ImportAutoFixer({ projectPath: compiler.context });
      const files = /* get changed files */;
      await fixer.fix(files);
      callback();
    });
  }
}

// VS Code extension integration
export function activate(context: vscode.ExtensionContext) {
  const command = vscode.commands.registerCommand('extension.fixImports', async () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const fixer = new ImportAutoFixer({ projectPath: vscode.workspace.rootPath! });
      await fixer.fix([editor.document.fileName]);
      vscode.window.showInformationMessage('Imports fixed!');
    }
  });
  context.subscriptions.push(command);
}
```

## API Reference

### Classes

- **ImportAutoFixer**: Main service class
- **BaseDetector**: Abstract detector base class
- **ESLintDetector**: ESLint-based detection
- **BaseResolver**: Abstract resolver base class
- **LocalResolver**: Local file resolution
- **AliasResolver**: TypeScript path alias resolution
- **PackageResolver**: npm package resolution

### Types

- **ImportAutoFixerOptions**: Constructor options
- **ImportAutoFixerConfig**: Complete configuration
- **MissingImport**: Detected missing import
- **ImportFixResult**: Fix operation result
- **ImportFixSummary**: Batch operation statistics
- **AddedImport**: Successfully added import

### Events

- `analysis:started`: Analysis begins
- `analysis:completed`: Analysis finishes
- `fix:started`: File fix begins
- `fix:import-added`: Import added to file
- `fix:completed`: File fix finishes
- `fix:error`: Error during fixing
- `resolution:ambiguous`: Multiple resolution options found

## Error Handling

The ImportAutoFixer gracefully handles various error conditions:

```typescript
const results = await fixer.fix(['problematic-file.ts']);

for (const result of results) {
  if (!result.success) {
    for (const error of result.errors) {
      switch (error.type) {
        case 'detection':
          console.log(`Could not parse file: ${error.message}`);
          break;
        case 'resolution':
          console.log(`Could not resolve ${error.identifier}: ${error.message}`);
          if (error.suggestion) {
            console.log(`Try: ${error.suggestion}`);
          }
          break;
        case 'application':
          console.log(`Could not apply fix: ${error.message}`);
          break;
        case 'io':
          console.log(`File system error: ${error.message}`);
          break;
      }
    }
  }
}
```

## Performance Considerations

- **Caching**: Export information is cached for performance
- **Incremental**: Only processes files that have changed
- **Concurrent**: Resolvers run concurrently when possible
- **Rate Limiting**: Built-in throttling for large batches
- **Memory**: Configurable cache sizes for large projects

## Limitations

- Requires ESLint for best detection accuracy
- Cannot resolve dynamic imports or computed property access
- May struggle with complex alias patterns
- Limited to CommonJS and ES Module patterns

## Contributing

The ImportAutoFixer is designed to be extensible:

1. **Custom Detectors**: Implement `IImportDetector` interface
2. **Custom Resolvers**: Extend `BaseResolver` class
3. **Configuration**: Add new configuration options
4. **Events**: Extend event system for better integration

See the source code for implementation details and extension points.