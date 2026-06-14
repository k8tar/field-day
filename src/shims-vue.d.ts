/* eslint-disable */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

// Global type declarations
declare global {
  interface Window {
    backendApi: import('./services/backendApiService').BackendApiService;
    restartBackendService: () => Promise<boolean>;
    Electron?: {
      ipcRenderer: {
        send(channel: string, ...args: unknown[]): void;
        invoke(channel: string, ...args: unknown[]): Promise<unknown>;
        on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void;
      };
    };
  }
}

export {}
