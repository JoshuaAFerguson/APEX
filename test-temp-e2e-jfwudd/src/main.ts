/**
 * Main application module
 * @version 2.0.0
 * @author Development Team
 * @since 1.0.0
 */

export class Application {
  /**
   * Application version
   * @version 2.0.1
   */
  public static readonly VERSION = 'v2.0.0';

  /**
   * Initialize application
   * @returns Promise<void>
   * @since version 1.5.0
   */
  async initialize(): Promise<void> {
    console.log('Starting application version 2.0.0');
  }
}
