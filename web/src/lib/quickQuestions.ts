// 카테고리별 예상 질문지 — 실제 FAQ 데이터를 바탕으로 자주 나올 만한 질문을 골라 정리한 것.
// 채팅창이 비어있을 때 카테고리별로 묶어서 보여주고, 클릭하면 바로 질문이 전송됩니다.
export type QuickQuestionGroup = {
  categoryId: string;
  categoryName: string;
  questions: string[];
};

export const QUICK_QUESTION_GROUPS: QuickQuestionGroup[] = [
  {
    categoryId: "payment_refund",
    categoryName: "결제 및 환불",
    questions: ["카드 결제가 안 돼요", "환불 처리는 어떻게 하나요", "결제 승인요청 버튼이 비활성화돼요"],
  },
  {
    categoryId: "hardware_kiosk",
    categoryName: "하드웨어 및 키오스크",
    questions: ["IC카드리더기 인식이 안 돼요", "바코드리더기를 찍어도 회원정보가 안 나와요", "영수증이 출력되지 않아요"],
  },
  {
    categoryId: "class_mgmt",
    categoryName: "강습 관리",
    questions: ["강습반은 어떻게 만드나요", "강습 접수기간 설정은 어떻게 하나요", "재등록이 안 되는데 어떻게 해야 하나요"],
  },
  {
    categoryId: "member_mgmt",
    categoryName: "회원 관리",
    questions: ["회원 정보를 잘못 등록했어요", "웹 아이디 변경이 가능한가요", "감면 적용이 안 돼요"],
  },
  {
    categoryId: "system_admin",
    categoryName: "시스템 및 사용자권한",
    questions: ["사용자 계정 비밀번호를 잊어버렸어요", "부서별 권한 설정은 어떻게 하나요", "중복 로그인으로 로그인이 안 돼요"],
  },
  {
    categoryId: "locker_rental",
    categoryName: "사물함 및 대관",
    questions: ["사물함 반납 처리는 어떻게 하나요", "대관 시간표 설정은 어떻게 하나요", "사물함 위치 추가는 어떻게 하나요"],
  },
  {
    categoryId: "online_web",
    categoryName: "온라인예약 및 웹",
    questions: ["온라인에서 강습반이 안 보여요", "홈페이지 로그인 비밀번호를 잊어버렸어요", "인터넷 신청 후 방문 결제는 어떻게 하나요"],
  },
  {
    categoryId: "etc_other",
    categoryName: "기타",
    questions: ["관리자 비밀번호를 변경하고 싶어요", "공휴일 설정은 어떻게 하나요", "행정공동망 서비스가 안 될 때는 어떻게 하나요"],
  },
];
