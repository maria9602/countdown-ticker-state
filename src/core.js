/**
 * Countdown Ticker State — core logic.
 *
 * The single design decision worth calling out: we compute the remaining
 * duration from a *supplied* clock function, never from `Date.now()` inside
 * the module. That makes every behaviour deterministic and lets tests drive
 * the clock without monkey-patching globals. Callers who don't care inject
 * `Date.now`; that's the default on the class wrapper.
 */

/**
 * The decomposed time-remaining value. All fields are non-negative
 * integers. `done` mirrors `totalMs <= 0` so callers can render a
 * finalised state without re-checking the raw duration.
 *
 * @typedef {Object} Remaining
 * @property {number} totalMs   Whole-millisecond distance to the deadline.
 * @property {number} days      Whole days left (floor).
 * @property {number} hours     0–23 whole hours left.
 * @property {number} minutes   0–59 whole minutes left.
 * @property {number} seconds   0–59 whole seconds left.
 * @property {number} ms        0–999 residual milliseconds.
 * @property {boolean} done     True once the deadline has been reached or passed.
 */

/**
 * Decompose a raw millisecond duration into the day/hour/minute/second/ms
 * fields a ticker renders.
 *
 * Negative durations (deadline already in the past) collapse to all-zero
 * fields with `totalMs <= 0` and `done === true`. We deliberately keep the
 * *signed* `totalMs` rather than clamping to zero at this layer: callers
 * can distinguish "exactly now" (0) from "3s overdue" (−3000) if they wish.
 * The {@link clampRemaining} helper exists for renderers that want a hard
 * zero floor instead.
 *
 * @param {number} remainingMs - Milliseconds until the deadline; may be negative.
 * @returns {Remaining}
 */
export function computeRemaining(remainingMs) {
  if (!Number.isFinite(remainingMs)) {
    throw new RangeError(
      `computeRemaining: duration must be finite, got ${remainingMs}`,
    );
  }

  // Truncate toward zero so the residual fields are always non-negative.
  const truncated = remainingMs < 0 ? Math.ceil(remainingMs) : remainingMs;

  if (truncated <= 0) {
    return {
      totalMs: remainingMs,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      ms: 0,
      done: true,
    };
  }

  let ms = Math.floor(truncated % 1000);
  let wholeSeconds = Math.floor(truncated / 1000);
  const seconds = wholeSeconds % 60;
  wholeSeconds = (wholeSeconds - seconds) / 60;
  const minutes = wholeSeconds % 60;
  wholeSeconds = (wholeSeconds - minutes) / 60;
  const hours = wholeSeconds % 24;
  const days = (wholeSeconds - hours) / 24;

  return {
    totalMs: truncated,
    days,
    hours,
    minutes,
    seconds,
    ms,
    done: false,
  };
}

/**
 * Renderer-friendly variant: identical to {@link computeRemaining} but with
 * `totalMs` floored at zero so a 3-second-overdue deadline reads as `0` rather
 * than `−3000`. Use this when you're driving a display; use the raw
 * `computeRemaining` when you need to know how far past the deadline you are.
 *
 * @param {number} remainingMs - Milliseconds until the deadline; may be negative.
 * @returns {Remaining}
 */
export function clampRemaining(remainingMs) {
  const r = computeRemaining(remainingMs);
  if (r.totalMs < 0) {
    return { ...r, totalMs: 0 };
  }
  return r;
}

/**
 * A small stateful wrapper around {@link computeRemaining}.
 *
 * It remembers a deadline and a clock function and recomputes the remaining
 * breakdown on demand via {@link tick}. Mutating the deadline through
 * {@link setDeadline} does not retroactively change past snapshots; it simply
 * takes effect on the next {@link tick} call. This mirrors how a real
 * countdown UI behaves: the displayed value is always derived from the
 * current clock reading.
 */
export class CountdownTicker {
  #deadline;
  #now;

  /**
   * @param {number} deadline - Absolute timestamp (ms since epoch) to count down to.
   * @param {() => number} [now] - Clock function returning ms since epoch. Defaults to `Date.now`; tests pass a fake.
   */
  constructor(deadline, now = Date.now) {
    if (!Number.isFinite(deadline)) {
      throw new RangeError(
        `CountdownTicker: deadline must be finite, got ${deadline}`,
      );
    }
    if (typeof now !== "function") {
      throw new TypeError("CountdownTicker: `now` must be a function");
    }
    this.#deadline = deadline;
    this.#now = now;
  }

  /** Absolute deadline this ticker counts down to. */
  get deadline() {
    return this.#deadline;
  }

  /** Replace the deadline. Affects subsequent {@link tick} calls only. */
  setDeadline(deadline) {
    if (!Number.isFinite(deadline)) {
      throw new RangeError(
        `setDeadline: deadline must be finite, got ${deadline}`,
      );
    }
    this.#deadline = deadline;
  }

  /**
   * Compute the current remaining breakdown against the registered clock.
   * @returns {Remaining}
   */
  tick() {
    const now = this.#now();
    if (!Number.isFinite(now)) {
      throw new RangeError(
        `CountdownTicker: clock returned non-finite value: ${now}`,
      );
    }
    return computeRemaining(this.#deadline - now);
  }
}
