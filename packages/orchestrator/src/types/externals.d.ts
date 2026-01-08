declare module 'js-yaml' {
  export function load(input: string): unknown;
}

declare module 'pixelmatch' {
  export default function pixelmatch(
    img1: Uint8Array,
    img2: Uint8Array,
    output: Uint8Array | null,
    width: number,
    height: number,
    options?: {
      threshold?: number;
      includeAA?: boolean;
      alpha?: number;
      aaColor?: [number, number, number];
      diffColor?: [number, number, number];
      diffColorAlt?: [number, number, number];
    }
  ): number;
}

declare module 'pngjs' {
  export class PNG {
    width: number;
    height: number;
    data: Uint8Array;
    constructor(options?: { width?: number; height?: number });
    static sync: {
      read(buffer: Buffer | Uint8Array): PNG;
      write(png: PNG): Buffer;
    };
  }
}
