import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpCloudAgent, type CloudAgentConfig } from '../../src/cloud/agent.js';
import type { CompletionParams, HoverParams, DefinitionParams } from 'vscode-languageserver-protocol';

describe('HttpCloudAgent', () => {
  let config: CloudAgentConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      endpoint: 'http://localhost:8080',
      apiKey: 'test-api-key',
      timeout: 5000,
      fallbackToLocal: true
    };
    
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  describe('completion', () => {
    it('should return null when disabled', async () => {
      const disabledConfig = { ...config, enabled: false };
      const agent = new HttpCloudAgent(disabledConfig);
      
      const params: CompletionParams = {
        textDocument: { uri: 'file:///test.ts' },
        position: { line: 0, character: 0 }
      };
      
      const result = await agent.completion(params);
      expect(result).toBeNull();
    });

    it('should make POST request to cloud endpoint', async () => {
      const mockResponse = {
        items: [{ label: 'test', kind: 1 }]
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });
      
      const agent = new HttpCloudAgent(config);
      const params: CompletionParams = {
        textDocument: { uri: 'file:///test.ts' },
        position: { line: 0, character: 0 }
      };
      
      const result = await agent.completion(params);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/completion',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return null on error when fallbackToLocal is true', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
      
      const agent = new HttpCloudAgent(config);
      const params: CompletionParams = {
        textDocument: { uri: 'file:///test.ts' },
        position: { line: 0, character: 0 }
      };
      
      const result = await agent.completion(params);
      expect(result).toBeNull();
    });

    it('should throw error when fallbackToLocal is false', async () => {
      const noFallbackConfig = { ...config, fallbackToLocal: false };
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
      
      const agent = new HttpCloudAgent(noFallbackConfig);
      const params: CompletionParams = {
        textDocument: { uri: 'file:///test.ts' },
        position: { line: 0, character: 0 }
      };
      
      await expect(agent.completion(params)).rejects.toThrow('Network error');
    });
  });

  describe('hover', () => {
    it('should return null when disabled', async () => {
      const disabledConfig = { ...config, enabled: false };
      const agent = new HttpCloudAgent(disabledConfig);
      
      const params: HoverParams = {
        textDocument: { uri: 'file:///test.ts' },
        position: { line: 0, character: 0 }
      };
      
      const result = await agent.hover(params);
      expect(result).toBeNull();
    });

    it('should make POST request to cloud endpoint', async () => {
      const mockResponse = {
        contents: { kind: 'markdown', value: 'Test hover' }
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });
      
      const agent = new HttpCloudAgent(config);
      const params: HoverParams = {
        textDocument: { uri: 'file:///test.ts' },
        position: { line: 0, character: 0 }
      };
      
      const result = await agent.hover(params);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/hover',
        expect.objectContaining({
          method: 'POST'
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('definition', () => {
    it('should return null when disabled', async () => {
      const disabledConfig = { ...config, enabled: false };
      const agent = new HttpCloudAgent(disabledConfig);
      
      const params: DefinitionParams = {
        textDocument: { uri: 'file:///test.ts' },
        position: { line: 0, character: 0 }
      };
      
      const result = await agent.definition(params);
      expect(result).toBeNull();
    });

    it('should make POST request to cloud endpoint', async () => {
      const mockResponse = {
        uri: 'file:///test.ts',
        range: {
          start: { line: 10, character: 0 },
          end: { line: 10, character: 10 }
        }
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });
      
      const agent = new HttpCloudAgent(config);
      const params: DefinitionParams = {
        textDocument: { uri: 'file:///test.ts' },
        position: { line: 0, character: 0 }
      };
      
      const result = await agent.definition(params);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/definition',
        expect.objectContaining({
          method: 'POST'
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('isAvailable', () => {
    it('should return false when disabled', async () => {
      const disabledConfig = { ...config, enabled: false };
      const agent = new HttpCloudAgent(disabledConfig);
      
      const result = await agent.isAvailable();
      expect(result).toBe(false);
    });

    it('should return true when health check succeeds', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true
      });
      
      const agent = new HttpCloudAgent(config);
      const result = await agent.isAvailable();
      
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/health',
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(result).toBe(true);
    });

    it('should return false when health check fails', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Connection refused'));
      
      const agent = new HttpCloudAgent(config);
      const result = await agent.isAvailable();
      
      expect(result).toBe(false);
    });
  });
});
