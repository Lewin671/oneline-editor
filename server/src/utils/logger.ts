export interface ErrorLog {
  timestamp: string;
  severity: 'error' | 'warning' | 'info';
  component: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
}

export class Logger {
  private logLevel: string;

  constructor(logLevel: string = 'info') {
    this.logLevel = logLevel;
  }

  /**
   * Log an error
   */
  error(component: string, message: string, error?: Error, context?: Record<string, any>): void {
    this.log('error', component, message, error?.stack, context);
  }

  /**
   * Log a warning
   */
  warn(component: string, message: string, context?: Record<string, any>): void {
    this.log('warning', component, message, undefined, context);
  }

  /**
   * Log info
   */
  info(component: string, message: string, context?: Record<string, any>): void {
    if (this.shouldLog('info')) {
      this.log('info', component, message, undefined, context);
    }
  }

  /**
   * Log debug
   */
  debug(component: string, message: string, context?: Record<string, any>): void {
    if (this.shouldLog('debug')) {
      this.log('info', component, message, undefined, context);
    }
  }

  /**
   * Internal log method
   */
  private log(
    severity: 'error' | 'warning' | 'info',
    component: string,
    message: string,
    stack?: string,
    context?: Record<string, any>
  ): void {
    const log: ErrorLog = {
      timestamp: new Date().toISOString(),
      severity,
      component,
      message,
      stack,
      context
    };

    // Output to console
    const logStr = JSON.stringify(log, null, 2);
    switch (severity) {
      case 'error':
        console.error(logStr);
        break;
      case 'warning':
        console.warn(logStr);
        break;
      default:
        console.log(logStr);
    }

    // Could also send to external logging service here
  }

  /**
   * Check if should log at this level
   */
  private shouldLog(level: string): boolean {
    const levels = ['error', 'warning', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex <= currentLevelIndex;
  }

  /**
   * Set log level
   */
  setLogLevel(level: string): void {
    this.logLevel = level;
  }
}

// Global logger instance
export const logger = new Logger(process.env.LOG_LEVEL || 'info');
