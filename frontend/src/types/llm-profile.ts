export interface LlmProfile {
  id: string;
  name: string;
  model: string;
  base_url?: string;
  api_key_set?: boolean;
  is_default?: boolean;
}

export type LlmProfileInput = Omit<LlmProfile, "id" | "is_default">;
