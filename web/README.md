# Online Editor Frontend

This is the Next.js frontend for the Online Editor.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI**: Tailwind CSS, Lucide React
- **State Management**: Zustand
- **Editor**: Monaco Editor (via `@monaco-editor/react`)
- **LSP**: Custom LSP Client

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Run the development server:
   ```bash
   pnpm dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) with your browser.

## Project Structure

- `app/`: Next.js App Router pages and layouts.
- `components/`: React components (Editor, FileTree, StatusBar).
- `lib/`: Core logic and utilities.
  - `editor/`: Editor manager logic.
  - `lsp/`: LSP client and host logic.
  - `transport/`: WebSocket transport.
  - `store.ts`: Zustand store.
