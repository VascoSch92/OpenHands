import React from "react";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import { BrandButton } from "#/components/features/settings/brand-button";
import { LlmProfileCard } from "./llm-profile-card";
import { LlmProfileModal } from "./llm-profile-modal";
import { DeleteLlmProfileModal } from "./delete-llm-profile-modal";
import { useLlmProfiles } from "#/hooks/use-llm-profiles";
import { LlmProfile, LlmProfileInput } from "#/types/llm-profile";
import { displaySuccessToast } from "#/utils/custom-toast-handlers";

export function LlmProfilesScreen() {
  const { t } = useTranslation();
  const {
    profiles,
    addProfile,
    updateProfile,
    deleteProfile,
    setDefaultProfile,
  } = useLlmProfiles();

  const [editTarget, setEditTarget] = React.useState<LlmProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<LlmProfile | null>(
    null,
  );
  const [createOpen, setCreateOpen] = React.useState(false);

  const handleSubmit = (input: LlmProfileInput) => {
    if (editTarget) {
      updateProfile(editTarget.id, input);
      displaySuccessToast(t(I18nKey.SETTINGS$LLM_PROFILE_UPDATED));
      setEditTarget(null);
    } else {
      addProfile(input);
      displaySuccessToast(t(I18nKey.SETTINGS$LLM_PROFILE_CREATED));
      setCreateOpen(false);
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteProfile(deleteTarget.id);
    displaySuccessToast(t(I18nKey.SETTINGS$LLM_PROFILE_DELETED));
    setDeleteTarget(null);
  };

  return (
    <div data-testid="llm-profiles-screen" className="flex flex-col grow">
      <div className="flex items-center justify-end mb-6">
        <BrandButton
          testId="add-llm-profile-button"
          type="button"
          variant="primary"
          onClick={() => setCreateOpen(true)}
        >
          {t(I18nKey.SETTINGS$ADD_LLM_PROFILE)}
        </BrandButton>
      </div>

      {profiles.length === 0 ? (
        <p className="text-sm text-tertiary-alt">
          {t(I18nKey.SETTINGS$LLM_PROFILES_EMPTY)}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {profiles.map((profile) => (
            <LlmProfileCard
              key={profile.id}
              profile={profile}
              onEdit={() => setEditTarget(profile)}
              onDelete={() => setDeleteTarget(profile)}
              onSetDefault={() => {
                setDefaultProfile(profile.id);
                displaySuccessToast(
                  t(I18nKey.SETTINGS$LLM_PROFILE_DEFAULT_UPDATED),
                );
              }}
            />
          ))}
        </div>
      )}

      <LlmProfileModal
        isOpen={createOpen || !!editTarget}
        initialProfile={editTarget ?? undefined}
        onClose={() => {
          setCreateOpen(false);
          setEditTarget(null);
        }}
        onSubmit={handleSubmit}
      />

      <DeleteLlmProfileModal
        isOpen={!!deleteTarget}
        profile={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
