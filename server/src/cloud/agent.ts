/**
 * Cloud Agent Interface
 * Provides abstraction for cloud-based code intelligence services
 */

import type {
  CompletionParams,
  CompletionList,
  CompletionItem,
  HoverParams,
  Hover,
  DefinitionParams,
  Definition,
  Location,
} from 'vscode-languageserver-protocol';

/**
 * Configuration for cloud agent
 */
export interface CloudAgentConfig {
  enabled: boolean;
  endpoint: string;
  apiKey?: string;
  timeout?: number;
  fallbackToLocal?: boolean;
}

/**
 * Interface for cloud-based code intelligence agent
 */
export interface ICloudAgent {
  /**
   * Request code completion from cloud service
   */
  completion(params: CompletionParams): Promise<CompletionList | CompletionItem[] | null>;

  /**
   * Request hover information from cloud service
   */
  hover(params: HoverParams): Promise<Hover | null>;

  /**
   * Request definition location from cloud service
   */
  definition(params: DefinitionParams): Promise<Definition | Location[] | null>;

  /**
   * Check if the cloud agent is available and healthy
   */
  isAvailable(): Promise<boolean>;
}

/**
 * HTTP-based cloud agent implementation
 */
export class HttpCloudAgent implements ICloudAgent {
  private config: CloudAgentConfig;

  constructor(config: CloudAgentConfig) {
    this.config = config;
  }

  async completion(params: CompletionParams): Promise<CompletionList | CompletionItem[] | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const response = await this.makeRequest('/completion', params);
      return response as CompletionList | CompletionItem[];
    } catch (error) {
      console.error('[Cloud Agent] Completion request failed:', error);
      if (this.config.fallbackToLocal) {
        return null; // Fall back to local LSP
      }
      throw error;
    }
  }

  async hover(params: HoverParams): Promise<Hover | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const response = await this.makeRequest('/hover', params);
      return response as Hover;
    } catch (error) {
      console.error('[Cloud Agent] Hover request failed:', error);
      if (this.config.fallbackToLocal) {
        return null; // Fall back to local LSP
      }
      throw error;
    }
  }

  async definition(params: DefinitionParams): Promise<Definition | Location[] | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const response = await this.makeRequest('/definition', params);
      return response as Definition | Location[];
    } catch (error) {
      console.error('[Cloud Agent] Definition request failed:', error);
      if (this.config.fallbackToLocal) {
        return null; // Fall back to local LSP
      }
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      // Note: AbortSignal.timeout() requires Node.js 16.14.0+
      // This project requires Node.js 18+ (see package.json engines field)
      const response = await fetch(`${this.config.endpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.timeout || 5000),
      });
      return response.ok;
    } catch (error) {
      console.error('[Cloud Agent] Health check failed:', error);
      return false;
    }
  }

  private async makeRequest(path: string, params: unknown): Promise<unknown> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    // Note: AbortSignal.timeout() requires Node.js 16.14.0+
    // This project requires Node.js 18+ (see package.json engines field)
    const response = await fetch(`${this.config.endpoint}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(this.config.timeout || 5000),
    });

    if (!response.ok) {
      throw new Error(`Cloud agent request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

/**
 * Create a cloud agent instance based on configuration
 */
export function createCloudAgent(config: CloudAgentConfig): ICloudAgent {
  return new HttpCloudAgent(config);
}
