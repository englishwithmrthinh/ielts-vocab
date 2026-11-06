// Tên + biểu tượng huy hiệu
import { Award, BookCheck, CalendarCheck, Crown, Flame, Send, Sun, type LucideIcon } from 'lucide-react';
import type { BadgeCode } from '@shared/types';
import { badgeName, COPY } from './copy';

/** Tên huy hiệu lấy từ copy.json */
export const BADGE_VI = Object.fromEntries(
  (Object.keys(COPY.badges) as BadgeCode[]).map((c) => [c, badgeName(c)]),
) as Record<BadgeCode, string>;

export const BADGE_ICON: Record<BadgeCode, LucideIcon> = {
  first_submit: Send,
  perfect_week: CalendarCheck,
  perfect_month: Crown,
  all_sundays_month: Sun,
  pass_10: BookCheck,
  pass_50: BookCheck,
  pass_100: BookCheck,
  pass_300: Award,
  streak_6: Flame,
  streak_12: Flame,
  streak_24: Flame,
};
