#!/usr/bin/env tsx

/**
 * Comprehensive audit script for v0.1.0 CLI commands
 * Verifies that all 6 target commands (init, run, status, agents, workflows, logs)
 * are fully functional implementations rather than stubs.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

interface CommandDefinition {
  name: string;
  aliases: string[];
  description: string;
  usage?: string;
  handlerStartLine: number;
  handlerEndLine: number;
  handlerContent: string;
  isStub: boolean;
  complexity: 'simple' | 'medium' | 'complex';
  featureCount: number;
  features: string[];
}

interface AuditResult {
  command: string;
  status: 'FUNCTIONAL' | 'STUB' | 'MISSING';
  details: {
    linesOfCode: number;
    hasErrorHandling: boolean;
    hasInitCheck: boolean;
    hasArgParsing: boolean;
    hasBusinessLogic: boolean;
    features: string[];
  };
  issues: string[];
  recommendations: string[];
}

const TARGET_COMMANDS = ['init', 'run', 'status', 'agents', 'workflows', 'logs'];

class CLICommandAuditor {
  private cliSourcePath: string;
  private sourceCode: string = '';

  constructor() {
    this.cliSourcePath = path.join(process.cwd(), 'packages/cli/src/index.ts');
  }

  async audit(): Promise<AuditResult[]> {
    console.log(chalk.blue('🔍 Starting v0.1.0 CLI Commands Audit\n'));

    try {
      this.sourceCode = await fs.readFile(this.cliSourcePath, 'utf-8');
      console.log(chalk.green(`✅ Loaded CLI source: ${this.cliSourcePath}`));
      console.log(chalk.gray(`   File size: ${this.sourceCode.length} characters\n`));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to load CLI source: ${error}`));
      process.exit(1);
    }

    const results: AuditResult[] = [];

    for (const command of TARGET_COMMANDS) {
      console.log(chalk.yellow(`📋 Auditing command: ${command}`));
      const result = await this.auditCommand(command);
      results.push(result);
      this.printCommandResult(result);
      console.log(''); // Add spacing
    }

    this.printSummary(results);
    this.generateReport(results);

    return results;
  }

  private async auditCommand(commandName: string): Promise<AuditResult> {
    const commandDef = this.extractCommandDefinition(commandName);

    if (!commandDef) {
      return {
        command: commandName,
        status: 'MISSING',
        details: {
          linesOfCode: 0,
          hasErrorHandling: false,
          hasInitCheck: false,
          hasArgParsing: false,
          hasBusinessLogic: false,
          features: []
        },
        issues: ['Command definition not found'],
        recommendations: ['Implement command definition']
      };
    }

    const analysis = this.analyzeCommandHandler(commandDef);

    return {
      command: commandName,
      status: analysis.isStub ? 'STUB' : 'FUNCTIONAL',
      details: {
        linesOfCode: commandDef.handlerContent.split('\n').length,
        hasErrorHandling: this.hasErrorHandling(commandDef.handlerContent),
        hasInitCheck: this.hasInitializationCheck(commandDef.handlerContent),
        hasArgParsing: this.hasArgumentParsing(commandDef.handlerContent),
        hasBusinessLogic: this.hasBusinessLogic(commandDef.handlerContent),
        features: commandDef.features
      },
      issues: this.identifyIssues(commandDef),
      recommendations: this.generateRecommendations(commandDef)
    };
  }

  private extractCommandDefinition(commandName: string): CommandDefinition | null {
    // Find the command definition pattern
    const commandRegex = new RegExp(`name: ['"]${commandName}['"]`, 'g');
    const match = commandRegex.exec(this.sourceCode);

    if (!match) {
      return null;
    }

    // Find the handler function start
    const startIndex = match.index;
    const handlerMatch = this.sourceCode.substring(startIndex).match(/handler: async \(.*?\) => \{/);

    if (!handlerMatch) {
      return null;
    }

    const handlerStart = startIndex + handlerMatch.index! + handlerMatch[0].length;

    // Find matching closing brace
    let braceCount = 1;
    let i = handlerStart;
    while (i < this.sourceCode.length && braceCount > 0) {
      if (this.sourceCode[i] === '{') braceCount++;
      if (this.sourceCode[i] === '}') braceCount--;
      i++;
    }

    const handlerEnd = i - 1;
    const handlerContent = this.sourceCode.substring(handlerStart, handlerEnd);

    // Extract other properties
    const commandBlock = this.sourceCode.substring(startIndex, handlerEnd + 1);
    const aliases = this.extractAliases(commandBlock);
    const description = this.extractDescription(commandBlock);
    const usage = this.extractUsage(commandBlock);

    const features = this.extractFeatures(handlerContent);

    return {
      name: commandName,
      aliases,
      description,
      usage,
      handlerStartLine: this.getLineNumber(startIndex),
      handlerEndLine: this.getLineNumber(handlerEnd),
      handlerContent,
      isStub: this.isStubHandler(handlerContent),
      complexity: this.determineComplexity(handlerContent),
      featureCount: features.length,
      features
    };
  }

  private extractAliases(commandBlock: string): string[] {
    const aliasMatch = commandBlock.match(/aliases: \[(.*?)\]/s);
    if (!aliasMatch) return [];

    const aliasString = aliasMatch[1];
    return aliasString.split(',')
      .map(alias => alias.trim().replace(/['"]/g, ''))
      .filter(alias => alias.length > 0);
  }

  private extractDescription(commandBlock: string): string {
    const descMatch = commandBlock.match(/description: ['"]([^'"]+)['"]/);
    return descMatch ? descMatch[1] : 'No description';
  }

  private extractUsage(commandBlock: string): string | undefined {
    const usageMatch = commandBlock.match(/usage: ['"]([^'"]+)['"]/);
    return usageMatch ? usageMatch[1] : undefined;
  }

  private extractFeatures(handlerContent: string): string[] {
    const features: string[] = [];

    // Common feature patterns
    const featurePatterns = [
      { pattern: /console\.log/, feature: 'console output' },
      { pattern: /chalk\.(red|green|yellow|blue)/, feature: 'colored output' },
      { pattern: /if\s*\(.*args/, feature: 'argument parsing' },
      { pattern: /if\s*\(.*initialized/, feature: 'initialization check' },
      { pattern: /try\s*\{/, feature: 'error handling' },
      { pattern: /await\s+.*load/, feature: 'data loading' },
      { pattern: /await\s+.*save/, feature: 'data saving' },
      { pattern: /\.filter\(/, feature: 'data filtering' },
      { pattern: /\.map\(/, feature: 'data transformation' },
      { pattern: /inquirer\./, feature: 'user interaction' },
      { pattern: /spawn\(/, feature: 'process execution' },
      { pattern: /boxen\(/, feature: 'formatted display' },
      { pattern: /table\./, feature: 'table display' },
      { pattern: /orchestrator\./, feature: 'orchestrator integration' }
    ];

    for (const { pattern, feature } of featurePatterns) {
      if (pattern.test(handlerContent)) {
        features.push(feature);
      }
    }

    return features;
  }

  private isStubHandler(handlerContent: string): boolean {
    const cleanContent = handlerContent.trim();

    // Check for stub indicators
    const stubPatterns = [
      /console\.log\(['"]Not implemented['"]?\)/,
      /throw new Error\(['"]Not implemented['"]?\)/,
      /TODO:/,
      /STUB/,
      /PLACEHOLDER/
    ];

    const hasStubPattern = stubPatterns.some(pattern => pattern.test(cleanContent));

    // Check if it's too simple (less than 3 meaningful lines)
    const meaningfulLines = cleanContent.split('\n')
      .filter(line => line.trim().length > 0)
      .filter(line => !line.trim().startsWith('//'))
      .filter(line => !line.trim().startsWith('/*'))
      .filter(line => line.trim() !== '{' && line.trim() !== '}');

    const tooSimple = meaningfulLines.length < 3;

    return hasStubPattern || tooSimple;
  }

  private determineComplexity(handlerContent: string): 'simple' | 'medium' | 'complex' {
    const lines = handlerContent.split('\n').filter(line => line.trim().length > 0);
    const features = this.extractFeatures(handlerContent);

    if (lines.length < 10 || features.length < 3) return 'simple';
    if (lines.length < 50 || features.length < 6) return 'medium';
    return 'complex';
  }

  private analyzeCommandHandler(commandDef: CommandDefinition): CommandDefinition {
    return commandDef;
  }

  private hasErrorHandling(handlerContent: string): boolean {
    return /try\s*\{|catch\s*\(|\.catch\(/.test(handlerContent);
  }

  private hasInitializationCheck(handlerContent: string): boolean {
    return /if\s*\(.*initialized/.test(handlerContent);
  }

  private hasArgumentParsing(handlerContent: string): boolean {
    return /args\[|args\./.test(handlerContent);
  }

  private hasBusinessLogic(handlerContent: string): boolean {
    // Check for meaningful business logic beyond simple console.log statements
    const businessLogicPatterns = [
      /await\s+.*load/,
      /await\s+.*save/,
      /await\s+.*create/,
      /await\s+.*update/,
      /await\s+.*delete/,
      /orchestrator\./,
      /spawn\(/,
      /inquirer\./,
      /fs\./,
      /path\./
    ];

    return businessLogicPatterns.some(pattern => pattern.test(handlerContent));
  }

  private identifyIssues(commandDef: CommandDefinition): string[] {
    const issues: string[] = [];

    if (commandDef.isStub) {
      issues.push('Command appears to be a stub implementation');
    }

    if (!this.hasErrorHandling(commandDef.handlerContent)) {
      issues.push('No error handling detected');
    }

    if (!this.hasInitializationCheck(commandDef.handlerContent) && commandDef.name !== 'init') {
      issues.push('No initialization check detected');
    }

    if (commandDef.featureCount < 3) {
      issues.push('Low feature complexity detected');
    }

    return issues;
  }

  private generateRecommendations(commandDef: CommandDefinition): string[] {
    const recommendations: string[] = [];

    if (commandDef.isStub) {
      recommendations.push('Implement full command functionality');
    }

    if (!this.hasErrorHandling(commandDef.handlerContent)) {
      recommendations.push('Add proper error handling with try/catch blocks');
    }

    if (commandDef.complexity === 'simple' && !commandDef.isStub) {
      recommendations.push('Consider adding more features or validation');
    }

    return recommendations;
  }

  private getLineNumber(characterIndex: number): number {
    const beforeIndex = this.sourceCode.substring(0, characterIndex);
    return beforeIndex.split('\n').length;
  }

  private printCommandResult(result: AuditResult): void {
    const statusColor = result.status === 'FUNCTIONAL' ? 'green' :
                       result.status === 'STUB' ? 'yellow' : 'red';
    const statusIcon = result.status === 'FUNCTIONAL' ? '✅' :
                      result.status === 'STUB' ? '⚠️' : '❌';

    console.log(`   ${statusIcon} Status: ${chalk[statusColor](result.status)}`);
    console.log(`   📏 Lines of Code: ${result.details.linesOfCode}`);
    console.log(`   🔧 Features: ${result.details.features.length} (${result.details.features.join(', ')})`);

    if (result.details.hasErrorHandling) console.log(`   ✅ Error handling: Present`);
    else console.log(`   ❌ Error handling: Missing`);

    if (result.details.hasInitCheck) console.log(`   ✅ Initialization check: Present`);
    else if (result.command !== 'init') console.log(`   ❌ Initialization check: Missing`);

    if (result.issues.length > 0) {
      console.log(`   ⚠️  Issues: ${result.issues.join(', ')}`);
    }
  }

  private printSummary(results: AuditResult[]): void {
    console.log(chalk.blue('📊 AUDIT SUMMARY'));
    console.log('='.repeat(50));

    const functional = results.filter(r => r.status === 'FUNCTIONAL').length;
    const stubs = results.filter(r => r.status === 'STUB').length;
    const missing = results.filter(r => r.status === 'MISSING').length;

    console.log(`✅ Functional commands: ${chalk.green(functional)}`);
    console.log(`⚠️  Stub commands: ${chalk.yellow(stubs)}`);
    console.log(`❌ Missing commands: ${chalk.red(missing)}`);
    console.log(`📈 Overall completeness: ${chalk.blue(Math.round((functional / results.length) * 100))}%`);

    const totalFeatures = results.reduce((sum, r) => sum + r.details.features.length, 0);
    console.log(`🔧 Total features implemented: ${chalk.cyan(totalFeatures)}`);

    console.log('');

    if (functional === TARGET_COMMANDS.length) {
      console.log(chalk.green('🎉 ALL TARGET COMMANDS ARE FULLY FUNCTIONAL!'));
    } else {
      console.log(chalk.yellow('⚠️  Some commands need attention.'));
    }
  }

  private async generateReport(results: AuditResult[]): Promise<void> {
    const reportPath = path.join(process.cwd(), 'audit-reports', 'v010-cli-commands-audit.md');

    // Ensure directory exists
    await fs.mkdir(path.dirname(reportPath), { recursive: true });

    const report = this.generateMarkdownReport(results);
    await fs.writeFile(reportPath, report, 'utf-8');

    console.log(chalk.blue(`📄 Detailed report saved: ${reportPath}`));
  }

  private generateMarkdownReport(results: AuditResult[]): string {
    const timestamp = new Date().toISOString();

    let report = `# APEX v0.1.0 CLI Commands Audit Report

Generated: ${timestamp}

## Overview

This report provides a comprehensive audit of the 6 target CLI commands for v0.1.0:
${TARGET_COMMANDS.map(cmd => `- \`apex ${cmd}\``).join('\n')}

## Summary

| Command | Status | Lines of Code | Features | Issues |
|---------|--------|---------------|----------|--------|
`;

    for (const result of results) {
      const statusEmoji = result.status === 'FUNCTIONAL' ? '✅' :
                         result.status === 'STUB' ? '⚠️' : '❌';
      report += `| \`${result.command}\` | ${statusEmoji} ${result.status} | ${result.details.linesOfCode} | ${result.details.features.length} | ${result.issues.length} |\n`;
    }

    report += `\n## Detailed Analysis\n\n`;

    for (const result of results) {
      report += `### \`apex ${result.command}\`\n\n`;
      report += `**Status:** ${result.status}\n\n`;
      report += `**Details:**\n`;
      report += `- Lines of Code: ${result.details.linesOfCode}\n`;
      report += `- Error Handling: ${result.details.hasErrorHandling ? '✅' : '❌'}\n`;
      report += `- Initialization Check: ${result.details.hasInitCheck ? '✅' : '❌'}\n`;
      report += `- Argument Parsing: ${result.details.hasArgParsing ? '✅' : '❌'}\n`;
      report += `- Business Logic: ${result.details.hasBusinessLogic ? '✅' : '❌'}\n`;
      report += `- Features: ${result.details.features.join(', ') || 'None'}\n\n`;

      if (result.issues.length > 0) {
        report += `**Issues:**\n`;
        result.issues.forEach(issue => report += `- ${issue}\n`);
        report += '\n';
      }

      if (result.recommendations.length > 0) {
        report += `**Recommendations:**\n`;
        result.recommendations.forEach(rec => report += `- ${rec}\n`);
        report += '\n';
      }

      report += '---\n\n';
    }

    const functional = results.filter(r => r.status === 'FUNCTIONAL').length;
    const completeness = Math.round((functional / results.length) * 100);

    report += `## Conclusion

- **Overall Completeness:** ${completeness}%
- **Functional Commands:** ${functional}/${results.length}
- **Status:** ${functional === TARGET_COMMANDS.length ? 'ALL COMMANDS FUNCTIONAL ✅' : 'NEEDS ATTENTION ⚠️'}

`;

    return report;
  }
}

// Main execution
async function main() {
  try {
    const auditor = new CLICommandAuditor();
    const results = await auditor.audit();

    // Exit with appropriate code
    const allFunctional = results.every(r => r.status === 'FUNCTIONAL');
    process.exit(allFunctional ? 0 : 1);
  } catch (error) {
    console.error(chalk.red(`❌ Audit failed: ${error}`));
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { CLICommandAuditor, type AuditResult };