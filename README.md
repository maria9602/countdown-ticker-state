# Countdown Ticker State

Maintains the state of a live countdown timer: given an absolute deadline timestamp and a clock function, it decomposes the remaining time into days, hours, minutes, seconds, and milliseconds.

## Usage

```js
import { CountdownTicker, computeRemaining, clampRemaining } from "countdown-ticker-state";

const deadline = Date.now() + 10_000; // 10 seconds from now
const ticker = new CountdownTicker(deadline);

const r = ticker.tick();
// { totalMs, days, hours, minutes, seconds, ms, done }

// Drive the clock yourself for tests or server-side determinism:
let fakeNow = 1_700_000_000_000;
const controlled = new CountdownTicker(fakeNow + 60_000, () => fakeNow);
controlled.tick(); // 60 seconds remaining
fakeNow += 30_000;
controlled.tick(); // 30 seconds remaining

// Pure helpers if you already have a duration:
computeRemaining(65_000);  // { days:0, hours:0, minutes:1, seconds:5, ms:0, ... }
clampRemaining(-3_000);    // totalMs floored to 0, done: true
```

Exports: `CountdownTicker`, `computeRemaining`, `clampRemaining`.

## Why this exists

A countdown UI needs to recompute the days/hours/minutes/seconds breakdown on every animation frame, and it needs to do it without touching `Date.now()` directly — otherwise tests become racy and server-rendered snapshots are non-deterministic. This library takes a `now` function as a constructor argument so the clock is always explicit. `Date.now` is the default for real applications; tests pass a fake.

The split between `computeRemaining` (pure math) and `CountdownTicker` (the thin stateful wrapper) is deliberate: you can decompose any duration without instantiating a ticker.

## Awkward edge: past deadlines

When the deadline has already passed, the raw `totalMs` returned by `computeRemaining` is **negative** and signed (e.g. `-3000` for 3 seconds overdue), while every decomposed field is zero and `done` is `true`. This lets a caller distinguish "exactly now" from "3s late". If you're driving a display and want a hard zero floor, use `clampRemaining` instead — it keeps the same fields but floors `totalMs` at zero.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

