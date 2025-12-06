import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface FileEntry {
  uri: string;
  content: string;
  version: number;
  languageId: string;
}

export class VirtualFileSystem {
  private files: Map<string, FileEntry> = new Map();
  private tempDir: string;

  constructor(tempDir?: string) {
    this.tempDir = tempDir || path.join(os.tmpdir(), 'online-editor');
  }

  /**
   * Create a new file in the virtual file system
   */
  createFile(uri: string, content: string, languageId: string): void {
    this.files.set(uri, {
      uri,
      content,
      version: 1,
      languageId
    });
  }

  /**
   * Update an existing file's content
   */
  updateFile(uri: string, content: string): void {
    const file = this.files.get(uri);
    if (file) {
      file.content = content;
      file.version++;
    } else {
      throw new Error(`File not found: ${uri}`);
    }
  }

  /**
   * Get a file by URI
   */
  getFile(uri: string): FileEntry | undefined {
    return this.files.get(uri);
  }

  /**
   * Delete a file from the virtual file system
   */
  deleteFile(uri: string): void {
    this.files.delete(uri);
  }

  /**
   * Get all files
   */
  getAllFiles(): FileEntry[] {
    return Array.from(this.files.values());
  }

  /**
   * Check if a file exists
   */
  hasFile(uri: string): boolean {
    return this.files.has(uri);
  }

  /**
   * Write a file to the temporary directory for Language Server access
   */
  async writeToTempDir(uri: string): Promise<string> {
    const file = this.files.get(uri);
    if (!file) {
      throw new Error(`File not found: ${uri}`);
    }

    const tempPath = this.getTempPath(uri);
    const dir = path.dirname(tempPath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(tempPath, file.content, 'utf-8');

    return tempPath;
  }

  /**
   * Convert URI to temporary file path
   */
  public getTempPath(uri: string): string {
    try {
      const parsed = new URL(uri);
      return path.join(this.tempDir, parsed.pathname);
    } catch {
      // If not a valid URL, treat as relative path
      return path.join(this.tempDir, uri);
    }
  }

  /**
   * Get the temporary directory path
   */
  getTempDir(): string {
    return this.tempDir;
  }

  /**
   * Clear all files
   */
  clear(): void {
    this.files.clear();
  }

  /**
   * Get file count
   */
  getFileCount(): number {
    return this.files.size;
  }
}
