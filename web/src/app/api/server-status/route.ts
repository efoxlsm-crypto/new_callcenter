// 백엔드(API, 8000번 포트)가 실제로 응답하는지 확인합니다.
// 프론트엔드는 이 라우트 자체가 응답한다는 사실 자체가 "프론트엔드가 실행 중"이라는 증거이므로
// 항상 true를 돌려줍니다 (자기 자신이 꺼져있으면애초에 이 요청에 응답할 수 없습니다).
export async function GET() {
  let backendUp = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch("http://localhost:8000/categories", { signal: controller.signal });
    clearTimeout(timeout);
    backendUp = res.ok;
  } catch {
    backendUp = false;
  }

  return Response.json({ frontend: true, backend: backendUp });
}
