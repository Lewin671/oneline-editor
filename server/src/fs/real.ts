import * as fs from 'fs/promises';
import * as path from 'path';

export interface FileEntry {
  uri: string;
  content: string;
  version: number;
  languageId: string;
}

/**
 * RealFileSystem directly maps to the actual file system at a workspace root
 * instead of maintaining virtual files in memory.
 */
export class RealFileSystem {
  private fileVersions: Map<string, number> = new Map();
  private fileLanguages: Map<string, string> = new Map();

  constructor(private workspaceRoot: string) {}

  /**
   * Create a new file in the real file system
   */
  async createFile(uri: string, content: string, languageId: string): Promise<void> {
    const filePath = this.uriToPath(uri);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(filePath, content, 'utf-8');
    
    // Track version and language
    this.fileVersions.set(uri, 1);
    this.fileLanguages.set(uri, languageId);
  }

  /**
   * Update an existing file's content
   */
  async updateFile(uri: string, content: string): Promise<void> {
    const filePath = this.uriToPath(uri);
    
    // Write file
    await fs.writeFile(filePath, content, 'utf-8');
    
    // Increment version
    const currentVersion = this.fileVersions.get(uri) || 0;
    this.fileVersions.set(uri, currentVersion + 1);
  }

  /**
   * Get a file by URI
   */
  async getFile(uri: string): Promise<FileEntry | undefined> {
    const filePath = this.uriToPath(uri);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const version = this.fileVersions.get(uri) || 1;
      const languageId = this.fileLanguages.get(uri) || this.inferLanguageId(uri);
      
      return {
        uri,
        content,
        version,
        languageId
      };
    } catch (error) {
      // File doesn't exist
      return undefined;
    }
  }

  /**
   * Delete a file from the file system
   */
  async deleteFile(uri: string): Promise<void> {
    const filePath = this.uriToPath(uri);
    
    try {
      await fs.unlink(filePath);
      this.fileVersions.delete(uri);
      this.fileLanguages.delete(uri);
    } catch (error) {
      // Ignore errors if file doesn't exist
    }
  }

  /**
   * Get all files (not implemented for real file system)
   * This would require scanning the entire workspace, which is expensive
   */
  getAllFiles(): FileEntry[] {
    throw new Error('getAllFiles() is not supported in RealFileSystem');
  }

  /**
   * Check if a file exists
   */
  async hasFile(uri: string): Promise<boolean> {
    const filePath = this.uriToPath(uri);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert URI to real file path
   * This is the key method that maps URIs to the workspace root
   */
  uriToPath(uri: string): string {
    const rawPath = this.extractPathFromUri(uri);
    const normalized = this.normalizePath(rawPath);
    return path.join(this.workspaceRoot, normalized);
  }

  /**
   * Convert file path to URI
   */
  pathToUri(filePath: string): string {
    // If the path is within workspace root, make it relative
    if (filePath.startsWith(this.workspaceRoot)) {
      const relativePath = path.relative(this.workspaceRoot, filePath);
      return `file:///${relativePath.replace(/\\/g, '/')}`;
    }
    return `file:///${filePath.replace(/\\/g, '/')}`;
  }

  private extractPathFromUri(uri: string): string {
    try {
      return new URL(uri).pathname;
    } catch {
      return uri;
    }
  }

  private normalizePath(rawPath: string): string {
    // Strip leading slashes so path.join doesn't escape the workspace root
    const withoutLeadingSlash = rawPath.replace(/^[/\\]+/, '');
    // Normalize to collapse any .. segments
    return path.normalize(withoutLeadingSlash);
  }

  /**
   * Infer language ID from file extension
   */
  private inferLanguageId(uri: string): string {
    const ext = path.extname(uri).toLowerCase();
    const languageMap: Record<string, string> = {
      '.go': 'go',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
    };
    return languageMap[ext] || 'plaintext';
  }

  /**
   * Get the workspace root path
   */
  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  /**
   * Clear all tracking data (but not the actual files)
   */
  clear(): void {
    this.fileVersions.clear();
    this.fileLanguages.clear();
  }

  /**
   * Get file count (number of tracked files)
   */
  getFileCount(): number {
    return this.fileVersions.size;
  }
}
