import React from "react";
import { LlmProfile, LlmProfileInput } from "#/types/llm-profile";

const DEFAULT_PROFILES: LlmProfile[] = [
  {
    id: "mock-1",
    name: "Model 1",
    model: "openai/gpt-5.2",
    api_key_set: true,
    is_default: true,
  },
  {
    id: "mock-2",
    name: "Model 2",
    model: "openai/gpt-5.2",
    api_key_set: true,
  },
];

type Listener = (profiles: LlmProfile[]) => void;

let store: LlmProfile[] = DEFAULT_PROFILES;
const listeners = new Set<Listener>();

const notify = () => {
  listeners.forEach((l) => l(store));
};

const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `profile-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function useLlmProfiles() {
  const [profiles, setProfiles] = React.useState<LlmProfile[]>(store);

  React.useEffect(() => {
    const listener: Listener = (next) => setProfiles(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const addProfile = React.useCallback((input: LlmProfileInput) => {
    const newProfile: LlmProfile = {
      ...input,
      id: genId(),
      is_default: store.length === 0,
    };
    store = [...store, newProfile];
    notify();
    return newProfile;
  }, []);

  const updateProfile = React.useCallback(
    (id: string, input: LlmProfileInput) => {
      store = store.map((p) => (p.id === id ? { ...p, ...input } : p));
      notify();
    },
    [],
  );

  const deleteProfile = React.useCallback((id: string) => {
    const wasDefault = store.find((p) => p.id === id)?.is_default;
    store = store.filter((p) => p.id !== id);
    if (wasDefault && store.length > 0) {
      store = store.map((p, i) => ({ ...p, is_default: i === 0 }));
    }
    notify();
  }, []);

  const setDefaultProfile = React.useCallback((id: string) => {
    store = store.map((p) => ({ ...p, is_default: p.id === id }));
    notify();
  }, []);

  return {
    profiles,
    addProfile,
    updateProfile,
    deleteProfile,
    setDefaultProfile,
  };
}
