import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { LlmProfileSummary } from "#/api/settings-service/profiles-service.api";

export interface ModelListEntry {
  id: string;
  profiles: LlmProfileSummary[];
  activeProfile: string | null;
}

interface ModelState {
  entriesByConversation: Record<string, ModelListEntry[]>;
}

interface ModelActions {
  show: (
    conversationId: string,
    profiles: LlmProfileSummary[],
    activeProfile: string | null,
  ) => void;
  dismiss: (conversationId: string, id: string) => void;
}

type ModelStore = ModelState & ModelActions;

const initialState: ModelState = { entriesByConversation: {} };

const updateEntries = (
  state: ModelState,
  conversationId: string,
  updater: (entries: ModelListEntry[]) => ModelListEntry[],
): Pick<ModelState, "entriesByConversation"> => ({
  entriesByConversation: {
    ...state.entriesByConversation,
    [conversationId]: updater(
      state.entriesByConversation[conversationId] ?? [],
    ),
  },
});

export const useModelStore = create<ModelStore>()(
  devtools(
    (set) => ({
      ...initialState,
      show: (conversationId, profiles, activeProfile) =>
        set((s) =>
          updateEntries(s, conversationId, (entries) => [
            ...entries,
            { id: crypto.randomUUID(), profiles, activeProfile },
          ]),
        ),
      dismiss: (conversationId, id) =>
        set((s) =>
          updateEntries(s, conversationId, (entries) =>
            entries.filter((e) => e.id !== id),
          ),
        ),
    }),
    { name: "ModelStore" },
  ),
);
