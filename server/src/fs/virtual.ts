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
  // Track mapping from temp file paths back to their original URIs
  private tempToOriginalUri: Map<string, string> = new Map();

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
    const tempPath = this.getTempPath(uri);
    this.tempToOriginalUri.delete(path.normalize(tempPath));
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
    this.tempToOriginalUri.set(path.normalize(tempPath), uri);

    return tempPath;
  }

  /**
   * Convert URI to temporary file path
   */
  public getTempPath(uri: string): string {
    // Try parsing as a URL first (e.g., file:// URIs)
    const rawPath = this.extractPathFromUri(uri);
    const normalized = this.normalizePath(rawPath);
    return path.join(this.tempDir, normalized);
  }

  /**
   * Resolve a temp file URI/path back to the original URI that created it
   */
  resolveOriginalUri(tempUri: string): string | undefined {
    const rawPath = this.extractPathFromUri(tempUri);
    const normalized = path.normalize(rawPath);
    const direct = this.tempToOriginalUri.get(normalized);
    if (direct) return direct;

    // Also try matching when the temp dir prefix is included
    const strippedTempDir = normalized.startsWith(this.tempDir)
      ? normalized
      : path.join(this.tempDir, this.normalizePath(rawPath));
    return this.tempToOriginalUri.get(path.normalize(strippedTempDir));
  }

  private extractPathFromUri(uri: string): string {
    try {
      return new URL(uri).pathname;
    } catch {
      return uri;
    }
  }

  private normalizePath(rawPath: string): string {
    // Strip leading slashes so path.join doesn't escape the temp dir
    const withoutLeadingSlash = rawPath.replace(/^[/\\]+/, '');
    // Normalize to collapse any .. segments
    return path.normalize(withoutLeadingSlash);
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
    this.tempToOriginalUri.clear();
  }

  /**
   * Get file count
   */
  getFileCount(): number {
    return this.files.size;
  }
}
