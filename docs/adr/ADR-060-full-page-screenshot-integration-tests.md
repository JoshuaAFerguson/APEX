# ADR-060: Full Page Screenshot Integration Tests

## Status
Proposed

## Context

The APEX browser automation system provides a `captureFullPage()` method in the `BrowserSession` class for capturing entire scrollable web pages as screenshots. This feature is critical for visual regression testing, documentation generation, and UI verification workflows.

### Current State Analysis

From analyzing the existing codebase:

**BrowserSession** (`packages/browser/src/browser-session.ts`, lines 857-891):
- `captureFullPage(options?: ScreenshotOptions)` method exists
- Uses Playwright's `page.screenshot({ fullPage: true })` internally
- Supports PNG (default) and JPEG formats
- JPEG quality configurable (1-100)
- Returns `BrowserActionResult<Buffer>`
- Optional file path saving via `path` option

**Existing Test Coverage**:
- `screenshot-capture.test.ts`: Basic unit tests for `captureFullPage()`
- `captureFullPage-edge-cases.test.ts`: Edge case handling tests
- `captureFullPage-final-validation.test.ts`: Validation tests
- `screenshot-capture-integration.test.ts`: General screenshot integration tests

### Gaps Identified

The acceptance criteria require dedicated **integration tests** specifically for:
1. Full page screenshot capture with entire page content
2. PNG and JPEG output format verification
3. Viewport sizing and its effect on full page captures
4. Scroll handling for long/tall pages
5. Image dimension validation

## Decision

### 1. Test Architecture Overview

Create a dedicated integration test file for full page screenshot capture:

```
tests/browser-integration/
└── full-page-screenshot-capture.integration.test.ts   # NEW
```

### 2. Test Categories

| Category | Purpose | Acceptance Criteria Coverage |
|----------|---------|------------------------------|
| Basic Capture | Verify full page capture works | AC1: Full page tests exist |
| Format Support | Test PNG/JPEG output | AC2: Image format verification |
| Viewport Sizing | Test viewport effects | AC3: Viewport sizing tests |
| Scroll Handling | Test long page capture | AC4: Scroll handling tests |
| Dimension Validation | Verify output dimensions | AC5: Dimension verification |

### 3. Technical Design

#### 3.1 Test File Structure

```typescript
// tests/browser-integration/full-page-screenshot-capture.integration.test.ts

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import {
  createBrowserManager,
  createBrowserSession,
  BrowserManager,
  BrowserSession,
} from '@apexcli/browser';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Full Page Screenshot Integration Tests
 *
 * Validates complete full page screenshot capture functionality:
 * - AC1: Full page screenshot tests exist and pass
 * - AC2: Tests verify image output format (PNG/JPEG)
 * - AC3: Tests verify viewport sizing effects
 * - AC4: Tests verify scroll handling for long pages
 * - AC5: Tests verify output dimensions
 */
describe('Full Page Screenshot Capture Integration Tests', () => {
  // Test implementation...
});
```

#### 3.2 Image Validation Helper

```typescript
/**
 * Validates image buffer and extracts metadata
 */
interface ImageValidation {
  isValid: boolean;
  format: 'png' | 'jpeg' | 'unknown';
  size: number;
  dimensions?: { width: number; height: number };
}

function validateImageBuffer(buffer: Buffer): ImageValidation {
  if (buffer.length === 0) {
    return { isValid: false, format: 'unknown', size: 0 };
  }

  // PNG signature: 0x89 0x50 0x4E 0x47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 &&
      buffer[2] === 0x4E && buffer[3] === 0x47) {
    // Extract dimensions from IHDR chunk
    const dimensions = extractPngDimensions(buffer);
    return { isValid: true, format: 'png', size: buffer.length, dimensions };
  }

  // JPEG signature: 0xFF 0xD8 0xFF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    const dimensions = extractJpegDimensions(buffer);
    return { isValid: true, format: 'jpeg', size: buffer.length, dimensions };
  }

  return { isValid: false, format: 'unknown', size: buffer.length };
}

function extractPngDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  // PNG IHDR chunk is at offset 16 (after signature and chunk length/type)
  // Width is at offset 16, height at offset 20 (both are 4-byte big-endian)
  if (buffer.length >= 24) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }
  return undefined;
}

function extractJpegDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  // JPEG dimensions are in SOF0 marker (0xFF 0xC0)
  for (let i = 0; i < buffer.length - 10; i++) {
    if (buffer[i] === 0xFF && buffer[i + 1] === 0xC0) {
      const height = buffer.readUInt16BE(i + 5);
      const width = buffer.readUInt16BE(i + 7);
      return { width, height };
    }
  }
  return undefined;
}
```

