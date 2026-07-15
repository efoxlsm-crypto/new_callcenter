"""교육스크립트(.txt)를 파싱해서 data/faq.json을 다시 만들고, 참고 이미지를 다운로드합니다.

사용법 (ai-callcenter 폴더에서):
    python scripts/build_faq.py

교육스크립트 파일을 새로 받으면 data/source_교육스크립트.txt로 교체한 뒤 이 스크립트를 다시 실행하면
FAQ 데이터베이스(data/faq.json)와 참고 이미지(data/images/)가 통째로 새로 만들어집니다.

이미지는 helpdesk.hisco.co.kr에 로그인해야 접근 가능하므로, .env 파일의
HISCO_LOGIN_ID / HISCO_LOGIN_PW 값을 사용합니다.
"""
import json
import os
import re
import urllib.parse
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

SRC = ROOT / "data" / "source_교육스크립트.txt"
IMAGES_DIR = ROOT / "data" / "images"
OUT_JSON = ROOT / "data" / "faq.json"

HISCO_BASE = "https://helpdesk.hisco.co.kr"
HISCO_LOGIN_ID = os.environ.get("HISCO_LOGIN_ID")
HISCO_LOGIN_PW = os.environ.get("HISCO_LOGIN_PW")


def parse_entries(text: str):
    lines = text.splitlines()

    # 이 경계 줄 번호는 현재 교육스크립트.txt 형식을 기준으로 합니다.
    # 파일 구조가 크게 바뀌면 아래 인덱스를 다시 확인해야 합니다.
    top_section = "\n".join(lines[1:39])
    main_section = "\n".join(lines[40:1227])
    context_section = "\n".join(lines[1231:1368])
    tail_section = "\n".join(lines[1368:])

    entries = []

    header_re = re.compile(r"^(\d+(?:-\d+)?)\.\s+(.*)$", re.MULTILINE)
    matches = list(header_re.finditer(main_section))
    for i, m in enumerate(matches):
        num = m.group(1)
        question = m.group(2).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(main_section)
        body = main_section[start:end].strip()

        image_url = None
        img_match = re.search(r"이미지\s*링크\s*:\s*\n?(https?://\S+)", body)
        if img_match:
            image_url = img_match.group(1).strip()
            body = body[: img_match.start()].strip()

        entries.append({"id": f"faq-{num}", "question": question, "answer": body, "image_url": image_url})

    top_re = re.compile(r"Q(\d+)\.\s*(.+?)\n\s*A \(표준 답변\):\s*(.+?)(?=\n\s*Q\d+\.|\Z)", re.DOTALL)
    for m in top_re.finditer(top_section):
        qnum, question, answer = m.groups()
        entries.append({
            "id": f"best-{qnum}",
            "question": question.strip(),
            "answer": re.sub(r"\n\s+", "\n", answer.strip()),
            "image_url": None,
        })

    tail_count = 0
    for line in tail_section.splitlines():
        line = line.rstrip()
        if "\t" not in line:
            continue
        q, a = line.split("\t", 1)
        q, a = q.strip(), a.strip()
        if not q or not a:
            continue
        tail_count += 1
        entries.append({"id": f"misc-{tail_count}", "question": q, "answer": a, "image_url": None})

    return entries, context_section.strip()


def login_session():
    if not HISCO_LOGIN_ID or not HISCO_LOGIN_PW:
        print("경고: HISCO_LOGIN_ID / HISCO_LOGIN_PW가 .env에 없어 이미지 다운로드를 건너뜁니다.")
        return None
    session = requests.Session()
    r0 = session.get(f"{HISCO_BASE}/as/faq/file/image/view?thisFileName=dummy", timeout=15)
    csrf_match = re.search(r'name="_csrf" content="([^"]+)"', r0.text)
    csrf = csrf_match.group(1) if csrf_match else None
    r1 = session.post(
        f"{HISCO_BASE}/as/member/checkLoginUser",
        data={"id": HISCO_LOGIN_ID, "password": HISCO_LOGIN_PW, "_csrf": csrf},
        headers={"X-Requested-With": "XMLHttpRequest", "X-CSRF-TOKEN": csrf},
        timeout=15,
    )
    if '"RSLT_YN":"Y"' not in r1.text:
        print("경고: helpdesk.hisco.co.kr 로그인 실패 — 이미지 다운로드를 건너뜁니다.")
        return None
    return session


def download_images(entries, session):
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    downloaded, failed = 0, 0
    for entry in entries:
        url = entry.get("image_url")
        if not url or session is None:
            entry["image_file"] = None
            continue
        parsed = urllib.parse.urlparse(url)
        qs = urllib.parse.parse_qs(parsed.query)
        filename_param = qs.get("thisFileName", [""])[0]
        ext = Path(filename_param).suffix.lower() or ".png"
        if ext not in (".png", ".jpg", ".jpeg", ".gif"):
            ext = ".png"
        local_name = f"{entry['id']}{ext}"
        try:
            resp = session.get(url, timeout=20)
            if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image/"):
                (IMAGES_DIR / local_name).write_bytes(resp.content)
                entry["image_file"] = local_name
                downloaded += 1
            else:
                entry["image_file"] = None
                failed += 1
        except requests.RequestException:
            entry["image_file"] = None
            failed += 1
    print(f"이미지 다운로드 성공: {downloaded} / 실패(원본 없음 등): {failed}")


def main():
    text = SRC.read_text(encoding="utf-8")
    entries, context_section = parse_entries(text)
    print(f"파싱된 FAQ 엔트리 수: {len(entries)}")

    session = login_session()
    download_images(entries, session)

    data = {
        "product": "FMCS (회원관리 프로그램) / 온라인예약 시스템",
        "vendor": "HISCO (혁산정보시스템)",
        "support_phone": "1577-6846",
        "support_site": HISCO_BASE,
        "system_context": context_section,
        "faqs": entries,
    }
    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("저장 완료:", OUT_JSON)


if __name__ == "__main__":
    main()
