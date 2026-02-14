# ADR-052: Mock HTML Page Templates for Navigation Testing

## Status
**Accepted**

## Date
2025-02-13

## Context

APEX requires mock HTML page templates for comprehensive browser navigation testing. The testing infrastructure needs reusable HTML templates that support:
- Basic page navigation
- Pages with multiple links
- Form interactions
- Iframes and frames for embedded content testing
- Dynamic content injection via template variables

### Current State Analysis

The existing codebase already has robust test utilities in place:

1. **Static HTML Fixtures** (`packages/browser/src/__tests__/fixtures/`):
   - `test-page.html` - Basic navigation page with buttons and links
   - `page2.html` - Navigation page 2 with green styling
   - `page3.html` - Navigation page 3 with yellow styling

2. **Programmatic Template Generators** (`packages/browser/src/test-utils/test-pages.ts`):
   - `TestPages.simple()` - Basic test page
   - `TestPages.formTest()` - Comprehensive form with all input types
   - `TestPages.iframeTest()` - Iframe testing page
   - `TestPages.navigationTest()` - Navigation-focused page
   - `NavigationTemplateBuilder` - Fluent API for building navigation pages
   - `FormTemplateBuilder` - Fluent API for building form pages

3. **DOM Builders** (`packages/browser/src/test-utils/dom-builders.ts`):
   - `buildFormHtml()` - Form generation
   - `buildNavigationHtml()` - Navigation menu generation
   - `buildCompletePage()` - Full HTML page wrapper

4. **Template Variable System**:
   - `TemplateProcessor` class for `{{variable}}` substitution
   - Support for default variables with override capability

### Gap Analysis

While the current system is comprehensive, some specific template types are needed:

| Template Type | Current Support | Gap |
|--------------|-----------------|-----|
| Basic Page | Yes (`TestPages.simple()`) | None |
| Multiple Links | Partial (`NavigationTemplateBuilder`) | Need dedicated multi-link template |
| Form Page | Yes (`TestPages.formTest()`) | None |
| Iframe/Frame | Partial (`TestPages.iframeTest()`) | Need enhanced frame testing support |

## Decision

Extend the existing template system with a new **Navigation Test Templates** module that provides:

1. **Four Core Static HTML Templates** - Physical HTML files for direct use
2. **Enhanced Template Generators** - TypeScript functions with full template variable support
3. **Unified Export Interface** - Single import point for all navigation templates

### Architecture Design

```
packages/browser/
├── src/
│   ├── __tests__/
│   │   └── fixtures/
│   │       └── navigation/             # NEW: Navigation template fixtures
│   │           ├── basic-page.html
│   │           ├── multi-link-page.html
│   │           ├── form-page.html
│   │           └── iframe-page.html
│   └── test-utils/
│       ├── test-pages.ts               # Existing (extend)
│       └── navigation-templates.ts     # NEW: Navigation template generators
```

### Template Specifications

#### 1. Basic Page Template (`basic-page.html`)

**Purpose**: Simple navigation page with minimal content for basic navigation testing.

**Features**:
- Page title and description
- Load timestamp display
- Page instance tracking (`window.pageInstance`)
- `window.testHelpers` API for programmatic access
- Template variables: `{{title}}`, `{{description}}`, `{{backgroundColor}}`

**Structure**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{{title}}</title>
</head>
<body>
  <div class="container">
    <h1 id="page-title">{{title}}</h1>
    <p>{{description}}</p>
    <div class="status">
      <span id="load-time"></span>
      <span id="page-instance"></span>
    </div>
  </div>
  <script>
    window.testHelpers = {
      getPageInstance: () => window.pageInstance,
      getLoadTime: () => document.getElementById('load-time').textContent
    };
  </script>
</body>
</html>
```

#### 2. Multi-Link Page Template (`multi-link-page.html`)

**Purpose**: Navigation testing with multiple internal and external links.

**Features**:
- Configurable link collection
- Link categories (internal, external, anchor)
- Link targets (_self, _blank, _parent)
- Navigation history tracking
- Error link handling (404 scenarios)

**Template Variables**:
- `{{title}}` - Page title
- `{{backgroundColor}}` - Background color
- `{{linkColor}}` - Link button color
- `{{links}}` - JSON array of link configurations

**Link Configuration Schema**:
```typescript
interface LinkConfig {
  url: string;
  text: string;
  target?: '_self' | '_blank' | '_parent' | '_top';
  category?: 'internal' | 'external' | 'anchor' | 'error';
  id?: string;
}
```

**Structure**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>{{title}}</title>
</head>
<body>
  <div class="container">
    <h1>{{title}}</h1>

    <nav class="nav-links" data-link-count="0">
      <!-- Links injected here -->
    </nav>

    <div class="nav-history">
      <h3>Navigation History</h3>
      <div id="history-log"></div>
    </div>
  </div>
  <script>
    window.testHelpers = {
      getLinksCount: () => document.querySelectorAll('.nav-links a').length,
      getAllLinks: () => Array.from(document.querySelectorAll('.nav-links a')).map(a => ({
        href: a.href,
        text: a.textContent,
        target: a.target
      })),
      clickLink: (selector) => document.querySelector(selector)?.click()
    };
  </script>
</body>
</html>
```

