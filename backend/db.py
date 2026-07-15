"""문의(티켓) 기록을 저장하고 조회하는 데이터베이스 모듈.

Neon(Postgres)을 사용합니다. 연결 주소는 .env의 DATABASE_URL 환경변수에서 읽습니다.
모든 문의는 여기에 한 줄씩 쌓이고, 이 기록이 나중에 "예측 서비스"(상담량 예측, 장비 고장 예측)와
"피드백 루프"(답변 품질 개선)의 재료가 됩니다.
"""
import os

import psycopg2
import psycopg2.extras

DATABASE_URL = os.environ.get("DATABASE_URL")


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL 환경변수가 없습니다. .env 파일에 Neon 연결 주소(DATABASE_URL)를 설정해주세요."
        )
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS tickets (
            id SERIAL PRIMARY KEY,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            site_id TEXT,
            question TEXT NOT NULL,
            category TEXT NOT NULL,
            device_type TEXT,
            is_hardware_issue BOOLEAN NOT NULL DEFAULT FALSE,
            needs_human_agent BOOLEAN NOT NULL DEFAULT FALSE,
            confidence REAL,
            answer_summary TEXT,
            helpful BOOLEAN
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS sites (
            site_id TEXT PRIMARY KEY,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """
    )
    cur.execute(
        "INSERT INTO sites (site_id) SELECT DISTINCT site_id FROM tickets "
        "WHERE site_id IS NOT NULL ON CONFLICT (site_id) DO NOTHING"
    )
    conn.commit()
    cur.close()
    conn.close()


def upsert_site(site_id: str):
    if not site_id:
        return
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("INSERT INTO sites (site_id) VALUES (%s) ON CONFLICT (site_id) DO NOTHING", (site_id,))
    conn.commit()
    cur.close()
    conn.close()


def fetch_sites():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT site_id FROM sites ORDER BY site_id")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [r["site_id"] for r in rows]


def insert_ticket(site_id, question, category, device_type, is_hardware_issue, needs_human_agent, confidence, answer_summary):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO tickets
            (site_id, question, category, device_type, is_hardware_issue, needs_human_agent, confidence, answer_summary)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (site_id, question, category, device_type, bool(is_hardware_issue), bool(needs_human_agent), confidence, answer_summary),
    )
    ticket_id = cur.fetchone()["id"]
    conn.commit()
    cur.close()
    conn.close()
    return ticket_id


def set_feedback(ticket_id: int, helpful: bool) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("UPDATE tickets SET helpful = %s WHERE id = %s", (helpful, ticket_id))
    updated = cur.rowcount > 0
    conn.commit()
    cur.close()
    conn.close()
    return updated


def fetch_all_tickets():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM tickets ORDER BY created_at DESC")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


def count_tickets():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) AS n FROM tickets")
    n = cur.fetchone()["n"]
    cur.close()
    conn.close()
    return n
