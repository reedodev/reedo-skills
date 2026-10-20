<p align="center"><img src="docs/banner.png" alt="Reedo Skills: 매일 쓰면서 고친 한국어 AI 에이전트 스킬 10개" width="100%"></p>

# Reedo Skills

이 저장소는 **목록**입니다. 스킬 10개는 각각 따로 된 저장소에 있고, 필요한 것만 골라서 설치하면 됩니다. 저장소마다 설명서, 예시 파일, 자동 시험(GitHub Actions)이 들어 있습니다.

| 스킬 | 한 줄 소개 | 저장소 |
|---|---|---|
| [**옵시디언 3D 지식그래프**](https://github.com/reedodev/obsidian-brain-3d) | 내 노트가 엑스레이 뇌와 세계수로 보입니다 | `reedodev/obsidian-brain-3d` |
| [**노트 먼저 찾아보기**](https://github.com/reedodev/vault-recall) | 같은 실수, 내 노트가 먼저 막아 줍니다 | `reedodev/vault-recall` |
| [**작업 기록 강의자료**](https://github.com/reedodev/work-to-lecture-deck) | AI와 한 작업이 그대로 강의자료가 됩니다 | `reedodev/work-to-lecture-deck` |
| [**한국어 말투 점검**](https://github.com/reedodev/korean-tone-check) | 존댓말 글에 섞인 반말 한 줄을 찾아냅니다 | `reedodev/korean-tone-check` |
| [**네이버 황금키워드**](https://github.com/reedodev/naver-golden-keywords) | 찾는 사람은 많고 글은 적은 키워드 | `reedodev/naver-golden-keywords` |
| [**한글 양식 채우기**](https://github.com/reedodev/hwpx-form-fill) | 한컴오피스 없이 신청서 칸을 채웁니다 | `reedodev/hwpx-form-fill` |
| [**TTS 끝소리 고치기**](https://github.com/reedodev/tts-tail-fix) | AI 목소리가 말하다 만 것처럼 끊길 때 | `reedodev/tts-tail-fix` |
| [**카드뉴스 렌더**](https://github.com/reedodev/html-card-render) | 글자는 HTML로, 크기는 픽셀까지 정확하게 | `reedodev/html-card-render` |
| [**영상 비율 검사**](https://github.com/reedodev/social-video-gate) | 업로드 전에 화면에 보이는 비율로 확인합니다 | `reedodev/social-video-gate` |
| [**유튜브 게시 점검**](https://github.com/reedodev/youtube-publish-checklist) | 썸네일·고정 댓글 확인 전에는 완료가 아닙니다 | `reedodev/youtube-publish-checklist` |

## 설치 (예: 3D 지식그래프)

```
/plugin marketplace add reedodev/obsidian-brain-3d
/plugin install obsidian-brain-3d@obsidian-brain-3d
```

다른 스킬도 저장소 이름만 바꿔서 같은 방법으로 설치합니다.

## 만든 사람

**리도**, AI 좌충우돌 실습 중인 20년차 엔지니어입니다. [YouTube @Reedodev](https://www.youtube.com/@Reedodev) · [Threads @reedo.dev](https://www.threads.com/@reedo.dev) · [GitHub @reedodev](https://github.com/reedodev)

---

## English

This repository is an index. Each of the ten Claude Code skills lives in its own repository with its own README, examples and CI.

- [obsidian-brain-3d](https://github.com/reedodev/obsidian-brain-3d): Render an Obsidian vault as points inside an x-ray brain and skull, switch to a world-tree layout with T, and see real note titles, dates and link counts. Optional title/group hiding for public sharing.
- [vault-recall](https://github.com/reedodev/vault-recall): Before a task, recall relevant past lessons from an Obsidian/markdown vault: Korean-aware bigram search, status and recency weighting, cached index (8k notes in under a second after the first run).
- [work-to-lecture-deck](https://github.com/reedodev/work-to-lecture-deck): Turn real AI work logs (Claude Code sessions) into a single-file HTML lecture deck with a human/AI swimlane and per-step cards: what I said, what the AI did, what got fixed.
- [korean-tone-check](https://github.com/reedodev/korean-tone-check): Flags mixed Korean speech levels (formal/polite/plain), stock AI phrases, translationese and choppy sentence runs. Exits 1 on speech-level mismatches so an agent cannot publish a mixed draft.
- [naver-golden-keywords](https://github.com/reedodev/naver-golden-keywords): Score Naver blog keywords by monthly searches vs. blog document count using the official Search Ad and Search APIs, with related-keyword discovery and S/A/B grades.
- [hwpx-form-fill](https://github.com/reedodev/hwpx-form-fill): Fill Hangul (HWPX) form tables by label without Hancom Office, refuse to overwrite filled cells, re-open the file to verify, and fail loudly on missing or ambiguous labels.
- [tts-tail-fix](https://github.com/reedodev/tts-tail-fix): Detect and fix TTS / voice-clone clips whose last syllable is chopped off: sentinel word, cut at the pause, fade where the sound really ends, and verify.
- [html-card-render](https://github.com/reedodev/html-card-render): Zero-dependency HTML to PNG renderer over the Chrome DevTools Protocol: exact pixel sizes, multi-page card batches, and an in-page overflow / broken-image check before capture.
- [social-video-gate](https://github.com/reedodev/social-video-gate): Check the displayed aspect ratio of a video (rotation metadata and non-square pixels included) for Reels, Shorts, TikTok, YouTube or square, and fail before upload on mismatch.
- [youtube-publish-checklist](https://github.com/reedodev/youtube-publish-checklist): Per-video publish gate for YouTube: custom thumbnail (size, ratio, shown on channel) and pinned comment, including a required follow-up task for scheduled releases.