import { BaseEvent } from "../base/event";

/**
 * Transient LLM token delta delivered via WebSocket during generation.
 * Not persisted to history; used only to render the in-progress assistant
 * bubble. Final content arrives as a regular MessageEvent.
 */
export interface StreamingDeltaEvent extends BaseEvent {
  kind: "StreamingDeltaEvent";
  content: string | null;
  reasoning_content: string | null;
}
