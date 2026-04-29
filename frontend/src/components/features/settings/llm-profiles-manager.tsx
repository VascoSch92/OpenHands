import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BrandButton } from "#/components/features/settings/brand-button";
import { SettingsInput } from "#/components/features/settings/settings-input";
import { LoadingSpinner } from "#/components/shared/loading-spinner";
import { ApiKeyModalBase } from "#/components/features/settings/api-key-modal-base";
import { ContextMenu } from "#/ui/context-menu";
import { ContextMenuListItem } from "#/components/features/context-menu/context-menu-list-item";
import { ConversationNameContextMenuIconText } from "#/components/features/conversation/conversation-name-context-menu-icon-text";
import { useClickOutsideElement } from "#/hooks/use-click-outside-element";
import { LlmProfileSummary } from "#/api/settings-service/profiles-service.api";
import { useLlmProfiles } from "#/hooks/query/use-llm-profiles";
import { useDeleteLlmProfile } from "#/hooks/mutation/use-delete-llm-profile";
import { useActivateLlmProfile } from "#/hooks/mutation/use-activate-llm-profile";
import { useRenameLlmProfile } from "#/hooks/mutation/use-rename-llm-profile";
import { displayErrorToast } from "#/utils/custom-toast-handlers";
import { mutateWithToast } from "#/utils/mutate-with-toast";
import { extractErrorMessage } from "#/utils/extract-error-message";
import { I18nKey } from "#/i18n/declaration";
import SettingsGearIcon from "#/icons/settings-gear.svg?react";
import EditIcon from "#/icons/u-edit.svg?react";
import DeleteIcon from "#/icons/u-delete.svg?react";
import CheckmarkIcon from "#/icons/checkmark.svg?react";
import ThreeDotsVerticalIcon from "#/icons/three-dots-vertical.svg?react";

// Mirrors the backend regex ^[A-Za-z0-9._-]{1,64}$ in settings_router.py.
const PROFILE_NAME_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

interface RenameProfileModalProps {
  profile: LlmProfileSummary | null;
  onClose: () => void;
}

function RenameProfileModal({ profile, onClose }: RenameProfileModalProps) {
  const { t } = useTranslation();
  const [newName, setNewName] = useState("");
  const renameProfile = useRenameLlmProfile();

  useEffect(() => {
    setNewName(profile?.name ?? "");
  }, [profile?.name]);

  if (!profile) return null;

  const trimmed = newName.trim();
  const isUnchanged = trimmed === profile.name;
  const isValid = PROFILE_NAME_PATTERN.test(trimmed);

  const handleSubmit = async () => {
    if (!isValid) {
      displayErrorToast(t(I18nKey.SETTINGS$PROFILE_NAME_RULE));
      return;
    }
    if (isUnchanged) {
      onClose();
      return;
    }
    const ok = await mutateWithToast(
      renameProfile,
      { name: profile.name, newName: trimmed },
      {
        success: t(I18nKey.SETTINGS$PROFILE_RENAMED, { name: trimmed }),
        error: (err) => extractErrorMessage(err, t(I18nKey.ERROR$GENERIC)),
      },
    ).catch(() => null);
    if (ok !== null) onClose();
  };

  const footer = (
    <>
      <BrandButton
        testId="rename-profile-submit"
        type="button"
        variant="primary"
        className="grow"
        onClick={handleSubmit}
        isDisabled={renameProfile.isPending || !isValid}
      >
        {renameProfile.isPending ? (
          <LoadingSpinner size="small" />
        ) : (
          t(I18nKey.BUTTON$RENAME)
        )}
      </BrandButton>
      <BrandButton
        type="button"
        variant="secondary"
        className="grow"
        onClick={onClose}
        isDisabled={renameProfile.isPending}
      >
        {t(I18nKey.BUTTON$CANCEL)}
      </BrandButton>
    </>
  );

  return (
    <ApiKeyModalBase
      isOpen
      title={t(I18nKey.SETTINGS$PROFILE_RENAME_TITLE)}
      footer={footer}
    >
      <div data-testid="rename-profile-modal" className="flex flex-col gap-3">
        <SettingsInput
          testId="rename-profile-input"
          label={t(I18nKey.SETTINGS$NAME)}
          type="text"
          value={newName}
          className="w-full"
          onChange={setNewName}
        />
        <p
          data-testid="rename-profile-rule"
          className={`text-xs ${
            trimmed.length > 0 && !isValid ? "text-red-400" : "text-gray-400"
          }`}
        >
          {t(I18nKey.SETTINGS$PROFILE_NAME_RULE)}
        </p>
      </div>
    </ApiKeyModalBase>
  );
}

