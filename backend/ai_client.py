"""Groq API와 대화하는 부분.

한 번의 API 호출로 여러가지를 동시에 처리합니다 (Structured Outputs / JSON Schema strict 모드):
1. 정리된(한눈에 보기 쉬운) 한국어 답변 생성 — 한줄요약 + 단계별 안내 + 참고사항 (FAQ 지식창고 기반)
2. 답변 근거가 된 FAQ를 인용 → 그 FAQ에 딸린 실제 화면 스크린샷을 답변과 함께 표시 (backend/main.py에서 처리)
3. 문의 카테고리 자동 분류 (예측 서비스 #1: 자동분류/라우팅)
4. 장비(하드웨어) 관련 문의인지 판단 (예측 서비스 #3: 장비고장 사전예측의 재료)
"""
import json
import os
from pathlib import Path

import groq
from dotenv import set_key
from groq import Groq

from .knowledge import build_knowledge_context, category_ids

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"

# 모델/API 키는 설정 화면(UI)에서 바로 바꿀 수 있어야 해서, 모듈 상수가 아니라
# 실행 중에 바꿔 끼울 수 있는 상태로 관리합니다. 바뀌면 .env 파일에도 저장해서
# 서버를 재시작해도 유지됩니다.
_state = {
    "model": os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b"),
    "api_key": os.environ.get("GROQ_API_KEY", ""),
}

# 무료 티어는 분당 토큰 한도(TPM)가 낮아서, 한도에 걸리면 SDK가 기본적으로
# 오래(최대 몇 분) 재시도합니다. 채팅은 실시간 응답이 중요하므로 재시도를 1회로 줄이고
# 타임아웃도 짧게 잡아서, 막히면 빨리 실패하고 사용자에게 안내할 수 있게 합니다.
client = Groq(api_key=_state["api_key"] or None, timeout=20.0, max_retries=1)

RATE_LIMIT_MESSAGE = (
    "지금 문의가 몰려서 잠시 응답이 지연되고 있습니다. 10~20초 후 다시 시도해주세요. "
    "(무료 API 사용량 한도 — 계속 반복되면 관리자에게 Groq 요금제 업그레이드를 문의하세요)"
)


def get_ai_config():
    """설정 화면에 보여줄 AI 설정. API 키는 원문 그대로 돌려주지 않고 뒷 4자리만 보여줍니다."""
    key = _state["api_key"] or ""
    if len(key) >= 4:
        masked = f"{'*' * max(len(key) - 4, 4)}{key[-4:]}"
    else:
        masked = ""
    return {
        "chat_model": _state["model"],
        "has_api_key": bool(key),
        "api_key_masked": masked,
    }


def update_ai_config(chat_model: str | None = None, api_key: str | None = None):
    """설정 화면에서 모델/API 키를 바꾸면 즉시 반영하고 .env에도 저장합니다 (서버 재시작 불필요)."""
    global client
    if chat_model:
        _state["model"] = chat_model
        set_key(str(ENV_PATH), "GROQ_MODEL", chat_model)
    if api_key:
        _state["api_key"] = api_key
        client = Groq(api_key=api_key, timeout=20.0, max_retries=1)
        set_key(str(ENV_PATH), "GROQ_API_KEY", api_key)
    return get_ai_config()


# 채팅 답변 생성에 쓸 수 없는 모델(음성 인식/TTS/분류 전용)은 선택 목록에서 제외합니다.
_NON_CHAT_MODEL_HINTS = ("whisper", "orpheus", "prompt-guard", "tts")


def list_available_models():
    """이 API 키로 실제 사용 가능한 Groq 채팅 모델 목록을 조회합니다 (설정 화면의 모델 선택 드롭다운용)."""
    try:
        response = client.models.list()
        ids = [m.id for m in response.data]
    except Exception:
        return []
    return sorted(i for i in ids if not any(hint in i.lower() for hint in _NON_CHAT_MODEL_HINTS))


class AIUnavailableError(Exception):
    """AI 응답을 받지 못했을 때 (사용량 한도 초과, 타임아웃 등) — 화면에 그대로 보여줄 안내 메시지를 담습니다."""

SYSTEM_HEADER = (
    "너는 FMCS(회원관리 프로그램) 및 온라인예약 시스템의 헬프데스크 상담 AI야. "
    "아래 [지식창고]에 있는 FAQ와 시스템 배경지식만 근거로 답변해. "
    "지식창고에 없는 내용이면 지어내지 말고 needs_human_agent를 true로 설정하고, "
    "정중하게 기술지원팀(1577-6846)으로 연결 안내를 note에 포함해. "
    "이전 대화 내역이 있으면 참고해서 문맥에 맞게 답변해 — 예를 들어 '그럼 그건요?' 같은 "
    "후속 질문은 직전 대화 주제를 이어받아 이해해야 해. "
    "답변은 절대 하나의 긴 문단으로 쓰지 말고 반드시 아래 형식을 지켜: "
    "summary는 결론을 담은 한 문장, steps는 실제 조작 순서(메뉴 경로 포함)를 "
    "단계별로 쪼갠 배열(불필요하면 빈 배열), note는 주의사항이나 예외 상황(없으면 null). "
    "steps 배열의 각 항목에는 '1.' '①' 같은 번호나 순번을 절대 붙이지 마 — 화면에서 "
    "자동으로 번호를 매기니까 항목 내용만 순수하게 적어. "
    "고객이 한눈에 훑어볼 수 있도록 간결하고 친절한 존댓말을 사용해."
)

