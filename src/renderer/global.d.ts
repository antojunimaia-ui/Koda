import type { KodaApi } from '../shared/ipc'

declare global {
  interface Window {
    marked?: any;
    hljs?: any;
    // Tipado pelo contrato compartilhado (src/shared/ipc.ts) — fonte única de verdade
    koda: KodaApi
  }
}

declare module 'ansi-to-html';
declare module 'discord-rpc';
declare module '*.css';
declare module '*.scss';
declare module '*.sass';
declare module '*.less';
declare module '*.svg';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.webp';
