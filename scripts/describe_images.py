"""FAQ에 딸린 참고 이미지(스크린샷)를 AI(비전 모델)로 분석해서 한국어 설명을 만들고,
data/faq.json의 각 항목에 "image_description" 필드로 저장합니다.

왜 필요한가:
    지금까지는 이미지가 "질문과 매칭된 FAQ에 곁들이는 첨부물"로만 쓰였고, 정작 질문과
    이미지 내용을 매칭하는 검색 단계에서는 이미지가 전혀 활용되지 않았습니다.
    예를 들어 고객이 "그 화면에서 버튼이 안 보여요"처럼 화면 자체를 언급하는 질문을 해도
    이미지 속 내용(메뉴 위치, 버튼 이름 등)은 검색에 반영되지 않았습니다.
    이 스크립트로 이미지 설명 텍스트를 한 번 만들어두면, 그 텍스트가 FAQ 검색(knowledge.py의
    _bigrams)과 AI 답변 근거(지식창고)에 함께 포함되어 화면 관련 질문의 매칭 정확도가 올라갑니다.

사용법 (ai-callcenter 폴더에서):
    python scripts/describe_images.py

이미 image_description이 있는 항목은 건너뛰므로, 새 이미지가 추가된 뒤 다시 실행해도
전체를 다시 돌리지 않고 새로 생긴 항목만 처리합니다. (1회성 배치 작업 — 매 질문마다
호출되는 게 아니라 미리 한 번만 실행하면 됩니다.)
"""
import base64
import io
import json
import time
from pathlib import Path

from dotenv import load_dotenv
from groq import Groq
from PIL import Image

MAX_IMAGE_BYTES = 4 * 1024 * 1024  # Groq API 요청 크기 제한 보호용 (원본이 이보다 크면 축소)

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

FAQ_PATH = ROOT / "data" / "faq.json"
IMAGES_DIR = ROOT / "data" / "images"
VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

PROMPT = (
    "이 이미지는 체육시설 회원관리 프로그램(FMCS) 헬프데스크 화면 스크린샷입니다. "
    "어떤 메뉴/화면인지, 어떤 버튼·입력창·설정 항목이 보이는지 한국어로 2~3문장으로 "
    "간결하게 설명해줘. 화면에 보이는 메뉴 경로나 버튼 이름이 있으면 그대로 적어줘."
)


def _encode_image(image_path: Path) -> tuple[str, str]:
    """이미지가 너무 크면(용량 제한 초과 가능성) 축소해서 JPEG로 인코딩합니다."""
    raw = image_path.read_bytes()
    if len(raw) <= MAX_IMAGE_BYTES:
        ext = image_path.suffix.lstrip(".").lower()
        ext = "jpeg" if ext == "jpg" else ext
        return ext, base64.b64encode(raw).decode()

    img = Image.open(io.BytesIO(raw)).convert("RGB")
    img.thumbnail((1600, 1600))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    return "jpeg", base64.b64encode(buf.getvalue()).decode()


def describe_image(client, image_path: Path) -> str:
    ext, b64 = _encode_image(image_path)
    response = client.chat.completions.create(
        model=VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:image/{ext};base64,{b64}"}},
                ],
            }
        ],
    )
    return response.choices[0].message.content.strip()


def main():
    data = json.loads(FAQ_PATH.read_text(encoding="utf-8"))
    client = Groq(timeout=30.0, max_retries=2)

    todo = [f for f in data["faqs"] if f.get("image_file") and not f.get("image_description")]
    print(f"설명 생성 대상: {len(todo)}건 (이미 있는 항목은 건너뜀)")

    done, failed = 0, 0
    for i, entry in enumerate(todo):
        image_path = IMAGES_DIR / entry["image_file"]
        if not image_path.is_file():
            continue
        try:
            entry["image_description"] = describe_image(client, image_path)
            done += 1
        except Exception as e:  # noqa: BLE001 — 배치 작업이므로 하나 실패해도 계속 진행
            entry["image_description"] = None
            failed += 1
            print(f"  [{i+1}/{len(todo)}] 실패 ({entry['id']}): {e}")
            continue
        print(f"  [{i+1}/{len(todo)}] {entry['id']} 완료")
        # 무료 티어 분당 요청/토큰 한도 보호 (배치 작업이라 속도보다 안정성 우선)
        time.sleep(1.5)
        if (i + 1) % 10 == 0:
            FAQ_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            print("  (중간 저장 완료)")

    FAQ_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"완료: 성공 {done}건 / 실패 {failed}건. 저장: {FAQ_PATH}")


if __name__ == "__main__":
    main()
