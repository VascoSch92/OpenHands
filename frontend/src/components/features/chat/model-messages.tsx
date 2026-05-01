import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import CheckCircle from "#/icons/check-circle-solid.svg?react";
import { useModelStore } from "#/stores/model-store";
import { Typography } from "#/ui/typography";
import { GenericEventMessage } from "./generic-event-message";
import type { LlmProfileSummary } from "#/api/settings-service/profiles-service.api";

function GotItButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-success bg-success/10 hover:bg-success/20 border border-success/30 transition-colors"
    >
      <CheckCircle className="w-3.5 h-3.5 fill-success" />
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <span>Got it</span>
    </button>
  );
}

interface ProfileRowProps {
  profile: LlmProfileSummary;
  isActive: boolean;
}

function ProfileRow({ profile, isActive }: ProfileRowProps) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="border border-neutral-700 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full py-1.5 px-2 text-left flex items-center gap-2 hover:bg-neutral-700 transition-colors cursor-pointer"
      >
        <Typography.Text className="text-neutral-300">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </Typography.Text>
        <Typography.Text className="font-semibold text-neutral-200 text-sm">
          {profile.name}
          {isActive && (
            // eslint-disable-next-line i18next/no-literal-string
            <span className="ml-2 text-xs font-normal text-success">
              (active)
            </span>
          )}
        </Typography.Text>
      </button>
      {expanded && (
        <>
          <hr className="border-neutral-700" />
          <div className="px-3 py-2 text-xs text-neutral-300 font-mono whitespace-pre-wrap">
            {`model:    ${profile.model ?? "—"}\n` +
              `base_url: ${profile.base_url ?? "—"}\n` +
              `api_key:  ${profile.api_key_set ? "set" : "not set"}`}
          </div>
        </>
      )}
    </div>
  );
}

export interface ModelMessagesProps {
  conversationId: string | null | undefined;
}

export function ModelMessages({ conversationId }: ModelMessagesProps) {
  const entriesById = useModelStore((s) => s.entriesByConversation);
  const dismiss = useModelStore((s) => s.dismiss);
  const entries = conversationId ? (entriesById[conversationId] ?? []) : [];

  if (!conversationId || entries.length === 0) return null;

  return (
    <div data-testid="model-messages" className="flex flex-col w-full">
      {entries.map((entry) => (
        <GenericEventMessage
          key={entry.id}
          title={
            <span className="flex items-center gap-2">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="opacity-60">/model</span>
              <span>
                {entry.profiles.length === 0
                  ? /* eslint-disable-next-line i18next/no-literal-string */
                    "No saved profiles"
                  : /* eslint-disable-next-line i18next/no-literal-string */
                    `Available profiles (${entry.profiles.length})`}
              </span>
            </span>
          }
          details={
            entry.profiles.length === 0 ? (
              // eslint-disable-next-line i18next/no-literal-string
              <Typography.Text className="text-neutral-300 text-sm px-2 py-1">
                Use the LLM settings page to create a profile, then run /model
                &lt;name&gt; to switch.
              </Typography.Text>
            ) : (
              <div className="flex flex-col gap-1 mt-1">
                {entry.profiles.map((p) => (
                  <ProfileRow
                    key={p.name}
                    profile={p}
                    isActive={p.name === entry.activeProfile}
                  />
                ))}
              </div>
            )
          }
          initiallyExpanded
          chevronPosition="before"
          titleTrailing={
            <GotItButton onClick={() => dismiss(conversationId, entry.id)} />
          }
        />
      ))}
    </div>
  );
}
