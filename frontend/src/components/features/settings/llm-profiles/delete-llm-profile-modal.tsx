import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import { ApiKeyModalBase } from "#/components/features/settings/api-key-modal-base";
import { BrandButton } from "#/components/features/settings/brand-button";
import { LlmProfile } from "#/types/llm-profile";

interface DeleteLlmProfileModalProps {
  isOpen: boolean;
  profile: LlmProfile | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteLlmProfileModal({
  isOpen,
  profile,
  onClose,
  onConfirm,
}: DeleteLlmProfileModalProps) {
  const { t } = useTranslation();

  if (!profile) return null;

  const footer = (
    <>
      <BrandButton
        type="button"
        variant="danger"
        className="grow"
        onClick={onConfirm}
      >
        {t(I18nKey.BUTTON$DELETE)}
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
      title={t(I18nKey.SETTINGS$DELETE_LLM_PROFILE)}
      footer={footer}
    >
      <p className="text-sm text-gray-300">
        {t(I18nKey.SETTINGS$DELETE_LLM_PROFILE_CONFIRM, { name: profile.name })}
      </p>
    </ApiKeyModalBase>
  );
}
