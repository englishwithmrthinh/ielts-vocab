---
name: ielts-vocab-json
description: Biến danh sách từ vựng IELTS giáo viên dán vào thành một khối JSON để nhập vào web ôn từ. Dùng khi giáo viên dán danh sách từ (có thể kèm "- nghĩa gợi ý") và cần JSON cho buổi học.
---

# IELTS Vocabulary JSON Generator

The teacher pastes a list of English words or phrases, one per line, optionally followed by a hyphen and a suggested Vietnamese meaning:

```text
biodiversity
contaminate - làm ô nhiễm
sustainable
```

Reply with **one JSON code block only**: no greeting, no explanation, nothing before or after it. The teacher pastes it straight into the admin page.

## Output format

```json
{
  "words": [
    {
      "word": "environment",
      "pos": "n",
      "meaning_vi": "môi trường",
      "ipa": "/ɪnˈvaɪrənmənt/",
      "syllables": "en·VI·ron·ment",
      "example": "Plastic waste is a serious threat to the natural environment we depend on.",
      "word_family": [
        { "form": "environmental", "pos": "adj", "sentence": "The new airport will have a huge ___ impact on local wildlife." },
        { "form": "environmentally", "pos": "adv", "sentence": "Shoppers increasingly choose ___ friendly products made from recycled materials." }
      ],
      "image_hint": "a green forest with a clear river and a deer drinking"
    }
  ]
}
```

## Rules for each field

1. **word**: the base headword in lowercase, trimmed. Remove duplicates, keep input order. Output count = number of unique input words.
2. **pos**: exactly one of `n`, `v`, `adj`, `adv`, `prep`, `conj`, `phr`, matching the meaning used (the teacher's suggested meaning if given).
3. **meaning_vi**: the most common meaning in an IELTS Academic context, at most 6 Vietnamese words. If the teacher gave a meaning, use it (shorten only if longer than 6 words).
4. **ipa**: British English (RP) transcription inside `/.../`, with primary stress `ˈ` and secondary stress `ˌ` where needed.
5. **syllables**: syllables separated by the middle dot `·`. The primary stressed syllable in UPPERCASE, the rest lowercase (`en·VI·ron·ment`). One-syllable words are written fully in uppercase (`DROUGHT`). Phrases: words separated by a space.
6. **example**: 8–18 words, CEFR B2–C1, academic tone.
   - Contains the exact `word` string exactly once, as a whole word (not inside a longer word, no `-s`, `-ed`, `-ing`), and NOT as the first word of the sentence.
   - Rich context: when the word is blanked out, a student should be able to infer this exact word. Avoid sentences where several other words of the same part of speech fit equally well.
7. **word_family**: 0–3 common derivatives with a different form (never the headword itself). Empty array `[]` if none suits B2–C1 learners.
   - `form` lowercase, `pos` from the list above.
   - `sentence`: 8–18 words with exactly one `___` replacing that derivative. Only this form may fit grammatically (for example the gap must require an adjective).
8. **image_hint**: English, **8–15 words**, ONE main subject with at most 2–3 details. It becomes one small cell in a picture grid viewed on a phone.
   - Concrete and drawable. Abstract words become a simple visual metaphor with tangible objects.
   - No split scenes (left/right, before/after).
   - Never ask for text, letters, numbers, labels, signs, speech bubbles, icons, ticks or other symbols.

## General

- Use **British spelling** in every field (`programme`, `colour`, `enrol`, `fibre`). The Oxford `-ize` ending is allowed (`organize`, `revolutionize`). Typing answers are marked exactly, so each word must have one spelling only.
- Use straight double quotes and valid JSON.

## Check before answering

- [ ] One JSON block `{ "words": [...] }`, valid syntax.
- [ ] Number of items = number of unique input words, no duplicates.
- [ ] Every `meaning_vi` ≤ 6 words.
- [ ] Every `example` is 8–18 words and contains the exact `word` once, not at the start.
- [ ] Every `word_family` has 0–3 items, each `sentence` has exactly one `___`.
- [ ] Every `image_hint` is 8–15 words, one subject, no text or symbols.
