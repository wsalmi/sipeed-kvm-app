/// <reference types="vite/client" />
import { KvmApi } from '../main/preload';

declare global {
  interface Window {
    kvmApi: KvmApi;
  }
}
