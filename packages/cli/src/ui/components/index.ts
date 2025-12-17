export { Banner, type BannerProps } from './Banner.js';
export { CodeBlock, type CodeBlockProps } from './CodeBlock.js';
export { InputPrompt, type InputPromptProps } from './InputPrompt.js';
export { ResponseStream, type ResponseStreamProps } from './ResponseStream.js';
export { ServicesPanel, type ServicesPanelProps } from './ServicesPanel.js';
export { StatusBar, type StatusBarProps } from './StatusBar.js';
export { TaskProgress, type TaskProgressProps, type SubtaskInfo } from './TaskProgress.js';
export { ToolCall, type ToolCallProps } from './ToolCall.js';

// Enhanced v0.3.0 components
export { MarkdownRenderer, SimpleMarkdownRenderer, type MarkdownRendererProps } from './MarkdownRenderer.js';
export { SyntaxHighlighter, SimpleSyntaxHighlighter, type SyntaxHighlighterProps } from './SyntaxHighlighter.js';
export { DiffViewer, type DiffViewerProps } from './DiffViewer.js';
export { StreamingText, StreamingResponse, TypewriterText, type StreamingTextProps, type StreamingResponseProps, type TypewriterTextProps } from './StreamingText.js';
export { AdvancedInput, type AdvancedInputProps, type Suggestion } from './AdvancedInput.js';
export {
  ProgressBar,
  CircularProgress,
  LoadingSpinner,
  StepProgress,
  MultiTaskProgress,
  type ProgressBarProps,
  type CircularProgressProps,
  type LoadingSpinnerProps,
  type StepProgressProps,
  type TaskProgressProps as AdvancedTaskProgressProps,
  type MultiTaskProgressProps
} from './ProgressIndicators.js';
export { ActivityLog, LogStream, CompactLog, type ActivityLogProps, type LogEntry, type LogStreamProps, type CompactLogProps } from './ActivityLog.js';
export { ErrorDisplay, ErrorSummary, ValidationError, type ErrorDisplayProps, type ErrorSuggestion, type ErrorSummaryProps, type ValidationErrorProps } from './ErrorDisplay.js';
export {
  SuccessCelebration,
  Milestone,
  ProgressCelebration,
  QuickSuccess,
  type SuccessCelebrationProps,
  type MilestoneProps,
  type ProgressCelebrationProps,
  type QuickSuccessProps
} from './SuccessCelebration.js';
export { IntentDetector, SmartSuggestions, type IntentDetectorProps, type Intent, type SmartSuggestionsProps } from './IntentDetector.js';
export { PreviewPanel, type PreviewPanelProps } from './PreviewPanel.js';
export { ThoughtDisplay, type ThoughtDisplayProps } from './ThoughtDisplay.js';
export { CollapsibleSection, type CollapsibleSectionProps } from './CollapsibleSection.js';

// Agent components
export {
  AgentPanel,
  HandoffIndicator,
  ParallelExecutionView,
  SubtaskTree,
  type AgentInfo,
  type AgentPanelProps,
  type HandoffIndicatorProps,
  type ParallelExecutionViewProps,
  type SubtaskNode,
  type SubtaskTreeProps
} from './agents/index.js';
