"use client";

import { useState, useRef, useEffect } from "react";
import { sendChat, sendFeedback, fetchSites, type ChatResponse, type HistoryItem } from "@/lib/api";
import { CategoryIcon } from "@/lib/categoryIcons";
import {
  IconAlertTriangle,
  IconThumbsUp,
  IconThumbsDown,
  IconMessage,
  IconBuilding,
  IconExternalLink,
  IconHeadset,
  IconGlobe,
} from "@/components/icons";

const AS_SITE_URL = "https://helpdesk.hisco.co.kr/as/init";
const GOV_NETWORK_STATUS_URL = "https://next.share.go.kr/idx-login.do";

type Message = {
  id: number;
  role: "user" | "bot";
  text: string;
  meta?: ChatResponse;
  pending?: boolean;
  feedback?: "up" | "down";
};

const NEW_SITE_VALUE = "__new__";
const MAX_HISTORY_TURNS = 2; // 최근 2번의 주고받음까지만 대화 맥락으로 전송 (토큰 사용량 절약)

let nextId = 1;

function buildHistory(messages: Message[]): HistoryItem[] {
  // 이전 답변의 요약(summary)만 히스토리에 담습니다 — 단계별 안내까지 다 넣으면
  // 무료 API의 분당 토큰 한도(TPM)를 금방 넘어서기 때문에, 맥락 유지에 필요한
  // 핵심(요약)만 최소한으로 전달합니다.
  const history: HistoryItem[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      history.push({ role: "user", content: m.text });
    } else if (m.meta) {
      history.push({ role: "assistant", content: m.meta.summary });
    }
  }
  return history.slice(-MAX_HISTORY_TURNS * 2);
}

