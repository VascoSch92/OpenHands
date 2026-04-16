import React from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";
import ThreeDotsVerticalIcon from "#/icons/three-dots-vertical.svg?react";
import { I18nKey } from "#/i18n/declaration";
import { Card } from "#/ui/card";
import { ContextMenuListItem } from "#/components/features/context-menu/context-menu-list-item";
import { LlmProfile } from "#/types/llm-profile";
import { extractModelAndProvider } from "#/utils/extract-model-and-provider";
import { mapProvider } from "#/utils/map-provider";
import { cn } from "#/utils/utils";

interface LlmProfileCardProps {
  profile: LlmProfile;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

const formatModelLabel = (model: string) => {
  const { provider, model: modelName } = extractModelAndProvider(model);
  const providerLabel = provider ? mapProvider(provider) : "";
  if (providerLabel && modelName) return `${providerLabel} ${modelName}`;
  return model;
};

const MENU_GAP = 4;
const ESTIMATED_MENU_HEIGHT = 140;

export function LlmProfileCard({
  profile,
  onEdit,
  onDelete,
  onSetDefault,
}: LlmProfileCardProps) {
  const { t } = useTranslation();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = React.useState<{
    top: number;
    right: number;
  } | null>(null);

  const closeMenu = React.useCallback(() => setMenuPos(null), []);

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropUp = spaceBelow < ESTIMATED_MENU_HEIGHT;
    const top = dropUp
      ? rect.top - ESTIMATED_MENU_HEIGHT - MENU_GAP
      : rect.bottom + MENU_GAP;
    setMenuPos({ top, right: window.innerWidth - rect.right });
  };

  const handleMenuItem = (action: () => void) => () => {
    closeMenu();
    action();
  };

  React.useEffect(() => {
    if (!menuPos) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closeMenu();
    };
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [menuPos, closeMenu]);

  const portalTarget =
    typeof document !== "undefined"
      ? document.getElementById("portal-root") || document.body
      : null;

  return (
    <Card theme="default" className="w-full px-5 py-4 items-center gap-3">
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <span className="font-semibold text-white whitespace-nowrap">
          {profile.name}
        </span>
        <span className="text-sm text-tertiary-alt truncate">
          {formatModelLabel(profile.model)}
        </span>
        {profile.is_default && (
          <span
            data-testid="llm-profile-default-badge"
            className={cn(
              "text-xs px-2 py-0.5 rounded-md",
              "bg-white/10 text-white/80 border border-white/10",
            )}
          >
            {t(I18nKey.SETTINGS$DEFAULT_PROFILE_BADGE)}
          </span>
        )}
      </div>

      <button
        ref={triggerRef}
        type="button"
        data-testid="llm-profile-menu-trigger"
        aria-label={t(I18nKey.SETTINGS$LLM_PROFILE_ACTIONS)}
        onClick={() => (menuPos ? closeMenu() : openMenu())}
        className="p-1 rounded-sm hover:bg-white/10 cursor-pointer shrink-0"
      >
        <ThreeDotsVerticalIcon width={18} height={18} color="#a3a3a3" />
      </button>

      {menuPos &&
        portalTarget &&
        ReactDOM.createPortal(
          <div
            ref={menuRef}
            data-testid="llm-profile-menu"
            style={{
              position: "fixed",
              top: menuPos.top,
              right: menuPos.right,
            }}
            className="bg-tertiary text-white rounded-[6px] context-menu-box-shadow py-[6px] px-1 min-w-[180px] z-[9999] flex flex-col gap-2"
          >
            {!profile.is_default && (
              <ContextMenuListItem
                testId="llm-profile-set-default"
                onClick={handleMenuItem(onSetDefault)}
              >
                {t(I18nKey.SETTINGS$SET_AS_DEFAULT)}
              </ContextMenuListItem>
            )}
            <ContextMenuListItem
              testId="llm-profile-edit"
              onClick={handleMenuItem(onEdit)}
            >
              {t(I18nKey.SETTINGS$LLM_PROFILE_EDIT_ACTION)}
            </ContextMenuListItem>
            <ContextMenuListItem
              testId="llm-profile-delete"
              onClick={handleMenuItem(onDelete)}
              className="text-red-400 hover:bg-red-500/10"
            >
              {t(I18nKey.BUTTON$DELETE)}
            </ContextMenuListItem>
          </div>,
          portalTarget,
        )}
    </Card>
  );
}
