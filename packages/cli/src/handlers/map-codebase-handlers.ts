import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs/promises';
import { CodebaseIndexer } from '@apexcli/orchestrator';
import type { CliContext } from '../index.js';

/**
 * Analyzes an existing codebase and generates comprehensive documentation.
 *
 * @param ctx - CLI context containing project configuration
 * @param args - Command arguments (output-dir, parallel, output-format, include-debt, quick, verbose)
 */
export async function handleMapCodebase(ctx: CliContext, args: Record<string, any>): Promise<void> {
  try {
    const outputDir = args['output-dir'] || path.join(ctx.cwd, '.apex', 'analysis');
    const parallel = parseInt(args.parallel || '4', 10);
    const format = args['output-format'] || 'json';
    const quick = args.quick || false;
    const verbose = args.verbose || false;
    const includeDept = args['include-debt'] || false;

    console.log(chalk.cyan('\n📊 Analyzing Codebase...\n'));

    if (verbose) {
      console.log(chalk.gray(`Output directory: ${outputDir}`));
      console.log(chalk.gray(`Parallel workers: ${parallel}`));
      console.log(chalk.gray(`Format: ${format}`));
      console.log(chalk.gray(`Include technical debt: ${includeDept}`));
      console.log();
    }

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Initialize CodebaseIndexer
    const indexer = CodebaseIndexer.getInstance();

    // Index the codebase with options
    const indexingOptions = {
      continueOnError: true,
      includeNodeModules: false,
      parallel,
      ...(quick && { maxDepth: 3 }),
    };

    let progressCallback: ((progress: any) => void) | undefined;
    if (verbose) {
      let lastUpdate = Date.now();
      progressCallback = (progress: any) => {
        const now = Date.now();
        if (now - lastUpdate > 500) {
          console.log(
            chalk.gray(
              `  Indexed ${progress.filesProcessed || 0} files, found ${progress.symbolsDiscovered || 0} symbols...`
            )
          );
          lastUpdate = now;
        }
      };
    }

    const repositoryMap = await indexer.indexDirectoryWithProgress(ctx.cwd, indexingOptions, progressCallback);

    console.log(chalk.green('✓ Analysis Complete\n'));

    // Display summary statistics
    if (repositoryMap.stats) {
      console.log(chalk.cyan('📈 Summary Statistics:\n'));
      console.log(`  ${chalk.yellow('Files indexed:')} ${repositoryMap.stats.totalFiles}`);
      console.log(`  ${chalk.yellow('Symbols found:')} ${repositoryMap.stats.totalSymbols}`);
      console.log(`  ${chalk.yellow('Languages detected:')} ${Object.keys(repositoryMap.stats.languageBreakdown || {}).join(', ')}`);

      if (verbose && repositoryMap.stats.symbolTypeBreakdown) {
        console.log(chalk.cyan('\n  Symbol breakdown:\n'));
        for (const [kind, count] of Object.entries(repositoryMap.stats.symbolTypeBreakdown)) {
          console.log(`    ${chalk.gray(kind)}: ${count}`);
        }
      }

      console.log();
    }

    // Generate output files based on requested format
    if (format === 'json' || format === 'all') {
      const jsonPath = path.join(outputDir, 'repository-map.json');
      await fs.writeFile(jsonPath, JSON.stringify(repositoryMap, null, 2));
      console.log(chalk.green(`✓ JSON output: ${chalk.gray(jsonPath)}`));
    }

    if (format === 'yaml' || format === 'all') {
      // Note: YAML output would require a YAML library
      // For now, we'll just note it's not yet implemented
      console.log(chalk.yellow('ℹ YAML output not yet implemented'));
    }

    if (format === 'markdown' || format === 'all') {
      const mdPath = path.join(outputDir, 'CODEBASE_MAP.md');
      const markdown = generateMarkdownReport(repositoryMap);
      await fs.writeFile(mdPath, markdown);
      console.log(chalk.green(`✓ Markdown output: ${chalk.gray(mdPath)}`));
    }

    console.log(chalk.cyan(`\n📁 Analysis saved to: ${outputDir}\n`));

    if (verbose) {
      console.log(chalk.gray('Use this data for:'));
      console.log(chalk.gray('  - Architecture documentation'));
      console.log(chalk.gray('  - Impact analysis'));
      console.log(chalk.gray('  - Dependency visualization'));
      console.log();
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to analyze codebase: ${(error as Error).message}\n`));
    if (process.env.DEBUG) {
      console.error((error as Error).stack);
    }
  }
}

/**
 * Generates a markdown report from the repository map.
 *
 * @param repositoryMap - The analyzed repository map
 * @returns Markdown formatted report
 */
function generateMarkdownReport(repositoryMap: any): string {
  let md = '# Codebase Map Report\n\n';
  md += `Generated: ${new Date().toISOString()}\n\n`;

  // Statistics section
  if (repositoryMap.stats) {
    md += '## Statistics\n\n';
    md += `- **Total Files:** ${repositoryMap.stats.totalFiles}\n`;
    md += `- **Total Symbols:** ${repositoryMap.stats.totalSymbols}\n`;

    if (repositoryMap.stats.languageBreakdown) {
      md += `- **Languages:** ${Object.keys(repositoryMap.stats.languageBreakdown).join(', ')}\n`;
    }

    md += '\n';
  }

  // Files section
  if (repositoryMap.files && Object.keys(repositoryMap.files).length > 0) {
    md += '## Files\n\n';

    const fileEntries = Object.entries(repositoryMap.files).slice(0, 50);
    for (const [filePath, fileData] of fileEntries) {
      md += `### ${filePath}\n\n`;

      const file = fileData as any;
      if (file.language) {
        md += `**Language:** \`${file.language}\`\n\n`;
      }

      if (file.symbols && file.symbols.length > 0) {
        md += '**Symbols:**\n\n';
        for (const symbol of file.symbols.slice(0, 10)) {
          md += `- \`${symbol.name}\` (${symbol.kind})\n`;
        }

        if (file.symbols.length > 10) {
          md += `- ... and ${file.symbols.length - 10} more\n`;
        }

        md += '\n';
      }
    }

    if (Object.keys(repositoryMap.files).length > 50) {
      md += `\n... and ${Object.keys(repositoryMap.files).length - 50} more files\n\n`;
    }
  }

  md += '## Notes\n\n';
  md += 'This report provides a high-level overview of the codebase structure.\n';
  md += 'For detailed analysis and dependency graphs, refer to the JSON output.\n';

  return md;
}