interface DeleteProfileModalProps {
  profile: LlmProfileSummary | null;
  onClose: () => void;
}

function DeleteProfileModal({ profile, onClose }: DeleteProfileModalProps) {
  const { t } = useTranslation();
  const deleteProfile = useDeleteLlmProfile();

  if (!profile) return null;

  const handleDelete = async () => {
    const ok = await mutateWithToast(deleteProfile, profile.name, {
      success: t(I18nKey.SETTINGS$PROFILE_DELETED, { name: profile.name }),
      error: (err) => extractErrorMessage(err, t(I18nKey.ERROR$GENERIC)),
    }).catch(() => null);
    if (ok !== null) onClose();
  };

  const footer = (
    <>
      <BrandButton
        testId="delete-profile-confirm"
        type="button"
        variant="danger"
        className="grow"
        onClick={handleDelete}
        isDisabled={deleteProfile.isPending}
      >
        {deleteProfile.isPending ? (
          <LoadingSpinner size="small" />
        ) : (
          t(I18nKey.BUTTON$DELETE)
        )}
      </BrandButton>
      <BrandButton
        type="button"
        variant="secondary"
        className="grow"
        onClick={onClose}
        isDisabled={deleteProfile.isPending}
      >
        {t(I18nKey.BUTTON$CANCEL)}
      </BrandButton>
    </>
  );

  return (
    <ApiKeyModalBase
      isOpen
      title={t(I18nKey.SETTINGS$PROFILE_DELETE_TITLE)}
      footer={footer}
    >
      <p className="text-sm break-all">
        {t(I18nKey.SETTINGS$PROFILE_DELETE_CONFIRMATION, {
          name: profile.name,
        })}
      </p>
    </ApiKeyModalBase>
  );
}

interface ProfileActionsMenuProps {
  onEdit: () => void;
  onRename: () => void;
  onSetActive: () => void;
  onDelete: () => void;
  isActive: boolean;
  isActivating: boolean;
  onClose: () => void;
}

type MenuIcon = React.ComponentType<{ width: number; height: number }>;

interface MenuItemSpec {
  testId: string;
  icon: MenuIcon;
  label: string;
  onSelect: () => void;
  isDisabled?: boolean;
  isDestructive?: boolean;
}

function ProfileActionsMenu({
  onEdit,
  onRename,
  onSetActive,
  onDelete,
  isActive,
  isActivating,
  onClose,
}: ProfileActionsMenuProps) {
  const { t } = useTranslation();
  const ref = useClickOutsideElement<HTMLUListElement>(onClose);

  const items: MenuItemSpec[] = [
    {
      testId: "profile-edit",
      icon: SettingsGearIcon,
      label: t(I18nKey.SETTINGS$PROFILE_EDIT),
      onSelect: onEdit,
    },
    {
      testId: "profile-rename",
      icon: EditIcon,
      label: t(I18nKey.BUTTON$RENAME),
      onSelect: onRename,
    },
    {
      testId: "profile-set-active",
      icon: CheckmarkIcon,
      label: t(I18nKey.SETTINGS$PROFILE_SET_ACTIVE),
      onSelect: onSetActive,
      isDisabled: isActive || isActivating,
    },
    {
      testId: "profile-delete",
      icon: DeleteIcon,
      label: t(I18nKey.BUTTON$DELETE),
      onSelect: onDelete,
      isDestructive: true,
    },
  ];

  return (
    <ContextMenu
      ref={ref}
      testId="profile-actions-menu"
      alignment="right"
      position="bottom"
      className="min-w-[180px]"
    >
      {items.map(
        ({
          testId,
          icon: Icon,
          label,
          onSelect,
          isDisabled,
          isDestructive,
        }) => (
          <ContextMenuListItem
            key={testId}
            testId={testId}
            onClick={() => {
              onSelect();
              onClose();
            }}
            isDisabled={isDisabled}
            className="cursor-pointer p-0 h-auto hover:bg-transparent"
          >
            <ConversationNameContextMenuIconText
              icon={<Icon width={16} height={16} />}
              text={label}
              className={isDestructive ? "text-red-400" : undefined}
            />
          </ContextMenuListItem>
        ),
      )}
    </ContextMenu>
  );
}

interface ProfileRowProps {
  profile: LlmProfileSummary;
  isActive: boolean;
  onActivate: (name: string) => void;
  onEdit: (profile: LlmProfileSummary) => void;
  onRename: (profile: LlmProfileSummary) => void;
  onDelete: (profile: LlmProfileSummary) => void;
  isActivating: boolean;
}