#### 3. Form Page Template (`form-page.html`)

**Purpose**: Comprehensive form testing with all HTML input types.

**Features**:
- All standard HTML5 input types
- Form validation (client-side)
- Form submission handling
- Dynamic form population
- Form reset functionality

**Template Variables**:
- `{{title}}` - Page title
- `{{formAction}}` - Form action URL
- `{{formMethod}}` - Form method (GET/POST)
- `{{fields}}` - JSON array of field configurations
- `{{submitLabel}}` - Submit button text

**Field Configuration Schema**:
```typescript
interface FieldConfig {
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' |
        'checkbox' | 'radio' | 'textarea' | 'file' | 'hidden' | 'tel' | 'url';
  id: string;
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  options?: Array<{ value: string; label: string }>; // For select/radio
  attributes?: Record<string, string>;
}
```

**Structure**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>{{title}}</title>
</head>
<body>
  <div class="container">
    <h1>{{title}}</h1>

    <form id="test-form" action="{{formAction}}" method="{{formMethod}}" novalidate>
      <!-- Fields injected here -->
      <div class="form-actions">
        <button type="submit">{{submitLabel}}</button>
        <button type="reset">Reset</button>
        <button type="button" id="fill-test-data">Fill Test Data</button>
      </div>
    </form>

    <div class="form-status">
      <div id="validation-results"></div>
      <div id="submission-status"></div>
    </div>
  </div>
  <script>
    window.testHelpers = {
      getFormData: () => Object.fromEntries(new FormData(document.getElementById('test-form'))),
      fillTestData: () => { /* Fill with sample data */ },
      validateForm: () => { /* Validate and return results */ },
      submitForm: () => document.getElementById('test-form').submit(),
      resetForm: () => document.getElementById('test-form').reset(),
      getFieldValue: (name) => document.querySelector(`[name="${name}"]`)?.value,
      setFieldValue: (name, value) => { document.querySelector(`[name="${name}"]`).value = value; }
    };
  </script>
</body>
</html>
```

#### 4. Iframe/Frame Page Template (`iframe-page.html`)

**Purpose**: Testing iframe and frame navigation, cross-frame communication.

**Features**:
- Multiple iframes with different sources
- Named iframes for targeting
- Iframe load event tracking
- Cross-frame communication helpers
- Frame navigation testing

**Template Variables**:
- `{{title}}` - Page title
- `{{iframes}}` - JSON array of iframe configurations
- `{{allowCrossOrigin}}` - Enable cross-origin testing

**Iframe Configuration Schema**:
```typescript
interface IframeConfig {
  id: string;
  name: string;
  src: string;
  title: string;
  width?: string;
  height?: string;
  sandbox?: string;
  allowedFeatures?: string[];
}
```

**Structure**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>{{title}}</title>
</head>
<body>
  <div class="container">
    <h1>{{title}}</h1>

    <div class="iframe-controls">
      <button id="reload-all">Reload All Iframes</button>
      <button id="navigate-all">Navigate All</button>
    </div>

    <div class="iframe-container">
      <!-- Iframes injected here -->
    </div>

    <div class="iframe-status">
      <h3>Iframe Status</h3>
      <div id="iframe-load-log"></div>
    </div>
  </div>
  <script>
    window.testHelpers = {
      getIframeCount: () => document.querySelectorAll('iframe').length,
      getIframeByName: (name) => document.querySelector(`iframe[name="${name}"]`),
      setIframeSrc: (name, src) => { document.querySelector(`iframe[name="${name}"]`).src = src; },
      reloadIframe: (name) => {
        const iframe = document.querySelector(`iframe[name="${name}"]`);
        iframe.src = iframe.src;
      },
      getIframeLoadStatus: () => { /* Return load status for all iframes */ },
      waitForIframeLoad: async (name, timeout) => { /* Wait for iframe to load */ }
    };
  </script>
</body>
</html>
```

### TypeScript Template Generator Interface

