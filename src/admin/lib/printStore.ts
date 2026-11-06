/** Thẻ chờ in — chỉ giữ trong bộ nhớ tab (PIN không ghi vào localStorage). */
import type { StudentCard } from './adminApi';

let cards: StudentCard[] = [];

export function setPrintCards(next: StudentCard[]) {
  cards = [...next].sort((a, b) => a.code.localeCompare(b.code));
}

export function takePrintCards(): StudentCard[] {
  return cards;
}
