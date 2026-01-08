/**
 * Package Import Resolver
 *
 * Resolves imports from npm packages (node_modules). Uses common
 * identifier-to-package mappings and inspects installed packages.
 *
 * @module orchestrator/import-auto-fixer/resolvers/package-resolver
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ImportResolution,
  ResolverContext,
  PackageResolverConfig,
  PackageJsonInfo,
} from '../types';
import { BaseResolver } from './base-resolver';

/**
 * Common identifier to package mappings
 */
const COMMON_PACKAGES: Record<string, { pkg: string; importType: 'named' | 'default' | 'namespace' }> = {
  // React ecosystem
  React: { pkg: 'react', importType: 'default' },
  ReactDOM: { pkg: 'react-dom', importType: 'default' },
  useState: { pkg: 'react', importType: 'named' },
  useEffect: { pkg: 'react', importType: 'named' },
  useCallback: { pkg: 'react', importType: 'named' },
  useMemo: { pkg: 'react', importType: 'named' },
  useRef: { pkg: 'react', importType: 'named' },
  useContext: { pkg: 'react', importType: 'named' },
  useReducer: { pkg: 'react', importType: 'named' },
  useLayoutEffect: { pkg: 'react', importType: 'named' },
  useImperativeHandle: { pkg: 'react', importType: 'named' },
  useDebugValue: { pkg: 'react', importType: 'named' },
  useId: { pkg: 'react', importType: 'named' },
  useDeferredValue: { pkg: 'react', importType: 'named' },
  useTransition: { pkg: 'react', importType: 'named' },
  useSyncExternalStore: { pkg: 'react', importType: 'named' },
  useInsertionEffect: { pkg: 'react', importType: 'named' },
  createContext: { pkg: 'react', importType: 'named' },
  createRef: { pkg: 'react', importType: 'named' },
  forwardRef: { pkg: 'react', importType: 'named' },
  memo: { pkg: 'react', importType: 'named' },
  lazy: { pkg: 'react', importType: 'named' },
  Suspense: { pkg: 'react', importType: 'named' },
  Fragment: { pkg: 'react', importType: 'named' },
  StrictMode: { pkg: 'react', importType: 'named' },
  Component: { pkg: 'react', importType: 'named' },
  PureComponent: { pkg: 'react', importType: 'named' },
  Children: { pkg: 'react', importType: 'named' },

  // React Router
  useNavigate: { pkg: 'react-router-dom', importType: 'named' },
  useParams: { pkg: 'react-router-dom', importType: 'named' },
  useLocation: { pkg: 'react-router-dom', importType: 'named' },
  useSearchParams: { pkg: 'react-router-dom', importType: 'named' },
  Link: { pkg: 'react-router-dom', importType: 'named' },
  NavLink: { pkg: 'react-router-dom', importType: 'named' },
  Routes: { pkg: 'react-router-dom', importType: 'named' },
  Route: { pkg: 'react-router-dom', importType: 'named' },
  BrowserRouter: { pkg: 'react-router-dom', importType: 'named' },
  Outlet: { pkg: 'react-router-dom', importType: 'named' },

  // Lodash
  _: { pkg: 'lodash', importType: 'default' },
  lodash: { pkg: 'lodash', importType: 'default' },

  // Axios
  axios: { pkg: 'axios', importType: 'default' },

  // Date libraries
  moment: { pkg: 'moment', importType: 'default' },
  dayjs: { pkg: 'dayjs', importType: 'default' },

  // Testing
  describe: { pkg: 'vitest', importType: 'named' },
  it: { pkg: 'vitest', importType: 'named' },
  test: { pkg: 'vitest', importType: 'named' },
  expect: { pkg: 'vitest', importType: 'named' },
  vi: { pkg: 'vitest', importType: 'named' },
  beforeEach: { pkg: 'vitest', importType: 'named' },
  afterEach: { pkg: 'vitest', importType: 'named' },
  beforeAll: { pkg: 'vitest', importType: 'named' },
  afterAll: { pkg: 'vitest', importType: 'named' },

  // Node.js built-ins (for ESM)
  path: { pkg: 'path', importType: 'namespace' },
  fs: { pkg: 'fs', importType: 'namespace' },
  util: { pkg: 'util', importType: 'namespace' },
  os: { pkg: 'os', importType: 'namespace' },
  crypto: { pkg: 'crypto', importType: 'namespace' },
  http: { pkg: 'http', importType: 'namespace' },
  https: { pkg: 'https', importType: 'namespace' },
  url: { pkg: 'url', importType: 'namespace' },
  querystring: { pkg: 'querystring', importType: 'namespace' },
  stream: { pkg: 'stream', importType: 'namespace' },
  events: { pkg: 'events', importType: 'namespace' },

  // EventEmitter
  EventEmitter: { pkg: 'eventemitter3', importType: 'named' },

  // Zod
  z: { pkg: 'zod', importType: 'named' },
};

