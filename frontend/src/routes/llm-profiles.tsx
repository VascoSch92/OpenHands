import { LlmProfilesScreen } from "#/components/features/settings/llm-profiles/llm-profiles-screen";
import { createPermissionGuard } from "#/utils/org/permission-guard";

export const clientLoader = createPermissionGuard("view_llm_settings");

export default function LlmProfilesRoute() {
  return <LlmProfilesScreen />;
}
