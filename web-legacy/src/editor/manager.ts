import * as monaco from 'monaco-editor';

export interface EditorConfig {
  theme?: 'vs-dark' | 'vs-light';
  language?: string;
  automaticLayout?: boolean;
  minimap?: { enabled: boolean };
}

export interface FileModel {
  uri: string;
  model: monaco.editor.ITextModel;
  languageId: string;
}

export class EditorManager {
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private models: Map<string, FileModel> = new Map();
  private currentUri: string | null = null;
  private changeListeners: Array<(uri: string, content: string) => void> = [];

  /**
   * Create and initialize the Monaco Editor
   */
  createEditor(container: HTMLElement, config?: EditorConfig): void {
    const defaultConfig: monaco.editor.IStandaloneEditorConstructionOptions = {
      theme: config?.theme || 'vs-dark',
      automaticLayout: config?.automaticLayout !== false,
      minimap: config?.minimap || { enabled: true },
      fontSize: 14,
      lineNumbers: 'on',
      roundedSelection: false,
      scrollBeyondLastLine: false,
      readOnly: false,
      cursorStyle: 'line',
      wordWrap: 'off'
    };

    this.editor = monaco.editor.create(container, defaultConfig);

    // Listen to content changes
    this.editor.onDidChangeModelContent(() => {
      if (this.currentUri && this.editor) {
        const model = this.editor.getModel();
        if (model) {
          const content = model.getValue();
          this.notifyContentChange(this.currentUri, content);
        }
      }
    });
  }

  /**
   * Open a file in the editor
   */
  openFile(uri: string, content: string, languageId: string): void {
    let fileModel = this.models.get(uri);

    if (!fileModel) {
      // Create new model
      const monacoUri = monaco.Uri.parse(uri);
      const model = monaco.editor.createModel(content, languageId, monacoUri);

      fileModel = {
        uri,
        model,
        languageId
      };

      this.models.set(uri, fileModel);
    }

    // Set model to editor
    if (this.editor) {
      this.editor.setModel(fileModel.model);
      this.currentUri = uri;
    }
  }

  /**
   * Close a file
   */
  closeFile(uri: string): void {
    const fileModel = this.models.get(uri);
    if (fileModel) {
      fileModel.model.dispose();
      this.models.delete(uri);

      if (this.currentUri === uri) {
        this.currentUri = null;
        if (this.editor) {
          this.editor.setModel(null);
        }
      }
    }
  }

  /**
   * Get current model
   */
  getCurrentModel(): monaco.editor.ITextModel | null {
    return this.editor?.getModel() || null;
  }

  /**
   * Get current URI
   */
  getCurrentUri(): string | null {
    return this.currentUri;
  }

  /**
   * Get model by URI
   */
  getModel(uri: string): monaco.editor.ITextModel | null {
    return this.models.get(uri)?.model || null;
  }

  /**
   * Get all open files
   */
  getOpenFiles(): string[] {
    return Array.from(this.models.keys());
  }

  /**
   * Update file content
   */
  updateFileContent(uri: string, content: string): void {
    const fileModel = this.models.get(uri);
    if (fileModel) {
      fileModel.model.setValue(content);
    }
  }

  /**
   * Get file content
   */
  getFileContent(uri: string): string | null {
    const fileModel = this.models.get(uri);
    return fileModel ? fileModel.model.getValue() : null;
  }

  /**
   * Register content change listener
   */
  onContentChange(listener: (uri: string, content: string) => void): void {
    this.changeListeners.push(listener);
  }

  /**
   * Notify content change
   */
  private notifyContentChange(uri: string, content: string): void {
    this.changeListeners.forEach(listener => listener(uri, content));
  }

  /**
   * Get editor instance
   */
  getEditor(): monaco.editor.IStandaloneCodeEditor | null {
    return this.editor;
  }

  /**
   * Set editor theme
   */
  setTheme(theme: 'vs-dark' | 'vs-light'): void {
    monaco.editor.setTheme(theme);
  }

  /**
   * Focus editor
   */
  focus(): void {
    this.editor?.focus();
  }

  /**
   * Dispose editor and all models
   */
  dispose(): void {
    // Dispose all models
    this.models.forEach(fileModel => {
      fileModel.model.dispose();
    });
    this.models.clear();

    // Dispose editor
    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
    }

    this.changeListeners = [];
  }
}