#### 3.3 Test Page Generation

```typescript
/**
 * Creates a tall test page for scroll handling tests
 */
function createTallTestPage(heightPixels: number = 3000): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Full Page Screenshot Test</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            height: ${heightPixels}px;
            background: linear-gradient(to bottom, #667eea, #764ba2, #ff6b6b);
          }
          .marker {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 20px 40px;
            border-radius: 10px;
            font-family: Arial, sans-serif;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          }
          .top-marker { top: 50px; }
          .middle-marker { top: ${Math.floor(heightPixels / 2)}px; }
          .bottom-marker { bottom: 50px; }
        </style>
      </head>
      <body>
        <div class="marker top-marker">Top of Page</div>
        <div class="marker middle-marker">Middle of Page</div>
        <div class="marker bottom-marker">Bottom of Page</div>
      </body>
    </html>
  `;
}
```

### 4. Test Specifications

#### 4.1 Basic Full Page Capture Tests

| Test | Description | Validates |
|------|-------------|-----------|
| Capture PNG default | Full page capture with default options | AC1, AC2 |
| Capture JPEG | Full page capture as JPEG format | AC1, AC2 |
| Capture with quality | JPEG quality parameter | AC2 |
| Save to file | Full page saved to file path | AC1 |
| Buffer return | Returns valid Buffer data | AC1 |

#### 4.2 Viewport Sizing Tests

| Test | Description | Validates |
|------|-------------|-----------|
| Standard viewport | 1280x720 viewport effects | AC3 |
| Wide viewport | 1920x1080 viewport effects | AC3 |
| Narrow viewport | 800x600 viewport effects | AC3 |
| Mobile viewport | 375x812 viewport effects | AC3 |
| Custom viewport | Arbitrary viewport dimensions | AC3 |

#### 4.3 Scroll Handling Tests

| Test | Description | Validates |
|------|-------------|-----------|
| Standard tall page | 3000px height page | AC4 |
| Very tall page | 10000px height page | AC4 |
| Wide scrollable page | Horizontal scroll content | AC4 |
| Dynamic content | Content added after load | AC4 |
| Nested scroll containers | Overflow: scroll elements | AC4 |
| Fixed position elements | Sticky headers/footers | AC4 |

#### 4.4 Dimension Validation Tests

| Test | Description | Validates |
|------|-------------|-----------|
| Match page dimensions | Output matches content size | AC5 |
| Full height capture | Captures entire height | AC5 |
| Full width capture | Captures entire width | AC5 |
| Size comparison | Full page > viewport | AC5 |

### 5. Implementation Plan

#### Phase 1: Test Infrastructure (Estimated: 30 minutes)
1. Create test file structure
2. Implement image validation helpers
3. Set up test page generators
4. Configure beforeEach/afterEach hooks

#### Phase 2: Core Tests (Estimated: 45 minutes)
1. Implement basic capture tests
2. Implement format verification tests
3. Implement quality parameter tests
4. Implement file saving tests

#### Phase 3: Advanced Tests (Estimated: 45 minutes)
1. Implement viewport sizing tests
2. Implement scroll handling tests
3. Implement dimension validation tests
4. Implement edge case tests

#### Phase 4: Validation (Estimated: 15 minutes)
1. Run all tests
2. Verify acceptance criteria coverage
3. Fix any failing tests
4. Document test results

### 6. Expected Test Count

| Category | Test Count |
|----------|------------|
| Basic Capture | 6 |
| Format Support | 5 |
| Viewport Sizing | 6 |
| Scroll Handling | 8 |
| Dimension Validation | 5 |
| **Total** | **30** |

## Consequences

### Positive
- Comprehensive coverage of full page screenshot functionality
- Validates image format correctness at binary level
- Tests real-world scenarios (tall pages, viewports, scroll)
- Provides regression protection for screenshot feature
- Documents expected behavior through tests

### Negative
- Browser-based tests are slower than unit tests
- May have slight cross-browser variations in pixel dimensions
- Requires Playwright browser installation

### Risks
- Browser updates may affect screenshot dimensions slightly
- Very large pages (>10000px) may have performance implications
- JPEG quality may produce slight size variations

## Compliance

This ADR ensures the implementation meets the following acceptance criteria:

| Criteria | Verification Method |
|----------|---------------------|
| Full page screenshot tests exist and pass | 30+ dedicated tests |
| Tests verify image output format | PNG/JPEG signature validation |
| Tests verify dimensions | Dimension extraction and comparison |
