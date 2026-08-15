/**
 * Minimal ambient types for the File System Access API surface this tool
 * uses. TypeScript's bundled DOM lib does not ship these (the API is not on
 * the standards track in every browser) — scoped to this one internal
 * tool rather than widening @types/web or adding a whole package for three
 * methods.
 */
export {};

declare global {
  interface FileSystemDirectoryHandle {
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  }

  interface FileSystemFileHandle {
    createWritable(): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemWritableFileStream {
    write(data: string): Promise<void>;
    close(): Promise<void>;
  }

  interface Window {
    showDirectoryPicker?(): Promise<FileSystemDirectoryHandle>;
  }
}
