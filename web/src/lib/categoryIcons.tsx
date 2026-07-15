import {
  IconCard,
  IconMonitor,
  IconCalendar,
  IconUser,
  IconSettings,
  IconBox,
  IconGlobe,
  IconDots,
} from "@/components/icons";

type IconComponent = (props: { size?: number; className?: string; style?: React.CSSProperties }) => React.ReactElement;

const CATEGORY_ICONS: Record<string, IconComponent> = {
  payment_refund: IconCard,
  hardware_kiosk: IconMonitor,
  class_mgmt: IconCalendar,
  member_mgmt: IconUser,
  system_admin: IconSettings,
  locker_rental: IconBox,
  online_web: IconGlobe,
  etc_other: IconDots,
};

export function CategoryIcon({
  categoryId,
  size,
  className,
  style,
}: {
  categoryId: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = CATEGORY_ICONS[categoryId] ?? IconDots;
  return <Icon size={size} className={className} style={style} />;
}
