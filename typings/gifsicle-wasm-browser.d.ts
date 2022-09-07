declare module 'gifsicle-wasm-browser' {
  interface GifsicleOptions {
    input: {
      file: string | File | Blob | ArrayBuffer;
      name: string;
    }[];
    command: string[]
  }

  interface Gifsicle {
    run: (params: GifsicleOptions) => Promise<File[]>
  }

  const gifsicle: Gifsicle
  export default gifsicle
}