export default function ChatPanel({ onTicketAdded }: { onTicketAdded: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sites, setSites] = useState<string[]>([]);
  const [siteId, setSiteId] = useState("");
  const [addingNewSite, setAddingNewSite] = useState(false);
  const [newSiteDraft, setNewSiteDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchSites().then(setSites).catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function handleSiteSelect(value: string) {
    if (value === NEW_SITE_VALUE) {
      setAddingNewSite(true);
      setNewSiteDraft("");
    } else {
      setAddingNewSite(false);
      setSiteId(value);
    }
  }

  function confirmNewSite() {
    const name = newSiteDraft.trim();
    if (!name) return;
    setSites((prev) => (prev.includes(name) ? prev : [...prev, name].sort()));
    setSiteId(name);
    setAddingNewSite(false);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    // 히스토리는 이번 질문을 보내기 "직전"까지의 대화만 포함해야 합니다.
    const history = buildHistory(messages);

    const userMsg: Message = { id: nextId++, role: "user", text };
    const pendingMsg: Message = { id: nextId++, role: "bot", text: "생각 중...", pending: true };
    setMessages((prev) => [...prev, userMsg, pendingMsg]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(true);

    try {
      const data = await sendChat(text, siteId, history);
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingMsg.id ? { id: m.id, role: "bot", text: data.summary, meta: data } : m))
      );
      onTicketAdded();
    } catch (err) {
      const message = err instanceof Error ? err.message : "오류가 발생했습니다. 서버가 켜져 있는지 확인해주세요.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingMsg.id
            ? { id: m.id, role: "bot", text: message }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  }

  async function handleFeedback(messageId: number, ticketId: number, helpful: boolean) {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, feedback: helpful ? "up" : "down" } : m))
    );
    try {
      await sendFeedback(ticketId, helpful);
      onTicketAdded(); // 대시보드의 "답변 피드백" 카드도 바로 갱신
    } catch {
      // 실패해도 화면 표시는 유지 — 다음 대시보드 새로고침 때 다시 시도할 수 있게 조용히 무시
    }
  }

  return (
    <div className="flex h-full flex-col rounded-lg border" style={{ borderColor: "var(--border-ring)", background: "var(--surface-1)" }}>
      <div className="border-b px-6 py-5" style={{ borderColor: "var(--border-ring)" }}>
        <div className="flex items-center gap-2">
          <IconMessage size={26} style={{ color: "var(--accent)" }} />
          <h1 className="text-2xl font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
            FMCS Helpdesk AI
          </h1>
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          프로그램 사용 중 궁금한 점을 물어보세요 · 1577-6846
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} onFeedback={handleFeedback} />
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t p-4" style={{ borderColor: "var(--border-ring)" }}>
        <div className="flex items-center gap-2">
          <label className="flex shrink-0 items-center gap-1.5 text-[18px] uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
            <IconBuilding size={18} />
            업장
          </label>

          {!addingNewSite ? (
            <select
              value={siteId}
              onChange={(e) => handleSiteSelect(e.target.value)}
              className="w-40 rounded border px-2 py-2 text-sm outline-none focus:ring-1"
              style={{ borderColor: "var(--border-ring)", color: "var(--text-primary)", background: "var(--surface-1)" }}
            >
              <option value="">업장 선택 안함</option>
              {sites.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value={NEW_SITE_VALUE}>+ 새 업장 추가</option>
            </select>
          ) : (
            <div className="flex flex-1 gap-2">
              <input
                autoFocus
                value={newSiteDraft}
                onChange={(e) => setNewSiteDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmNewSite()}
                placeholder="새 업장명 입력"
                className="w-40 rounded border px-3 py-2 text-sm outline-none focus:ring-1"
                style={{ borderColor: "var(--border-ring)", color: "var(--text-primary)" }}
              />
              <button
                onClick={confirmNewSite}
                className="rounded px-3 py-2 text-xs font-semibold"
                style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
              >
                추가
              </button>
              <button
                onClick={() => setAddingNewSite(false)}
                className="rounded border px-3 py-2 text-xs"
                style={{ borderColor: "var(--border-ring)", color: "var(--text-secondary)" }}
              >
                취소
              </button>
            </div>
          )}

          {!addingNewSite && siteId && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              선택됨: <b style={{ color: "var(--text-primary)" }}>{siteId}</b>
            </span>
          )}
        </div>

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
              // Shift+Enter는 그대로 두어 줄바꿈이 되도록 함
            }}
            placeholder="예) 카드결제가 안돼요 (Shift+Enter로 줄바꿈)"
            className="max-h-[120px] flex-1 resize-none rounded border px-4 py-2 text-sm outline-none focus:ring-1"
            style={{ borderColor: "var(--border-ring)", color: "var(--text-primary)" }}
          />
          <button
            onClick={handleSend}
            disabled={sending}
            className="rounded px-5 py-2 text-sm font-semibold transition disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  onFeedback,
}: {
  message: Message;
  onFeedback: (messageId: number, ticketId: number, helpful: boolean) => void;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[80%] rounded px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
          style={{ background: "var(--text-primary)", color: "var(--surface-1)" }}
        >
          {message.text}
        </div>
      </div>
    );
  }

  if (message.pending || !message.meta) {
    return (
      <div className="flex justify-start">
        <div
          className="max-w-[80%] rounded border px-4 py-3 text-sm leading-relaxed"
          style={{ background: "var(--surface-1)", borderColor: "var(--border-ring)", color: "var(--text-primary)" }}
        >
          {message.pending ? (
            <span className="italic" style={{ color: "var(--text-muted)" }}>{message.text}</span>
          ) : (
            message.text
          )}
        </div>
      </div>
    );
  }

  const meta = message.meta;

  return (
    <div className="flex justify-start">
      <div
        className="max-w-[85%] rounded border px-4 py-4 text-sm leading-relaxed"
        style={{ background: "var(--surface-1)", borderColor: "var(--border-ring)", color: "var(--text-primary)" }}
      >
        {/* 한줄 요약 */}
        <p className="font-semibold">{meta.summary}</p>

        {/* 단계별 안내 */}
        {meta.steps.length > 0 && (
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {meta.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}

        {/* 참고 화면 이미지 */}
        {meta.images.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {meta.images.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt="참고 화면"
                  className="max-h-48 rounded border object-contain"
                  style={{ borderColor: "var(--border-ring)" }}
                />
              </a>
            ))}
          </div>
        )}

        {/* 주의사항 / 안내 */}
        {meta.note && (
          <p
            className="mt-3 rounded border px-3 py-2 text-xs"
            style={{ borderColor: "var(--border-ring)", background: "var(--page-plane)", color: "var(--text-secondary)" }}
          >
            {meta.note}
          </p>
        )}

        {/* 상담원 연결 필요 시 — 바로 접수할 수 있도록 AS 접수 사이트/전화 연결 */}
        {meta.needs_human_agent && (
          <div
            className="mt-3 flex flex-col gap-2 rounded border px-3 py-3"
            style={{ borderColor: "var(--status-critical)", background: "var(--page-plane)" }}
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--status-critical)" }}>
              <IconAlertTriangle size={13} /> 지금 바로 접수하시겠어요?
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={AS_SITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition"
                style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
              >
                <IconExternalLink size={13} /> AS 접수 사이트 바로가기
              </a>
              <a
                href="tel:1577-6846"
                className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold"
                style={{ borderColor: "var(--border-ring)", color: "var(--text-secondary)" }}
              >
                <IconHeadset size={13} /> 1577-6846 전화하기
              </a>
            </div>
          </div>
        )}

        {/* 행정공동망 오류 / 감면 확인 불가 문의 — 실제 공동망 사이트에 중단 공지가 확인된 경우에만 표시 */}
        {meta.gov_network_notice && (
          <div
            className="mt-3 flex flex-col gap-2 rounded border px-3 py-3"
            style={{ borderColor: "var(--status-warning)", background: "var(--page-plane)" }}
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--status-warning)" }}>
              <IconGlobe size={13} /> 행정공동망 서비스 중단 공지가 확인됐어요
            </p>
            <p className="whitespace-pre-line text-xs" style={{ color: "var(--text-secondary)" }}>
              {meta.gov_network_notice.slice(0, 220)}
              {meta.gov_network_notice.length > 220 ? "…" : ""}
            </p>
            <a
              href={GOV_NETWORK_STATUS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition"
              style={{ background: "var(--status-warning)", color: "var(--accent-contrast)" }}
            >
              <IconExternalLink size={13} /> 행정공동망 사이트에서 자세히 보기
            </a>
          </div>
        )}

        {/* 분류/확신도 메타 */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          <CategoryIcon categoryId={meta.category} size={13} style={{ color: "var(--accent)" }} />
          <span className="uppercase tracking-wide">{meta.category_name}</span>
          <span style={{ color: "var(--text-muted)" }}>·</span>
          <span className="tabular-nums">{meta.confidence.toFixed(2)}</span>
        </div>

        {/* 피드백 */}
        <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: "var(--border-ring)" }}>
          {message.feedback ? (
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {message.feedback === "up" ? "도움이 됐다고 표시했습니다. 감사합니다." : "의견 감사합니다 — 개선에 참고할게요."}
            </span>
          ) : (
            <>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>이 답변이 도움이 됐나요?</span>
              <button
                onClick={() => onFeedback(message.id, meta.ticket_id, true)}
                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
                style={{ borderColor: "var(--border-ring)", color: "var(--text-secondary)" }}
              >
                <IconThumbsUp size={12} /> 예
              </button>
              <button
                onClick={() => onFeedback(message.id, meta.ticket_id, false)}
                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
                style={{ borderColor: "var(--border-ring)", color: "var(--text-secondary)" }}
              >
                <IconThumbsDown size={12} /> 아니요
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
