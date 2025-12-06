import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RealFileSystem } from '../../src/fs/real.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('RealFileSystem', () => {
  let rfs: RealFileSystem;
  let testWorkspaceRoot: string;

  beforeEach(async () => {
    // Create a unique temporary workspace for each test
    testWorkspaceRoot = path.join(os.tmpdir(), `test-workspace-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(testWorkspaceRoot, { recursive: true });
    rfs = new RealFileSystem(testWorkspaceRoot);
  });

  afterEach(async () => {
    // Clean up the test workspace
    try {
      await fs.rm(testWorkspaceRoot, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should create a file', async () => {
    await rfs.createFile('file:///test.go', 'package main', 'go');
    const exists = await rfs.hasFile('file:///test.go');
    expect(exists).toBe(true);
  });

  it('should update file content', async () => {
    await rfs.createFile('file:///test.go', 'package main', 'go');
    await rfs.updateFile('file:///test.go', 'package main\n\nfunc main() {}');
    
    const file = await rfs.getFile('file:///test.go');
    expect(file?.content).toContain('func main()');
    expect(file?.version).toBe(2);
  });

  it('should delete a file', async () => {
    await rfs.createFile('file:///test.go', 'package main', 'go');
    await rfs.deleteFile('file:///test.go');
    const exists = await rfs.hasFile('file:///test.go');
    expect(exists).toBe(false);
  });

  it('should increment version on update', async () => {
    await rfs.createFile('file:///test.go', 'v1', 'go');
    let file = await rfs.getFile('file:///test.go');
    expect(file?.version).toBe(1);
    
    await rfs.updateFile('file:///test.go', 'v2');
    file = await rfs.getFile('file:///test.go');
    expect(file?.version).toBe(2);
    
    await rfs.updateFile('file:///test.go', 'v3');
    file = await rfs.getFile('file:///test.go');
    expect(file?.version).toBe(3);
  });

  it('should map files to workspace root for file URIs', () => {
    const filePath = rfs.uriToPath('file:///src/index.ts');
    expect(filePath).toBe(path.join(testWorkspaceRoot, 'src/index.ts'));
  });

  it('should map files to workspace root for absolute paths without scheme', () => {
    const filePath = rfs.uriToPath('/src/index.ts');
    expect(filePath).toBe(path.join(testWorkspaceRoot, 'src/index.ts'));
  });

  it('should infer language ID from file extension', async () => {
    await rfs.createFile('file:///test.ts', 'const x = 1;', 'typescript');
    const file = await rfs.getFile('file:///test.ts');
    expect(file?.languageId).toBe('typescript');
  });

  it('should handle nested directories', async () => {
    await rfs.createFile('file:///src/nested/deep/test.go', 'package main', 'go');
    const exists = await rfs.hasFile('file:///src/nested/deep/test.go');
    expect(exists).toBe(true);
    
    const file = await rfs.getFile('file:///src/nested/deep/test.go');
    expect(file?.content).toBe('package main');
  });

  it('should return undefined for non-existent files', async () => {
    const file = await rfs.getFile('file:///nonexistent.go');
    expect(file).toBeUndefined();
  });

  it('should track file count', async () => {
    expect(rfs.getFileCount()).toBe(0);
    
    await rfs.createFile('file:///test1.go', 'package main', 'go');
    expect(rfs.getFileCount()).toBe(1);
    
    await rfs.createFile('file:///test2.ts', 'console.log()', 'typescript');
    expect(rfs.getFileCount()).toBe(2);
    
    await rfs.deleteFile('file:///test1.go');
    expect(rfs.getFileCount()).toBe(1);
  });

  it('should clear tracking data', async () => {
    await rfs.createFile('file:///test.go', 'package main', 'go');
    rfs.clear();
    expect(rfs.getFileCount()).toBe(0);
    
    // Files should still exist on disk
    const exists = await rfs.hasFile('file:///test.go');
    expect(exists).toBe(true);
  });
});
