// 백엔드(API 서버)가 실제로 응답하는지 확인합니다. 로컬에서는 localhost:8000, 배포
// 환경에서는 NEXT_PUBLIC_API_URL(예: Render 주소)을 바라봅니다 — 하드코딩하면 배포
// 환경에서 이 서버리스 함수 자기 자신에게 물어보게 되는 버그가 생깁니다.
// 프론트엔드는 이 라우트 자체가 응답한다는 사실 자체가 "프론트엔드가 실행 중"이라는 증거이므로
// 항상 true를 돌려줍니다 (자기 자신이 꺼져있으면 애초에 이 요청에 응답할 수 없습니다).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET() {
  let backendUp = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${API_URL}/categories`, { signal: controller.signal });
    clearTimeout(timeout);
    backendUp = res.ok;
  } catch {
    backendUp = false;
  }

  return Response.json({ frontend: true, backend: backendUp });
}
