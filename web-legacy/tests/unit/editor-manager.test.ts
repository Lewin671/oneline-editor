import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Monaco Editor
vi.mock('monaco-editor', () => ({
  editor: {
    create: vi.fn(() => ({
      onDidChangeModelContent: vi.fn(),
      setModel: vi.fn(),
      getModel: vi.fn(),
      dispose: vi.fn()
    })),
    createModel: vi.fn((content, languageId, uri) => ({
      getValue: vi.fn(() => content),
      setValue: vi.fn(),
      dispose: vi.fn(),
      getVersionId: vi.fn(() => 1)
    })),
    setModelMarkers: vi.fn(),
    setTheme: vi.fn()
  },
  Uri: {
    parse: vi.fn((uri) => uri)
  },
  MarkerSeverity: {
    Error: 8,
    Warning: 4,
    Info: 2,
    Hint: 1
  }
}));

import { EditorManager } from '../../src/editor/manager.js';

describe('EditorManager', () => {
  let manager: EditorManager;

  beforeEach(() => {
    manager = new EditorManager();
  });

  it('should open a file', () => {
    const uri = 'file:///test.go';
    const content = 'package main';
    const languageId = 'go';

    manager.openFile(uri, content, languageId);
    
    expect(manager.getCurrentUri()).toBe(uri);
    expect(manager.getOpenFiles()).toContain(uri);
  });

  it('should close a file', () => {
    const uri = 'file:///test.go';
    manager.openFile(uri, 'package main', 'go');
    manager.closeFile(uri);
    
    expect(manager.getOpenFiles()).not.toContain(uri);
  });

  it('should get file content', () => {
    const uri = 'file:///test.go';
    const content = 'package main';
    
    manager.openFile(uri, content, 'go');
    const retrievedContent = manager.getFileContent(uri);
    
    expect(retrievedContent).toBe(content);
  });

  it('should track multiple files', () => {
    manager.openFile('file:///test1.go', 'package main', 'go');
    manager.openFile('file:///test2.ts', 'console.log()', 'typescript');
    
    expect(manager.getOpenFiles()).toHaveLength(2);
  });
});
