"""예측 서비스 로직.

정직하게 밝히자면: 진짜 머신러닝 예측이 아니라 "축적된 문의 로그를 통계적으로 요약"하는
수준의 실용적인 예측입니다. 데이터(문의 로그)가 쌓일수록 정확해집니다.
운영 초반에는 데이터가 적어 "데이터 부족" 상태로 표시됩니다.
"""
from collections import defaultdict
from datetime import datetime, timedelta

from .db import fetch_all_tickets
from .knowledge import category_name

WEEKDAY_NAMES_KO = ["월", "화", "수", "목", "금", "토", "일"]

EQUIPMENT_RISK_WINDOW_DAYS = 14
EQUIPMENT_RISK_THRESHOLD = 2
MIN_TICKETS_FOR_VOLUME_FORECAST = 14

# 트렌드(급증) 감지 설정
TREND_RECENT_DAYS = 3       # "최근" 기간
TREND_BASELINE_DAYS = 14    # 비교 기준(베이스라인) 기간 — 이 기간에서 최근 기간을 뺀 만큼이 "평소" 구간
TREND_SURGE_RATIO = 2.0     # 평소 대비 이 배수 이상이면 "급증"
TREND_MIN_RECENT_COUNT = 3  # 노이즈 방지용 최소 건수

# 동시다발 장비 이슈 감지 설정 (여러 업장에서 같은 장비 문제가 한꺼번에 발생 = 시스템/결제사 이슈 가능성)
MULTI_SITE_WINDOW_HOURS = 48
MULTI_SITE_MIN_SITES = 3


def call_volume_forecast():
    """요일별 문의량을 계산합니다. (상담량 예측 #1)

    데이터가 1건이라도 있으면 바로 그래프를 그릴 수 있도록 값을 돌려줍니다.
    다만 최소 건수(MIN_TICKETS_FOR_VOLUME_FORECAST) 미만이면 "참고용" 상태로 표시해서,
    아직 요일 패턴을 신뢰하기엔 이르다는 걸 화면에서 알 수 있게 합니다.
    """
    tickets = fetch_all_tickets()
    if len(tickets) == 0:
        return {
            "status": "insufficient_data",
            "message": "아직 문의 데이터가 없습니다. 문의가 쌓이면 요일별 상담량 그래프가 표시됩니다.",
            "ticket_count": 0,
        }

    by_weekday = defaultdict(int)
    by_hour = defaultdict(int)
    days_seen = set()

    for t in tickets:
        dt = t["created_at"]
        by_weekday[dt.weekday()] += 1
        by_hour[dt.hour] += 1
        days_seen.add(dt.date())

    n_weeks = max(1, len(days_seen) / 7)
    is_preliminary = len(tickets) < MIN_TICKETS_FOR_VOLUME_FORECAST

    weekday_volume = {
        WEEKDAY_NAMES_KO[wd]: (
            by_weekday.get(wd, 0) if is_preliminary else round(by_weekday.get(wd, 0) / n_weeks, 1)
        )
        for wd in range(7)
    }
    peak_hour = max(by_hour.items(), key=lambda kv: kv[1])[0] if by_hour else None

    return {
        "status": "preliminary" if is_preliminary else "ok",
        "ticket_count": len(tickets),
        "min_tickets_needed": MIN_TICKETS_FOR_VOLUME_FORECAST,
        "weekday_avg_volume": weekday_volume,
        "peak_hour": peak_hour,
        "hourly_distribution": dict(sorted(by_hour.items())),
    }


def equipment_risk_warnings():
    """같은 업장(site)에서 같은 장비 관련 문의가 짧은 기간에 반복되면 경고합니다. (장비고장 사전예측)"""
    tickets = fetch_all_tickets()
    cutoff = datetime.now() - timedelta(days=EQUIPMENT_RISK_WINDOW_DAYS)

    recent_hw_tickets = [
        t
        for t in tickets
        if t["is_hardware_issue"] and t["created_at"] >= cutoff
    ]

    groups = defaultdict(list)
    for t in recent_hw_tickets:
        key = (t["site_id"] or "미지정업장", t["device_type"] or "미지정장비")
        groups[key].append(t)

    warnings = []
    for (site_id, device_type), group_tickets in groups.items():
        if len(group_tickets) >= EQUIPMENT_RISK_THRESHOLD:
            warnings.append(
                {
                    "site_id": site_id,
                    "device_type": device_type,
                    "occurrences": len(group_tickets),
                    "window_days": EQUIPMENT_RISK_WINDOW_DAYS,
                    "message": (
                        f"[{site_id}] {device_type} 관련 문의가 최근 {EQUIPMENT_RISK_WINDOW_DAYS}일간 "
                        f"{len(group_tickets)}회 발생했습니다. 장비 점검을 권장합니다."
                    ),
                }
            )

    warnings.sort(key=lambda w: w["occurrences"], reverse=True)
    return warnings


