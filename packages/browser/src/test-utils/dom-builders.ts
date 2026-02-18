/**
 * @apexcli/browser - DOM Structure Simulation
 *
 * Build HTML strings representing common DOM structures for testing
 */

export interface TableConfig {
  headers: string[];
  rows: string[][];
  caption?: string;
  className?: string;
  striped?: boolean;
}

export interface ModalConfig {
  id?: string;
  title: string;
  content: string;
  hasCloseButton?: boolean;
  hasOverlay?: boolean;
  className?: string;
}

export interface CardConfig {
  title: string;
  content: string;
  imageUrl?: string;
  actions?: Array<{ text: string; href?: string; className?: string }>;
  className?: string;
}

export interface FormConfig {
  action?: string;
  method?: string;
  fields: FormField[];
  submitLabel?: string;
  className?: string;
}

export interface FormField {
  name: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox' | 'radio';
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[]; // for select/radio
  value?: string;
  className?: string;
}

export interface NavLink {
  href: string;
  text: string;
  target?: string;
  className?: string;
}

/**
 * Build a complete HTML form
 */
export function buildFormHtml(config: FormConfig): string {
  const fields = config.fields.map(field => buildFormField(field)).join('\n');

  return `
<form action="${config.action || ''}" method="${config.method || 'POST'}" class="${config.className || ''}">
${fields}
  <button type="submit">${config.submitLabel || 'Submit'}</button>
</form>`;
}

/**
 * Build an HTML table
 */
export function buildTableHtml(config: TableConfig): string {
  const headers = config.headers.map(header => `<th>${header}</th>`).join('');
  const rows = config.rows.map(row =>
    '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>'
  ).join('\n');

  const caption = config.caption ? `<caption>${config.caption}</caption>` : '';
  const className = config.className ? ` class="${config.className}"` : '';
  const stripedClass = config.striped ? ' striped' : '';

  return `
<table${className}${stripedClass}>
  ${caption}
  <thead>
    <tr>${headers}</tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>`;
}

/**
 * Build a navigation menu
 */
export function buildNavigationHtml(links: NavLink[]): string {
  const navItems = links.map(link => {
    const target = link.target ? ` target="${link.target}"` : '';
    const className = link.className ? ` class="${link.className}"` : '';
    return `<a href="${link.href}"${target}${className}>${link.text}</a>`;
  }).join('\n    ');

  return `
<nav>
  <ul>
    ${links.map(link => `<li><a href="${link.href}"${link.target ? ` target="${link.target}"` : ''}${link.className ? ` class="${link.className}"` : ''}>${link.text}</a></li>`).join('\n    ')}
  </ul>
</nav>`;
}

/**
 * Build a simple list (ordered or unordered)
 */
export function buildListHtml(items: string[], ordered: boolean = false): string {
  const tag = ordered ? 'ol' : 'ul';
  const listItems = items.map(item => `  <li>${item}</li>`).join('\n');

  return `
<${tag}>
${listItems}
</${tag}>`;
}

/**
 * Build a modal dialog
 */
export function buildModalHtml(config: ModalConfig): string {
  const id = config.id || 'modal';
  const overlay = config.hasOverlay !== false;
  const closeButton = config.hasCloseButton !== false;
  const className = config.className ? ` class="${config.className}"` : '';

  return `
${overlay ? '<div class="modal-overlay"></div>' : ''}
<div id="${id}" class="modal"${className}>
  <div class="modal-content">
    ${closeButton ? '<button class="modal-close" aria-label="Close">&times;</button>' : ''}
    <div class="modal-header">
      <h2>${config.title}</h2>
    </div>
    <div class="modal-body">
      ${config.content}
    </div>
  </div>
</div>`;
}

/**
 * Build a grid of cards
 */
export function buildCardGridHtml(cards: CardConfig[]): string {
  const cardElements = cards.map(card => buildCardHtml(card)).join('\n');

  return `
<div class="card-grid">
  ${cardElements}
</div>`;
}

/**
 * Build a single card component
 */
export function buildCardHtml(config: CardConfig): string {
  const className = config.className ? ` class="${config.className}"` : '';
  const image = config.imageUrl ? `<img src="${config.imageUrl}" alt="${config.title}" class="card-image">` : '';

  const actions = config.actions ? config.actions.map(action => {
    const actionClass = action.className ? ` class="${action.className}"` : '';
    return action.href
      ? `<a href="${action.href}"${actionClass}>${action.text}</a>`
      : `<button${actionClass}>${action.text}</button>`;
  }).join(' ') : '';

  return `
<div class="card"${className}>
  ${image}
  <div class="card-content">
    <h3 class="card-title">${config.title}</h3>
    <div class="card-body">${config.content}</div>
    ${actions ? `<div class="card-actions">${actions}</div>` : ''}
  </div>
</div>`;
}

/**
 * Build a complete page with head and body
 */
