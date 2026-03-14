/**
 * Integration Analyzer - Third-party Dependencies and API Analysis
 *
 * Analyzes third-party integrations and dependencies including:
 * - Dependency analysis (production/development packages)
 * - Outdated dependency detection using npm registry
 * - Security vulnerability identification
 * - External API consumption patterns
 * - Exposed API endpoint detection
 * - Service integration mapping (databases, caches, cloud services)
 *
 * Returns structured IntegrationAnalysis data validated against schema.
 */

import { promises as fs } from 'fs';
import { join, relative, basename } from 'path';
import type { IntegrationAnalysis } from '@apexcli/core';
import type { CodebaseAnalyzer } from '../types.js';
import { queryNpmRegistry } from '@apexcli/core';
// Import compareVersions from utils since it's not exported from the main package
import { compareVersions } from '@apexcli/core/src/utils.js';

/**
 * Service integration detection patterns
 */
const SERVICE_PATTERNS = {
  databases: [
    { pattern: /postgres|pg|postgresql/i, name: 'PostgreSQL' },
    { pattern: /mysql|mysql2/i, name: 'MySQL' },
    { pattern: /mongodb|mongoose/i, name: 'MongoDB' },
    { pattern: /redis|ioredis/i, name: 'Redis' },
    { pattern: /sqlite|sqlite3/i, name: 'SQLite' },
    { pattern: /prisma/i, name: 'Prisma' },
    { pattern: /typeorm/i, name: 'TypeORM' },
    { pattern: /sequelize/i, name: 'Sequelize' },
    { pattern: /knex/i, name: 'Knex' },
    { pattern: /drizzle/i, name: 'Drizzle' },
  ],
  caches: [
    { pattern: /redis/i, name: 'Redis' },
    { pattern: /memcached/i, name: 'Memcached' },
    { pattern: /node-cache/i, name: 'Node Cache' },
    { pattern: /memory-cache/i, name: 'Memory Cache' },
  ],
  queues: [
    { pattern: /bull|bullmq/i, name: 'Bull Queue' },
    { pattern: /agenda/i, name: 'Agenda' },
    { pattern: /bee-queue/i, name: 'Bee Queue' },
    { pattern: /kue/i, name: 'Kue' },
    { pattern: /amqplib|rabbitmq/i, name: 'RabbitMQ' },
    { pattern: /aws-sdk.*sqs|@aws-sdk.*sqs/i, name: 'AWS SQS' },
  ],
  cloud: [
    { pattern: /aws-sdk|@aws-sdk/i, name: 'AWS SDK' },
    { pattern: /@google-cloud/i, name: 'Google Cloud' },
    { pattern: /@azure/i, name: 'Azure SDK' },
    { pattern: /firebase/i, name: 'Firebase' },
    { pattern: /vercel/i, name: 'Vercel' },
    { pattern: /netlify/i, name: 'Netlify' },
    { pattern: /heroku/i, name: 'Heroku' },
    { pattern: /digitalocean/i, name: 'DigitalOcean' },
  ],
  monitoring: [
    { pattern: /sentry/i, name: 'Sentry' },
    { pattern: /datadog/i, name: 'Datadog' },
    { pattern: /newrelic/i, name: 'New Relic' },
    { pattern: /bugsnag/i, name: 'Bugsnag' },
    { pattern: /rollbar/i, name: 'Rollbar' },
    { pattern: /winston/i, name: 'Winston' },
    { pattern: /pino/i, name: 'Pino' },
  ],
  auth: [
    { pattern: /passport/i, name: 'Passport.js' },
    { pattern: /auth0/i, name: 'Auth0' },
    { pattern: /firebase.*auth/i, name: 'Firebase Auth' },
    { pattern: /supabase/i, name: 'Supabase Auth' },
    { pattern: /clerk/i, name: 'Clerk' },
    { pattern: /next-auth|nextauth/i, name: 'NextAuth.js' },
    { pattern: /oauth/i, name: 'OAuth' },
  ],
  payments: [
    { pattern: /stripe/i, name: 'Stripe' },
    { pattern: /paypal/i, name: 'PayPal' },
    { pattern: /square/i, name: 'Square' },
    { pattern: /braintree/i, name: 'Braintree' },
    { pattern: /paddle/i, name: 'Paddle' },
  ],
};

