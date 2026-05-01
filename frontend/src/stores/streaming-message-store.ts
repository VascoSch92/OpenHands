import { create } from "zustand";

interface StreamingMessageStore {
  displayed: string;
  appendDelta: (chunk: string) => void;
  // sealMs > 0 ignores any deltas that arrive within the next sealMs ms.
  // Used after an assistant MessageEvent to discard wire-stragglers from the
  // just-completed generation without locking out the next stream cycle.
  reset: (sealMs?: number) => void;
}

// Network coalesce window. Tokens piled up here before they're handed to the
// typewriter, so a "H e l l o" burst lands as a single chunk instead of five
// jittery updates.
const COALESCE_MS = 100;
const COALESCE_TOKEN_LIMIT = 8;

// Typewriter reveal speed. ~60 chars/sec ≈ 360 wpm — fast enough to keep up
// with most LLM token rates while feeling smooth instead of twitchy.
const CHARS_PER_SECOND = 60;
// If the typewriter trails the network buffer by more than this, drain at
// lag / DRAIN_DIVISOR per frame so the bubble never falls visibly behind.
const BACKLOG_THRESHOLD = 200;
const DRAIN_DIVISOR = 8;

const reducedMotionQuery =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

const prefersReducedMotion = () => reducedMotionQuery?.matches ?? false;
const hasRaf = typeof requestAnimationFrame !== "undefined";

export const useStreamingMessageStore = create<StreamingMessageStore>(
  (set, get) => {
    let target = "";
    let pendingChunk = "";
    let pendingTokenCount = 0;
    let coalesceTimer: ReturnType<typeof setTimeout> | null = null;
    let rafId: number | null = null;
    let lastTickMs: number | null = null;
    // Fractional carryover so the average reveal rate matches CHARS_PER_SECOND
    // instead of being clamped to the (frame-rate, 1) lower bound.
    let charCarry = 0;
    // performance.now() timestamp until which appendDelta is a no-op.
    // Set by reset(sealMs) to absorb stragglers after a terminal MessageEvent.
    let sealedUntil = 0;
    const nowMs = () =>
      typeof performance !== "undefined" ? performance.now() : Date.now();

    const cancelTypewriter = () => {
      if (rafId !== null && hasRaf) {
        cancelAnimationFrame(rafId);
      }
      rafId = null;
      lastTickMs = null;
      charCarry = 0;
    };

    const tick = (now: number) => {
      rafId = null;
      const { displayed } = get();
      const lag = target.length - displayed.length;
      if (lag <= 0) {
        lastTickMs = null;
        charCarry = 0;
        return;
      }

      const elapsedMs = lastTickMs === null ? 0 : now - lastTickMs;
      lastTickMs = now;
      charCarry += (elapsedMs * CHARS_PER_SECOND) / 1000;
      let charsToAdd = Math.floor(charCarry);
      charCarry -= charsToAdd;

      if (lag > BACKLOG_THRESHOLD) {
        charsToAdd = Math.max(charsToAdd, Math.ceil(lag / DRAIN_DIVISOR));
        charCarry = 0;
      }

      if (charsToAdd > 0) {
        const next = target.slice(0, displayed.length + charsToAdd);
        set({ displayed: next });
        if (next.length >= target.length) {
          lastTickMs = null;
          charCarry = 0;
          return;
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    const startTypewriter = () => {
      if (!hasRaf) {
        set({ displayed: target });
        return;
      }
      if (rafId === null) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const flushCoalesced = () => {
      if (coalesceTimer !== null) {
        clearTimeout(coalesceTimer);
        coalesceTimer = null;
      }
      if (!pendingChunk) return;
      target += pendingChunk;
      pendingChunk = "";
      pendingTokenCount = 0;

      if (prefersReducedMotion()) {
        cancelTypewriter();
        set({ displayed: target });
      } else {
        startTypewriter();
      }
    };

    return {
      displayed: "",
      appendDelta: (chunk: string) => {
        if (!chunk) return;
        if (sealedUntil > 0 && nowMs() < sealedUntil) return;
        const isFirstByte = target === "" && pendingChunk === "";
        pendingChunk += chunk;
        pendingTokenCount += 1;

        // Flush the first delta of a fresh stream immediately so the user sees
        // text instantly instead of after the 100 ms coalesce window.
        if (isFirstByte || pendingTokenCount >= COALESCE_TOKEN_LIMIT) {
          flushCoalesced();
          return;
        }
        if (coalesceTimer === null) {
          coalesceTimer = setTimeout(flushCoalesced, COALESCE_MS);
        }
      },
      reset: (sealMs = 0) => {
        if (coalesceTimer !== null) {
          clearTimeout(coalesceTimer);
          coalesceTimer = null;
        }
        cancelTypewriter();
        target = "";
        pendingChunk = "";
        pendingTokenCount = 0;
        sealedUntil = sealMs > 0 ? nowMs() + sealMs : 0;
        set({ displayed: "" });
      },
    };
  },
);
