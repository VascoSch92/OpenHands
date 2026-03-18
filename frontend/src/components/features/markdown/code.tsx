import React from "react";
import { ExtraProps } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import CopyIcon from "#/icons/copy.svg?react";

function CopyButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text)}
      className="absolute top-2 right-2 p-1 rounded bg-neutral-700 hover:bg-neutral-600"
      aria-label="Copy code"
    >
      <CopyIcon width={14} height={14} />
    </button>
  );
}

// See https://github.com/remarkjs/react-markdown?tab=readme-ov-file#use-custom-components-syntax-highlight

/**
 * Component to render code blocks in markdown.
 */
export function code({
  children,
  className,
}: React.ClassAttributes<HTMLElement> &
  React.HTMLAttributes<HTMLElement> &
  ExtraProps) {
  const match = /language-(\w+)/.exec(className || ""); // get the language
  const codeString = String(children).replace(/\n$/, "");

  if (!match) {
    const isMultiline = String(children).includes("\n");

    if (!isMultiline) {
      return (
        <code
          className={className}
          style={{
            backgroundColor: "#2a3038",
            padding: "0.2em 0.4em",
            borderRadius: "4px",
            color: "#e6edf3",
            border: "1px solid #30363d",
          }}
        >
          {children}
        </code>
      );
    }

    return (
      <div className="relative">
        <CopyButton text={codeString} />
        <pre
          style={{
            backgroundColor: "#2a3038",
            padding: "1em",
            borderRadius: "4px",
            color: "#e6edf3",
            border: "1px solid #30363d",
            overflow: "auto",
          }}
        >
          <code className={className}>{codeString}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="relative">
      <CopyButton text={codeString} />
      <SyntaxHighlighter
        className="rounded-lg"
        style={vscDarkPlus}
        language={match?.[1]}
        PreTag="div"
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
}
