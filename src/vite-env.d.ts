/// <reference types="vite/client" />

interface Navigator {
  bluetooth?: {
    requestDevice(options: any): Promise<any>;
  };
}
