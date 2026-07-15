"use client";

import { QUICK_QUESTION_GROUPS } from "@/lib/quickQuestions";
import { CategoryIcon } from "@/lib/categoryIcons";
import { IconHelpCircle } from "@/components/icons";

export default function QuickQuestions({ onSelect }: { onSelect: (question: string) => void }) {
  return (
    <div className="flex h-full flex-col rounded-lg border" style={{ borderColor: "var(--border-ring)", background: "var(--surface-1)" }}>
      <div className="border-b px-5 py-4" style={{ borderColor: "var(--border-ring)" }}>
        <div className="flex items-center gap-2">
          <IconHelpCircle size={18} style={{ color: "var(--accent)" }} />
          <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>자주 묻는 질문</h2>
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>눌러보면 바로 질문이 전송됩니다.</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {QUICK_QUESTION_GROUPS.map((group) => (
          <div
            key={group.categoryId}
            className="rounded border p-3"
            style={{ borderColor: "var(--border-ring)", background: "var(--page-plane)" }}
          >
            <div className="mb-2 flex items-center gap-1.5">
              <CategoryIcon categoryId={group.categoryId} size={13} style={{ color: "var(--accent)" }} />
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                {group.categoryName}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {group.questions.map((q) => (
                <button
                  key={q}
                  onClick={() => onSelect(q)}
                  className="rounded border px-2.5 py-1.5 text-left text-xs transition hover:opacity-80"
                  style={{ borderColor: "var(--border-ring)", background: "var(--surface-1)", color: "var(--text-secondary)" }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
