import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LanguageServerManager } from '../../src/lsp/manager';

// Mock the dependencies
vi.mock('@lewin671/lsp-client', () => {
  return {
    LanguageClient: vi.fn().mockImplementation(() => ({
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined)
    })),
    StdioTransport: vi.fn()
  };
});

vi.mock('../../src/lsp/host', () => {
  return {
    ServerHost: vi.fn()
  };
});

describe('LanguageServerManager', () => {
  let manager: LanguageServerManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new LanguageServerManager('/tmp/test-workspace');
  });

  it('should reuse the same client promise for concurrent requests', async () => {
    const { LanguageClient } = await import('@lewin671/lsp-client');
    
    // Simulate a slow start
    (LanguageClient as any).mockImplementation(() => ({
      start: vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      }),
      stop: vi.fn().mockResolvedValue(undefined)
    }));

    const p1 = manager.getOrCreateClient('typescript');
    const p2 = manager.getOrCreateClient('typescript');

    const c1 = await p1;
    const c2 = await p2;

    expect(c1).toBe(c2);
    expect(LanguageClient).toHaveBeenCalledTimes(1);
  });

  it('should return existing client if already started', async () => {
    const { LanguageClient } = await import('@lewin671/lsp-client');
    
    const c1 = await manager.getOrCreateClient('typescript');
    const c2 = await manager.getOrCreateClient('typescript');

    expect(c1).toBe(c2);
    // Should be called once for the first creation
    expect(LanguageClient).toHaveBeenCalledTimes(1);
  });
});
