import { create } from "zustand";

interface StreamingMessageStore {
  displayed: string;
  appendDelta: (chunk: string) => void;
  reset: () => void;
}

export const useStreamingMessageStore = create<StreamingMessageStore>(
  (set) => ({
    displayed: "",
    appendDelta: (chunk: string) => {
      if (!chunk) return;
      set((state) => ({ displayed: state.displayed + chunk }));
    },
    reset: () => set({ displayed: "" }),
  }),
);
