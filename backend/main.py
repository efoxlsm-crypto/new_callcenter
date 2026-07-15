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
from .knowledge import CATEGORIES, category_name, faq_by_id, image_file_exists

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


@app.get("/categories")
def categories():
    return CATEGORIES


@app.get("/sites")
def sites():
    return db.fetch_sites()


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
def dashboard_stats():
    tickets = db.fetch_all_tickets()
    category_counts: dict[str, int] = {}
    for t in tickets:
        category_counts[t["category"]] = category_counts.get(t["category"], 0) + 1

    helpful_count = sum(1 for t in tickets if t["helpful"] == 1)
    not_helpful_count = sum(1 for t in tickets if t["helpful"] == 0)

    LOW_CONFIDENCE_THRESHOLD = 0.5

    return {
        "total_tickets": len(tickets),
        "category_counts": category_counts,
        "call_volume_forecast": predict.call_volume_forecast(),
        "equipment_risk_warnings": predict.equipment_risk_warnings(),
        "category_trends": predict.category_trends(),
        "multi_site_alerts": predict.multi_site_device_alerts(),
        "needs_human_count": sum(1 for t in tickets if t["needs_human_agent"]),
        "feedback": {
            "helpful_count": helpful_count,
            "not_helpful_count": not_helpful_count,
            "unhelpful_tickets": [
                {"id": t["id"], "question": t["question"], "answer_summary": t["answer_summary"], "category": t["category"]}
                for t in db.fetch_unhelpful_tickets(limit=5)
            ],
        },
        "knowledge_gaps": {
            "threshold": LOW_CONFIDENCE_THRESHOLD,
            "count": db.count_low_confidence_tickets(LOW_CONFIDENCE_THRESHOLD),
            "tickets": [
                {
                    "id": t["id"],
                    "question": t["question"],
                    "answer_summary": t["answer_summary"],
                    "category": t["category"],
                    "confidence": t["confidence"],
                }
                for t in db.fetch_low_confidence_tickets(LOW_CONFIDENCE_THRESHOLD, limit=5)
            ],
        },
    }
