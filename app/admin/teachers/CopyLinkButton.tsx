"use client";
import { useState } from "react";

export default function CopyLinkButton({
  link,
  label = "Copy link",
}: {
  link: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="text-xs underline hover:no-underline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // fallback: select-and-prompt
          window.prompt("Copy the invite link", link);
        }
      }}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
