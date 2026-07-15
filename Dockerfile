# Render(또는 다른 컨테이너 호스팅)에 백엔드(backend/)를 배포하기 위한 Dockerfile.
# 행정공동망 상태 확인 기능(backend/gov_network_status.py)이 Playwright로 실제 브라우저(Chromium)를
# 띄워야 해서, Chromium과 필요한 시스템 라이브러리가 이미 설치된 Playwright 공식 이미지를 사용합니다.
FROM mcr.microsoft.com/playwright/python:v1.61.0-jammy

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY data/ ./data/

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
