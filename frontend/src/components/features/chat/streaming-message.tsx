import React from "react";
import { useStreamingMessageStore } from "#/stores/streaming-message-store";
import { useScrollContext } from "#/context/scroll-context";

const FOLLOW_WINDOW_MS = 1500;

export function StreamingMessage() {
  const displayed = useStreamingMessageStore((state) => state.displayed);
  const { autoScroll, scrollDomToBottom } = useScrollContext();
  // Re-armed on each empty→non-empty transition; this component never unmounts so a mount-time deadline would expire before any token arrives.
  const followUntilRef = React.useRef<number>(0);
  const prevDisplayedRef = React.useRef<string>("");

  React.useEffect(() => {
    if (displayed && !prevDisplayedRef.current) {
      followUntilRef.current = Date.now() + FOLLOW_WINDOW_MS;
    }
    prevDisplayedRef.current = displayed;

    if (autoScroll && Date.now() < followUntilRef.current) {
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
        className="text-sm min-h-[1.5em]"
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
