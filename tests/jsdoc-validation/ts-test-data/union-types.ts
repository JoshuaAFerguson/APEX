
/**
 * Status of an operation
 */
export type OperationStatus = 'pending' | 'success' | 'error' | 'cancelled';

/**
 * Result of an API operation
 */
export interface ApiResult<T = any> {
  /** Status of the operation */
  status: OperationStatus;
  /** Data returned on success */
  data?: T;
  /** Error message on failure */
  error?: string;
  /** Timestamp of the operation */
  timestamp: Date;
}

/**
 * Processes an API result and returns appropriate response
 * @param {ApiResult<any>} result - The API result to process
 * @returns {string | any} Either the data or an error message
 */
export function processApiResult(result: ApiResult<any>): string | any {
  switch (result.status) {
    case 'success':
      return result.data;
    case 'error':
      return `Error: ${result.error || 'Unknown error'}`;
    case 'pending':
      return 'Operation is still pending...';
    case 'cancelled':
      return 'Operation was cancelled';
    default:
      // TypeScript should ensure this is never reached
      const exhaustiveCheck: never = result.status;
      return `Unknown status: ${exhaustiveCheck}`;
  }
}

/**
 * Creates a successful API result
 * @template T
 * @param {T} data - The success data
 * @returns {ApiResult<T>} A successful API result
 */
export function createSuccessResult<T>(data: T): ApiResult<T> {
  return {
    status: 'success',
    data,
    timestamp: new Date()
  };
}

/**
 * Creates an error API result
 * @param {string} error - The error message
 * @returns {ApiResult<never>} An error API result
 */
export function createErrorResult(error: string): ApiResult<never> {
  return {
    status: 'error',
    error,
    timestamp: new Date()
  };
}