/**
 * Resolver that resolves from npm packages
 *
 * @example
 * ```typescript
 * const resolver = new PackageResolver();
 * const resolution = await resolver.resolve('useState', context);
 * // { source: 'react', importType: 'named', ... }
 * ```
 */
export class PackageResolver extends BaseResolver {
  readonly id = 'package';
  readonly priority = 3; // Lowest priority - prefer local first

  private config: PackageResolverConfig;
  private packageJsonCache: Map<string, PackageJsonInfo | null> = new Map();

  constructor(config: Partial<PackageResolverConfig> = {}) {
    super();
    this.config = {
      enabled: true,
      preferredPackages: {},
      excludePackages: [],
      ...config,
    };
  }

  /**
   * Check if this resolver can potentially resolve the identifier
   */
  async canResolve(identifier: string, context: ResolverContext): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    // Skip if already imported
    if (this.isAlreadyImported(identifier, context)) {
      return false;
    }

    // Check preferred packages first
    if (this.config.preferredPackages[identifier]) {
      return true;
    }

    // Check common packages
    if (COMMON_PACKAGES[identifier]) {
      const pkg = COMMON_PACKAGES[identifier].pkg;
      if (!this.config.excludePackages.includes(pkg)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Resolve the import source for an identifier from packages
   */
  async resolve(
    identifier: string,
    context: ResolverContext
  ): Promise<ImportResolution | null> {
    if (!this.config.enabled) {
      return null;
    }

    // Check preferred packages first
    const preferredPkg = this.config.preferredPackages[identifier];
    if (preferredPkg) {
      const isInstalled = await this.isPackageInstalled(preferredPkg, context.projectPath);
      if (isInstalled) {
        return this.createResolution({
          source: preferredPkg,
          importType: 'named', // Assume named for preferred
          isTypeOnly: false,
          confidence: 0.9,
        });
      }
    }

    // Check common packages
    const common = COMMON_PACKAGES[identifier];
    if (common && !this.config.excludePackages.includes(common.pkg)) {
      const isInstalled = await this.isPackageInstalled(common.pkg, context.projectPath);
      if (isInstalled) {
        return this.createResolution({
          source: common.pkg,
          importType: common.importType,
          isTypeOnly: false,
          confidence: 0.85,
        });
      }
    }

    // Try to find in installed packages by export analysis
    const packageResolution = await this.searchInstalledPackages(identifier, context);
    if (packageResolution) {
      return packageResolution;
    }

    return null;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Check if a package is installed
   */
  private async isPackageInstalled(
    packageName: string,
    projectPath: string
  ): Promise<boolean> {
    const packageJson = await this.loadPackageJson(projectPath);
    if (!packageJson) {
      return false;
    }

    // Check all dependency types
    return !!(
      packageJson.dependencies[packageName] ||
      packageJson.devDependencies[packageName] ||
      packageJson.peerDependencies?.[packageName]
    );
  }

  /**
   * Load and cache package.json
   */
  private async loadPackageJson(projectPath: string): Promise<PackageJsonInfo | null> {
    if (this.packageJsonCache.has(projectPath)) {
      return this.packageJsonCache.get(projectPath) ?? null;
    }

    const packageJsonPath = path.join(projectPath, 'package.json');

    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const parsed = JSON.parse(content);

      const info: PackageJsonInfo = {
        packagePath: packageJsonPath,
        name: parsed.name,
        dependencies: parsed.dependencies || {},
        devDependencies: parsed.devDependencies || {},
        peerDependencies: parsed.peerDependencies,
      };

      this.packageJsonCache.set(projectPath, info);
      return info;
    } catch {
      this.packageJsonCache.set(projectPath, null);
      return null;
    }
  }

  /**
   * Search installed packages for an identifier
   */
  private async searchInstalledPackages(
    identifier: string,
    context: ResolverContext
  ): Promise<ImportResolution | null> {
    const packageJson = await this.loadPackageJson(context.projectPath);
    if (!packageJson) {
      return null;
    }

    // Get all dependencies
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Skip if too many packages (performance)
    const depNames = Object.keys(allDeps);
    if (depNames.length > 100) {
      return null;
    }

    // Try each package
    for (const pkgName of depNames) {
      if (this.config.excludePackages.includes(pkgName)) {
        continue;
      }

      const exportInfo = await this.checkPackageExports(identifier, pkgName, context.projectPath);
      if (exportInfo) {
        return this.createResolution({
          source: pkgName,
          importType: exportInfo.importType,
          isTypeOnly: exportInfo.isType,
          confidence: 0.6, // Lower confidence for auto-discovered
        });
      }
    }

    return null;
  }

  /**
   * Check if a package exports an identifier
   */
  private async checkPackageExports(
    identifier: string,
    packageName: string,
    projectPath: string
  ): Promise<{ importType: 'named' | 'default'; isType: boolean } | null> {
    const nodeModulesPath = path.join(projectPath, 'node_modules', packageName);

    // Try to read package.json to find main entry
    try {
      const pkgJsonPath = path.join(nodeModulesPath, 'package.json');
      const content = await fs.readFile(pkgJsonPath, 'utf-8');
      const pkg = JSON.parse(content);

      // Check types field for TypeScript definitions
      const typesFile = pkg.types || pkg.typings;
      if (typesFile) {
        const typesPath = path.join(nodeModulesPath, typesFile);
        try {
          const typesContent = await fs.readFile(typesPath, 'utf-8');
          const exportInfo = this.findExportInPackageTypes(identifier, typesContent);
          if (exportInfo) {
            return exportInfo;
          }
        } catch {
          // Types file not readable
        }
      }

      // Check main entry
      const mainFile = pkg.main || 'index.js';
      const mainPath = path.join(nodeModulesPath, mainFile);
      try {
        const mainContent = await fs.readFile(mainPath, 'utf-8');
        if (this.hasExport(identifier, mainContent)) {
          return { importType: 'named', isType: false };
        }
      } catch {
        // Main file not readable
      }
    } catch {
      // Package.json not readable
    }

    return null;
  }

  /**
   * Find export in package type definitions
   */
  private findExportInPackageTypes(
    identifier: string,
    content: string
  ): { importType: 'named' | 'default'; isType: boolean } | null {
    // Check for exported interface/type
    const typeExportRegex = new RegExp(
      `export\\s+(?:interface|type)\\s+${identifier}\\b`
    );
    if (typeExportRegex.test(content)) {
      return { importType: 'named', isType: true };
    }

    // Check for exported function/const/class
    const valueExportRegex = new RegExp(
      `export\\s+(?:const|let|var|function|class)\\s+${identifier}\\b`
    );
    if (valueExportRegex.test(content)) {
      return { importType: 'named', isType: false };
    }

    // Check for export { identifier }
    const exportBlockRegex = /export\s*\{([^}]+)\}/g;
    let match;
    while ((match = exportBlockRegex.exec(content)) !== null) {
      const names = match[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop()!.trim());
      if (names.includes(identifier)) {
        return { importType: 'named', isType: false };
      }
    }

    return null;
  }

  /**
   * Check if content has an export for identifier
   */
  private hasExport(identifier: string, content: string): boolean {
    // Check various export patterns
    const patterns = [
      `export\\s+(?:const|let|var|function|class)\\s+${identifier}\\b`,
      `exports\\.${identifier}\\s*=`,
      `module\\.exports\\.${identifier}\\s*=`,
    ];

    for (const pattern of patterns) {
      if (new RegExp(pattern).test(content)) {
        return true;
      }
    }

    // Check export { ... }
    const exportBlockRegex = /export\s*\{([^}]+)\}/g;
    let match;
    while ((match = exportBlockRegex.exec(content)) !== null) {
      const names = match[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop()!.trim());
      if (names.includes(identifier)) {
        return true;
      }
    }

    return false;
  }
}
