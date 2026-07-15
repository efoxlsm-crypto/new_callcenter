"use client";

/** 미니멀 라인 아이콘 세트 — 별도 라이브러리 없이 인라인 SVG로 직접 관리.
 * 전부 24x24 뷰박스, stroke 기반, currentColor 사용 (부모의 color로 색 상속). */
type IconProps = { size?: number; className?: string; style?: React.CSSProperties };

function Base({ size = 16, className, style, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconCard(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19" />
      <path d="M6 15h4" />
    </Base>
  );
}

export function IconMonitor(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="2.5" y="4" width="19" height="12" rx="1.5" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </Base>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </Base>
  );
}

export function IconUser(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.5-4 5-5.5 7.5-5.5s6 1.5 7.5 5.5" />
    </Base>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M3 12h2.5M18.5 12H21M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </Base>
  );
}

export function IconBox(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16z" />
      <path d="M3.5 8 12 12.5 20.5 8" />
      <path d="M12 12.5V20.5" />
    </Base>
  );
}

export function IconGlobe(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3Z" />
    </Base>
  );
}

export function IconDots(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconMessage(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 5h16v11H8l-4 4z" />
    </Base>
  );
}

export function IconHeadset(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
      <rect x="3" y="13" width="4" height="6" rx="1.2" />
      <rect x="17" y="13" width="4" height="6" rx="1.2" />
      <path d="M19 19v1a2 2 0 0 1-2 2h-3" />
    </Base>
  );
}

export function IconBarChart(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 20V10" />
      <path d="M12 20V4" />
      <path d="M20 20v-7" />
    </Base>
  );
}

export function IconTrendingUp(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 17l6-6 4 4 8-9" />
      <path d="M15 6h6v6" />
    </Base>
  );
}

export function IconAlertTriangle(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5 21.5 20h-19z" />
      <path d="M12 9.5v4.5" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconActivity(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 12h4l2.5-7 4 14 2.5-7H21" />
    </Base>
  );
}

export function IconAlertOctagon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7.8 3h8.4L21 7.8v8.4L16.2 21H7.8L3 16.2V7.8z" />
      <path d="M12 8v5" />
      <circle cx="12" cy="16" r="0.9" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconHelpCircle(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.3a2.5 2.5 0 1 1 3.7 2.2c-.9.5-1.2 1-1.2 2" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconThumbsUp(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 11v9H4v-9z" />
      <path d="M7 11l3.5-7a2 2 0 0 1 2 2v4H18a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7" />
    </Base>
  );
}

export function IconBuilding(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="3" width="12" height="18" rx="1" />
      <path d="M16 8h4v13" />
      <path d="M16 21H4" />
      <path d="M7.5 7h1.5M11.5 7h1.5M7.5 11h1.5M11.5 11h1.5M7.5 15h1.5M11.5 15h1.5" />
    </Base>
  );
}

export function IconExternalLink(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9 6H5.5A1.5 1.5 0 0 0 4 7.5v11A1.5 1.5 0 0 0 5.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15" />
      <path d="M14 4h6v6" />
      <path d="M20 4 10.5 13.5" />
    </Base>
  );
}

export function IconThumbsDown(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M17 13V4h3v9z" />
      <path d="M17 13l-3.5 7a2 2 0 0 1-2-2v-4H6a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 7.2 4H17" />
    </Base>
  );
}
