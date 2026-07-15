"use client";

import { useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { fetchDashboardStats, fetchCategories, type DashboardStats, type Category } from "@/lib/api";
import { CategoryIcon } from "@/lib/categoryIcons";
import {
  IconMessage,
  IconHeadset,
  IconBarChart,
  IconTrendingUp,
  IconAlertTriangle,
  IconActivity,
  IconAlertOctagon,
  IconHelpCircle,
  IconThumbsUp,
  IconThumbsDown,
} from "@/components/icons";

export type DashboardHandle = { refresh: () => void };

const WEEKDAY_ORDER = ["월", "화", "수", "목", "금", "토", "일"];

const Dashboard = forwardRef<DashboardHandle>(function Dashboard(_props, ref) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([fetchDashboardStats(), fetchCategories()]);
      setStats(s);
      setCategories(c);
      setError(null);
    } catch {
      setError("대시보드를 불러오지 못했습니다. 백엔드 서버(포트 8000)가 켜져 있는지 확인해주세요.");
    }
  }, []);

  useImperativeHandle(ref, () => ({ refresh: load }), [load]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <Card title="운영 현황">
        <p className="text-sm" style={{ color: "var(--status-critical)" }}>
          {error}
        </p>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card title="운영 현황">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>불러오는 중...</p>
      </Card>
    );
  }

  const categoryMax = Math.max(1, ...Object.values(stats.category_counts));
  const forecast = stats.call_volume_forecast;
  const hasForecastChart = forecast.status === "ok" || forecast.status === "preliminary";
  const weekdayValues = hasForecastChart ? forecast.weekday_avg_volume : {};
  const weekdayMax = Math.max(1, ...Object.values(weekdayValues));

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <StatTile label="총 문의 건수" value={stats.total_tickets} icon={<IconMessage size={18} />} />
        <StatTile
          label="상담원 연결 필요"
          value={stats.needs_human_count}
          accent={stats.needs_human_count > 0}
          icon={<IconHeadset size={18} />}
        />
      </div>

      <Card title="카테고리별 문의 분포" subtitle="문의 자동분류 · 라우팅" icon={<IconBarChart size={24} />}>
        {categories.length === 0 ? (
          <Empty text="아직 문의 데이터가 없습니다." />
        ) : (
          <div className="flex flex-col gap-2">
            {categories.map((cat) => (
              <BarRow
                key={cat.id}
                label={cat.name}
                icon={<CategoryIcon categoryId={cat.id} size={13} />}
                value={stats.category_counts[cat.id] ?? 0}
                max={categoryMax}
                color="var(--bar-neutral)"
              />
            ))}
          </div>
        )}
      </Card>

      <Card title="요일별 평균 상담량 예측" subtitle="상담량 예측" icon={<IconTrendingUp size={24} />}>
        {forecast.status === "insufficient_data" ? (
          <Empty text={forecast.message} />
        ) : (
          <>
            {forecast.status === "preliminary" && (
              <p className="mb-2 text-xs" style={{ color: "var(--status-warning)" }}>
                참고용 그래프입니다 (현재 {forecast.ticket_count}건 · 최소 {forecast.min_tickets_needed}건 쌓이면
                요일별 "평균"으로 전환됩니다).
              </p>
            )}
            <div className="flex flex-col gap-2">
              {WEEKDAY_ORDER.map((day) => (
                <BarRow
                  key={day}
                  label={`${day}요일`}
                  value={weekdayValues[day] ?? 0}
                  max={weekdayMax}
                  color="var(--accent)"
                />
              ))}
            </div>
            <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
              피크 시간대: {forecast.peak_hour !== null ? `${forecast.peak_hour}시` : "-"}
            </p>
          </>
        )}
      </Card>

      <Card title="장비 고장 사전 예측 경고" icon={<IconAlertTriangle size={24} />}>
        {stats.equipment_risk_warnings.length === 0 ? (
          <Empty text="현재 경고 없음" />
        ) : (
          <div className="flex flex-col gap-2">
            {stats.equipment_risk_warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border-ring)", background: "var(--page-plane)" }}
              >
                <IconAlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span style={{ color: "var(--text-primary)" }}>{w.message}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="트렌드 · 이상 탐지" subtitle="문의 급증 및 동시다발 이슈 자동 감지" icon={<IconActivity size={24} />}>
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-2 text-[10.5px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              카테고리 급증
            </p>
            {stats.category_trends.length === 0 ? (
              <Empty text="평소 대비 급증한 문의 유형 없음" />
            ) : (
              <div className="flex flex-col gap-2">
                {stats.category_trends.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--border-ring)", background: "var(--page-plane)" }}
                  >
                    <IconTrendingUp size={15} className="mt-0.5 shrink-0" style={{ color: "var(--status-warning)" }} />
                    <span style={{ color: "var(--text-primary)" }}>{t.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t pt-3" style={{ borderColor: "var(--border-ring)" }}>
            <p className="mb-2 text-[10.5px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              동시다발 장비 이슈 (시스템 전반 장애 의심)
            </p>
            {stats.multi_site_alerts.length === 0 ? (
              <Empty text="동시다발 이슈 없음" />
            ) : (
              <div className="flex flex-col gap-2">
                {stats.multi_site_alerts.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--status-critical)", background: "var(--page-plane)" }}
                  >
                    <IconAlertOctagon size={15} className="mt-0.5 shrink-0" style={{ color: "var(--status-critical)" }} />
                    <span style={{ color: "var(--text-primary)" }}>{a.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card
        title="지식 갭 자동 감지"
        subtitle={`AI 확신도가 ${Math.round(stats.knowledge_gaps.threshold * 100)}% 미만인 답변 — 고객 피드백 없이도 미리 발견`}
        icon={<IconHelpCircle size={24} />}
      >
        {stats.knowledge_gaps.tickets.length === 0 ? (
          <Empty text="확신도 낮은 답변이 없습니다." />
        ) : (
          <div className="flex flex-col gap-2">
            {stats.knowledge_gaps.tickets.map((t) => (
              <div key={t.id} className="rounded border px-3 py-2 text-xs" style={{ borderColor: "var(--border-ring)" }}>
                <div className="flex items-start justify-between gap-2">
                  <p style={{ color: "var(--text-primary)" }}>Q. {t.question}</p>
                  <span className="shrink-0 tabular-nums" style={{ color: "var(--status-warning)" }}>
                    확신도 {Math.round(t.confidence * 100)}%
                  </span>
                </div>
                {t.answer_summary && (
                  <p className="mt-1" style={{ color: "var(--text-muted)" }}>A. {t.answer_summary}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="답변 피드백" subtitle="고객이 남긴 도움됨 여부 — 품질 개선 루프" icon={<IconThumbsUp size={24} />}>
        <div className="mb-3 flex gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
            <IconThumbsUp size={13} /> 도움됨 <b className="tabular-nums" style={{ color: "var(--text-primary)" }}>{stats.feedback.helpful_count}</b>
          </span>
          <span className="inline-flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
            <IconThumbsDown size={13} /> 도움안됨 <b className="tabular-nums" style={{ color: "var(--status-critical)" }}>{stats.feedback.not_helpful_count}</b>
          </span>
        </div>
        {stats.feedback.unhelpful_tickets.length === 0 ? (
          <Empty text="아직 '도움안됨' 피드백이 없습니다." />
        ) : (
          <div className="flex flex-col gap-2">
            {stats.feedback.unhelpful_tickets.map((t) => (
              <div key={t.id} className="rounded border px-3 py-2 text-xs" style={{ borderColor: "var(--border-ring)" }}>
                <p style={{ color: "var(--text-primary)" }}>Q. {t.question}</p>
                {t.answer_summary && (
                  <p className="mt-1" style={{ color: "var(--text-muted)" }}>A. {t.answer_summary}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
});

export default Dashboard;

function Card({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border p-5" style={{ borderColor: "var(--border-ring)", background: "var(--surface-1)" }}>
      <div className="mb-3 flex items-center gap-2.5">
        {icon && <span style={{ color: "var(--accent)" }}>{icon}</span>}
        <div>
          <h2 className="text-[22px] font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>{title}</h2>
          {subtitle && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function StatTile({ label, value, accent, icon }: { label: string; value: number; accent?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="rounded border p-5" style={{ borderColor: "var(--border-ring)", background: "var(--surface-1)" }}>
      <div className="flex items-center gap-2">
        {icon && <span style={{ color: "var(--text-secondary)" }}>{icon}</span>}
        <p className="text-[15px] uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>{label}</p>
      </div>
      <p
        className="mt-1 text-center text-2xl font-bold tabular-nums"
        style={{ color: accent ? "var(--status-critical)" : "var(--text-primary)" }}
      >
        {value.toLocaleString("ko-KR")}
      </p>
    </div>
  );
}

function BarRow({ label, value, max, color, icon }: { label: string; value: number; max: number; color: string; icon?: React.ReactNode }) {
  const pct = Math.max(2, (value / max) * 100);
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="flex w-[124px] shrink-0 items-center gap-1.5 whitespace-nowrap uppercase tracking-wide" style={{ color: "var(--text-secondary)", fontSize: "10.5px" }}>
        {icon && <span className="shrink-0" style={{ color: "var(--text-muted)" }}>{icon}</span>}
        {label}
      </span>
      <div className="h-2 flex-1 rounded-full" style={{ background: "var(--bar-track)" }}>
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-8 shrink-0 text-right font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm" style={{ color: "var(--text-muted)" }}>{text}</p>;
}