```typescript
// packages/browser/src/test-utils/navigation-templates.ts

export interface NavigationTemplateConfig {
  title?: string;
  description?: string;
  backgroundColor?: string;
}

export interface MultiLinkTemplateConfig extends NavigationTemplateConfig {
  links: LinkConfig[];
  linkColor?: string;
  showHistory?: boolean;
}

export interface FormTemplateConfig extends NavigationTemplateConfig {
  formAction?: string;
  formMethod?: 'GET' | 'POST';
  fields: FieldConfig[];
  submitLabel?: string;
  enableValidation?: boolean;
}

export interface IframeTemplateConfig extends NavigationTemplateConfig {
  iframes: IframeConfig[];
  allowCrossOrigin?: boolean;
}

// Template generator functions
export const NavigationTemplates = {
  basic: (config?: NavigationTemplateConfig): string => { /* ... */ },
  multiLink: (config: MultiLinkTemplateConfig): string => { /* ... */ },
  form: (config: FormTemplateConfig): string => { /* ... */ },
  iframe: (config: IframeTemplateConfig): string => { /* ... */ }
};

// Builder classes for complex templates
export class MultiLinkTemplateBuilder {
  addLink(url: string, text: string, options?: Partial<LinkConfig>): this;
  setLinkColor(color: string): this;
  enableHistoryTracking(): this;
  build(): string;
}

export class FormTemplateBuilder {
  addTextField(config: Partial<FieldConfig>): this;
  addSelectField(config: Partial<FieldConfig>): this;
  addCheckboxField(config: Partial<FieldConfig>): this;
  setFormAction(action: string, method?: string): this;
  build(): string;
}

export class IframeTemplateBuilder {
  addIframe(config: IframeConfig): this;
  enableCrossOriginTesting(): this;
  build(): string;
}
```

### Integration with Existing Test Infrastructure

The new templates integrate with existing test utilities:

```typescript
// Usage in tests
import { NavigationTemplates, MultiLinkTemplateBuilder } from '@apex/browser/test-utils';
import { TemplateProcessor } from '@apex/browser/test-utils';

// Direct template generation
const basicPage = NavigationTemplates.basic({
  title: 'Test Navigation',
  backgroundColor: '#f0f0f0'
});

// Builder pattern for complex pages
const multiLinkPage = new MultiLinkTemplateBuilder()
  .setTitle('Navigation Test Suite')
  .addLink('/page1', 'Page 1', { category: 'internal' })
  .addLink('/page2', 'Page 2', { category: 'internal' })
  .addLink('https://example.com', 'External', { target: '_blank' })
  .enableHistoryTracking()
  .build();

// Template variable injection
const customPage = TemplateProcessor.process(NavigationTemplates.basic(), {
  title: 'Custom Title',
  description: 'Custom description text'
});
```

### Test Helpers API Contract

All templates expose a consistent `window.testHelpers` API:

```typescript
interface BaseTestHelpers {
  getPageInstance(): string;
  getLoadTime(): string;
}

interface NavigationTestHelpers extends BaseTestHelpers {
  getLinksCount(): number;
  getAllLinks(): Array<{ href: string; text: string; target: string }>;
  clickLink(selector: string): void;
}

interface FormTestHelpers extends BaseTestHelpers {
  getFormData(): Record<string, string>;
  fillTestData(): void;
  validateForm(): ValidationResult;
  submitForm(): void;
  resetForm(): void;
  getFieldValue(name: string): string;
  setFieldValue(name: string, value: string): void;
}

interface IframeTestHelpers extends BaseTestHelpers {
  getIframeCount(): number;
  getIframeByName(name: string): HTMLIFrameElement;
  setIframeSrc(name: string, src: string): void;
  reloadIframe(name: string): void;
  getIframeLoadStatus(): Record<string, boolean>;
  waitForIframeLoad(name: string, timeout?: number): Promise<void>;
}
```

## Consequences

### Positive

1. **Comprehensive Coverage**: Four template types cover all navigation testing scenarios
2. **Reusability**: Templates can be used across multiple test suites
3. **Flexibility**: Both static HTML files and programmatic generators available
4. **Consistency**: Uniform `testHelpers` API across all templates
5. **Maintainability**: Centralized template definitions reduce duplication
6. **Type Safety**: TypeScript interfaces ensure correct configuration

### Negative

1. **Additional Complexity**: More files to maintain in the test utilities
2. **Learning Curve**: Developers need to understand template variable system

### Neutral

1. **Template Evolution**: Templates may need updates as browser automation requirements change
2. **Documentation**: Requires comprehensive documentation for template usage

## Implementation Plan

### Phase 1: Static HTML Templates
1. Create `packages/browser/src/__tests__/fixtures/navigation/` directory
2. Implement four core HTML template files
3. Add documentation comments in each template

### Phase 2: TypeScript Generators
1. Create `navigation-templates.ts` module
2. Implement `NavigationTemplates` object with generator functions
3. Implement builder classes for complex templates

### Phase 3: Integration
1. Export from `test-utils/index.ts`
2. Update package.json exports if needed
3. Create usage examples in test files

### Phase 4: Testing
1. Add unit tests for template generators
2. Add integration tests using generated templates
3. Verify template variable injection works correctly

## Related ADRs

- ADR-007: Agent Panel Event Wiring (browser automation context)
- ADR-045: Error Recovery Integration Tests (testing infrastructure)

## References

- Existing `test-pages.ts` module
- Existing `dom-builders.ts` module
- Playwright documentation for page testing
- HTML5 form validation specification
