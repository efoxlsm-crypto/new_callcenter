const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Category = { id: string; name: string };

export type HistoryItem = { role: "user" | "assistant"; content: string };

export type ChatResponse = {
  ticket_id: number;
  summary: string;
  steps: string[];
  note: string | null;
  images: string[];
  category: string;
  category_name: string;
  is_hardware_issue: boolean;
  is_gov_network_issue: boolean;
  gov_network_notice: string | null;
  needs_human_agent: boolean;
  confidence: number;
};

export type CallVolumeForecast =
  | { status: "insufficient_data"; message: string; ticket_count: number }
  | {
      status: "ok" | "preliminary";
      ticket_count: number;
      min_tickets_needed: number;
      weekday_avg_volume: Record<string, number>;
      peak_hour: number | null;
      hourly_distribution: Record<string, number>;
    };

export type EquipmentRiskWarning = {
  site_id: string;
  device_type: string;
  occurrences: number;
  window_days: number;
  message: string;
};

export type UnhelpfulTicket = {
  id: number;
  question: string;
  answer_summary: string | null;
  category: string;
};

export type FeedbackSummary = {
  helpful_count: number;
  not_helpful_count: number;
  unhelpful_tickets: UnhelpfulTicket[];
};

export type CategoryTrend = {
  category: string;
  category_name: string;
  recent_count: number;
  baseline_avg_per_day: number;
  ratio: number | null;
  message: string;
};

export type MultiSiteAlert = {
  device_type: string;
  site_count: number;
  sites: string[];
  window_hours: number;
  message: string;
};

export type KnowledgeGapTicket = {
  id: number;
  question: string;
  answer_summary: string | null;
  category: string;
  confidence: number;
};

export type KnowledgeGapSummary = {
  threshold: number;
  count: number;
  tickets: KnowledgeGapTicket[];
};

export type DashboardStats = {
  total_tickets: number;
  category_counts: Record<string, number>;
  call_volume_forecast: CallVolumeForecast;
  equipment_risk_warnings: EquipmentRiskWarning[];
  category_trends: CategoryTrend[];
  multi_site_alerts: MultiSiteAlert[];
  needs_human_count: number;
  feedback: FeedbackSummary;
  knowledge_gaps: KnowledgeGapSummary;
};

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/categories`);
  if (!res.ok) throw new Error("카테고리 정보를 불러오지 못했습니다.");
  return res.json();
}

export async function fetchSites(): Promise<string[]> {
  const res = await fetch(`${API_URL}/sites`, { cache: "no-store" });
  if (!res.ok) throw new Error("업장 목록을 불러오지 못했습니다.");
  return res.json();
}

export async function sendChat(
  message: string,
  siteId: string,
  history: HistoryItem[] = []
): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, site_id: siteId || null, history }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || "답변을 받아오지 못했습니다.");
  }
  const data: ChatResponse = await res.json();
  return { ...data, images: data.images.map((path) => `${API_URL}${path}`) };
}

export async function sendFeedback(ticketId: number, helpful: boolean): Promise<void> {
  const res = await fetch(`${API_URL}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket_id: ticketId, helpful }),
  });
  if (!res.ok) throw new Error("피드백을 저장하지 못했습니다.");
}

export async function fetchDashboardStats(siteId?: string): Promise<DashboardStats> {
  const url = siteId ? `${API_URL}/dashboard/stats?site_id=${encodeURIComponent(siteId)}` : `${API_URL}/dashboard/stats`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("대시보드 정보를 불러오지 못했습니다.");
  return res.json();
}

export type AiInfo = {
  chat_model: string;
  vision_model: string;
  has_api_key: boolean;
  api_key_masked: string;
};

export type SystemInfo = {
  product: string;
  vendor: string;
  support_phone: string;
  support_site: string;
};

export type SettingsResponse = { ai: AiInfo; system_info: SystemInfo };

export async function fetchSettings(): Promise<SettingsResponse> {
  const res = await fetch(`${API_URL}/settings`, { cache: "no-store" });
  if (!res.ok) throw new Error("설정 정보를 불러오지 못했습니다.");
  return res.json();
}

export async function updateSystemInfo(info: SystemInfo): Promise<SystemInfo> {
  const res = await fetch(`${API_URL}/settings/system-info`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(info),
  });
  if (!res.ok) throw new Error("설정을 저장하지 못했습니다.");
  const data = await res.json();
  return data.system_info;
}

export async function fetchAvailableModels(): Promise<string[]> {
  const res = await fetch(`${API_URL}/settings/ai/models`, { cache: "no-store" });
  if (!res.ok) throw new Error("모델 목록을 불러오지 못했습니다.");
  const data = await res.json();
  return data.models;
}

export async function updateAiConfig(update: { chat_model?: string; api_key?: string }): Promise<AiInfo> {
  const res = await fetch(`${API_URL}/settings/ai`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error("AI 설정을 저장하지 못했습니다.");
  const data = await res.json();
  return data.ai;
}

// 아래 두 함수는 FastAPI 백엔드가 아니라, 이 Next.js 앱 자신의 API 라우트를 호출합니다
// (서버 실행/상태 확인은 브라우저가 아니라 프론트엔드 서버 프로세스에서 처리해야 하기 때문).
export type ServerStatus = { frontend: boolean; backend: boolean };

export async function fetchServerStatus(): Promise<ServerStatus> {
  const res = await fetch("/api/server-status", { cache: "no-store" });
  if (!res.ok) throw new Error("서버 상태를 확인하지 못했습니다.");
  return res.json();
}

export async function startBackendServer(): Promise<{ ok: boolean; already_running?: boolean }> {
  const res = await fetch("/api/start-backend", { method: "POST" });
  if (!res.ok) throw new Error("백엔드 서버를 시작하지 못했습니다.");
  return res.json();
}
