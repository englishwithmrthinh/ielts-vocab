// Tên + biểu tượng huy hiệu
import { Award, BookCheck, CalendarCheck, Crown, Flame, Send, Sun, type LucideIcon } from 'lucide-react';
import type { BadgeCode } from '@shared/types';

export const BADGE_VI: Record<BadgeCode, string> = {
  first_submit: 'Bài nộp đầu tiên',
  perfect_week: 'Tuần hoàn hảo',
  perfect_month: 'Tháng hoàn hảo',
  all_sundays_month: 'Đủ mọi Chủ nhật trong tháng',
  pass_10: 'Thuộc 10 từ',
  pass_50: 'Thuộc 50 từ',
  pass_100: 'Thuộc 100 từ',
  pass_300: 'Thuộc 300 từ',
  streak_6: 'Chuỗi 6 mốc',
  streak_12: 'Chuỗi 12 mốc',
  streak_24: 'Chuỗi 24 mốc',
};

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
