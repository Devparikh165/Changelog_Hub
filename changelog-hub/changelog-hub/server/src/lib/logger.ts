/* Minimal leveled logger. Quiet during tests so test output stays readable. */
const silent = process.env.NODE_ENV === "test";
const stamp = () => new Date().toISOString().slice(11, 19);

export const logger = {
  info: (...args: unknown[]) => !silent && console.log(`[${stamp()}]`, ...args),
  warn: (...args: unknown[]) => !silent && console.warn(`[${stamp()}] WARN`, ...args),
  error: (...args: unknown[]) => console.error(`[${stamp()}] ERROR`, ...args),
};
