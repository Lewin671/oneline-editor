import * as fs from 'fs/promises';
import * as path from 'path';

export interface FileEntry {
  uri: string;
  content: string;
  version: number;
  languageId: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
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
   * Create a new directory in the real file system
   */
  async createDirectory(dirPath: string): Promise<void> {
    const fullPath = path.join(this.workspaceRoot, dirPath.replace(/^\//, ''));
    
    // Security check: ensure the resolved path is within workspace
    const resolvedPath = path.resolve(fullPath);
    const resolvedWorkspace = path.resolve(this.workspaceRoot);
    if (!resolvedPath.startsWith(resolvedWorkspace)) {
      throw new Error(`Access denied: path outside workspace`);
    }
    
    await fs.mkdir(resolvedPath, { recursive: true });
  }

  /**
   * Delete a file or directory (recursively) from the file system
   */
  async deletePath(targetPath: string): Promise<void> {
    const fullPath = path.join(this.workspaceRoot, targetPath.replace(/^\//, ''));
    
    // Security check: ensure the resolved path is within workspace
    const resolvedPath = path.resolve(fullPath);
    const resolvedWorkspace = path.resolve(this.workspaceRoot);
    if (!resolvedPath.startsWith(resolvedWorkspace)) {
      throw new Error(`Access denied: path outside workspace`);
    }
    
    try {
      const stats = await fs.stat(resolvedPath);
      if (stats.isDirectory()) {
        await fs.rm(resolvedPath, { recursive: true, force: true });
      } else {
        await fs.unlink(resolvedPath);
        // Clean up tracking data
        const uri = this.pathToUri(resolvedPath);
        this.fileVersions.delete(uri);
        this.fileLanguages.delete(uri);
      }
    } catch (error) {
      throw new Error(`Failed to delete: ${targetPath}`);
    }
  }

  /**
   * Rename a file or directory in the file system
   */
  async renamePath(oldPath: string, newPath: string): Promise<void> {
    const oldFullPath = path.join(this.workspaceRoot, oldPath.replace(/^\//, ''));
    const newFullPath = path.join(this.workspaceRoot, newPath.replace(/^\//, ''));
    
    // Security check: ensure both paths are within workspace
    const resolvedOldPath = path.resolve(oldFullPath);
    const resolvedNewPath = path.resolve(newFullPath);
    const resolvedWorkspace = path.resolve(this.workspaceRoot);
    
    if (!resolvedOldPath.startsWith(resolvedWorkspace) || !resolvedNewPath.startsWith(resolvedWorkspace)) {
      throw new Error(`Access denied: path outside workspace`);
    }
    
    // Ensure target directory exists
    const newDir = path.dirname(newFullPath);
    await fs.mkdir(newDir, { recursive: true });
    
    // Rename the file/directory
    await fs.rename(resolvedOldPath, resolvedNewPath);
    
    // Update tracking data for files
    const oldUri = this.pathToUri(resolvedOldPath);
    const newUri = this.pathToUri(resolvedNewPath);
    
    if (this.fileVersions.has(oldUri)) {
      const version = this.fileVersions.get(oldUri);
      const languageId = this.fileLanguages.get(oldUri);
      
      this.fileVersions.delete(oldUri);
      this.fileLanguages.delete(oldUri);
      
      if (version !== undefined) {
        this.fileVersions.set(newUri, version);
      }
      if (languageId !== undefined) {
        this.fileLanguages.set(newUri, languageId);
      }
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
   * List files and directories in the workspace as a tree structure
   * Includes empty directories
   */
  async listFileTree(relativePath: string = '/'): Promise<FileTreeNode[]> {
    const basePath = relativePath === '/' ? this.workspaceRoot : path.join(this.workspaceRoot, relativePath);
    
    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });
      const nodes: FileTreeNode[] = [];

      for (const entry of entries) {
        // Skip hidden files/folders (starting with .)
        if (entry.name.startsWith('.')) {
          continue;
        }

        const fullPath = path.join(basePath, entry.name);
        const relativeToWorkspace = path.relative(this.workspaceRoot, fullPath);
        const nodePath = '/' + relativeToWorkspace.replace(/\\/g, '/');

        if (entry.isDirectory()) {
          // Recursively get children
          const children = await this.listFileTree(relativeToWorkspace);
          nodes.push({
            name: entry.name,
            path: nodePath,
            type: 'directory',
            children: children.length > 0 ? children : [] // Include empty array for empty directories
          });
        } else if (entry.isFile()) {
          nodes.push({
            name: entry.name,
            path: nodePath,
            type: 'file'
          });
        }
      }

      // Sort: directories first, then files, both alphabetically
      return nodes.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === 'directory' ? -1 : 1;
      });
    } catch (error) {
      // If directory doesn't exist or can't be read, return empty array
      console.error(`Error listing files in ${basePath}:`, error);
      return [];
    }
  }

  /**
   * Read file content by path (not URI)
   */
  async readFileContent(filePath: string): Promise<string> {
    const fullPath = path.join(this.workspaceRoot, filePath.replace(/^\//, ''));
    
    // Security check: ensure the resolved path is within workspace
    const resolvedPath = path.resolve(fullPath);
    const resolvedWorkspace = path.resolve(this.workspaceRoot);
    if (!resolvedPath.startsWith(resolvedWorkspace)) {
      throw new Error(`Access denied: path outside workspace`);
    }
    
    try {
      return await fs.readFile(resolvedPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file: ${filePath}`);
    }
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
