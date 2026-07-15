import { spawn } from "child_process";
import { openSync } from "fs";
import path from "path";

// web/ 폴더 기준으로 프로젝트 루트(ai-callcenter/)를 찾습니다.
const PROJECT_ROOT = path.resolve(process.cwd(), "..");

async function isBackendUp(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch("http://localhost:8000/categories", { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

// 설정 화면의 "백엔드 서버 시작" 버튼에서 호출됩니다. 이미 켜져 있으면 아무것도 하지 않고,
// 꺼져 있을 때만 uvicorn을 새로 띄웁니다 (로컬 PC에서만 동작 — 배포 환경에서는 의미 없음).
export async function POST() {
  if (await isBackendUp()) {
    return Response.json({ ok: true, already_running: true });
  }

  try {
    const outLog = openSync(path.join(PROJECT_ROOT, "server_out.log"), "a");
    const errLog = openSync(path.join(PROJECT_ROOT, "server_err.log"), "a");

    const child = spawn("python", ["-m", "uvicorn", "backend.main:app", "--port", "8000"], {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: ["ignore", outLog, errLog],
      shell: true,
    });
    child.unref();

    return Response.json({ ok: true, already_running: false });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
