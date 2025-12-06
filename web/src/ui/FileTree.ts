export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export class FileTree {
  private container: HTMLElement;
  private files: FileTreeNode[] = [];
  private onFileSelectCallback?: (path: string) => void;
  private onFileCreateCallback?: (path: string, type: 'file' | 'directory') => void;
  private onFileDeleteCallback?: (path: string) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  /**
   * Set files to display
   */
  setFiles(files: FileTreeNode[]): void {
    this.files = files;
    this.render();
  }

  /**
   * Add a file to the tree
   */
  addFile(file: FileTreeNode): void {
    this.files.push(file);
    this.render();
  }

  /**
   * Remove a file from the tree
   */
  removeFile(path: string): void {
    this.files = this.files.filter(f => f.path !== path);
    this.render();
  }

  /**
   * Register file select callback
   */
  onFileSelect(callback: (path: string) => void): void {
    this.onFileSelectCallback = callback;
  }

  /**
   * Register file create callback
   */
  onFileCreate(callback: (path: string, type: 'file' | 'directory') => void): void {
    this.onFileCreateCallback = callback;
  }

  /**
   * Register file delete callback
   */
  onFileDelete(callback: (path: string) => void): void {
    this.onFileDeleteCallback = callback;
  }

  /**
   * Render the file tree
   */
  private render(): void {
    this.container.innerHTML = '';

    // Create toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'file-tree-toolbar';
    toolbar.style.cssText = `
      padding: 8px;
      border-bottom: 1px solid #333;
      display: flex;
      gap: 8px;
    `;

    const newFileBtn = this.createButton('+ File', () => this.createNewFile());
    const newFolderBtn = this.createButton('+ Folder', () => this.createNewFolder());

    toolbar.appendChild(newFileBtn);
    toolbar.appendChild(newFolderBtn);
    this.container.appendChild(toolbar);

    // Create file list
    const fileList = document.createElement('div');
    fileList.className = 'file-tree-list';
    fileList.style.cssText = `
      padding: 8px;
      overflow-y: auto;
      height: calc(100% - 40px);
    `;

    this.files.forEach(file => {
      const fileElement = this.renderFileNode(file, 0);
      fileList.appendChild(fileElement);
    });

    this.container.appendChild(fileList);
  }

  /**
   * Render a file node
   */
  private renderFileNode(node: FileTreeNode, depth: number): HTMLElement {
    const element = document.createElement('div');
    element.className = 'file-tree-node';
    element.style.cssText = `
      padding: 4px 8px;
      padding-left: ${depth * 16 + 8}px;
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      gap: 4px;
    `;

    // Icon
    const icon = document.createElement('span');
    icon.textContent = node.type === 'directory' ? '📁' : this.getFileIcon(node.name);
    element.appendChild(icon);

    // Name
    const name = document.createElement('span');
    name.textContent = node.name;
    element.appendChild(name);

    // Hover effect
    element.addEventListener('mouseenter', () => {
      element.style.backgroundColor = '#2a2a2a';
    });

    element.addEventListener('mouseleave', () => {
      element.style.backgroundColor = 'transparent';
    });

    // Click handler
    if (node.type === 'file') {
      element.addEventListener('click', () => {
        if (this.onFileSelectCallback) {
          this.onFileSelectCallback(node.path);
        }
      });
    }

    // Render children
    if (node.children && node.children.length > 0) {
      const childrenContainer = document.createElement('div');
      node.children.forEach(child => {
        const childElement = this.renderFileNode(child, depth + 1);
        childrenContainer.appendChild(childElement);
      });
      element.appendChild(childrenContainer);
    }

    return element;
  }

  /**
   * Get file icon based on extension
   */
  private getFileIcon(filename: string): string {
    if (filename.endsWith('.go')) return '🔵';
    if (filename.endsWith('.ts')) return '🔷';
    if (filename.endsWith('.js')) return '🟨';
    if (filename.endsWith('.json')) return '📋';
    if (filename.endsWith('.md')) return '📝';
    return '📄';
  }

  /**
   * Create a button
   */
  private createButton(text: string, onClick: () => void): HTMLElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      padding: 4px 8px;
      background: #0e639c;
      color: white;
      border: none;
      border-radius: 2px;
      cursor: pointer;
      font-size: 12px;
    `;

    button.addEventListener('click', onClick);

    button.addEventListener('mouseenter', () => {
      button.style.background = '#1177bb';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#0e639c';
    });

    return button;
  }

  /**
   * Create new file
   */
  private createNewFile(): void {
    const filename = prompt('Enter file name:');
    if (filename && this.onFileCreateCallback) {
      const path = `/workspace/${filename}`;
      this.onFileCreateCallback(path, 'file');
    }
  }

  /**
   * Create new folder
   */
  private createNewFolder(): void {
    const foldername = prompt('Enter folder name:');
    if (foldername && this.onFileCreateCallback) {
      const path = `/workspace/${foldername}`;
      this.onFileCreateCallback(path, 'directory');
    }
  }
}
