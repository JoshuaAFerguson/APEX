/**
 * Tools Module - Core Tools for APEX Orchestrator
 *
 * This module exports all available tools that can be used by APEX agents.
 * Each tool provides specific functionality for automation tasks.
 */

export {
  WebFetchTool,
  webFetchTool,
  webFetch,
  type WebFetchParams,
  type WebFetchResult,
  type HttpMethod,
} from './webfetch';

export {
  BrowserTool,
  browserTool,
  browser,
  type BrowserOperation,
  type BrowserParams,
  type BrowserResult,
  type BrowserNavigateParams,
  type BrowserClickParams,
  type BrowserTypeParams,
  type BrowserScreenshotParams,
  type BrowserCompareScreenshotParams,
  type BrowserEvaluateParams,
  type BrowserSubmitParams,
  type BrowserWaitForSelectorParams,
  type BrowserGetAttributeParams,
  type BrowserGetTextParams,
  type BrowserGetHtmlParams,
  type BrowserScrollParams,
  type BrowserHoverParams,
  type BrowserConsoleMessage,
  type BrowserRuntimeError,
  type BrowserToolConfig,
} from './browser-tool';

export {
  MultimodalInputHandler,
  MultimodalInputError,
  multimodalInputHandler,
  processImageFile,
  type ImageBlockParam,
  type MultimodalInputHandlerConfig,
  type ImageProcessResult,
} from './multimodal-input-handler';

// Re-export for convenience
export * from './webfetch';
export * from './browser-tool';
export * from './multimodal-input-handler';
