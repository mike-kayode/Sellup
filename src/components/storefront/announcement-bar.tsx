"use client";

/**
 * Sell Up announcement bar (Phase 2.2a).
 *
 * Config-driven top banner: text, link, background and text colors. Renders
 * nothing when disabled — no layout shift for stores that don't use it.
 */

import Link from "next/link";

interface AnnouncementBarProps {
  bar: {
    enabled: boolean;
    text: string;
    link: string;
    backgroundColor: string;
    textColor: string;
  };
}

export function AnnouncementBar({ bar }: AnnouncementBarProps) {
  if (!bar.enabled || !bar.text.trim()) return null;

  const hasLink = bar.link.trim().length > 0;

  return (
    <div
      role="banner"
      aria-live="polite"
      className="px-4 py-2 text-center font-medium text-sm transition-colors duration-300"
      style={{
        backgroundColor: bar.backgroundColor || "#25D366",
        color: bar.textColor || "#FFFFFF",
      }}
    >
      {hasLink ? (
        <Link
          href={bar.link}
          className="block no-underline"
          style={{ color: bar.textColor || "#FFFFFF" }}
        >
          {bar.text}
        </Link>
      ) : (
        <span>{bar.text}</span>
      )}
    </div>
  );
}
