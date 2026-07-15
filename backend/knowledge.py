"""FAQ 지식창고를 불러오고, AI에게 전달할 텍스트로 정리하는 모듈."""
import json
from pathlib import Path

FAQ_PATH = Path(__file__).resolve().parent.parent / "data" / "faq.json"
IMAGES_DIR = Path(__file__).resolve().parent.parent / "data" / "images"

# 행정공동망(관공서 연계망) 서비스 상태 확인 사이트 — 국가유공자/장애인/기초생활수급자 등
# 감면 대상 확인이 이 망을 통해 이루어지므로, 감면 확인/행정공동망 오류 문의 시 안내합니다.
GOV_NETWORK_STATUS_URL = "https://next.share.go.kr/idx-login.do"
GOV_NETWORK_CONTEXT = (
    "[행정공동망 / 감면 확인 서비스 안내]\n"
    "행정공동망은 국가유공자, 장애인, 기초생활수급자 등 감면 대상 여부를 관공서 시스템과 연동해서 "
    "확인하는 서비스입니다. 고객이 '행정공동망이 안돼요', '감면 확인이 안돼요/조회가 안돼요' 같은 "
    "문의를 하면, FMCS 자체 문제가 아니라 관공서 측 행정공동망 서비스 장애일 가능성이 높습니다. "
    f"이 경우 행정공동망 서비스 상태를 확인할 수 있는 사이트({GOV_NETWORK_STATUS_URL})를 note에 "
    "안내하고, is_gov_network_issue를 true로 설정하세요."
)

# 문의 자동분류/라우팅용 카테고리 (고정 8개 — 대시보드 색상 팔레트와 1:1 대응)
CATEGORIES = [
    {"id": "payment_refund", "name": "결제 및 환불"},
    {"id": "hardware_kiosk", "name": "하드웨어 및 키오스크"},
    {"id": "class_mgmt", "name": "강습 관리"},
    {"id": "member_mgmt", "name": "회원 관리"},
    {"id": "system_admin", "name": "시스템 및 사용자권한"},
    {"id": "locker_rental", "name": "사물함 및 대관"},
    {"id": "online_web", "name": "온라인예약 및 웹"},
    {"id": "etc_other", "name": "기타"},
]

_faq_cache = None


def load_faq():
    global _faq_cache
    if _faq_cache is None:
        with open(FAQ_PATH, encoding="utf-8") as f:
            _faq_cache = json.load(f)
    return _faq_cache


def get_system_info():
    """설정 화면에 보여줄 제품/기술지원 정보 (faq.json 최상단 필드)."""
    data = load_faq()
    return {
        "product": data.get("product", ""),
        "vendor": data.get("vendor", ""),
        "support_phone": data.get("support_phone", ""),
        "support_site": data.get("support_site", ""),
    }


def update_system_info(product, vendor, support_phone, support_site):
    """설정 화면에서 제품/기술지원 정보를 수정하면 faq.json에 바로 저장하고,
    서버 재시작 없이 다음 질문부터 바로 반영되도록 캐시를 갱신합니다."""
    global _faq_cache
    data = load_faq()
    data["product"] = product
    data["vendor"] = vendor
    data["support_phone"] = support_phone
    data["support_site"] = support_site
    FAQ_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    _faq_cache = data
    return get_system_info()


def category_ids():
    return [c["id"] for c in CATEGORIES]


def category_name(category_id):
    for c in CATEGORIES:
        if c["id"] == category_id:
            return c["name"]
    return category_id


def faq_by_id(faq_id):
    for entry in load_faq()["faqs"]:
        if entry["id"] == faq_id:
            return entry
    return None


def image_file_exists(filename):
    return filename and (IMAGES_DIR / filename).is_file()


def _bigrams(text):
    text = text.replace(" ", "")
    return {text[i : i + 2] for i in range(len(text) - 1)}


def _relevant_faqs(question, top_k=8):
    """질문과 겹치는 글자(2글자 단위)가 많은 FAQ 순으로 상위 top_k개를 고릅니다.

    128개 FAQ를 매번 전부 AI에게 보내면 무료 API의 분당 토큰 한도(TPM)를 초과하므로,
    질문과 관련 있어 보이는 FAQ만 추려서 보냅니다. 임베딩 없이 글자 겹침만 보는
    아주 단순한 방식이지만, FAQ가 지금 규모(수백 건 이하)에서는 실용적으로 잘 동작합니다.

    image_description(스크린샷을 AI가 미리 설명해둔 텍스트, scripts/describe_images.py로 생성)도
    매칭 대상에 포함합니다 — "그 화면에서 버튼이 안 보여요" 처럼 화면 자체를 언급하는 질문도
    관련 FAQ를 찾을 수 있도록 하기 위함입니다.
    """
    q_bigrams = _bigrams(question)
    scored = []
    for faq in load_faq()["faqs"]:
        entry_text = faq["question"] + faq["answer"] + (faq.get("image_description") or "")
        entry_bigrams = _bigrams(entry_text)
        score = len(q_bigrams & entry_bigrams)
        scored.append((score, faq))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [faq for score, faq in scored[:top_k] if score > 0]


def build_knowledge_context(question):
    """질문과 관련된 FAQ만 골라 AI에게 전달할 텍스트로 합칩니다."""
    data = load_faq()
    relevant = _relevant_faqs(question)
    lines = [
        f"[제품: {data['product']} / 제조사: {data['vendor']} / 기술지원: {data['support_phone']}]",
        "",
        "[시스템 배경지식 — FMCS 및 온라인예약 시스템 구조]",
        data.get("system_context", ""),
        "",
        GOV_NETWORK_CONTEXT,
        "",
        "[관련 FAQ 목록 — 아래 항목들 중에서만 답변 근거를 찾으세요]",
    ]
    if not relevant:
        lines.append("(질문과 겹치는 FAQ를 찾지 못했습니다. 시스템 배경지식만 참고하세요.)")
    for faq in relevant:
        line = f"- ID:{faq['id']} Q: {faq['question']}\n  A: {faq['answer']}"
        if faq.get("image_description"):
            line += f"\n  (참고 화면: {faq['image_description']})"
        lines.append(line)
    return "\n".join(lines)
