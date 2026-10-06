import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CountdownTicker,
  computeRemaining,
  clampRemaining,
} from "../src/index.js";

// All timestamps below are plain integer "ms since epoch" stand-ins; the
// library never compares to the wall clock, so any deterministic values work.

const T0 = 1_700_000_000_000; // arbitrary anchor
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("computeRemaining", () => {
  it("decomposes a positive duration into days/hours/minutes/seconds/ms", () => {
    // 1 day, 2 hours, 3 minutes, 4 seconds, 5 ms
    const r = computeRemaining(DAY + 2 * HOUR + 3 * MINUTE + 4 * SECOND + 5);
    assert.deepEqual(r, {
      totalMs: DAY + 2 * HOUR + 3 * MINUTE + 4 * SECOND + 5,
      days: 1,
      hours: 2,
      minutes: 3,
      seconds: 4,
      ms: 5,
      done: false,
    });
  });

  it("handles exactly zero", () => {
    const r = computeRemaining(0);
    assert.equal(r.totalMs, 0);
    assert.equal(r.days, 0);
    assert.equal(r.hours, 0);
    assert.equal(r.minutes, 0);
    assert.equal(r.seconds, 0);
    assert.equal(r.ms, 0);
    assert.equal(r.done, true);
  });

  it("rolls over 1000ms into a whole second", () => {
    const r = computeRemaining(1000);
    assert.equal(r.seconds, 1);
    assert.equal(r.ms, 0);
    assert.equal(r.done, false);
  });

  it("rolls 60 seconds into a minute", () => {
    const r = computeRemaining(60 * 1000);
    assert.equal(r.minutes, 1);
    assert.equal(r.seconds, 0);
  });

  it("rolls 24 hours into a day", () => {
    const r = computeRemaining(24 * 60 * 60 * 1000);
    assert.equal(r.days, 1);
    assert.equal(r.hours, 0);
  });

  it("treats negative durations as done with signed totalMs preserved", () => {
    const r = computeRemaining(-3 * SECOND);
    assert.equal(r.totalMs, -3 * SECOND);
    assert.equal(r.days, 0);
    assert.equal(r.seconds, 0);
    assert.equal(r.done, true);
  });

  it("rejects non-finite durations", () => {
    assert.throws(
      () => computeRemaining(Infinity),
      RangeError,
    );
    assert.throws(
      () => computeRemaining(NaN),
      RangeError,
    );
  });
});

describe("clampRemaining", () => {
  it("behaves like computeRemaining for non-negative durations", () => {
    const a = computeRemaining(5 * SECOND);
    const b = clampRemaining(5 * SECOND);
    assert.deepEqual(a, b);
  });

  it("floors totalMs at zero for past deadlines", () => {
    const r = clampRemaining(-2500);
    assert.equal(r.totalMs, 0);
    assert.equal(r.done, true);
    assert.equal(r.seconds, 0);
  });

  it("does not mutate the raw computeRemaining output", () => {
    const raw = computeRemaining(-100);
    assert.equal(raw.totalMs, -100);
    clampRemaining(-100); // should leave raw semantics intact
    assert.equal(raw.totalMs, -100);
  });
});

describe("CountdownTicker", () => {
  it("counts down against a fake clock", () => {
    let clock = T0;
    const ticker = new CountdownTicker(T0 + 10 * SECOND, () => clock);

    const first = ticker.tick();
    assert.equal(first.seconds, 10);
    assert.equal(first.done, false);

    clock += 3 * SECOND;
    const second = ticker.tick();
    assert.equal(second.seconds, 7);
    assert.equal(second.done, false);
  });

  it("reports done exactly when the clock reaches the deadline", () => {
    let clock = T0;
    const ticker = new CountdownTicker(T0 + 5 * SECOND, () => clock);
    clock += 5 * SECOND;
    const r = ticker.tick();
    assert.equal(r.totalMs, 0);
    assert.equal(r.done, true);
  });

  it("stays done as the clock advances past the deadline", () => {
    let clock = T0;
    const ticker = new CountdownTicker(T0 + 5 * SECOND, () => clock);
    clock += 5 * SECOND + 200;
    const r = ticker.tick();
    assert.equal(r.done, true);
    assert.equal(r.seconds, 0);
    assert.equal(r.ms, 0);
  });

  it("exposes the deadline and honours setDeadline on subsequent ticks", () => {
    let clock = T0;
    const ticker = new CountdownTicker(T0 + 10 * SECOND, () => clock);
    assert.equal(ticker.deadline, T0 + 10 * SECOND);

    ticker.setDeadline(T0 + 30 * SECOND);
    assert.equal(ticker.deadline, T0 + 30 * SECOND);
    const r = ticker.tick();
    assert.equal(r.seconds, 30);
  });

  it("defaults to Date.now when no clock is supplied", () => {
    const future = Date.now() + 5 * SECOND;
    const ticker = new CountdownTicker(future);
    const r = ticker.tick();
    assert.equal(r.done, false);
    assert.ok(r.totalMs > 0 && r.totalMs <= 5 * SECOND);
  });

  it("rejects a non-finite deadline", () => {
    assert.throws(() => new CountdownTicker(NaN), RangeError);
    assert.throws(() => new CountdownTicker(Infinity), RangeError);
  });

  it("rejects a non-function clock", () => {
    assert.throws(
      () => new CountdownTicker(T0 + 1000, "not a function"),
      TypeError,
    );
  });

  it("rejects when setDeadline receives a non-finite value", () => {
    const t = new CountdownTicker(T0 + 1000, () => T0);
    assert.throws(() => t.setDeadline(NaN), RangeError);
    assert.equal(t.deadline, T0 + 1000); // unchanged
  });

  it("throws if the clock returns a non-finite value", () => {
    const t = new CountdownTicker(T0 + 1000, () => NaN);
    assert.throws(() => t.tick(), RangeError);
  });
});
