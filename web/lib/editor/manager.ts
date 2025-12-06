import * as monaco from "monaco-editor";

export interface EditorConfig {
  theme?: "vs-dark" | "vs-light";
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
   * Attach to an existing Monaco Editor instance
   */
  attach(editor: monaco.editor.IStandaloneCodeEditor): void {
    this.editor = editor;

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
    // Always use Monaco URI string format for consistency
    const monacoUri = monaco.Uri.parse(uri);
    const normalizedUri = monacoUri.toString();
    
    let fileModel = this.models.get(normalizedUri);

    if (!fileModel) {
      // Check if model already exists in monaco (e.g. from previous session)
      let model = monaco.editor.getModel(monacoUri);
      if (!model) {
        model = monaco.editor.createModel(content, languageId, monacoUri);
      } else {
        model.setValue(content);
        monaco.editor.setModelLanguage(model, languageId);
      }

      fileModel = {
        uri: normalizedUri,
        model,
        languageId,
      };

      this.models.set(normalizedUri, fileModel);
    }

    // Set model to editor
    if (this.editor) {
      this.editor.setModel(fileModel.model);
      this.currentUri = normalizedUri;
    }
  }

  /**
   * Close a file
   */
  closeFile(uri: string): void {
    const normalizedUri = monaco.Uri.parse(uri).toString();
    const fileModel = this.models.get(normalizedUri);
    if (fileModel) {
      fileModel.model.dispose();
      this.models.delete(normalizedUri);

      if (this.currentUri === normalizedUri) {
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
    const normalizedUri = monaco.Uri.parse(uri).toString();
    return this.models.get(normalizedUri)?.model || null;
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
    const normalizedUri = monaco.Uri.parse(uri).toString();
    const fileModel = this.models.get(normalizedUri);
    if (fileModel) {
      fileModel.model.setValue(content);
    }
  }

  /**
   * Get file content
   */
  getFileContent(uri: string): string | null {
    const normalizedUri = monaco.Uri.parse(uri).toString();
    const fileModel = this.models.get(normalizedUri);
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
    this.changeListeners.forEach((listener) => listener(uri, content));
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
  setTheme(theme: "vs-dark" | "vs-light"): void {
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
    this.models.forEach((fileModel) => {
      fileModel.model.dispose();
    });
    this.models.clear();

    // Dispose editor
    if (this.editor) {
      // We don't dispose the editor here because it's managed by React component
      this.editor = null;
    }

    this.changeListeners = [];
  }
}