def category_trends():
    """카테고리별 문의량이 평소(베이스라인) 대비 급증했는지 감지합니다. (트렌드/이상탐지 #1)

    "최근 N일"의 하루 평균 문의량을, 그 이전 "베이스라인 기간"의 하루 평균과 비교합니다.
    베이스라인이 아예 없는(그동안 문의가 없던) 새 유형은 최근 건수만으로 판단합니다.
    """
    tickets = fetch_all_tickets()
    now = datetime.now()
    recent_cutoff = now - timedelta(days=TREND_RECENT_DAYS)
    baseline_cutoff = now - timedelta(days=TREND_BASELINE_DAYS)
    baseline_days = TREND_BASELINE_DAYS - TREND_RECENT_DAYS

    recent_counts = defaultdict(int)
    baseline_counts = defaultdict(int)
    for t in tickets:
        dt = t["created_at"]
        if dt >= recent_cutoff:
            recent_counts[t["category"]] += 1
        elif dt >= baseline_cutoff:
            baseline_counts[t["category"]] += 1

    trends = []
    for category, recent_n in recent_counts.items():
        if recent_n < TREND_MIN_RECENT_COUNT:
            continue
        baseline_n = baseline_counts.get(category, 0)
        recent_avg = recent_n / TREND_RECENT_DAYS
        cat_label = category_name(category)

        if baseline_n == 0:
            trends.append({
                "category": category,
                "category_name": cat_label,
                "recent_count": recent_n,
                "baseline_avg_per_day": 0,
                "ratio": None,
                "message": (
                    f"'{cat_label}' 문의가 최근 {TREND_RECENT_DAYS}일간 새롭게 {recent_n}건 발생했습니다 "
                    f"(그 이전에는 없었습니다)."
                ),
            })
            continue

        baseline_avg = baseline_n / baseline_days
        if baseline_avg <= 0:
            continue
        ratio = recent_avg / baseline_avg
        if ratio >= TREND_SURGE_RATIO:
            trends.append({
                "category": category,
                "category_name": cat_label,
                "recent_count": recent_n,
                "baseline_avg_per_day": round(baseline_avg, 1),
                "ratio": round(ratio, 1),
                "message": (
                    f"'{cat_label}' 문의가 최근 {TREND_RECENT_DAYS}일간 하루 평균 {recent_avg:.1f}건으로, "
                    f"평소({baseline_avg:.1f}건/일) 대비 {ratio:.1f}배 급증했습니다."
                ),
            })

    trends.sort(key=lambda t: t["ratio"] if t["ratio"] is not None else 999, reverse=True)
    return trends


def multi_site_device_alerts():
    """같은 장비 유형 문제가 여러 업장에서 동시에 발생하면 경고합니다. (트렌드/이상탐지 #2)

    한 업장에서만 반복되면 그 업장 장비의 문제(= equipment_risk_warnings)이지만,
    서로 다른 여러 업장에서 동시에 발생하면 결제사·시스템 전반의 장애일 가능성이 높습니다.
    """
    tickets = fetch_all_tickets()
    cutoff = datetime.now() - timedelta(hours=MULTI_SITE_WINDOW_HOURS)

    sites_by_device = defaultdict(set)
    for t in tickets:
        if not t["is_hardware_issue"]:
            continue
        if t["created_at"] < cutoff:
            continue
        device = t["device_type"] or "미지정장비"
        site = t["site_id"] or "미지정업장"
        sites_by_device[device].add(site)

    alerts = []
    for device, sites in sites_by_device.items():
        if len(sites) >= MULTI_SITE_MIN_SITES:
            alerts.append({
                "device_type": device,
                "site_count": len(sites),
                "sites": sorted(sites),
                "window_hours": MULTI_SITE_WINDOW_HOURS,
                "message": (
                    f"'{device}' 관련 문의가 최근 {MULTI_SITE_WINDOW_HOURS}시간 내 서로 다른 업장 "
                    f"{len(sites)}곳에서 동시에 발생했습니다 — 개별 장비 고장이 아니라 시스템/결제사 "
                    "전반의 장애일 수 있습니다."
                ),
            })

    alerts.sort(key=lambda a: a["site_count"], reverse=True)
    return alerts
