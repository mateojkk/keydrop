declare module 'process' {
  const process: { env: Record<string, string | undefined>; nextTick: (callback: (...args: unknown[]) => void, ...args: unknown[]) => void };
  export default process;
}
