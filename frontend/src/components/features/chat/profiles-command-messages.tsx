import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import { useLlmProfiles } from "#/hooks/use-llm-profiles";
import { useProfilesCommandStore } from "#/stores/profiles-command-store";
import { extractModelAndProvider } from "#/utils/extract-model-and-provider";
import { mapProvider } from "#/utils/map-provider";
import { GenericEventMessage } from "./generic-event-message";

const formatModel = (model: string) => {
  const { provider, model: m } = extractModelAndProvider(model);
  return provider && m ? `${mapProvider(provider)} ${m}` : model;
};

interface Props {
  conversationId: string | null | undefined;
}

export function ProfilesCommandMessages({ conversationId }: Props) {
  const { t } = useTranslation();
  const { profiles } = useLlmProfiles();
  const isVisible = useProfilesCommandStore((s) =>
    conversationId ? s.visibleIn.has(conversationId) : false,
  );

  if (!conversationId || !isVisible) return null;

  const details =
    profiles.length === 0
      ? t(I18nKey.SETTINGS$LLM_PROFILES_COMMAND_EMPTY)
      : profiles
          .map(
            (p) =>
              `- **${p.name}** — ${formatModel(p.model)}${p.is_default ? " _(default)_" : ""}`,
          )
          .join("\n");

  return (
    <GenericEventMessage
      title={t(I18nKey.SETTINGS$LLM_PROFILES_COMMAND_TITLE, {
        count: profiles.length,
      })}
      details={details}
      initiallyExpanded
      chevronPosition="before"
    />
  );
}
