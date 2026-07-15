"use client";

import { IconSettings, IconMessage, IconBarChart } from "@/components/icons";

export type View = "settings" | "front" | "admin";

const NAV_ITEMS: { view: View; label: string; icon: React.ReactNode }[] = [
  { view: "settings", label: "설정", icon: <IconSettings size={20} /> },
  { view: "front", label: "FRONT", icon: <IconMessage size={20} /> },
  { view: "admin", label: "ADMIN", icon: <IconBarChart size={20} /> },
];

export default function Sidebar({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <nav
      className="flex h-full w-16 shrink-0 flex-col items-center gap-2 rounded-lg border py-4"
      style={{ borderColor: "var(--border-ring)", background: "var(--surface-1)" }}
    >
      {NAV_ITEMS.map((item) => (
        <NavButton
          key={item.view}
          active={view === item.view}
          label={item.label}
          icon={item.icon}
          onClick={() => onChange(item.view)}
        />
      ))}
    </nav>
  );
}

function NavButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active}
      className="flex w-12 flex-col items-center gap-1 rounded-lg py-2.5 text-[9.5px] font-medium transition"
      style={{
        color: active ? "var(--accent-contrast)" : "var(--text-secondary)",
        background: active ? "var(--accent)" : "transparent",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