function ProfileRow({
  profile,
  isActive,
  onActivate,
  onEdit,
  onRename,
  onDelete,
  isActivating,
}: ProfileRowProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      data-testid="profile-row"
      className="flex items-center justify-between px-5 py-4"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-medium text-white truncate" title={profile.name}>
          {profile.name}
        </span>
        {profile.model ? (
          <span
            className="text-sm text-gray-400 truncate"
            title={profile.model}
          >
            {profile.model}
          </span>
        ) : null}
        {isActive && (
          <span
            className="text-xs bg-primary text-[#0D0F11] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap"
            data-testid="profile-active-badge"
          >
            {t(I18nKey.SETTINGS$PROFILE_ACTIVE_BADGE)}
          </span>
        )}
      </div>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={t(I18nKey.SETTINGS$PROFILE_MENU)}
          className="cursor-pointer text-gray-300 hover:text-white p-2 border border-tertiary rounded-md"
          data-testid="profile-menu-trigger"
        >
          <ThreeDotsVerticalIcon width={16} height={16} />
        </button>
        {menuOpen && (
          <ProfileActionsMenu
            onEdit={() => onEdit(profile)}
            onRename={() => onRename(profile)}
            onSetActive={() => onActivate(profile.name)}
            onDelete={() => onDelete(profile)}
            isActive={isActive}
            isActivating={isActivating}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

interface ProfilesBodyProps {
  isLoading: boolean;
  loadError: Error | null;
  profiles: LlmProfileSummary[];
  active: string | null;
  onActivate: (name: string) => void;
  onEdit: (profile: LlmProfileSummary) => void;
  onRename: (profile: LlmProfileSummary) => void;
  onDelete: (profile: LlmProfileSummary) => void;
  isActivating: boolean;
}

function ProfilesBody({
  isLoading,
  loadError,
  profiles,
  active,
  onActivate,
  onEdit,
  onRename,
  onDelete,
  isActivating,
}: ProfilesBodyProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <LoadingSpinner size="large" />
      </div>
    );
  }
  if (loadError) {
    return (
      <p className="text-sm text-red-400">
        {t(I18nKey.SETTINGS$PROFILES_LOAD_ERROR)}
      </p>
    );
  }
  if (profiles.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">
        {t(I18nKey.SETTINGS$PROFILES_EMPTY)}
      </p>
    );
  }
  return (
    <div className="border border-tertiary rounded-md divide-y divide-tertiary">
      {profiles.map((profile) => (
        <ProfileRow
          key={profile.name}
          profile={profile}
          isActive={profile.name === active}
          onActivate={onActivate}
          onEdit={onEdit}
          onRename={onRename}
          onDelete={onDelete}
          isActivating={isActivating}
        />
      ))}
    </div>
  );
}

interface LlmProfilesManagerProps {
  onAddProfile?: () => void;
  onEditProfile?: (profile: LlmProfileSummary) => void;
}

export function LlmProfilesManager({
  onAddProfile,
  onEditProfile,
}: LlmProfilesManagerProps = {}) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useLlmProfiles();
  const activateProfile = useActivateLlmProfile();
  const [profileToRename, setProfileToRename] =
    useState<LlmProfileSummary | null>(null);
  const [profileToDelete, setProfileToDelete] =
    useState<LlmProfileSummary | null>(null);

  const profiles = data?.profiles ?? [];
  const active = data?.active_profile ?? null;

  const handleActivate = async (name: string) => {
    await mutateWithToast(activateProfile, name, {
      success: t(I18nKey.SETTINGS$PROFILE_ACTIVATED, { name }),
      error: (err) => extractErrorMessage(err, t(I18nKey.ERROR$GENERIC)),
    }).catch(() => null);
  };

  const handleEdit = async (profile: LlmProfileSummary) => {
    if (profile.name !== active) {
      await handleActivate(profile.name);
    }
    onEditProfile?.(profile);
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">
            {t(I18nKey.SETTINGS$AVAILABLE_PROFILES)}
          </h2>
          {onAddProfile ? (
            <BrandButton
              testId="add-llm-profile"
              type="button"
              variant="primary"
              onClick={onAddProfile}
            >
              {t(I18nKey.SETTINGS$ADD_LLM_PROFILE)}
            </BrandButton>
          ) : null}
        </div>

        <ProfilesBody
          isLoading={isLoading}
          loadError={error ?? null}
          profiles={profiles}
          active={active}
          onActivate={handleActivate}
          onEdit={handleEdit}
          onRename={setProfileToRename}
          onDelete={setProfileToDelete}
          isActivating={activateProfile.isPending}
        />
      </div>

      <RenameProfileModal
        profile={profileToRename}
        onClose={() => setProfileToRename(null)}
      />
      <DeleteProfileModal
        profile={profileToDelete}
        onClose={() => setProfileToDelete(null)}
      />
    </>
  );
}
