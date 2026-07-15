"""행정공동망(next.share.go.kr) 로그인 화면에 자동으로 뜨는 공지 팝업을 확인합니다.

이 사이트는 방문할 때마다 "자동 오픈 공지사항 팝업"이 뜨는데, 여기에 각 기관(근로복지공단,
국토교통부 등) 제공 서비스의 "일시 중단" 안내가 올라옵니다. 감면 확인(국가유공자/장애인/
기초생활수급자 등)은 이 공동망을 거치기 때문에, 이 팝업에 중단 공지가 있으면 FMCS 문제가
아니라 공동망 자체 장애일 가능성이 높습니다.

Playwright로 실제 로그인 화면에 접속해 팝업을 캡처하는 방식이라 몇 초가 걸리므로,
매 채팅 요청마다 확인하지 않고 CACHE_TTL_SECONDS 동안 결과를 캐시해서 재사용합니다.
"""
import time

from playwright.sync_api import sync_playwright

GOV_LOGIN_URL = "https://next.share.go.kr/idx-login.do"
CACHE_TTL_SECONDS = 10 * 60  # 10분 — 매 질문마다 브라우저를 띄우면 느려서 캐시로 부담을 줄임
OUTAGE_KEYWORDS = ("중단", "장애", "점검")

_cache = {"checked_at": 0.0, "notice": None}


def _fetch_popup_text(timeout_ms=20000):
    """행정공동망 로그인 화면에 접속해서 자동 공지 팝업의 본문 텍스트를 가져옵니다.
    팝업이 뜨지 않으면(공지가 없으면) None을 돌려줍니다.
    """
    result = {"text": None}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            context = browser.new_context()
            page = context.new_page()

            def on_popup(popup):
                try:
                    popup.wait_for_load_state("networkidle", timeout=timeout_ms)
                    result["text"] = popup.inner_text("body")
                except Exception:
                    pass

            page.on("popup", on_popup)
            page.goto(GOV_LOGIN_URL, wait_until="networkidle", timeout=timeout_ms)
            page.wait_for_timeout(3000)
            context.close()
            browser.close()
    except Exception:
        return None
    return result["text"]


def get_outage_notice(force_refresh: bool = False) -> str | None:
    """서비스 중단 관련 공지가 떠 있으면 그 본문(앞부분)을, 없거나 확인 실패 시 None을 돌려줍니다."""
    now = time.time()
    if not force_refresh and (now - _cache["checked_at"]) < CACHE_TTL_SECONDS:
        return _cache["notice"]

    text = _fetch_popup_text()
    notice = text.strip() if text and any(kw in text for kw in OUTAGE_KEYWORDS) else None

    _cache["checked_at"] = now
    _cache["notice"] = notice
    return notice
