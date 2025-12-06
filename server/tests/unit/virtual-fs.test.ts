import { describe, it, expect, beforeEach } from 'vitest';
import { VirtualFileSystem } from '../../src/fs/virtual.js';

describe('VirtualFileSystem', () => {
  let vfs: VirtualFileSystem;

  beforeEach(() => {
    vfs = new VirtualFileSystem('/tmp/test');
  });

  it('should create a file', () => {
    vfs.createFile('file:///test.go', 'package main', 'go');
    expect(vfs.hasFile('file:///test.go')).toBe(true);
  });

  it('should update file content', () => {
    vfs.createFile('file:///test.go', 'package main', 'go');
    vfs.updateFile('file:///test.go', 'package main\n\nfunc main() {}');
    
    const file = vfs.getFile('file:///test.go');
    expect(file?.content).toContain('func main()');
    expect(file?.version).toBe(2);
  });

  it('should delete a file', () => {
    vfs.createFile('file:///test.go', 'package main', 'go');
    vfs.deleteFile('file:///test.go');
    expect(vfs.hasFile('file:///test.go')).toBe(false);
  });

  it('should get all files', () => {
    vfs.createFile('file:///test1.go', 'package main', 'go');
    vfs.createFile('file:///test2.ts', 'console.log()', 'typescript');
    
    const files = vfs.getAllFiles();
    expect(files).toHaveLength(2);
  });

  it('should increment version on update', () => {
    vfs.createFile('file:///test.go', 'v1', 'go');
    expect(vfs.getFile('file:///test.go')?.version).toBe(1);
    
    vfs.updateFile('file:///test.go', 'v2');
    expect(vfs.getFile('file:///test.go')?.version).toBe(2);
    
    vfs.updateFile('file:///test.go', 'v3');
    expect(vfs.getFile('file:///test.go')?.version).toBe(3);
  });

  it('should place temp files under the temp dir for file URIs', () => {
    const tempPath = vfs.getTempPath('file:///src/index.ts');
    expect(tempPath).toBe('/tmp/test/src/index.ts');
  });

  it('should place temp files under the temp dir for absolute paths without scheme', () => {
    const tempPath = vfs.getTempPath('/src/index.ts');
    expect(tempPath).toBe('/tmp/test/src/index.ts');
  });
});
