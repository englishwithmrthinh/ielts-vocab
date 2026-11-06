// 12 từ mẫu (A1–B1) để thử giao diện. Dữ liệu thật đến từ skill của Gemini.
import type { WordCard } from '@shared/types';

/** Ảnh giả: khối màu + hình đơn giản, không có chữ (giống ảnh thật cắt từ lưới) */
function fakeImage(hue: number, shape: 'circle' | 'square' | 'triangle'): string {
  const s =
    shape === 'circle'
      ? `<circle cx="200" cy="160" r="90" fill="hsl(${hue} 70% 92%)"/>`
      : shape === 'square'
        ? `<rect x="115" y="75" width="170" height="170" rx="24" fill="hsl(${hue} 70% 92%)"/>`
        : `<path d="M200 60 L310 250 L90 250 Z" fill="hsl(${hue} 70% 92%)"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320"><rect width="400" height="320" fill="hsl(${hue} 55% 55%)"/>${s}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const W = (
  i: number,
  w: Omit<WordCard, 'wordId' | 'imageUrl' | 'audioUrl'>,
  shape: 'circle' | 'square' | 'triangle',
): WordCard => ({ ...w, wordId: `w${i}`, imageUrl: fakeImage((i * 47) % 360, shape), audioUrl: null });

export const MOCK_WORDS: WordCard[] = [
  W(1, {
    word: 'environment', pos: 'n', meaningVi: 'môi trường', ipa: '/ɪnˈvaɪrənmənt/', syllables: 'en·VI·ron·ment',
    example: 'Plastic waste is a serious threat to the environment.',
    wordFamily: [
      { form: 'environmental', pos: 'adj', sentence: 'The project had a huge ___ impact.' },
      { form: 'environmentally', pos: 'adv', sentence: 'We need more ___ friendly products.' },
    ],
  }, 'circle'),
  W(2, {
    word: 'healthy', pos: 'adj', meaningVi: 'khoẻ mạnh, tốt cho sức khoẻ', ipa: '/ˈhelθi/', syllables: 'HEAL·thy',
    example: 'Eating fruit every day keeps you healthy.',
    wordFamily: [{ form: 'health', pos: 'n', sentence: 'Smoking is bad for your ___.' }],
  }, 'square'),
  W(3, {
    word: 'improve', pos: 'v', meaningVi: 'cải thiện', ipa: '/ɪmˈpruːv/', syllables: 'im·PROVE',
    example: 'Reading every night will improve your English.',
    wordFamily: [{ form: 'improvement', pos: 'n', sentence: 'There is a big ___ in your writing.' }],
  }, 'triangle'),
  W(4, {
    word: 'traffic', pos: 'n', meaningVi: 'giao thông, xe cộ', ipa: '/ˈtræfɪk/', syllables: 'TRAF·fic',
    example: 'The traffic in Hanoi is very heavy at 6 pm.',
    wordFamily: [],
  }, 'square'),
  W(5, {
    word: 'convenient', pos: 'adj', meaningVi: 'tiện lợi', ipa: '/kənˈviːniənt/', syllables: 'con·VE·ni·ent',
    example: 'Online shopping is very convenient for busy people.',
    wordFamily: [{ form: 'convenience', pos: 'n', sentence: 'I like the ___ of living near a market.' }],
  }, 'circle'),
  W(6, {
    word: 'pollution', pos: 'n', meaningVi: 'sự ô nhiễm', ipa: '/pəˈluːʃn/', syllables: 'pol·LU·tion',
    example: 'Air pollution is a big problem in many cities.',
    wordFamily: [{ form: 'pollute', pos: 'v', sentence: 'Factories ___ the river every year.' }],
  }, 'triangle'),
  W(7, {
    word: 'neighbour', pos: 'n', meaningVi: 'hàng xóm', ipa: '/ˈneɪbə(r)/', syllables: 'NEIGH·bour',
    example: 'My neighbour often waters my plants.',
    wordFamily: [{ form: 'neighbourhood', pos: 'n', sentence: 'There is a nice park in my ___.' }],
  }, 'circle'),
  W(8, {
    word: 'decide', pos: 'v', meaningVi: 'quyết định', ipa: '/dɪˈsaɪd/', syllables: 'de·CIDE',
    example: 'We decide to stay at home when it rains.',
    wordFamily: [{ form: 'decision', pos: 'n', sentence: 'It was a difficult ___ for her.' }],
  }, 'square'),
  W(9, {
    word: 'crowded', pos: 'adj', meaningVi: 'đông đúc', ipa: '/ˈkraʊdɪd/', syllables: 'CROWD·ed',
    example: 'The beach is always crowded in summer.',
    wordFamily: [{ form: 'crowd', pos: 'n', sentence: 'A large ___ waited outside the stadium.' }],
  }, 'triangle'),
  W(10, {
    word: 'public transport', pos: 'phr', meaningVi: 'phương tiện công cộng', ipa: '/ˌpʌblɪk ˈtrænspɔːt/', syllables: 'PUB·lic TRANS·port',
    example: 'More people should use public transport to work.',
    wordFamily: [],
  }, 'square'),
  W(11, {
    word: 'quiet', pos: 'adj', meaningVi: 'yên tĩnh', ipa: '/ˈkwaɪət/', syllables: 'QUI·et',
    example: 'The library is a quiet place to study.',
    wordFamily: [{ form: 'quietly', pos: 'adv', sentence: 'She closed the door ___.' }],
  }, 'circle'),
  W(12, {
    word: 'protect', pos: 'v', meaningVi: 'bảo vệ', ipa: '/prəˈtekt/', syllables: 'pro·TECT',
    example: 'We must protect wild animals.',
    wordFamily: [{ form: 'protection', pos: 'n', sentence: 'Sunscreen gives ___ from the sun.' }],
  }, 'triangle'),
];

export const wordById = (id: string) => MOCK_WORDS.find((w) => w.wordId === id)!;
