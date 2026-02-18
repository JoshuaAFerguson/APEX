# Navigation Testing Templates

This directory contains HTML templates for generating dynamic test pages for navigation testing in APEX.

## Templates

### 1. Basic Page Template (`basic-page.html`)
- **Purpose**: Simple page template with dynamic content injection
- **Features**: Navigation tracking, performance metrics, customizable content
- **Use cases**: Simple test pages, content validation, basic navigation

### 2. Links Page Template (`links-page.html`)
- **Purpose**: Page with multiple navigation links of various types
- **Features**: Internal links, external links, error links, redirect links, performance links
- **Use cases**: Link testing, navigation flows, click tracking

### 3. Form Page Template (`form-page.html`)
- **Purpose**: Comprehensive form with various input types
- **Features**: Text inputs, selections, checkboxes, radio buttons, file uploads
- **Use cases**: Form interaction testing, input validation, submission testing

### 4. Iframe Page Template (`iframe-page.html`)
- **Purpose**: Page with various iframe configurations
- **Features**: Internal iframes, external iframes, nested iframes, dynamic iframe creation
- **Use cases**: Frame navigation testing, cross-origin scenarios, iframe interactions

## Template System

### Template Engine (`template-engine.ts`)
- Variable substitution using `{{variable}}` syntax
- Type-safe configuration with TypeScript interfaces
- Caching for performance
- Validation helpers

### Example Usage

```typescript
import { Templates, TemplateConfigs } from './templates';

// Render a basic page
const html = Templates.basicPage({
  title: 'My Test Page',
  heading: 'Test Page',
  content: '<p>This is test content</p>',
  page_id: 'my-test-page'
});

// Render a links page with custom navigation
const linksHtml = Templates.linksPage({
  title: 'Link Test Page',
  heading: 'Link Testing',
  description: 'Page for testing navigation links',
  page_id: 'link-test'
});
```

### Enhanced Mock Server Integration

The enhanced mock server (`enhanced-mock-server.ts`) integrates with the template system:

```typescript
import { EnhancedMockNavigationServer } from './enhanced-mock-server';

const server = new EnhancedMockNavigationServer({
  useTemplates: true,
  verbose: true
});

// Add template-based scenarios
server.addTemplateScenario({
  name: 'test-page',
  path: '/test',
  template: 'basic',
  variables: {
    title: 'Dynamic Test Page',
    content: '<p>Generated from template</p>'
  }
});
```

## Template Variables

### Common Variables
- `title`: Page title
- `heading`: Main page heading
- `page_id`: Unique identifier for the page
- `custom_css`: Additional CSS styles
- `custom_script`: Additional JavaScript code
- `navigation`: Navigation links HTML

### Template-Specific Variables

#### Basic Page
- `content`: Main page content HTML
- `custom_content`: Additional content sections

#### Links Page
- `description`: Page description
- `internal_links`: Additional internal links
- `external_links`: External links HTML
- `error_links`: Error testing links
- `performance_links`: Performance testing links
- `redirect_links`: Redirect testing links

#### Form Page
- `description`: Form description
- `form_method`: Form HTTP method
- `form_action`: Form action URL
- `default_text`: Default text input values
- `select_options`: Additional select options
- `radio_options`: Additional radio buttons
- `checkbox_options`: Additional checkboxes

#### Iframe Page
- `description`: Page description
- `internal_iframe_src`: Internal iframe source
- `external_iframe_src`: External iframe source
- `iframe_width`/`iframe_height`: Iframe dimensions

## Testing

Run template tests:

```bash
npm run test:page-navigation
```

The template system includes comprehensive tests in `template-demo.test.ts` covering:
- Template rendering
- Variable substitution
- Validation helpers
- Mock server integration

## Files Structure

```
templates/
├── README.md                 # This file
├── index.ts                  # Template system exports
├── template-engine.ts        # Core template engine
├── basic-page.html          # Basic page template
├── links-page.html          # Links page template
├── form-page.html           # Form page template
└── iframe-page.html         # Iframe page template
```