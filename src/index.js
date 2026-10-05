/**
 * Countdown Ticker State — ESM entry point.
 *
 * The library is split so that `core.js` holds the pure calculation logic
 * (no side effects, trivially testable) while this file owns the thin
 * instance wrapper that callers actually use. Keeping them separate means
 * the core can be exercised without touching the class at all.
 */
export { CountdownTicker } from "./core.js";
export { computeRemaining } from "./core.js";
export { clampRemaining } from "./core.js";
