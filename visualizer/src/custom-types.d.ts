declare module 'super-three' {
    export * from 'three';
  }

declare module '*.frag' {
const value: string;
export default value;
}

declare module '*.vert' {
    const value: string;
    export default value;
}
