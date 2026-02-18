import { readFile } from 'fs/promises';
import * as path from 'path';

/**
 * Generate a JSDoc coverage report for orchestrator service classes
 */
export class JSDocCoverageReporter {
  private files: string[] = ['workspace-manager.ts', 'idle-processor.ts', 'hook-manager.ts'];
  private report: { [key: string]: any } = {};

  async generateReport(): Promise<void> {
    console.log('📊 Generating JSDoc Coverage Report...\n');

    for (const filename of this.files) {
      const filePath = path.join(__dirname, '..', filename);
      const sourceCode = await readFile(filePath, 'utf-8');

      this.report[filename] = await this.analyzeFile(sourceCode, filename);
    }

    this.printSummaryReport();
  }

  private async analyzeFile(sourceCode: string, filename: string): Promise<any> {
    const analysis = {
      filename,
      classes: this.countExportedClasses(sourceCode),
      interfaces: this.countExportedInterfaces(sourceCode),
      types: this.countExportedTypes(sourceCode),
      jsdocBlocks: this.countJSDocBlocks(sourceCode),
      examples: this.countExamples(sourceCode),
      paramTags: this.countParamTags(sourceCode),
      returnsTags: this.countReturnsTags(sourceCode),
      interfaceTags: this.countInterfaceTags(sourceCode),
      throwsTags: this.countThrowsTags(sourceCode),
      publicMethods: this.countPublicMethods(sourceCode),
      documentedMethods: this.countDocumentedMethods(sourceCode)
    };

    // Calculate coverage percentages
    analysis.interfaceCoverage = analysis.interfaces > 0 ?
      (analysis.interfaceTags / analysis.interfaces * 100).toFixed(1) : 'N/A';

    analysis.methodCoverage = analysis.publicMethods > 0 ?
      (analysis.documentedMethods / analysis.publicMethods * 100).toFixed(1) : 'N/A';

    console.log(`📁 ${filename}`);
    console.log(`   Classes: ${analysis.classes} | Interfaces: ${analysis.interfaces} | Types: ${analysis.types}`);
    console.log(`   JSDoc blocks: ${analysis.jsdocBlocks} | Examples: ${analysis.examples}`);
    console.log(`   @param tags: ${analysis.paramTags} | @returns tags: ${analysis.returnsTags}`);
    console.log(`   Interface coverage: ${analysis.interfaceCoverage}% | Method coverage: ${analysis.methodCoverage}%`);
    console.log();

    return analysis;
  }

  private countExportedClasses(sourceCode: string): number {
    return (sourceCode.match(/export class \w+/g) || []).length;
  }

  private countExportedInterfaces(sourceCode: string): number {
    return (sourceCode.match(/export interface \w+/g) || []).length;
  }

  private countExportedTypes(sourceCode: string): number {
    return (sourceCode.match(/export type \w+/g) || []).length;
  }

  private countJSDocBlocks(sourceCode: string): number {
    return (sourceCode.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
  }

  private countExamples(sourceCode: string): number {
    return (sourceCode.match(/@example/g) || []).length;
  }

  private countParamTags(sourceCode: string): number {
    return (sourceCode.match(/@param/g) || []).length;
  }

  private countReturnsTags(sourceCode: string): number {
    return (sourceCode.match(/@returns/g) || []).length;
  }

  private countInterfaceTags(sourceCode: string): number {
    return (sourceCode.match(/@interface/g) || []).length;
  }

  private countThrowsTags(sourceCode: string): number {
    return (sourceCode.match(/@throws/g) || []).length;
  }

  private countPublicMethods(sourceCode: string): number {
    const methods = sourceCode.match(/^\s*(async\s+)?(\w+)\s*\([^)]*\)\s*:/gm) || [];
    return methods.filter(method => {
      const methodName = method.trim().split(/\s+/)[1] || method.trim().split('(')[0];
      return methodName !== 'constructor' && !methodName.startsWith('_') && !methodName.startsWith('private');
    }).length;
  }

