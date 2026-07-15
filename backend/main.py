"""챗봇 서버(API)의 시작점.

PowerShell에서 아래처럼 실행합니다:
    uvicorn backend.main:app --reload --port 8000
화면(UI)은 이제 별도의 Next.js 앱(web/ 폴더)에서 실행됩니다. 이 서버는 API만 제공합니다.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import ai_client, db, gov_network_status, predict
from .knowledge import CATEGORIES, category_name, faq_by_id, get_system_info, image_file_exists, update_system_info

# 참고용 표시 전용 (scripts/describe_images.py의 VISION_MODEL과 동일해야 함) — 실제로 호출되는
# 곳은 배치 스크립트뿐이라 여기서는 설정 화면에 보여주기 위한 상수로만 둡니다.
VISION_MODEL_DISPLAY = "meta-llama/llama-4-scout-17b-16e-instruct"

BASE_DIR = Path(__file__).resolve().parent.parent

app = FastAPI(title="FMCS 헬프데스크 AI 챗봇 API")

db.init_db()

# 로컬 개발용(localhost:3000)은 항상 허용하고, 배포된 프론트엔드 주소는
# .env의 FRONTEND_ORIGIN 환경변수로 추가 허용합니다 (Vercel 배포 시 그 주소를 설정).
_allowed_origins = ["http://localhost:3000"]
if os.environ.get("FRONTEND_ORIGIN"):
    _allowed_origins.append(os.environ["FRONTEND_ORIGIN"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/images", StaticFiles(directory=BASE_DIR / "data" / "images"), name="images")


class HistoryItem(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    site_id: str | None = None
    history: list[HistoryItem] = []


class FeedbackRequest(BaseModel):
    ticket_id: int
    helpful: bool


class SystemInfoUpdate(BaseModel):
    product: str
    vendor: str
    support_phone: str
    support_site: str


class AiConfigUpdate(BaseModel):
    chat_model: str | None = None
    api_key: str | None = None


@app.get("/categories")
def categories():
    return CATEGORIES


@app.get("/sites")
def sites():
    return db.fetch_sites()


@app.get("/settings")
def get_settings():
    return {
        "ai": {**ai_client.get_ai_config(), "vision_model": VISION_MODEL_DISPLAY},
        "system_info": get_system_info(),
    }


@app.get("/settings/ai/models")
def get_available_models():
    return {"models": ai_client.list_available_models()}


@app.put("/settings/ai")
def put_ai_config(req: AiConfigUpdate):
    updated = ai_client.update_ai_config(chat_model=req.chat_model, api_key=req.api_key)
    return {"ok": True, "ai": {**updated, "vision_model": VISION_MODEL_DISPLAY}}


@app.put("/settings/system-info")
def put_system_info(req: SystemInfoUpdate):
    updated = update_system_info(req.product, req.vendor, req.support_phone, req.support_site)
    return {"ok": True, "system_info": updated}


@app.post("/chat")
def chat(req: ChatRequest):
    try:
        result = ai_client.ask(req.message, history=[h.model_dump() for h in req.history])
    except ai_client.AIUnavailableError as e:
        raise HTTPException(status_code=429, detail=str(e))

    # 행정공동망/감면 관련 문의로 판단되면, FAQ 답변보다 먼저 실제 공동망 사이트에
    # 서비스 중단 공지가 떠 있는지 확인합니다. 공지가 있으면 그게 진짜 원인일 가능성이
    # 높으므로 FAQ 기반 답변 대신 이 안내로 대체합니다.
    gov_notice = None
    if result["is_gov_network_issue"]:
        gov_notice = gov_network_status.get_outage_notice()
        if gov_notice:
            result["summary"] = (
                "지금 행정공동망(정부 공동이용시스템)에 서비스 중단 공지가 올라와 있습니다. "
                "감면/공동망 관련 문제는 이 때문일 수 있어요."
            )
            result["steps"] = []
            result["note"] = "아래 버튼으로 행정공동망 사이트에서 공지 내용을 직접 확인해보세요."
            result["needs_human_agent"] = False

    if req.site_id:
        db.upsert_site(req.site_id)

    ticket_id = db.insert_ticket(
        site_id=req.site_id,
        question=req.message,
        category=result["category"],
        device_type=result.get("device_type"),
        is_hardware_issue=result["is_hardware_issue"],
        needs_human_agent=result["needs_human_agent"],
        confidence=result["confidence"],
        answer_summary=result["summary"],
    )

    images = []
    for faq_id in result.get("matched_faq_ids", []):
        entry = faq_by_id(faq_id)
        image_file = entry.get("image_file") if entry else None
        if image_file_exists(image_file):
            images.append(f"/images/{image_file}")

    return {
        "ticket_id": ticket_id,
        "summary": result["summary"],
        "steps": result["steps"],
        "note": result.get("note"),
        "images": images,
        "category": result["category"],
        "category_name": category_name(result["category"]),
        "is_hardware_issue": result["is_hardware_issue"],
        "is_gov_network_issue": result["is_gov_network_issue"],
        "gov_network_notice": gov_notice,
        "needs_human_agent": result["needs_human_agent"],
        "confidence": result["confidence"],
    }


@app.post("/feedback")
def feedback(req: FeedbackRequest):
    updated = db.set_feedback(req.ticket_id, req.helpful)
    if not updated:
        raise HTTPException(status_code=404, detail="해당 문의를 찾을 수 없습니다.")
    return {"ok": True}


@app.get("/dashboard/stats")
def dashboard_stats(site_id: str | None = None):
    """site_id를 주면 그 업장 문의만으로 통계를 냅니다. 안 주면("공통") 전체 업장 합산입니다.

    단, multi_site_alerts(동시다발 장비 이슈)는 여러 업장에 걸친 데이터가 있어야 의미가 있는
    지표라서 업장 필터와 무관하게 항상 전체 업장 기준으로 보여줍니다.
    """
    all_tickets = db.fetch_all_tickets()
    tickets = [t for t in all_tickets if not site_id or t["site_id"] == site_id]

    category_counts: dict[str, int] = {}
    for t in tickets:
        category_counts[t["category"]] = category_counts.get(t["category"], 0) + 1

    helpful_count = sum(1 for t in tickets if t["helpful"] == 1)
    not_helpful_count = sum(1 for t in tickets if t["helpful"] == 0)

    LOW_CONFIDENCE_THRESHOLD = 0.5
    low_confidence_tickets = [
        t for t in tickets if t["confidence"] is not None and t["confidence"] < LOW_CONFIDENCE_THRESHOLD
    ]

    return {
        "total_tickets": len(tickets),
        "category_counts": category_counts,
        "call_volume_forecast": predict.call_volume_forecast(site_id),
        "equipment_risk_warnings": predict.equipment_risk_warnings(site_id),
        "category_trends": predict.category_trends(site_id),
        "multi_site_alerts": predict.multi_site_device_alerts(),
        "needs_human_count": sum(1 for t in tickets if t["needs_human_agent"]),
        "feedback": {
            "helpful_count": helpful_count,
            "not_helpful_count": not_helpful_count,
            "unhelpful_tickets": [
                {"id": t["id"], "question": t["question"], "answer_summary": t["answer_summary"], "category": t["category"]}
                for t in tickets
                if t["helpful"] == 0
            ][:5],
        },
        "knowledge_gaps": {
            "threshold": LOW_CONFIDENCE_THRESHOLD,
            "count": len(low_confidence_tickets),
            "tickets": [
                {
                    "id": t["id"],
                    "question": t["question"],
                    "answer_summary": t["answer_summary"],
                    "category": t["category"],
                    "confidence": t["confidence"],
                }
                for t in low_confidence_tickets[:5]
            ],
        },
    }