MAX_HISTORY_MESSAGES = 8  # 최근 4턴(질문+답변)까지만 대화 맥락으로 사용 (토큰 한도 보호)

RESPONSE_SCHEMA = {
    "name": "respond_to_inquiry",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "category": {
                "type": "string",
                "enum": category_ids() + ["unknown"],
                "description": "문의가 속하는 카테고리",
            },
            "is_hardware_issue": {
                "type": "boolean",
                "description": "IC카드리더기/바코드리더기/영수증프린터/키오스크 등 물리적 장비 문제인지 여부",
            },
            "device_type": {
                "type": ["string", "null"],
                "description": "하드웨어 문제일 경우 장비명 (예: 'IC카드리더기'), 아니면 null",
            },
            "is_gov_network_issue": {
                "type": "boolean",
                "description": (
                    "행정공동망(관공서 연계망) 오류, 또는 국가유공자/장애인/기초생활수급자 등 "
                    "감면 확인·조회가 안 된다는 문의인지 여부"
                ),
            },
            "confidence": {
                "type": "number",
                "description": "이 분류/답변에 대한 확신도 (0.0~1.0)",
            },
            "summary": {
                "type": "string",
                "description": "결론을 담은 한 문장 (고객이 가장 먼저 보는 한줄 요약)",
            },
            "steps": {
                "type": "array",
                "items": {"type": "string"},
                "description": "단계별 조작 순서. 단계로 나눌 필요가 없으면 빈 배열([])",
            },
            "note": {
                "type": ["string", "null"],
                "description": "주의사항, 예외 상황, 또는 상담원 연결 안내. 없으면 null",
            },
            "matched_faq_ids": {
                "type": "array",
                "items": {"type": "string"},
                "description": "답변의 근거가 된 FAQ id 목록 (지식창고의 ID: 값 그대로)",
            },
            "needs_human_agent": {
                "type": "boolean",
                "description": "지식창고로 해결 불가능하여 사람 상담원 연결이 필요한지 여부",
            },
        },
        "required": [
            "category",
            "is_hardware_issue",
            "device_type",
            "is_gov_network_issue",
            "confidence",
            "summary",
            "steps",
            "note",
            "matched_faq_ids",
            "needs_human_agent",
        ],
        "additionalProperties": False,
    },
}


def ask(question: str, history: list[dict] | None = None) -> dict:
    # 클라이언트가 role에 "system"을 넣어 지침을 덮어쓰는 걸 방지 (프롬프트 인젝션 방어)
    safe_history = [
        {"role": h["role"], "content": str(h["content"])}
        for h in (history or [])
        if h.get("role") in ("user", "assistant") and h.get("content")
    ][-MAX_HISTORY_MESSAGES:]

    # 후속 질문("그럼 그건요?")도 잘 검색되도록, 직전 사용자 발화 + 현재 질문을 합쳐서 FAQ를 찾습니다.
    prior_user_texts = [h["content"] for h in safe_history if h["role"] == "user"]
    retrieval_query = " ".join(prior_user_texts[-1:] + [question])

    messages = [
        {"role": "system", "content": SYSTEM_HEADER},
        {"role": "system", "content": f"[지식창고]\n{build_knowledge_context(retrieval_query)}"},
        *safe_history,
        {"role": "user", "content": question},
    ]

    # 모델이 가끔 JSON 스키마를 어기는 답변을 만들 때가 있어(특히 작은/저렴한 모델일수록),
    # 한 번은 자동으로 재시도합니다 — 그래도 안 되면 사람 상담원 연결로 안내합니다.
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model=_state["model"],
                messages=messages,
                response_format={"type": "json_schema", "json_schema": RESPONSE_SCHEMA},
            )
            return json.loads(response.choices[0].message.content)
        except groq.RateLimitError as e:
            raise AIUnavailableError(RATE_LIMIT_MESSAGE) from e
        except (groq.APITimeoutError, groq.APIConnectionError) as e:
            raise AIUnavailableError("AI 서버 응답이 너무 늦어 요청을 취소했습니다. 다시 시도해주세요.") from e
        except groq.BadRequestError as e:
            last_error = e
            continue

    raise AIUnavailableError(
        "AI가 답변 형식을 만드는데 실패했습니다. 다시 한 번 질문해주시거나, 계속되면 "
        "기술지원팀(1577-6846)으로 문의해주세요."
    ) from last_error
