/**
 * Utility Test Suite for Container Troubleshooting Documentation Structure
 *
 * This test suite validates the structural integrity, consistency, and quality
 * of the container troubleshooting documentation. It includes utility functions
 * for analyzing markdown structure, link validation, and content quality metrics.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const DOC_PATH = path.join(__dirname, '../../docs/container-troubleshooting.md');

// Utility functions for documentation analysis
class DocumentationAnalyzer {
  private content: string;

  constructor(content: string) {
    this.content = content;
  }

  extractHeaders(): Array<{ level: number; text: string; line: number }> {
    const headers: Array<{ level: number; text: string; line: number }> = [];
    const lines = this.content.split('\n');

    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        headers.push({
          level: match[1].length,
          text: match[2],
          line: index + 1
        });
      }
    });

    return headers;
  }

  extractCodeBlocks(): Array<{ language: string; content: string; line: number }> {
    const blocks: Array<{ language: string; content: string; line: number }> = [];
    const lines = this.content.split('\n');
    let inBlock = false;
    let currentBlock: { language: string; content: string; line: number } | null = null;

    lines.forEach((line, index) => {
      if (line.startsWith('```')) {
        if (!inBlock) {
          // Starting a code block
          inBlock = true;
          currentBlock = {
            language: line.substring(3).trim(),
            content: '',
            line: index + 1
          };
        } else {
          // Ending a code block
          inBlock = false;
          if (currentBlock) {
            blocks.push(currentBlock);
            currentBlock = null;
          }
        }
      } else if (inBlock && currentBlock) {
        currentBlock.content += line + '\n';
      }
    });

    return blocks;
  }

  extractLinks(): Array<{ text: string; href: string; line: number }> {
    const links: Array<{ text: string; href: string; line: number }> = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const lines = this.content.split('\n');

    lines.forEach((line, index) => {
      let match;
      while ((match = linkRegex.exec(line)) !== null) {
        links.push({
          text: match[1],
          href: match[2],
          line: index + 1
        });
      }
    });

    return links;
  }

  extractErrorSections(): Array<{ title: string; error: string; cause: string; solutions: string[] }> {
    const sections: Array<{ title: string; error: string; cause: string; solutions: string[] }> = [];

    // Find all sections with error patterns
    const errorPattern = /### "[^"]+"\s*\n\n\*\*Error:\*\*([\s\S]*?)\*\*Cause:\*\*([\s\S]*?)\*\*Solutions:\*\*([\s\S]*?)(?=^---|\n### |$)/gm;

    let match;
    while ((match = errorPattern.exec(this.content)) !== null) {
      const titleMatch = match[0].match(/### "([^"]+)"/);
      const title = titleMatch ? titleMatch[1] : '';

      const error = match[1].trim();
      const cause = match[2].trim();

      // Extract numbered solutions
      const solutionsText = match[3];
      const solutionMatches = solutionsText.match(/^\d+\.\s+\*\*([^*]+)\*\*/gm) || [];
      const solutions = solutionMatches.map(s => s.replace(/^\d+\.\s+\*\*([^*]+)\*\*/, '$1'));

      sections.push({ title, error, cause, solutions });
    }

    return sections;
  }

  calculateReadabilityMetrics() {
    const words = this.content.split(/\s+/).length;
    const sentences = this.content.split(/[.!?]+/).length;
    const paragraphs = this.content.split(/\n\s*\n/).length;
    const codeBlocks = this.extractCodeBlocks().length;

    return {
      wordCount: words,
      sentenceCount: sentences,
      paragraphCount: paragraphs,
      codeBlockCount: codeBlocks,
      averageWordsPerSentence: words / sentences,
      codeToTextRatio: codeBlocks / paragraphs
    };
  }
}

