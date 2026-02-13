/**
 * @fileoverview HTML fixtures for contenteditable integration testing
 *
 * This file provides HTML fixtures for testing contenteditable elements:
 * - Simple contenteditable div scenarios
 * - Contenteditable span scenarios
 * - Nested contenteditable element testing
 * - Complex content structures with mixed contenteditable elements
 * - Edge cases and accessibility considerations
 */

/**
 * Basic contenteditable div fixture
 */
export const BASIC_CONTENTEDITABLE_DIV_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Basic Contenteditable Div Test</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background: #f5f5f5;
        }
        .test-container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 600px;
            margin: 0 auto;
        }
        .contenteditable-div {
            border: 2px solid #ccc;
            padding: 12px;
            min-height: 100px;
            background: #fafafa;
            border-radius: 4px;
            font-size: 14px;
            line-height: 1.5;
            margin: 10px 0;
        }
        .contenteditable-div:focus {
            outline: none;
            border-color: #007acc;
            background: white;
        }
        .status {
            margin: 10px 0;
            padding: 10px;
            background: #e9f5ff;
            border-radius: 4px;
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="test-container">
        <h1>Contenteditable Div Test</h1>
        <p>Test typing in the contenteditable div below:</p>

        <div
            id="basic-div"
            class="contenteditable-div"
            contenteditable="true"
            data-testid="basic-contenteditable-div"
        >
            Initial content in div
        </div>

        <div class="status" id="div-status">
            Content: <span id="div-content-display">Initial content in div</span>
        </div>

        <button id="clear-div" onclick="clearDiv()">Clear Div</button>
        <button id="get-div-content" onclick="getDivContent()">Get Content</button>
    </div>

    <script>
        const basicDiv = document.getElementById('basic-div');
        const divStatusDisplay = document.getElementById('div-content-display');

        function updateDivStatus() {
            const textContent = basicDiv.textContent || '';
            const innerHTML = basicDiv.innerHTML || '';
            divStatusDisplay.textContent = textContent;
            console.log('Div content changed:', { textContent, innerHTML });
        }

        function clearDiv() {
            basicDiv.textContent = '';
            updateDivStatus();
        }

        function getDivContent() {
            const content = {
                textContent: basicDiv.textContent,
                innerHTML: basicDiv.innerHTML,
                innerText: basicDiv.innerText
            };
            console.log('Current div content:', content);
            alert('Content: ' + JSON.stringify(content, null, 2));
        }

        // Listen for content changes
        basicDiv.addEventListener('input', updateDivStatus);
        basicDiv.addEventListener('keyup', updateDivStatus);
        basicDiv.addEventListener('paste', () => {
            setTimeout(updateDivStatus, 10); // Delay to allow paste to complete
        });

        console.log('Basic contenteditable div test page loaded');
    </script>
</body>
</html>
`;

/**
 * Basic contenteditable span fixture
 */
export const BASIC_CONTENTEDITABLE_SPAN_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Basic Contenteditable Span Test</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background: #f5f5f5;
        }
        .test-container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 600px;
            margin: 0 auto;
        }
        .contenteditable-span {
            border: 1px solid #ccc;
            padding: 8px;
            background: #fafafa;
            border-radius: 4px;
            font-size: 14px;
            display: inline-block;
            min-width: 150px;
        }
        .contenteditable-span:focus {
            outline: none;
            border-color: #007acc;
            background: white;
        }
        .status {
            margin: 10px 0;
            padding: 10px;
            background: #e9f5ff;
            border-radius: 4px;
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="test-container">
        <h1>Contenteditable Span Test</h1>
        <p>Test typing in the contenteditable span:
            <span
                id="basic-span"
                class="contenteditable-span"
                contenteditable="true"
                data-testid="basic-contenteditable-span"
            >Initial span content</span>
        </p>

        <div class="status" id="span-status">
            Content: <span id="span-content-display">Initial span content</span>
        </div>

        <button id="clear-span" onclick="clearSpan()">Clear Span</button>
        <button id="get-span-content" onclick="getSpanContent()">Get Content</button>
    </div>

    <script>
        const basicSpan = document.getElementById('basic-span');
        const spanStatusDisplay = document.getElementById('span-content-display');

        function updateSpanStatus() {
            const textContent = basicSpan.textContent || '';
            const innerHTML = basicSpan.innerHTML || '';
            spanStatusDisplay.textContent = textContent;
            console.log('Span content changed:', { textContent, innerHTML });
        }

        function clearSpan() {
            basicSpan.textContent = '';
            updateSpanStatus();
        }

        function getSpanContent() {
            const content = {
                textContent: basicSpan.textContent,
                innerHTML: basicSpan.innerHTML,
                innerText: basicSpan.innerText
            };
            console.log('Current span content:', content);
            alert('Content: ' + JSON.stringify(content, null, 2));
        }

        // Listen for content changes
        basicSpan.addEventListener('input', updateSpanStatus);
        basicSpan.addEventListener('keyup', updateSpanStatus);
        basicSpan.addEventListener('paste', () => {
            setTimeout(updateSpanStatus, 10); // Delay to allow paste to complete
        });

        console.log('Basic contenteditable span test page loaded');
    </script>
</body>
</html>
`;

/**
 * Nested contenteditable elements fixture
 */
export const NESTED_CONTENTEDITABLE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nested Contenteditable Elements Test</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background: #f5f5f5;
        }
        .test-container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 700px;
            margin: 0 auto;
        }
        .outer-contenteditable {
            border: 3px solid #007acc;
            padding: 20px;
            min-height: 200px;
            background: #f0f8ff;
            border-radius: 6px;
            margin: 15px 0;
        }
        .inner-contenteditable {
            border: 2px solid #28a745;
            padding: 15px;
            margin: 10px 0;
            background: #f0fff0;
            border-radius: 4px;
        }
        .nested-span {
            border: 1px solid #dc3545;
            padding: 5px;
            background: #fff0f0;
            border-radius: 3px;
            margin: 0 5px;
        }
        .contenteditable-element:focus {
            outline: none;
            box-shadow: 0 0 5px rgba(0,123,255,0.5);
        }
        .status-panel {
            margin: 15px 0;
            padding: 15px;
            background: #e9ecef;
            border-radius: 4px;
            font-size: 12px;
        }
        .status-section {
            margin: 8px 0;
            padding: 8px;
            background: white;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="test-container">
        <h1>Nested Contenteditable Elements Test</h1>
        <p>Test typing in the nested contenteditable elements below:</p>

        <div
            id="outer-div"
            class="outer-contenteditable contenteditable-element"
            contenteditable="true"
            data-testid="outer-contenteditable"
        >
            <p>Outer div content. You can edit this.</p>

            <div
                id="inner-div"
                class="inner-contenteditable contenteditable-element"
                contenteditable="true"
                data-testid="inner-contenteditable"
            >
                Inner div content. This is nested and also editable.
                <span
                    id="nested-span"
                    class="nested-span contenteditable-element"
                    contenteditable="true"
                    data-testid="nested-span"
                >Nested span</span>
                within the inner div.
            </div>

            <p>More outer div content after the inner div.</p>
        </div>

        <div class="status-panel">
            <h3>Content Status</h3>
            <div class="status-section">
                <strong>Outer Div:</strong> <span id="outer-content-display">Loading...</span>
            </div>
            <div class="status-section">
                <strong>Inner Div:</strong> <span id="inner-content-display">Loading...</span>
            </div>
            <div class="status-section">
                <strong>Nested Span:</strong> <span id="nested-content-display">Loading...</span>
            </div>
        </div>

        <button id="clear-all" onclick="clearAll()">Clear All</button>
        <button id="get-all-content" onclick="getAllContent()">Get All Content</button>
        <button id="focus-outer" onclick="focusOuter()">Focus Outer</button>
        <button id="focus-inner" onclick="focusInner()">Focus Inner</button>
        <button id="focus-nested" onclick="focusNested()">Focus Nested</button>
    </div>

    <script>
        const outerDiv = document.getElementById('outer-div');
        const innerDiv = document.getElementById('inner-div');
        const nestedSpan = document.getElementById('nested-span');

        const outerDisplay = document.getElementById('outer-content-display');
        const innerDisplay = document.getElementById('inner-content-display');
        const nestedDisplay = document.getElementById('nested-content-display');

        function updateStatus() {
            outerDisplay.textContent = outerDiv.textContent?.substring(0, 50) + '...' || '';
            innerDisplay.textContent = innerDiv.textContent?.substring(0, 50) + '...' || '';
            nestedDisplay.textContent = nestedSpan.textContent || '';

            console.log('Nested content updated:', {
                outer: outerDiv.textContent,
                inner: innerDiv.textContent,
                nested: nestedSpan.textContent
            });
        }

        function clearAll() {
            nestedSpan.textContent = '';
            innerDiv.innerHTML = '<span id="nested-span" class="nested-span contenteditable-element" contenteditable="true" data-testid="nested-span">Nested span</span>';
            outerDiv.innerHTML = '<p>Outer div content</p><div id="inner-div" class="inner-contenteditable contenteditable-element" contenteditable="true" data-testid="inner-contenteditable">Inner div content. <span id="nested-span" class="nested-span contenteditable-element" contenteditable="true" data-testid="nested-span">Nested span</span> within the inner div.</div><p>More outer div content</p>';
            updateStatus();
            // Re-attach event listeners after DOM manipulation
            attachEventListeners();
        }

        function getAllContent() {
            const content = {
                outer: {
                    textContent: outerDiv.textContent,
                    innerHTML: outerDiv.innerHTML
                },
                inner: {
                    textContent: innerDiv.textContent,
                    innerHTML: innerDiv.innerHTML
                },
                nested: {
                    textContent: nestedSpan.textContent,
                    innerHTML: nestedSpan.innerHTML
                }
            };
            console.log('All nested content:', content);
            alert('Nested Content:\n' + JSON.stringify(content, null, 2));
        }

        function focusOuter() { outerDiv.focus(); }
        function focusInner() { innerDiv.focus(); }
        function focusNested() { nestedSpan.focus(); }

        function attachEventListeners() {
            [outerDiv, innerDiv, nestedSpan].forEach(element => {
                element.addEventListener('input', updateStatus);
                element.addEventListener('keyup', updateStatus);
                element.addEventListener('paste', () => {
                    setTimeout(updateStatus, 10);
                });
            });
        }

        // Initial setup
        updateStatus();
        attachEventListeners();

        console.log('Nested contenteditable elements test page loaded');
    </script>
</body>
</html>
`;

/**
 * Complex mixed contenteditable fixture
 */
export const COMPLEX_CONTENTEDITABLE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Complex Mixed Contenteditable Test</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
        }
        .test-container {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            max-width: 800px;
            margin: 0 auto;
        }
        .editable-title {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding: 10px 0;
            margin: 20px 0;
        }
        .editable-title:focus {
            outline: none;
            background: #f8f9fa;
        }
        .editable-paragraph {
            line-height: 1.8;
            margin: 15px 0;
            padding: 12px;
            border-left: 4px solid #e74c3c;
            background: #fdf2f2;
        }
        .editable-paragraph:focus {
            outline: none;
            background: #fff5f5;
        }
        .inline-editable {
            background: #fff3cd;
            padding: 3px 6px;
            border-radius: 3px;
            border: 1px solid #ffeaa7;
        }
        .inline-editable:focus {
            outline: none;
            background: #fff9e6;
            border-color: #f39c12;
        }
        .content-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 20px 0;
        }
        .grid-item {
            padding: 15px;
            border: 2px dashed #95a5a6;
            border-radius: 8px;
            background: #ecf0f1;
            min-height: 80px;
        }
        .grid-item:focus-within {
            border-color: #3498db;
            background: #ebf3fd;
        }
        .status-dashboard {
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #dee2e6;
        }
        .status-item {
            margin: 8px 0;
            padding: 8px;
            background: white;
            border-radius: 4px;
            font-size: 13px;
        }
        .control-panel {
            margin: 20px 0;
            text-align: center;
        }
        .control-panel button {
            margin: 5px;
            padding: 8px 16px;
            background: #3498db;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.3s;
        }
        .control-panel button:hover {
            background: #2980b9;
        }
    </style>
</head>
<body>
    <div class="test-container">
        <h1
            id="main-title"
            class="editable-title"
            contenteditable="true"
            data-testid="main-title"
        >
            Complex Contenteditable Test Suite
        </h1>

        <p
            id="intro-paragraph"
            class="editable-paragraph"
            contenteditable="true"
            data-testid="intro-paragraph"
        >
            This is an introduction paragraph that can be edited. It contains
            <span id="inline-highlight" class="inline-editable" contenteditable="true" data-testid="inline-highlight">
                highlighted text
            </span>
            that is also editable inline.
        </p>

        <div class="content-grid">
            <div
                id="left-content"
                class="grid-item"
                contenteditable="true"
                data-testid="left-content"
            >
                Left column content. This entire div is editable and can contain multiple lines of text.
            </div>

            <div
                id="right-content"
                class="grid-item"
                contenteditable="true"
                data-testid="right-content"
            >
                Right column content with
                <span id="nested-inline" class="inline-editable" contenteditable="true" data-testid="nested-inline">
                    nested editable span
                </span>
                for complex testing.
            </div>
        </div>

        <div
            id="rich-content"
            class="editable-paragraph"
            contenteditable="true"
            data-testid="rich-content"
        >
            <strong>Rich content area</strong> with <em>formatted text</em> and
            <a href="#" onclick="return false;">links</a>.
            <span id="rich-inline" class="inline-editable" contenteditable="true" data-testid="rich-inline">
                Rich inline element
            </span>
            for comprehensive testing.
        </div>

        <div class="status-dashboard">
            <h3>Content Status Dashboard</h3>
            <div class="status-item">
                <strong>Main Title:</strong> <span id="title-status">Loading...</span>
            </div>
            <div class="status-item">
                <strong>Intro Paragraph:</strong> <span id="intro-status">Loading...</span>
            </div>
            <div class="status-item">
                <strong>Inline Highlight:</strong> <span id="highlight-status">Loading...</span>
            </div>
            <div class="status-item">
                <strong>Left Content:</strong> <span id="left-status">Loading...</span>
            </div>
            <div class="status-item">
                <strong>Right Content:</strong> <span id="right-status">Loading...</span>
            </div>
            <div class="status-item">
                <strong>Rich Content:</strong> <span id="rich-status">Loading...</span>
            </div>
        </div>

        <div class="control-panel">
            <button onclick="validateAllContent()">Validate All Content</button>
            <button onclick="clearAllContent()">Clear All Content</button>
            <button onclick="restoreDefaultContent()">Restore Defaults</button>
            <button onclick="exportContent()">Export Content</button>
            <button onclick="simulateTyping()">Simulate Typing</button>
        </div>
    </div>

    <script>
        // Element references
        const elements = {
            mainTitle: document.getElementById('main-title'),
            introParagraph: document.getElementById('intro-paragraph'),
            inlineHighlight: document.getElementById('inline-highlight'),
            leftContent: document.getElementById('left-content'),
            rightContent: document.getElementById('right-content'),
            nestedInline: document.getElementById('nested-inline'),
            richContent: document.getElementById('rich-content'),
            richInline: document.getElementById('rich-inline')
        };

        // Status display references
        const statusElements = {
            title: document.getElementById('title-status'),
            intro: document.getElementById('intro-status'),
            highlight: document.getElementById('highlight-status'),
            left: document.getElementById('left-status'),
            right: document.getElementById('right-status'),
            rich: document.getElementById('rich-status')
        };

        // Default content for restoration
        const defaultContent = {
            mainTitle: 'Complex Contenteditable Test Suite',
            introParagraph: 'This is an introduction paragraph that can be edited. It contains <span id="inline-highlight" class="inline-editable" contenteditable="true" data-testid="inline-highlight">highlighted text</span> that is also editable inline.',
            leftContent: 'Left column content. This entire div is editable and can contain multiple lines of text.',
            rightContent: 'Right column content with <span id="nested-inline" class="inline-editable" contenteditable="true" data-testid="nested-inline">nested editable span</span> for complex testing.',
            richContent: '<strong>Rich content area</strong> with <em>formatted text</em> and <a href="#" onclick="return false;">links</a>. <span id="rich-inline" class="inline-editable" contenteditable="true" data-testid="rich-inline">Rich inline element</span> for comprehensive testing.'
        };

        function updateAllStatus() {
            statusElements.title.textContent = elements.mainTitle.textContent.substring(0, 40) + '...';
            statusElements.intro.textContent = elements.introParagraph.textContent.substring(0, 40) + '...';
            statusElements.highlight.textContent = elements.inlineHighlight.textContent;
            statusElements.left.textContent = elements.leftContent.textContent.substring(0, 30) + '...';
            statusElements.right.textContent = elements.rightContent.textContent.substring(0, 30) + '...';
            statusElements.rich.textContent = elements.richContent.textContent.substring(0, 40) + '...';

            console.log('Content status updated for all elements');
        }

        function validateAllContent() {
            const validation = {};
            Object.keys(elements).forEach(key => {
                const element = elements[key];
                validation[key] = {
                    textContent: element.textContent,
                    innerHTML: element.innerHTML,
                    hasContent: element.textContent.trim().length > 0,
                    isEditable: element.contentEditable === 'true'
                };
            });

            console.log('Content validation:', validation);
            alert('Validation completed. Check console for details.');
        }

        function clearAllContent() {
            Object.values(elements).forEach(element => {
                element.textContent = '';
            });
            updateAllStatus();
            console.log('All content cleared');
        }

        function restoreDefaultContent() {
            elements.mainTitle.textContent = defaultContent.mainTitle;
            elements.introParagraph.innerHTML = defaultContent.introParagraph;
            elements.leftContent.textContent = defaultContent.leftContent;
            elements.rightContent.innerHTML = defaultContent.rightContent;
            elements.richContent.innerHTML = defaultContent.richContent;

            // Re-acquire references after innerHTML changes
            elements.inlineHighlight = document.getElementById('inline-highlight');
            elements.nestedInline = document.getElementById('nested-inline');
            elements.richInline = document.getElementById('rich-inline');

            updateAllStatus();
            attachEventListeners();
            console.log('Default content restored');
        }

        function exportContent() {
            const exported = {};
            Object.keys(elements).forEach(key => {
                exported[key] = {
                    textContent: elements[key].textContent,
                    innerHTML: elements[key].innerHTML
                };
            });

            const jsonString = JSON.stringify(exported, null, 2);
            console.log('Exported content:', exported);

            // Create downloadable file
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'contenteditable-content.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function simulateTyping() {
            // Simulate typing in the main title
            const title = elements.mainTitle;
            title.focus();

            const testText = ' - Automated Test';
            let index = 0;

            const typeInterval = setInterval(() => {
                if (index < testText.length) {
                    title.textContent += testText[index];
                    index++;
                    updateAllStatus();
                } else {
                    clearInterval(typeInterval);
                    console.log('Simulated typing completed');
                }
            }, 100);
        }

        function attachEventListeners() {
            Object.values(elements).forEach(element => {
                if (element) {
                    element.addEventListener('input', updateAllStatus);
                    element.addEventListener('keyup', updateAllStatus);
                    element.addEventListener('paste', () => {
                        setTimeout(updateAllStatus, 10);
                    });
                }
            });
        }

        // Initialize
        updateAllStatus();
        attachEventListeners();

        console.log('Complex contenteditable test page loaded with', Object.keys(elements).length, 'editable elements');
    </script>
</body>
</html>
`;

/**
 * Create a data URL from HTML content for direct page navigation
 */
export function createContenteditableTestPage(htmlContent: string): string {
    return `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
}

/**
 * Test fixture metadata
 */
export interface ContenteditableTestFixture {
    name: string;
    description: string;
    html: string;
    testSelectors: {
        primary: string;
        secondary?: string;
        status?: string;
    };
    expectedContent: {
        initial: string;
        afterClear?: string;
    };
}

/**
 * All available contenteditable test fixtures
 */
export const CONTENTEDITABLE_FIXTURES: Record<string, ContenteditableTestFixture> = {
    basicDiv: {
        name: 'Basic Contenteditable Div',
        description: 'Simple div element with contenteditable=true',
        html: BASIC_CONTENTEDITABLE_DIV_HTML,
        testSelectors: {
            primary: '[data-testid="basic-contenteditable-div"]',
            status: '#div-content-display'
        },
        expectedContent: {
            initial: 'Initial content in div',
            afterClear: ''
        }
    },
    basicSpan: {
        name: 'Basic Contenteditable Span',
        description: 'Simple span element with contenteditable=true',
        html: BASIC_CONTENTEDITABLE_SPAN_HTML,
        testSelectors: {
            primary: '[data-testid="basic-contenteditable-span"]',
            status: '#span-content-display'
        },
        expectedContent: {
            initial: 'Initial span content',
            afterClear: ''
        }
    },
    nested: {
        name: 'Nested Contenteditable Elements',
        description: 'Complex nested structure with multiple contenteditable elements',
        html: NESTED_CONTENTEDITABLE_HTML,
        testSelectors: {
            primary: '[data-testid="outer-contenteditable"]',
            secondary: '[data-testid="inner-contenteditable"]',
            status: '#outer-content-display'
        },
        expectedContent: {
            initial: 'Outer div content',
            afterClear: ''
        }
    },
    complex: {
        name: 'Complex Mixed Contenteditable',
        description: 'Rich content with multiple contenteditable elements and formatting',
        html: COMPLEX_CONTENTEDITABLE_HTML,
        testSelectors: {
            primary: '[data-testid="main-title"]',
            secondary: '[data-testid="intro-paragraph"]',
            status: '#title-status'
        },
        expectedContent: {
            initial: 'Complex Contenteditable Test Suite',
            afterClear: ''
        }
    }
};