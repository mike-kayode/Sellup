"use client";

/**
 * Sell Up trust badges (Phase 2.2a).
 *
 * Config-driven row of small trust icons + labels (e.g. "Secure payment",
 * "Free delivery"). Renders nothing when disabled or empty.
 */

import {
  ShieldCheck,
  Truck,
  Medal,
  RefreshCw,
  Lock,
  Gift,
  Headphones,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  truck: Truck,
  shield: ShieldCheck,
  medal: Medal,
  refresh: RefreshCw,
  lock: Lock,
  gift: Gift,
  support: Headphones,
};

interface TrustBadgeProps {
  badge: {
    label: string;
    icon: string;
  };
}

function TrustBadge({ badge }: TrustBadgeProps) {
  const Icon = ICON_MAP[badge.icon] || ShieldCheck;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-slate-600"
      aria-label={badge.label}
    >
      <Icon size={12} className="text-slate-500" aria-hidden />
      {badge.label && <span>{badge.label}</span>}
    </span>
  );
}

interface TrustBadgesProps {
  badges: {
    enabled: boolean;
    items: Array<{ label: string; icon: string }>;
  };
}

export function TrustBadges({ badges }: TrustBadgesProps) {
  if (!badges.enabled || !badges.items || badges.items.length === 0)
    return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {badges.items.map((badge, i) => (
        <TrustBadge key={i} badge={badge} />
      ))}
    </div>
  );
}
