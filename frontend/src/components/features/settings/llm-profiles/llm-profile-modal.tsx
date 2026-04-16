import React from "react";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import { ApiKeyModalBase } from "#/components/features/settings/api-key-modal-base";
import { BrandButton } from "#/components/features/settings/brand-button";
import { SettingsInput } from "#/components/features/settings/settings-input";
import { ModelSelector } from "#/components/shared/modals/settings/model-selector";
import { LlmProfile, LlmProfileInput } from "#/types/llm-profile";

interface LlmProfileModalProps {
  isOpen: boolean;
  initialProfile?: LlmProfile;
  onClose: () => void;
  onSubmit: (input: LlmProfileInput) => void;
}

const buildModelId = (provider: string | null, model: string | null) =>
  provider && model ? `${provider}/${model}` : "";

export function LlmProfileModal({
  isOpen,
  initialProfile,
  onClose,
  onSubmit,
}: LlmProfileModalProps) {
  const { t } = useTranslation();
  const isEdit = !!initialProfile;

  const [name, setName] = React.useState("");
  const [model, setModel] = React.useState("");
  const [baseUrl, setBaseUrl] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");

  React.useEffect(() => {
    if (!isOpen) return;
    setName(initialProfile?.name ?? "");
    setModel(initialProfile?.model ?? "");
    setBaseUrl(initialProfile?.base_url ?? "");
    setApiKey("");
  }, [isOpen, initialProfile]);

  const canSubmit = name.trim().length > 0 && model.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      model: model.trim(),
      base_url: baseUrl.trim() || undefined,
      api_key_set:
        apiKey.trim().length > 0 || (isEdit && initialProfile?.api_key_set),
    });
  };

  const footer = (
    <>
      <BrandButton
        type="button"
        variant="primary"
        className="grow"
        onClick={handleSubmit}
        isDisabled={!canSubmit}
      >
        {isEdit ? t(I18nKey.BUTTON$SAVE) : t(I18nKey.BUTTON$CREATE)}
      </BrandButton>
      <BrandButton
        type="button"
        variant="secondary"
        className="grow"
        onClick={onClose}
      >
        {t(I18nKey.BUTTON$CANCEL)}
      </BrandButton>
    </>
  );

  return (
    <ApiKeyModalBase
      isOpen={isOpen}
      title={
        isEdit
          ? t(I18nKey.SETTINGS$EDIT_LLM_PROFILE)
          : t(I18nKey.SETTINGS$ADD_LLM_PROFILE)
      }
      footer={footer}
      width="560px"
    >
      <div
        data-testid="llm-profile-modal"
        className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto"
      >
        <SettingsInput
          testId="llm-profile-name-input"
          label={t(I18nKey.SETTINGS$NAME)}
          placeholder={t(I18nKey.SETTINGS$LLM_PROFILE_NAME_PLACEHOLDER)}
          value={name}
          onChange={setName}
          className="w-full"
          type="text"
        />

        <ModelSelector
          currentModel={model || undefined}
          onChange={(provider, modelId) => {
            const next = buildModelId(provider, modelId);
            if (next) setModel(next);
          }}
          wrapperClassName="!flex-col !gap-4"
        />

        <SettingsInput
          testId="llm-profile-base-url-input"
          label={t(I18nKey.SETTINGS$BASE_URL)}
          placeholder="https://api.openai.com"
          value={baseUrl}
          onChange={setBaseUrl}
          className="w-full"
          type="text"
          showOptionalTag
        />

        <SettingsInput
          testId="llm-profile-api-key-input"
          label={t(I18nKey.SETTINGS_FORM$API_KEY)}
          placeholder={isEdit && initialProfile?.api_key_set ? "<hidden>" : ""}
          value={apiKey}
          onChange={setApiKey}
          className="w-full"
          type="password"
          showOptionalTag={isEdit && initialProfile?.api_key_set}
        />
      </div>
    </ApiKeyModalBase>
  );
}