  private countDocumentedMethods(sourceCode: string): number {
    const documentedMethods = sourceCode.match(/\/\*\*[\s\S]*?\*\/\s*(async\s+)?\w+\s*\([^)]*\)\s*:/g) || [];
    return documentedMethods.filter(method => {
      const methodName = method.split(/\s+/).find(part => part.includes('('))?.split('(')[0] || '';
      return methodName !== 'constructor' && !methodName.startsWith('_') && !methodName.startsWith('private');
    }).length;
  }

  private printSummaryReport(): void {
    console.log('📈 SUMMARY REPORT');
    console.log('='.repeat(60));

    const totals = {
      classes: 0,
      interfaces: 0,
      types: 0,
      jsdocBlocks: 0,
      examples: 0,
      paramTags: 0,
      returnsTags: 0,
      interfaceTags: 0,
      throwsTags: 0,
      publicMethods: 0,
      documentedMethods: 0
    };

    Object.values(this.report).forEach((analysis: any) => {
      Object.keys(totals).forEach(key => {
        totals[key] += analysis[key];
      });
    });

    console.log(`📊 Total Exported Constructs:`);
    console.log(`   Classes: ${totals.classes}`);
    console.log(`   Interfaces: ${totals.interfaces}`);
    console.log(`   Types: ${totals.types}`);

    console.log(`\n📝 Documentation Elements:`);
    console.log(`   JSDoc blocks: ${totals.jsdocBlocks}`);
    console.log(`   @example tags: ${totals.examples}`);
    console.log(`   @param tags: ${totals.paramTags}`);
    console.log(`   @returns tags: ${totals.returnsTags}`);
    console.log(`   @interface tags: ${totals.interfaceTags}`);
    console.log(`   @throws tags: ${totals.throwsTags}`);

    console.log(`\n🎯 Coverage Metrics:`);
    const interfaceCoverage = totals.interfaces > 0 ?
      (totals.interfaceTags / totals.interfaces * 100).toFixed(1) : 'N/A';
    const methodCoverage = totals.publicMethods > 0 ?
      (totals.documentedMethods / totals.publicMethods * 100).toFixed(1) : 'N/A';
    const exampleDensity = totals.jsdocBlocks > 0 ?
      (totals.examples / totals.jsdocBlocks * 100).toFixed(1) : 'N/A';

    console.log(`   Interface Documentation: ${interfaceCoverage}%`);
    console.log(`   Method Documentation: ${methodCoverage}%`);
    console.log(`   Example Density: ${exampleDensity}%`);

    console.log(`\n✅ Quality Indicators:`);
    console.log(`   Average examples per file: ${(totals.examples / this.files.length).toFixed(1)}`);
    console.log(`   Average JSDoc blocks per file: ${(totals.jsdocBlocks / this.files.length).toFixed(1)}`);
    console.log(`   Parameter documentation: ${totals.paramTags > 20 ? 'Excellent' : totals.paramTags > 10 ? 'Good' : 'Needs improvement'}`);

    // Assessment
    console.log(`\n🏆 OVERALL ASSESSMENT:`);
    const score = this.calculateQualityScore(totals, interfaceCoverage, methodCoverage);
    console.log(`   Documentation Quality Score: ${score}/100`);

    if (score >= 90) {
      console.log(`   Status: 🌟 EXCELLENT - Documentation meets high standards`);
    } else if (score >= 75) {
      console.log(`   Status: ✅ GOOD - Documentation is adequate with room for improvement`);
    } else if (score >= 60) {
      console.log(`   Status: ⚠️  FAIR - Documentation needs significant improvement`);
    } else {
      console.log(`   Status: ❌ POOR - Documentation is inadequate`);
    }

    console.log();
  }

  private calculateQualityScore(totals: any, interfaceCoverage: string, methodCoverage: string): number {
    let score = 0;

    // Interface coverage (20 points)
    const intCov = parseFloat(interfaceCoverage);
    if (!isNaN(intCov)) {
      score += (intCov / 100) * 20;
    }

    // Method coverage (20 points)
    const methCov = parseFloat(methodCoverage);
    if (!isNaN(methCov)) {
      score += (methCov / 100) * 20;
    }

    // Example density (20 points)
    const exampleDensity = totals.jsdocBlocks > 0 ? totals.examples / totals.jsdocBlocks : 0;
    score += Math.min(exampleDensity, 1) * 20;

    // Parameter documentation (15 points)
    score += Math.min(totals.paramTags / 20, 1) * 15;

    // Return documentation (10 points)
    score += Math.min(totals.returnsTags / 15, 1) * 10;

    // Error documentation (10 points)
    score += Math.min(totals.throwsTags / 5, 1) * 10;

    // JSDoc block count (5 points)
    score += Math.min(totals.jsdocBlocks / 30, 1) * 5;

    return Math.round(score);
  }
}

// Run the report if this file is executed directly
if (require.main === module) {
  const reporter = new JSDocCoverageReporter();
  reporter.generateReport().catch(console.error);
}