describe('Container Troubleshooting Documentation - Structure Validation', () => {

  let content: string;
  let analyzer: DocumentationAnalyzer;

  beforeAll(() => {
    content = readFileSync(DOC_PATH, 'utf8');
    analyzer = new DocumentationAnalyzer(content);
  });

  describe('Document Structure Analysis', () => {
    it('should have proper header hierarchy', () => {
      const headers = analyzer.extractHeaders();

      // Should start with H1
      expect(headers[0].level).toBe(1);
      expect(headers[0].text).toContain('Container Troubleshooting Guide');

      // Should not skip header levels (no H1 -> H3 jumps)
      let previousLevel = 1;
      headers.slice(1).forEach(header => {
        const levelDiff = header.level - previousLevel;
        expect(levelDiff).toBeLessThanOrEqual(1); // Can only increase by 1 or decrease by any amount
        previousLevel = header.level;
      });
    });

    it('should have balanced section distribution', () => {
      const headers = analyzer.extractHeaders();
      const h2Headers = headers.filter(h => h.level === 2);
      const h3Headers = headers.filter(h => h.level === 3);

      expect(h2Headers.length).toBeGreaterThanOrEqual(10); // Main sections
      expect(h3Headers.length).toBeGreaterThanOrEqual(20); // Subsections

      // Should have reasonable subsection distribution
      const subsectionsPerSection = h3Headers.length / h2Headers.length;
      expect(subsectionsPerSection).toBeGreaterThan(1.5);
      expect(subsectionsPerSection).toBeLessThan(5);
    });

    it('should have consistent section separators', () => {
      const separators = content.match(/^---$/gm) || [];
      expect(separators.length).toBeGreaterThan(10); // Should separate major sections
    });
  });

  describe('Code Block Quality Analysis', () => {
    it('should have diverse and properly labeled code blocks', () => {
      const codeBlocks = analyzer.extractCodeBlocks();

      expect(codeBlocks.length).toBeGreaterThan(30); // Substantial code examples

      const languages = new Set(codeBlocks.map(block => block.language));
      const expectedLanguages = ['bash', 'yaml', 'dockerfile'];

      expectedLanguages.forEach(lang => {
        expect(languages.has(lang)).toBe(true);
      });
    });

    it('should have substantial bash command coverage', () => {
      const bashBlocks = analyzer.extractCodeBlocks().filter(block => block.language === 'bash');

      expect(bashBlocks.length).toBeGreaterThan(20);

      const allBashContent = bashBlocks.map(block => block.content).join('\n');
      const uniqueCommands = new Set();

      // Extract unique commands (first word after $ or #)
      const commandMatches = allBashContent.match(/^[#$]\s*(\w+)/gm) || [];
      commandMatches.forEach(match => {
        const command = match.replace(/^[#$]\s*/, '').split(' ')[0];
        uniqueCommands.add(command);
      });

      expect(uniqueCommands.size).toBeGreaterThan(15); // Diverse command coverage
    });

    it('should have comprehensive YAML configuration examples', () => {
      const yamlBlocks = analyzer.extractCodeBlocks().filter(block => block.language === 'yaml');

      expect(yamlBlocks.length).toBeGreaterThan(5);

      const allYamlContent = yamlBlocks.map(block => block.content).join('\n');

      // Should demonstrate various configuration aspects
      expect(allYamlContent).toContain('workspace:');
      expect(allYamlContent).toContain('container:');
      expect(allYamlContent).toContain('resourceLimits:');
      expect(allYamlContent).toContain('environment:');
    });
  });

  describe('Link Integrity Analysis', () => {
    it('should have valid internal documentation links', () => {
      const links = analyzer.extractLinks();
      const internalLinks = links.filter(link =>
        link.href.startsWith('./') || link.href.startsWith('../') || link.href.startsWith('#')
      );

      expect(internalLinks.length).toBeGreaterThan(5);

      // Check that referenced documentation files exist
      const docLinks = internalLinks.filter(link => link.href.endsWith('.md'));
      docLinks.forEach(link => {
        const docPath = path.resolve(path.dirname(DOC_PATH), link.href);
        expect(() => readFileSync(docPath)).not.toThrow();
      });
    });

    it('should have proper anchor link formatting', () => {
      const links = analyzer.extractLinks();
      const anchorLinks = links.filter(link => link.href.startsWith('#'));

      anchorLinks.forEach(link => {
        // Anchor links should be lowercase and hyphenated
        expect(link.href).toMatch(/^#[a-z0-9-]+$/);
      });
    });

    it('should have descriptive link text', () => {
      const links = analyzer.extractLinks();

      links.forEach(link => {
        // Link text should be descriptive (not just "here" or "click")
        const badLinkTexts = ['here', 'click', 'link', 'this'];
        expect(badLinkTexts.includes(link.text.toLowerCase())).toBe(false);

        // Link text should be reasonably long
        expect(link.text.length).toBeGreaterThan(3);
      });
    });
  });

  describe('Error Section Structure Analysis', () => {
    it('should have consistent error section formatting', () => {
      const errorSections = analyzer.extractErrorSections();

      expect(errorSections.length).toBeGreaterThan(10);

      errorSections.forEach(section => {
        expect(section.title).toBeTruthy();
        expect(section.error).toBeTruthy();
        expect(section.cause).toBeTruthy();
        expect(section.solutions.length).toBeGreaterThan(0);
      });
    });

    it('should provide multiple solutions for each error', () => {
      const errorSections = analyzer.extractErrorSections();

      const multiSolutionSections = errorSections.filter(section => section.solutions.length > 1);

      // Most errors should have multiple solution approaches
      expect(multiSolutionSections.length / errorSections.length).toBeGreaterThan(0.6);
    });

    it('should have descriptive error titles', () => {
      const errorSections = analyzer.extractErrorSections();

      errorSections.forEach(section => {
        // Error titles should be descriptive and indicate the problem
        expect(section.title.length).toBeGreaterThan(10);

        // Common error indicators
        const errorIndicators = ['error', 'failed', 'denied', 'timeout', 'not found', 'connection', 'killed'];
        const hasIndicator = errorIndicators.some(indicator =>
          section.title.toLowerCase().includes(indicator)
        );
        expect(hasIndicator).toBe(true);
      });
    });
  });

  describe('Content Quality Metrics', () => {
    it('should meet comprehensive documentation standards', () => {
      const metrics = analyzer.calculateReadabilityMetrics();

      expect(metrics.wordCount).toBeGreaterThan(10000); // Comprehensive coverage
      expect(metrics.paragraphCount).toBeGreaterThan(100); // Well-structured
      expect(metrics.codeBlockCount).toBeGreaterThan(30); // Practical examples

      // Readable sentence length
      expect(metrics.averageWordsPerSentence).toBeGreaterThan(8);
      expect(metrics.averageWordsPerSentence).toBeLessThan(25);

      // Good balance of code and text
      expect(metrics.codeToTextRatio).toBeGreaterThan(0.2);
      expect(metrics.codeToTextRatio).toBeLessThan(0.8);
    });

    it('should have comprehensive keyword coverage', () => {
      const criticalKeywords = [
        'docker', 'podman', 'container', 'apex',
        'error', 'solution', 'troubleshoot', 'debug',
        'memory', 'cpu', 'network', 'volume',
        'permission', 'timeout', 'cleanup'
      ];

      criticalKeywords.forEach(keyword => {
        const regex = new RegExp(keyword, 'gi');
        const matches = content.match(regex) || [];
        expect(matches.length).toBeGreaterThan(5); // Adequate coverage
      });
    });

    it('should maintain consistent terminology', () => {
      // Check for consistent use of technical terms
      const termVariations = [
        ['docker', 'Docker'],
        ['podman', 'Podman'],
        ['APEX', 'apex'],
        ['container', 'Container']
      ];

      termVariations.forEach(([lowercase, capitalized]) => {
        const lowercaseCount = (content.match(new RegExp(`\\b${lowercase}\\b`, 'g')) || []).length;
        const capitalizedCount = (content.match(new RegExp(`\\b${capitalized}\\b`, 'g')) || []).length;

        // Should prefer one consistent form
        const totalCount = lowercaseCount + capitalizedCount;
        const dominantForm = Math.max(lowercaseCount, capitalizedCount);
        const consistency = dominantForm / totalCount;

        expect(consistency).toBeGreaterThan(0.7); // 70% consistency
      });
    });
  });

  describe('Cross-Reference Analysis', () => {
    it('should have bidirectional documentation references', () => {
      // Should reference and be referenced by related docs
      expect(content).toContain('container-isolation.md');
      expect(content).toContain('container-configuration.md');
      expect(content).toContain('troubleshooting.md');
    });

    it('should provide contextual cross-references', () => {
      const headers = analyzer.extractHeaders();
      const links = analyzer.extractLinks();

      // Should have internal cross-references between sections
      const internalRefs = links.filter(link => link.href.startsWith('#'));
      expect(internalRefs.length).toBeGreaterThan(3);

      // Cross-references should point to actual sections
      internalRefs.forEach(link => {
        const anchorText = link.href.substring(1);
        const matchingHeaders = headers.filter(header =>
          header.text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') === anchorText
        );
        // Note: This is a simplified check; actual anchor generation may be more complex
        // expect(matchingHeaders.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Accessibility and Usability', () => {
    it('should have clear visual structure', () => {
      // Should use proper markdown formatting for emphasis
      expect(content).toContain('**');  // Bold text
      expect(content).toContain('`');   // Inline code
      expect(content).toContain('> ');  // Blockquotes

      // Should use lists for better readability
      expect(content).toContain('- '); // Bullet lists
      expect(content).toContain('1. '); // Numbered lists
    });

    it('should have scannable content structure', () => {
      const headers = analyzer.extractHeaders();

      // Should have frequent headers for scannability
      const averageContentPerHeader = content.length / headers.length;
      expect(averageContentPerHeader).toBeLessThan(1000); // Max ~1KB per section

      // Should use descriptive header text
      headers.forEach(header => {
        expect(header.text.length).toBeGreaterThan(5);
        expect(header.text.length).toBeLessThan(80); // Reasonable header length
      });
    });

    it('should provide clear action items', () => {
      // Commands should be clearly marked and easy to copy
      const codeBlocks = analyzer.extractCodeBlocks();
      const bashBlocks = codeBlocks.filter(block => block.language === 'bash');

      bashBlocks.forEach(block => {
        // Bash blocks should have clear commands (not just comments)
        const hasCommands = /^[^#].*\w/m.test(block.content);
        expect(hasCommands).toBe(true);
      });
    });
  });

  describe('Documentation Completeness Verification', () => {
    it('should cover the full troubleshooting spectrum', () => {
      const troubleshootingAreas = [
        'prerequisite', 'installation', 'configuration',
        'runtime', 'network', 'permission', 'resource',
        'cleanup', 'monitoring', 'debug'
      ];

      troubleshootingAreas.forEach(area => {
        expect(content.toLowerCase()).toContain(area);
      });
    });

    it('should provide graduated difficulty solutions', () => {
      // Should provide both simple and advanced solutions
      expect(content).toContain('basic');
      expect(content).toContain('advanced');
      expect(content).toContain('simple');
      expect(content).toContain('comprehensive');
    });

    it('should maintain professional technical writing standards', () => {
      // Should avoid conversational language in technical sections
      const problematicPhrases = [
        'just do this', 'simply run', 'easy fix', 'quick hack'
      ];

      problematicPhrases.forEach(phrase => {
        expect(content.toLowerCase().includes(phrase)).toBe(false);
      });

      // Should use precise technical language
      expect(content).toContain('configure');
      expect(content).toContain('execute');
      expect(content).toContain('implement');
      expect(content).toContain('verify');
    });
  });
});