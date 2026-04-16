import { create } from "zustand";

interface ProfilesCommandStore {
  visibleIn: Set<string>;
  show: (conversationId: string) => void;
  hide: (conversationId: string) => void;
}

export const useProfilesCommandStore = create<ProfilesCommandStore>((set) => ({
  visibleIn: new Set(),
  show: (id) => set((s) => ({ visibleIn: new Set(s.visibleIn).add(id) })),
  hide: (id) =>
    set((s) => {
      const next = new Set(s.visibleIn);
      next.delete(id);
      return { visibleIn: next };
    }),
}));
