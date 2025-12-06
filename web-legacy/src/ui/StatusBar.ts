export class StatusBar {
  private container: HTMLElement;
  private statusElement: HTMLElement;
  private loadingElement: HTMLElement;
  private messageElement: HTMLElement;
  private loadingOperations: Set<string> = new Set();

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 12px;
      background: #007acc;
      color: white;
      font-size: 12px;
      height: 24px;
    `;

    // Connection status
    this.statusElement = document.createElement('div');
    this.statusElement.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    this.container.appendChild(this.statusElement);

    // Loading indicator
    this.loadingElement = document.createElement('div');
    this.loadingElement.style.cssText = `
      display: none;
      align-items: center;
      gap: 6px;
    `;
    this.container.appendChild(this.loadingElement);

    // Message area
    this.messageElement = document.createElement('div');
    this.messageElement.style.cssText = `
      flex: 1;
      text-align: center;
    `;
    this.container.appendChild(this.messageElement);

    this.setStatus('disconnected');
  }

  /**
   * Set connection status
   */
  setStatus(status: 'connected' | 'disconnected' | 'connecting'): void {
    const indicator = document.createElement('span');
    indicator.style.cssText = `
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    `;

    let text = '';
    switch (status) {
      case 'connected':
        indicator.style.background = '#4caf50';
        text = 'Connected';
        break;
      case 'disconnected':
        indicator.style.background = '#f44336';
        text = 'Disconnected';
        break;
      case 'connecting':
        indicator.style.background = '#ff9800';
        text = 'Connecting...';
        break;
    }

    this.statusElement.innerHTML = '';
    this.statusElement.appendChild(indicator);
    this.statusElement.appendChild(document.createTextNode(text));
  }

  /**
   * Show loading indicator for an operation
   */
  showLoading(operationId: string, message?: string): void {
    this.loadingOperations.add(operationId);
    this.updateLoadingDisplay(message);
  }

  /**
   * Hide loading indicator for an operation
   */
  hideLoading(operationId: string): void {
    this.loadingOperations.delete(operationId);
    this.updateLoadingDisplay();
  }

  /**
   * Update loading display
   */
  private updateLoadingDisplay(message?: string): void {
    if (this.loadingOperations.size > 0) {
      this.loadingElement.style.display = 'flex';
      this.loadingElement.innerHTML = `
        <span class="spinner" style="
          width: 12px;
          height: 12px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        "></span>
        <span>${message || 'Loading...'}</span>
      `;

      // Add spinner animation
      if (!document.getElementById('spinner-style')) {
        const style = document.createElement('style');
        style.id = 'spinner-style';
        style.textContent = `
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
      }
    } else {
      this.loadingElement.style.display = 'none';
    }
  }

  /**
   * Show a temporary message
   */
  showMessage(message: string, duration: number = 3000): void {
    this.messageElement.textContent = message;
    setTimeout(() => {
      this.messageElement.textContent = '';
    }, duration);
  }

  /**
   * Show error message
   */
  showError(message: string): void {
    this.messageElement.style.color = '#f44336';
    this.messageElement.textContent = `Error: ${message}`;
    setTimeout(() => {
      this.messageElement.textContent = '';
      this.messageElement.style.color = 'white';
    }, 5000);
  }

  /**
   * Clear all messages
   */
  clearMessage(): void {
    this.messageElement.textContent = '';
  }
}

/**
 * Utility function to track long-running operations
 */
export async function withLoadingIndicator<T>(
  statusBar: StatusBar,
  operationId: string,
  operation: () => Promise<T>,
  threshold: number = 200
): Promise<T> {
  const startTime = Date.now();
  let timeoutId: number | null = null;

  // Show loading indicator after threshold
  timeoutId = window.setTimeout(() => {
    statusBar.showLoading(operationId);
  }, threshold);

  try {
    const result = await operation();
    return result;
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    statusBar.hideLoading(operationId);
  }
}