export function buildCompletePage(options: {
  title?: string;
  body: string;
  styles?: string;
  scripts?: string;
  meta?: Array<{ name?: string; content?: string; [key: string]: string | undefined }>;
}): string {
  const title = options.title || 'Test Page';
  const styles = options.styles || '';
  const scripts = options.scripts || '';
  const metaTags = options.meta?.map(meta => {
    const attrs = Object.entries(meta)
      .filter(([key, value]) => value !== undefined)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');
    return `<meta ${attrs}>`;
  }).join('\n') || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${metaTags}
  ${styles ? `<style>${styles}</style>` : ''}
</head>
<body>
  ${options.body}
  ${scripts ? `<script>${scripts}</script>` : ''}
</body>
</html>`;
}

/**
 * Build a responsive layout with header, main, and footer
 */
export function buildLayoutHtml(sections: {
  header?: string;
  main: string;
  footer?: string;
  sidebar?: string;
}): string {
  return `
<div class="layout">
  ${sections.header ? `<header class="layout-header">${sections.header}</header>` : ''}
  <div class="layout-content">
    ${sections.sidebar ? `<aside class="layout-sidebar">${sections.sidebar}</aside>` : ''}
    <main class="layout-main">${sections.main}</main>
  </div>
  ${sections.footer ? `<footer class="layout-footer">${sections.footer}</footer>` : ''}
</div>`;
}

/**
 * Build a breadcrumb navigation
 */
export function buildBreadcrumbHtml(items: Array<{ text: string; href?: string }>): string {
  const breadcrumbItems = items.map((item, index) => {
    const isLast = index === items.length - 1;
    const content = item.href && !isLast
      ? `<a href="${item.href}">${item.text}</a>`
      : `<span>${item.text}</span>`;

    return `<li class="breadcrumb-item${isLast ? ' active' : ''}">${content}</li>`;
  }).join('\n    ');

  return `
<nav aria-label="breadcrumb">
  <ol class="breadcrumb">
    ${breadcrumbItems}
  </ol>
</nav>`;
}

/**
 * Build a pagination component
 */
export function buildPaginationHtml(options: {
  currentPage: number;
  totalPages: number;
  baseUrl?: string;
  showFirstLast?: boolean;
  showPrevNext?: boolean;
}): string {
  const { currentPage, totalPages, baseUrl = '#', showFirstLast = true, showPrevNext = true } = options;
  const items: string[] = [];

  // First page link
  if (showFirstLast && currentPage > 1) {
    items.push(`<li class="page-item"><a class="page-link" href="${baseUrl}?page=1">First</a></li>`);
  }

  // Previous page link
  if (showPrevNext && currentPage > 1) {
    items.push(`<li class="page-item"><a class="page-link" href="${baseUrl}?page=${currentPage - 1}">Previous</a></li>`);
  }

  // Page numbers (show current page and 2 pages before/after)
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  for (let page = startPage; page <= endPage; page++) {
    const isActive = page === currentPage;
    const className = `page-item${isActive ? ' active' : ''}`;
    const content = isActive
      ? `<span class="page-link">${page}</span>`
      : `<a class="page-link" href="${baseUrl}?page=${page}">${page}</a>`;
    items.push(`<li class="${className}">${content}</li>`);
  }

  // Next page link
  if (showPrevNext && currentPage < totalPages) {
    items.push(`<li class="page-item"><a class="page-link" href="${baseUrl}?page=${currentPage + 1}">Next</a></li>`);
  }

  // Last page link
  if (showFirstLast && currentPage < totalPages) {
    items.push(`<li class="page-item"><a class="page-link" href="${baseUrl}?page=${totalPages}">Last</a></li>`);
  }

  return `
<nav aria-label="pagination">
  <ul class="pagination">
    ${items.join('\n    ')}
  </ul>
</nav>`;
}

// Helper function to build individual form fields
function buildFormField(field: FormField): string {
  const required = field.required ? ' required' : '';
  const className = field.className ? ` class="${field.className}"` : '';
  const placeholder = field.placeholder ? ` placeholder="${field.placeholder}"` : '';
  const value = field.value ? ` value="${field.value}"` : '';

  switch (field.type) {
    case 'select': {
      const options = field.options?.map(option =>
        `<option value="${option}"${field.value === option ? ' selected' : ''}>${option}</option>`
      ).join('') || '';
      return `
  <div class="form-group">
    <label for="${field.name}">${field.label}</label>
    <select id="${field.name}" name="${field.name}"${required}${className}>
      ${options}
    </select>
  </div>`;
    }

    case 'textarea':
      return `
  <div class="form-group">
    <label for="${field.name}">${field.label}</label>
    <textarea id="${field.name}" name="${field.name}"${placeholder}${required}${className}>${field.value || ''}</textarea>
  </div>`;

    case 'checkbox':
      return `
  <div class="form-group">
    <label class="checkbox-label">
      <input type="checkbox" id="${field.name}" name="${field.name}"${field.value === 'true' ? ' checked' : ''}${required}${className}>
      ${field.label}
    </label>
  </div>`;

    case 'radio':
      return field.options?.map(option => `
  <div class="form-group">
    <label class="radio-label">
      <input type="radio" name="${field.name}" value="${option}"${field.value === option ? ' checked' : ''}${required}${className}>
      ${option}
    </label>
  </div>`).join('') || '';

    default:
      return `
  <div class="form-group">
    <label for="${field.name}">${field.label}</label>
    <input type="${field.type}" id="${field.name}" name="${field.name}"${value}${placeholder}${required}${className}>
  </div>`;
  }
}