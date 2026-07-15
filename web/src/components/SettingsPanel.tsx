"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchSettings,
  updateSystemInfo,
  fetchAvailableModels,
  updateAiConfig,
  fetchServerStatus,
  startBackendServer,
  type SettingsResponse,
  type SystemInfo,
  type ServerStatus,
} from "@/lib/api";
import { IconSettings } from "@/components/icons";

export default function SettingsPanel() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [form, setForm] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [startingBackend, setStartingBackend] = useState(false);
  const [startBackendError, setStartBackendError] = useState<string | null>(null);

  const loadSettings = useCallback(() => {
    fetchSettings()
      .then((s) => {
        setSettings(s);
        setForm(s.system_info);
        setSelectedModel(s.ai.chat_model);
        setError(null);
      })
      .catch(() => setError("설정 정보를 불러오지 못했습니다. 백엔드 서버(포트 8000)가 켜져 있는지 확인해주세요."));
    fetchAvailableModels()
      .then(setModels)
      .catch(() => {});
  }, []);

  const checkServerStatus = useCallback(async () => {
    setCheckingStatus(true);
    try {
      const status = await fetchServerStatus();
      setServerStatus(status);
    } catch {
      setServerStatus({ frontend: true, backend: false });
    } finally {
      setCheckingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    checkServerStatus();
  }, [loadSettings, checkServerStatus]);

  async function handleStartBackend() {
    setStartingBackend(true);
    setStartBackendError(null);
    try {
      await startBackendServer();
      // 프로세스가 완전히 뜰 때까지 잠깐 기다렸다가 상태를 다시 확인하고, 설정 정보도 다시 불러옵니다.
      await new Promise((r) => setTimeout(r, 3000));
      await checkServerStatus();
      loadSettings();
    } catch (e) {
      setStartBackendError(e instanceof Error ? e.message : "백엔드 서버를 시작하지 못했습니다.");
    } finally {
      setStartingBackend(false);
    }
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const updated = await updateSystemInfo(form);
      setForm(updated);
      setSaved(true);
    } catch {
      setError("저장하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAiSave() {
    if (!settings) return;
    setAiSaving(true);
    setAiSaved(false);
    setAiError(null);
    try {
      const update: { chat_model?: string; api_key?: string } = {};
      if (selectedModel && selectedModel !== settings.ai.chat_model) update.chat_model = selectedModel;
      if (apiKeyInput.trim()) update.api_key = apiKeyInput.trim();

      if (!update.chat_model && !update.api_key) {
        setAiSaving(false);
        return;
      }

      const updatedAi = await updateAiConfig(update);
      setSettings({ ...settings, ai: updatedAi });
      setSelectedModel(updatedAi.chat_model);
      setApiKeyInput("");
      setAiSaved(true);
    } catch {
      setAiError("AI 설정을 저장하지 못했습니다. API 키가 올바른지 확인해주세요.");
    } finally {
      setAiSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <div className="flex items-center gap-2 px-1">
        <IconSettings size={18} style={{ color: "var(--accent)" }} />
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>설정</h1>
      </div>

      <section className="rounded border p-5" style={{ borderColor: "var(--border-ring)", background: "var(--surface-1)" }}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
            서버 상태
          </h2>
          <button
            onClick={checkServerStatus}
            disabled={checkingStatus}
            className="text-xs underline disabled:opacity-50"
            style={{ color: "var(--text-secondary)" }}
          >
            {checkingStatus ? "확인 중..." : "새로고침"}
          </button>
        </div>
        <p className="mb-4 text-xs" style={{ color: "var(--text-muted)" }}>
          FRONT · ADMIN은 이 화면 하나(프론트엔드 서버)의 메뉴 탭일 뿐이라 따로 켜고 끄는 서버가
          아닙니다. 실제로 따로 떠 있는 서버는 아래 2개입니다.
        </p>
        <div className="flex flex-col gap-2">
          <ServerRow
            label="프론트엔드 (화면, :3000)"
            note="지금 이 화면 자체가 프론트엔드라 항상 실행 중입니다."
            up={serverStatus?.frontend ?? true}
          />
          <ServerRow
            label="백엔드 (API, :8000)"
            note="채팅 응답·대시보드·설정 저장을 처리하는 서버입니다."
            up={serverStatus?.backend ?? false}
          />
        </div>
        {serverStatus && !serverStatus.backend && (
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleStartBackend}
              disabled={startingBackend}
              className="rounded px-4 py-2 text-xs font-semibold transition disabled:opacity-50"
              style={{ background: "var(--status-critical)", color: "var(--accent-contrast)" }}
            >
              {startingBackend ? "시작하는 중..." : "백엔드 서버 시작"}
            </button>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              로컬 PC에서만 동작합니다 (배포 환경에서는 사용할 수 없음).
            </span>
          </div>
        )}
        {startBackendError && (
          <p className="mt-2 text-xs" style={{ color: "var(--status-critical)" }}>{startBackendError}</p>
        )}
      </section>

      {error && (
        <div className="rounded border px-4 py-3 text-sm" style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)" }}>
          {error}
        </div>
      )}

      {!settings || !form ? (
        <p className="px-1 text-sm" style={{ color: "var(--text-muted)" }}>불러오는 중...</p>
      ) : (
        <>
          <section className="rounded border p-5" style={{ borderColor: "var(--border-ring)", background: "var(--surface-1)" }}>
            <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
              AI 모델 정보
            </h2>
            <p className="mb-4 text-xs" style={{ color: "var(--text-muted)" }}>
              답변 생성 모델과 API 키를 여기서 바로 바꿀 수 있습니다. 저장하면 서버 재시작 없이 바로 반영됩니다.
            </p>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>답변 생성 모델</span>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="rounded border px-3 py-2 text-sm outline-none focus:ring-1"
                  style={{ borderColor: "var(--border-ring)", color: "var(--text-primary)", background: "var(--surface-1)" }}
                >
                  {!models.includes(selectedModel) && selectedModel && (
                    <option value={selectedModel}>{selectedModel}</option>
                  )}
                  {models.length === 0 && <option value={selectedModel}>{selectedModel} (목록을 불러오는 중)</option>}
                  {models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Groq API 키</span>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={settings.ai.has_api_key ? `저장됨 (${settings.ai.api_key_masked}) — 바꾸려면 새 키를 입력` : "gsk_로 시작하는 키를 입력하세요"}
                  className="rounded border px-3 py-2 text-sm outline-none focus:ring-1"
                  style={{ borderColor: "var(--border-ring)", color: "var(--text-primary)", background: "var(--surface-1)" }}
                />
              </label>

              <InfoRow label="이미지 설명 모델 (스크린샷 분석용, 1회성 배치 — 변경 불가)" value={settings.ai.vision_model} />
            </div>

            {aiError && <p className="mt-3 text-xs" style={{ color: "var(--status-critical)" }}>{aiError}</p>}

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleAiSave}
                disabled={aiSaving}
                className="rounded px-5 py-2 text-sm font-semibold transition disabled:opacity-50"
                style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
              >
                {aiSaving ? "저장 중..." : "저장"}
              </button>
              {aiSaved && <span className="text-xs" style={{ color: "var(--status-good)" }}>저장됐습니다.</span>}
            </div>
          </section>

          <section className="rounded border p-5" style={{ borderColor: "var(--border-ring)", background: "var(--surface-1)" }}>
            <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
              시스템 정보
            </h2>
            <p className="mb-4 text-xs" style={{ color: "var(--text-muted)" }}>
              고객 안내와 AI 답변에 쓰이는 기본 정보입니다. 여기서 수정하면 서버 재시작 없이 바로 반영됩니다.
            </p>
            <div className="flex flex-col gap-3">
              <Field label="제품명" value={form.product} onChange={(v) => setForm({ ...form, product: v })} />
              <Field label="제조사" value={form.vendor} onChange={(v) => setForm({ ...form, vendor: v })} />
              <Field
                label="기술지원 전화번호"
                value={form.support_phone}
                onChange={(v) => setForm({ ...form, support_phone: v })}
              />
              <Field
                label="지원 사이트 URL"
                value={form.support_site}
                onChange={(v) => setForm({ ...form, support_site: v })}
              />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded px-5 py-2 text-sm font-semibold transition disabled:opacity-50"
                style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
              >
                {saving ? "저장 중..." : "저장"}
              </button>
              {saved && <span className="text-xs" style={{ color: "var(--status-good)" }}>저장됐습니다.</span>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ServerRow({ label, note, up }: { label: string; note: string; up: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded border px-3 py-2" style={{ borderColor: "var(--border-ring)", background: "var(--page-plane)" }}>
      <div>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>{label}</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{note}</p>
      </div>
      <span
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{
          background: up ? "var(--status-good-soft, var(--page-plane))" : "var(--status-critical)",
          color: up ? "var(--status-good)" : "var(--accent-contrast)",
        }}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: up ? "var(--status-good)" : "var(--accent-contrast)" }} />
        {up ? "실행 중" : "꺼짐"}
      </span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded border px-3 py-2" style={{ borderColor: "var(--border-ring)", background: "var(--page-plane)" }}>
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="font-mono text-xs" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border px-3 py-2 text-sm outline-none focus:ring-1"
        style={{ borderColor: "var(--border-ring)", color: "var(--text-primary)", background: "var(--surface-1)" }}
      />
    </label>
  );
}
