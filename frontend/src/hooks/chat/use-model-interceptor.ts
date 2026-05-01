import { useCallback } from "react";
import ProfilesService from "#/api/settings-service/profiles-service.api";
import { switchV1Profile } from "#/hooks/mutation/conversation-mutation-utils";
import { useModelStore } from "#/stores/model-store";
import {
  displayErrorToast,
  displaySuccessToast,
} from "#/utils/custom-toast-handlers";
import { MODEL_COMMAND } from "#/utils/constants";

const MODEL_PREFIX = `${MODEL_COMMAND} `;

/**
 * Intercepts "/model" submissions:
 *   - "/model"        → render an inline list of saved profiles in the chat
 *   - "/model <name>" → switch the running conversation's LLM profile
 * Anything else (including /model on a V0 conversation) falls through.
 */
export const useModelInterceptor = (
  conversationId: string | null | undefined,
  onSubmit: (message: string) => void,
) => {
  const showProfiles = useModelStore((s) => s.show);

  return useCallback(
    (message: string) => {
      const trimmed = message.trim();
      const isModel =
        trimmed === MODEL_COMMAND || trimmed.startsWith(MODEL_PREFIX);
      if (!conversationId || !isModel) {
        onSubmit(message);
        return;
      }

      const arg = trimmed.slice(MODEL_COMMAND.length).trim();

      if (!arg) {
        ProfilesService.listProfiles()
          .then(({ profiles, active_profile }) =>
            showProfiles(conversationId, profiles, active_profile),
          )
          .catch((err) =>
            displayErrorToast(err?.message ?? "Failed to list LLM profiles"),
          );
        return;
      }

      switchV1Profile(conversationId, arg)
        .then(() => displaySuccessToast(`Switched to profile '${arg}'`))
        .catch((err) =>
          displayErrorToast(
            err?.response?.data?.detail ??
              err?.message ??
              `Failed to switch to profile '${arg}'`,
          ),
        );
    },
    [conversationId, onSubmit, showProfiles],
  );
};
