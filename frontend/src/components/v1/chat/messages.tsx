import React from "react";
import { useParams } from "react-router";
import { OpenHandsEvent } from "#/types/v1/core";
import { EventMessage } from "./event-message";
import { ChatMessage } from "../../features/chat/chat-message";
import { ModelMessages } from "../../features/chat/model-messages";
import { useOptimisticUserMessageStore } from "#/stores/optimistic-user-message-store";
import { usePlanPreviewEvents } from "./hooks/use-plan-preview-events";
// TODO: Implement microagent functionality for V1 when APIs support V1 event IDs
// import { AgentState } from "#/types/agent-state";
// import MemoryIcon from "#/icons/memory_icon.svg?react";

interface MessagesProps {
  messages: OpenHandsEvent[]; // UI events (actions replaced by observations)
  allEvents: OpenHandsEvent[]; // Full event history (for action lookup)
}

export const Messages: React.FC<MessagesProps> = React.memo(
  ({ messages, allEvents }) => {
    const { getOptimisticUserMessage } = useOptimisticUserMessageStore();
    const params = useParams();
    const conversationId = params.conversationId ?? null;

    const optimisticUserMessage = getOptimisticUserMessage();

    // Get the set of event IDs that should render PlanPreview
    // This ensures only one preview per user message "phase"
    const planPreviewEventIds = usePlanPreviewEvents(allEvents);

    // TODO: Implement microagent functionality for V1 if needed
    // For now, we'll skip microagent features

    return (
      <>
        {messages.map((message, index) => (
          <React.Fragment key={message.id}>
            <EventMessage
              event={message}
              messages={allEvents}
              isLastMessage={messages.length - 1 === index}
              isInLast10Actions={messages.length - 1 - index < 10}
              planPreviewEventIds={planPreviewEventIds}
              // Microagent props - not implemented yet for V1
              // microagentStatus={undefined}
              // microagentConversationId={undefined}
              // microagentPRUrl={undefined}
              // actions={undefined}
            />
            <ModelMessages
              conversationId={conversationId}
              anchorEventId={String(message.id)}
            />
          </React.Fragment>
        ))}

        {optimisticUserMessage && (
          <ChatMessage type="user" message={optimisticUserMessage} />
        )}
      </>
    );
  },
  (prevProps, nextProps) => {
    // Prevent re-renders if messages are the same length
    if (prevProps.messages.length !== nextProps.messages.length) {
      return false;
    }

    return true;
  },
);

Messages.displayName = "Messages";
