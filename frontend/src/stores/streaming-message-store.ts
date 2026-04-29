import { create } from "zustand";

interface StreamingMessageState {
  // Full text accumulated from deltas. Append-only until reset.
  target: string;
  // Slice of `target` currently visible. Catches up via the rAF drainer.
  displayed: string;
}

interface StreamingMessageActions {
  appendDelta: (chunk: string) => void;
  reset: () => void;
}

type StreamingMessageStore = StreamingMessageState & StreamingMessageActions;

const initialState: StreamingMessageState = {
  target: "",
  displayed: "",
};

// Steady-state reveal speed. ~250wpm reading speed ≈ 33 chars/sec, so this
// is a touch slower than "comfortable read" — feels like the model is
// thinking, not racing.
const CHARS_PER_SECOND = 28;
// If the buffer falls more than this many chars behind, bypass the time
// gate and catch up at lag / DRAIN_DIVISOR per frame so we don't drift.
const BACKLOG_THRESHOLD = 80;
const DRAIN_DIVISOR = 20;

export const useStreamingMessageStore = create<StreamingMessageStore>(
  (set, get) => {
    let rafId: number | null = null;
    let lastTickTime: number | null = null;
    // Fractional carryover: at 60fps and 28 chars/sec, each frame is worth
    // ~0.47 chars. We accumulate the fractional part across frames so the
    // average rate matches CHARS_PER_SECOND instead of clamping to 60/sec.
    let pendingChars = 0;

    const tick = (now: number) => {
      rafId = null;
      const { target, displayed } = get();
      const lag = target.length - displayed.length;
      if (lag <= 0) {
        lastTickTime = null;
        pendingChars = 0;
        return;
      }

      const elapsedMs = lastTickTime === null ? 0 : now - lastTickTime;
      lastTickTime = now;
      pendingChars += (elapsedMs * CHARS_PER_SECOND) / 1000;

      let charsToAdd = Math.floor(pendingChars);
      pendingChars -= charsToAdd;

      // Catch-up branch: if we're way behind, drain proportionally to lag
      // so the bubble never trails the model by more than a moment.
      if (lag > BACKLOG_THRESHOLD) {
        charsToAdd = Math.max(charsToAdd, Math.ceil(lag / DRAIN_DIVISOR));
        pendingChars = 0;
      }

      if (charsToAdd > 0) {
        const next = target.slice(0, displayed.length + charsToAdd);
        set({ displayed: next });
        if (next.length >= target.length) {
          lastTickTime = null;
          pendingChars = 0;
          return;
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    const ensureTicking = () => {
      if (rafId !== null) return;
      if (typeof requestAnimationFrame === "undefined") return;
      rafId = requestAnimationFrame(tick);
    };

    const cancelTick = () => {
      if (rafId === null) return;
      cancelAnimationFrame(rafId);
      rafId = null;
      lastTickTime = null;
      pendingChars = 0;
    };

    return {
      ...initialState,
      appendDelta: (chunk: string) => {
        if (!chunk) return;
        set((state) => ({ target: state.target + chunk }));
        ensureTicking();
      },
      reset: () => {
        cancelTick();
        set(() => ({ ...initialState }));
      },
    };
  },
);
