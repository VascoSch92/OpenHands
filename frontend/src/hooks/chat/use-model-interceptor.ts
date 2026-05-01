import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import V1ConversationService from "#/api/conversation-service/v1-conversation-service.api";
import ProfilesService from "#/api/settings-service/profiles-service.api";
import { shouldRenderEvent as shouldRenderV1Event } from "#/components/v1/chat";
import { useEventStore } from "#/stores/use-event-store";
import { useModelStore } from "#/stores/model-store";
import { isV1Event } from "#/types/v1/type-guards";
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
  const queryClient = useQueryClient();

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
        // Anchor the toggle to the latest v1 event so it renders inline at the
        // chat position where the user typed /model, instead of always at the
        // bottom of the chat history. Apply the same filter chain as
        // `useFilteredEvents` so we only anchor to events that are actually
        // rendered — anchoring to a hidden event (e.g. ConversationStateUpdate)
        // would leave the toggle with no slot to mount in.
        const renderedEvents = useEventStore
          .getState()
          .uiEvents.filter(isV1Event)
          .filter(shouldRenderV1Event);
        const anchorEventId =
          renderedEvents.length > 0
            ? String(renderedEvents[renderedEvents.length - 1].id)
            : null;
        ProfilesService.listProfiles()
          .then(({ profiles }) =>
            showProfiles(conversationId, anchorEventId, profiles),
          )
          .catch((err) =>
            displayErrorToast(err?.message ?? "Failed to list LLM profiles"),
          );
        return;
      }

      V1ConversationService.switchProfile(conversationId, arg)
        .then(() => {
          displaySuccessToast(`Switched to profile '${arg}'`);
          // Refetch the conversation so the chat header (and anything else
          // reading `conversation.llm_model`) picks up the new model. The
          // backend persisted it as part of the switch.
          queryClient.invalidateQueries({
            queryKey: ["user", "conversation", conversationId],
          });
        })
        .catch((err) =>
          displayErrorToast(
            err?.response?.data?.detail ??
              err?.message ??
              `Failed to switch to profile '${arg}'`,
          ),
        );
    },
    [conversationId, onSubmit, showProfiles, queryClient],
  );
};
