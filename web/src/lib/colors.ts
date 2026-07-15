// "미니멀 프리시전" 방향에서는 카테고리를 색으로 구분하지 않고 텍스트 라벨로만 구분합니다.
// (색은 인터랙션 요소에만 아껴서 사용 — 8가지 무지개색 대신 단일 톤의 태그 점만 사용)
export function categoryColorVar(_categoryId: string): string {
  return "var(--accent)";
}