/**
 * API detection patterns in source code
 */
const API_CONSUMPTION_PATTERNS = [
  /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,
  /axios\.(?:get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
  /request\s*\(\s*['"`]([^'"`]+)['"`]/g,
  /superagent\s*\.(?:get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
];

/**
 * Exposed API patterns (for backend services)
 */
const API_EXPOSURE_PATTERNS = [
  /(?:app|router|server)\.(?:get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
  /route\s*\(\s*['"`]([^'"`]+)['"`]/g,
  /@(?:Get|Post|Put|Delete|Patch)\s*\(\s*['"`]([^'"`]+)['"`]/g, // Decorators
];

/**
 * Known vulnerability patterns (simplified)
 */
const VULNERABILITY_PATTERNS = [
  { pattern: /lodash/i, versions: ['<4.17.19'], vulnerability: 'Prototype pollution', severity: 'high' as const },
  { pattern: /minimist/i, versions: ['<1.2.2'], vulnerability: 'Prototype pollution', severity: 'high' as const },
  { pattern: /yargs-parser/i, versions: ['<18.1.2'], vulnerability: 'Prototype pollution', severity: 'high' as const },
];

export class IntegrationAnalyzer implements CodebaseAnalyzer<IntegrationAnalysis> {
  /**
   * Analyze integrations and dependencies in a codebase
   */
  async analyze(projectPath: string): Promise<IntegrationAnalysis> {
    try {
      // 1. Parse package.json for dependencies
      const dependencyInfo = await this.analyzeDependencies(projectPath);

      // 2. Check for outdated packages using npm registry
      const outdated = await this.checkOutdatedPackages(dependencyInfo);

      // 3. Check for security vulnerabilities
      const security = this.checkSecurityVulnerabilities(dependencyInfo);

      // 4. Detect consumed APIs from source code
      const consumedApis = await this.detectConsumedApis(projectPath);

      // 5. Detect exposed APIs
      const exposedApis = await this.detectExposedApis(projectPath);

      // 6. Detect service integrations
      const services = this.detectServiceIntegrations(dependencyInfo);

      // 7. Calculate health metrics
      const health = this.calculateHealthMetrics(outdated, security, dependencyInfo);

      // 8. Generate recommendations
      const recommendations = this.generateRecommendations(outdated, security, health);

      return {
        dependencies: {
          production: dependencyInfo.production,
          development: dependencyInfo.development,
          outdated,
          security,
        },
        apis: {
          consumed: consumedApis,
          exposed: exposedApis,
        },
        services,
        health,
        recommendations,
      };
    } catch (error) {
      throw new Error(`Integration analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Analyze dependencies from package.json
   */
  private async analyzeDependencies(projectPath: string): Promise<{
    production: IntegrationAnalysis['dependencies']['production'];
    development: IntegrationAnalysis['dependencies']['development'];
    all: Map<string, string>;
  }> {
    const production: IntegrationAnalysis['dependencies']['production'] = [];
    const development: IntegrationAnalysis['dependencies']['development'] = [];
    const all = new Map<string, string>();

    try {
      const packageJsonPath = join(projectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      // Process production dependencies
      const prodDeps = packageJson.dependencies || {};
      for (const [name, version] of Object.entries(prodDeps)) {
        const category = this.categorizeDependency(name);
        const cleanVersion = String(version).replace(/^[\^~]/, '');

        production.push({
          name,
          version: cleanVersion,
          category,
        });
        all.set(name, cleanVersion);
      }

      // Process development dependencies
      const devDeps = packageJson.devDependencies || {};
      for (const [name, version] of Object.entries(devDeps)) {
        const category = this.categorizeDependency(name);
        const cleanVersion = String(version).replace(/^[\^~]/, '');

        development.push({
          name,
          version: cleanVersion,
          category,
        });
        all.set(name, cleanVersion);
      }

      return { production, development, all };
    } catch (error) {
      // No package.json or can't read it
      return { production: [], development: [], all: new Map() };
    }
  }

  /**
   * Categorize dependency by name patterns
   */
  private categorizeDependency(name: string): IntegrationAnalysis['dependencies']['production'][0]['category'] {
    const patterns = {
      frontend: /^(react|vue|angular|svelte|solid-js|preact|@angular|@vue)/i,
      backend: /^(express|fastify|koa|hapi|@nestjs|apollo-server)/i,
      testing: /^(jest|vitest|mocha|cypress|playwright|@testing-library)/i,
      build: /^(webpack|rollup|vite|parcel|esbuild|babel|@babel)/i,
      database: /^(prisma|typeorm|sequelize|mongoose|pg|mysql|redis)/i,
      ui: /^(@mui|antd|@chakra-ui|@mantine|tailwindcss|bootstrap)/i,
      'state-management': /^(redux|@reduxjs|zustand|mobx|recoil|@tanstack)/i,
      security: /^(helmet|cors|bcrypt|jsonwebtoken|passport)/i,
    };

    for (const [category, pattern] of Object.entries(patterns)) {
      if (pattern.test(name)) {
        return category as IntegrationAnalysis['dependencies']['production'][0]['category'];
      }
    }

    return 'other';
  }

  /**
   * Check for outdated packages using npm registry
   */
  private async checkOutdatedPackages(dependencyInfo: {
    all: Map<string, string>;
  }): Promise<IntegrationAnalysis['dependencies']['outdated']> {
    const outdated: IntegrationAnalysis['dependencies']['outdated'] = [];

    // Check a subset of dependencies to avoid API rate limits
    const dependenciesToCheck = Array.from(dependencyInfo.all.entries()).slice(0, 20);

    for (const [name, currentVersion] of dependenciesToCheck) {
      try {
        const npmInfo = await queryNpmRegistry(name);
        if (!npmInfo || npmInfo.error) {
          continue; // Skip if registry query fails
        }

        const latestVersion = npmInfo.latestVersion;
        const comparison = compareVersions(currentVersion, latestVersion);

        if (comparison < 0) {
          // Current version is behind latest
          const versionParts = this.parseVersionParts(currentVersion);
          const latestParts = this.parseVersionParts(latestVersion);

          const majorVersionsBehind = Math.max(0, latestParts.major - versionParts.major);
          const minorVersionsBehind = majorVersionsBehind > 0 ? 0 : Math.max(0, latestParts.minor - versionParts.minor);
          const patchVersionsBehind = majorVersionsBehind > 0 || minorVersionsBehind > 0 ? 0 : Math.max(0, latestParts.patch - versionParts.patch);

          const risk = this.calculateUpdateRisk(majorVersionsBehind, minorVersionsBehind, patchVersionsBehind);
          const breaking = majorVersionsBehind > 0;

          outdated.push({
            name,
            currentVersion,
            latestVersion,
            majorVersionsBehind,
            minorVersionsBehind,
            patchVersionsBehind,
            risk,
            breaking,
          });
        }
      } catch (error) {
        // Skip packages that can't be checked
        continue;
      }
    }

    return outdated;
  }

  /**
   * Parse semantic version into parts
   */
  private parseVersionParts(version: string): { major: number; minor: number; patch: number } {
    const cleaned = version.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.').map(p => parseInt(p, 10) || 0);

    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0,
    };
  }

  /**
   * Calculate update risk based on version differences
   */
  private calculateUpdateRisk(major: number, minor: number, patch: number): IntegrationAnalysis['dependencies']['outdated'][0]['risk'] {
    if (major > 2) return 'critical';
    if (major > 0) return 'high';
    if (minor > 5) return 'high';
    if (minor > 2) return 'medium';
    if (patch > 10) return 'medium';
    return 'low';
  }

  /**
   * Check for known security vulnerabilities
   */
  private checkSecurityVulnerabilities(dependencyInfo: {
    all: Map<string, string>;
  }): IntegrationAnalysis['dependencies']['security'] {
    const vulnerabilities: IntegrationAnalysis['dependencies']['security'] = [];

    for (const [name, version] of dependencyInfo.all.entries()) {
      for (const vuln of VULNERABILITY_PATTERNS) {
        if (vuln.pattern.test(name)) {
          // Check if current version is vulnerable
          for (const vulnVersion of vuln.versions) {
            if (this.isVersionVulnerable(version, vulnVersion)) {
              vulnerabilities.push({
                name,
                severity: vuln.severity,
                vulnerability: vuln.vulnerability,
                patchedVersion: this.extractPatchedVersion(vulnVersion),
              });
              break;
            }
          }
        }
      }
    }

    return vulnerabilities;
  }

  /**
   * Check if a version matches a vulnerability pattern
   */
  private isVersionVulnerable(version: string, vulnPattern: string): boolean {
    // Simple version comparison - would need more sophisticated logic for real use
    const operator = vulnPattern.match(/^[<>=]+/)?.[0] || '';
    const vulnVersion = vulnPattern.replace(/^[<>=]+/, '');

    if (operator === '<') {
      return compareVersions(version, vulnVersion) < 0;
    }

    return false;
  }

  /**
   * Extract patched version from vulnerability pattern
   */
  private extractPatchedVersion(vulnPattern: string): string {
    return vulnPattern.replace(/^[<>=]+/, '');
  }

  /**
   * Detect consumed APIs from source code
   */
  private async detectConsumedApis(projectPath: string): Promise<IntegrationAnalysis['apis']['consumed']> {
    const consumedApis: IntegrationAnalysis['apis']['consumed'] = [];
    const apiSet = new Set<string>();

    try {
      const files = await this.findSourceFiles(projectPath);

      // Analyze a subset of files for performance
      const filesToAnalyze = files.slice(0, 50);

      for (const file of filesToAnalyze) {
        try {
          const content = await fs.readFile(file, 'utf-8');

          // Find API calls using various patterns
          for (const pattern of API_CONSUMPTION_PATTERNS) {
            const matches = content.matchAll(pattern);

            for (const match of matches) {
              const url = match[1];
              if (url && this.isExternalUrl(url)) {
                const apiKey = `${this.getUrlMethod(content, match.index || 0)} ${url}`;
                if (!apiSet.has(apiKey)) {
                  apiSet.add(apiKey);
                  consumedApis.push({
                    url,
                    method: this.getUrlMethod(content, match.index || 0),
                    authenticated: this.hasAuthentication(content, match.index || 0),
                    provider: this.extractProvider(url),
                  });
                }
              }
            }
          }
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }
    } catch (error) {
      // Skip if can't find source files
    }

    return consumedApis;
  }

  /**
   * Detect exposed APIs from source code
   */
  private async detectExposedApis(projectPath: string): Promise<IntegrationAnalysis['apis']['exposed']> {
    const exposedApis: IntegrationAnalysis['apis']['exposed'] = [];
    const apiSet = new Set<string>();

    try {
      const files = await this.findSourceFiles(projectPath);

      // Analyze a subset of files for performance
      const filesToAnalyze = files.slice(0, 50);

      for (const file of filesToAnalyze) {
        try {
          const content = await fs.readFile(file, 'utf-8');

          // Find API definitions using various patterns
          for (const pattern of API_EXPOSURE_PATTERNS) {
            const matches = content.matchAll(pattern);

            for (const match of matches) {
              const path = match[1];
              if (path) {
                const method = this.extractHttpMethod(match[0]);
                const apiKey = `${method} ${path}`;

                if (!apiSet.has(apiKey)) {
                  apiSet.add(apiKey);
                  exposedApis.push({
                    path,
                    method,
                    authenticated: this.hasAuthenticationInDefinition(match[0], content),
                    deprecated: this.isDeprecatedEndpoint(content, match.index || 0),
                  });
                }
              }
            }
          }
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }
    } catch (error) {
      // Skip if can't find source files
    }

    return exposedApis;
  }

  /**
   * Find source files for API analysis
   */
  private async findSourceFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs']);

    const walkDir = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);

          if (entry.isDirectory()) {
            const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);
            if (!skipDirs.has(entry.name)) {
              await walkDir(fullPath);
            }
          } else if (entry.isFile() && extensions.has(require('path').extname(entry.name))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories that can't be read
      }
    };

    await walkDir(projectPath);
    return files;
  }

  /**
   * Detect service integrations from dependencies
   */
  private detectServiceIntegrations(dependencyInfo: {
    all: Map<string, string>;
  }): IntegrationAnalysis['services'] {
    const services: IntegrationAnalysis['services'] = {
      databases: [],
      caches: [],
      queues: [],
      cloud: [],
      monitoring: [],
      auth: [],
      payments: [],
    };

    for (const [depName] of dependencyInfo.all.entries()) {
      for (const [serviceType, patterns] of Object.entries(SERVICE_PATTERNS)) {
        for (const { pattern, name } of patterns) {
          if (pattern.test(depName) && !services[serviceType as keyof typeof services].includes(name)) {
            services[serviceType as keyof typeof services].push(name);
            break;
          }
        }
      }
    }

    return services;
  }

  /**
   * Calculate overall health metrics
   */
  private calculateHealthMetrics(
    outdated: IntegrationAnalysis['dependencies']['outdated'],
    security: IntegrationAnalysis['dependencies']['security'],
    dependencyInfo: { all: Map<string, string> }
  ): IntegrationAnalysis['health'] {
    const totalDeps = dependencyInfo.all.size;
    const criticalOutdated = outdated.filter(d => d.risk === 'critical').length;
    const highSeveritySecurity = security.filter(s => s.severity === 'critical' || s.severity === 'high').length;

    // Calculate dependency risk
    let dependencyRisk: IntegrationAnalysis['health']['dependencyRisk'];
    if (criticalOutdated > 0 || outdated.length / totalDeps > 0.5) {
      dependencyRisk = 'critical';
    } else if (outdated.filter(d => d.risk === 'high').length > 0 || outdated.length / totalDeps > 0.3) {
      dependencyRisk = 'high';
    } else if (outdated.length / totalDeps > 0.1) {
      dependencyRisk = 'medium';
    } else {
      dependencyRisk = 'low';
    }

    // Calculate security risk
    let securityRisk: IntegrationAnalysis['health']['securityRisk'];
    if (highSeveritySecurity > 0) {
      securityRisk = security.some(s => s.severity === 'critical') ? 'critical' : 'high';
    } else if (security.length > 0) {
      securityRisk = 'medium';
    } else {
      securityRisk = 'low';
    }

    // Calculate maintenance load
    let maintenanceLoad: IntegrationAnalysis['health']['maintenanceLoad'];
    if (dependencyRisk === 'critical' || securityRisk === 'critical') {
      maintenanceLoad = 'critical';
    } else if (dependencyRisk === 'high' || securityRisk === 'high') {
      maintenanceLoad = 'high';
    } else if (outdated.length > 5 || security.length > 0) {
      maintenanceLoad = 'medium';
    } else {
      maintenanceLoad = 'low';
    }

    // Calculate update frequency status
    let updateFrequency: IntegrationAnalysis['health']['updateFrequency'];
    const majorOutdated = outdated.filter(d => (d.majorVersionsBehind || 0) > 0);
    if (majorOutdated.length > totalDeps * 0.3) {
      updateFrequency = 'abandoned';
    } else if (majorOutdated.length > 0 || outdated.length > totalDeps * 0.5) {
      updateFrequency = 'legacy';
    } else if (outdated.length > totalDeps * 0.2) {
      updateFrequency = 'behind';
    } else {
      updateFrequency = 'current';
    }

    return {
      dependencyRisk,
      securityRisk,
      maintenanceLoad,
      updateFrequency,
    };
  }

  /**
   * Generate recommendations for integration improvements
   */
  private generateRecommendations(
    outdated: IntegrationAnalysis['dependencies']['outdated'],
    security: IntegrationAnalysis['dependencies']['security'],
    health: IntegrationAnalysis['health']
  ): string[] {
    const recommendations: string[] = [];

    // Security recommendations
    if (security.length > 0) {
      const critical = security.filter(s => s.severity === 'critical');
      if (critical.length > 0) {
        recommendations.push(`URGENT: Fix ${critical.length} critical security vulnerabilities`);
      }
      const high = security.filter(s => s.severity === 'high');
      if (high.length > 0) {
        recommendations.push(`Fix ${high.length} high-severity security vulnerabilities`);
      }
    }

    // Outdated dependencies
    const criticallyOutdated = outdated.filter(d => d.risk === 'critical');
    if (criticallyOutdated.length > 0) {
      recommendations.push(`Update ${criticallyOutdated.length} critically outdated dependencies`);
    }

    const majorUpdates = outdated.filter(d => (d.majorVersionsBehind || 0) > 0);
    if (majorUpdates.length > 0 && majorUpdates.length < 10) {
      recommendations.push(`Plan major version updates for ${majorUpdates.length} dependencies`);
    }

    // Health-based recommendations
    if (health?.updateFrequency === 'abandoned') {
      recommendations.push('Consider replacing abandoned dependencies with maintained alternatives');
    }

    if (health?.maintenanceLoad === 'critical' || health?.maintenanceLoad === 'high') {
      recommendations.push('Prioritize dependency maintenance to reduce security and stability risks');
    }

    // General recommendations
    if (outdated.length > 20) {
      recommendations.push('Implement automated dependency updates (Renovate, Dependabot)');
    }

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  // Helper methods for API detection

  private isExternalUrl(url: string): boolean {
    return url.startsWith('http') || url.includes('api') || url.includes('.com') || url.includes('.org');
  }

  private getUrlMethod(content: string, index: number): IntegrationAnalysis['apis']['consumed'][0]['method'] {
    const beforeMatch = content.substring(Math.max(0, index - 100), index);

    if (/\.post\s*\(/i.test(beforeMatch)) return 'POST';
    if (/\.put\s*\(/i.test(beforeMatch)) return 'PUT';
    if (/\.delete\s*\(/i.test(beforeMatch)) return 'DELETE';
    if (/\.patch\s*\(/i.test(beforeMatch)) return 'PATCH';
    if (/\.head\s*\(/i.test(beforeMatch)) return 'HEAD';
    if (/\.options\s*\(/i.test(beforeMatch)) return 'OPTIONS';

    return 'GET'; // Default
  }

  private hasAuthentication(content: string, index: number): boolean {
    const context = content.substring(Math.max(0, index - 200), index + 200);
    return /authorization|auth|token|bearer|api[_-]?key/i.test(context);
  }

  private extractProvider(url: string): string | undefined {
    const domain = url.match(/https?:\/\/(?:www\.)?([^\/]+)/)?.[1];
    if (!domain) return undefined;

    const providers = [
      'api.stripe.com',
      'api.github.com',
      'graph.facebook.com',
      'api.twitter.com',
      'googleapis.com',
      'api.slack.com',
    ];

    return providers.find(provider => domain.includes(provider.replace('api.', ''))) || domain;
  }

  private extractHttpMethod(matchText: string): IntegrationAnalysis['apis']['exposed'][0]['method'] {
    if (/\.post\s*\(|@Post/i.test(matchText)) return 'POST';
    if (/\.put\s*\(|@Put/i.test(matchText)) return 'PUT';
    if (/\.delete\s*\(|@Delete/i.test(matchText)) return 'DELETE';
    if (/\.patch\s*\(|@Patch/i.test(matchText)) return 'PATCH';
    if (/\.head\s*\(|@Head/i.test(matchText)) return 'HEAD';
    if (/\.options\s*\(|@Options/i.test(matchText)) return 'OPTIONS';

    return 'GET'; // Default
  }

  private hasAuthenticationInDefinition(matchText: string, content: string): boolean {
    return /auth|protected|private|@UseGuards|middleware.*auth/i.test(matchText);
  }

  private isDeprecatedEndpoint(content: string, index: number): boolean {
    const context = content.substring(Math.max(0, index - 100), index + 100);
    return /@deprecated|@Deprecated|deprecated|DEPRECATED/i.test(context);
  }
}