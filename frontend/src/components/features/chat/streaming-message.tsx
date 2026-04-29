import React from "react";
import { useStreamingMessageStore } from "#/stores/streaming-message-store";
import { useScrollContext } from "#/context/scroll-context";

export function StreamingMessage() {
  const displayed = useStreamingMessageStore((state) => state.displayed);
  const { autoScroll, scrollDomToBottom } = useScrollContext();

  // Follow the bottom while text streams in, but only if the user hasn't
  // scrolled up. autoScroll flips to false on user scroll-up via the
  // existing useScrollToBottom hook.
  React.useEffect(() => {
    if (displayed && autoScroll) {
      scrollDomToBottom();
    }
  }, [displayed, autoScroll, scrollDomToBottom]);

  if (!displayed) return null;

  // Plain-text bubble during streaming (no markdown re-parse on every
  // frame). The terminal MessageEvent renders the final, fully-formatted
  // bubble through the regular V1Messages path, so we don't lose markdown.
  return (
    <article
      data-testid="agent-streaming-message"
      className="mt-6 w-full max-w-full bg-transparent flex flex-col gap-2"
    >
      <div
        className="text-sm"
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {displayed}
        <span
          aria-hidden="true"
          className="inline-block w-[2px] h-[1em] align-[-2px] ml-0.5 bg-current animate-pulse"
        />
      </div>
    </article>
  );
}
