<p align="center"><img src="docs/banner.png" alt="Reedo Skills: 매일 쓰면서 고친 한국어 AI 에이전트 스킬 12개" width="100%"></p>

# Reedo Skills

[한국어](#한국어) · [English](#english)

## 한국어

이 저장소는 **목록**입니다. 스킬 12개는 각각 따로 된 저장소에 있고, 필요한 것만 골라서 설치하면 됩니다. 저장소마다 설명서, 예시 파일, 자동 시험(GitHub Actions)이 들어 있습니다.

### 처음 오셨나요? 3분 안내

**스킬이 무엇인가요?** AI 코딩 도우미(Claude Code)에게 "이 일은 이렇게 하세요"라고 알려 주는 설명서 폴더입니다. 설치해 두면 말만 걸어도 도우미가 그 방식대로 일합니다. 예를 들어 "이 글 말투 점검해 줘"라고 하면 korean-tone-check 스킬이 글을 검사합니다.

**용어 풀이**

| 말 | 뜻 |
|---|---|
| Claude Code | 터미널(명령을 글자로 입력하는 창)에서 대화하듯 쓰는 AI 코딩 도우미입니다 |
| 스킬 | 도우미가 읽고 따르는 작업 설명서 폴더(`SKILL.md`)와 그에 딸린 도구입니다 |
| 터미널 | Windows는 "PowerShell", Mac은 "터미널" 앱입니다. 시작 메뉴나 Spotlight에서 찾으면 됩니다 |
| Node.js | 스킬 안의 도구를 돌리는 프로그램입니다. 터미널에 `node -v`를 입력해 18 이상 숫자가 나오면 준비된 것입니다. 없으면 [nodejs.org](https://nodejs.org)에서 설치합니다 |

**설치는 두 줄입니다.** 아래는 3D 지식그래프 예시이고, 다른 스킬은 저장소 이름만 바꾸면 됩니다. Claude Code를 켠 뒤 입력창에 그대로 붙여 넣습니다.

```
/plugin marketplace add reedodev/obsidian-brain-3d
/plugin install obsidian-brain-3d@obsidian-brain-3d
```

설치한 뒤에는 도우미에게 평소 말투로 부탁하면 됩니다. 각 저장소 README에 "이렇게 말해 보세요" 문장과 실제 실행 결과, 막혔을 때 표가 있습니다.

### 어떤 스킬이 필요한가요?

| 이런 일이 있다면 | 스킬 | 저장소 |
|---|---|---|
| 한 줄 주제로 설명 영상을 만들고 싶다 | [**설명 영상 만들기**](https://github.com/reedodev/explainer-studio) | `reedodev/explainer-studio` |
| 옵시디언을 AI가 정리해 주는 지식 저장고로 만들고 싶다 | [**옵시디언 LLM 위키**](https://github.com/reedodev/obsidian-llm-wiki) | `reedodev/obsidian-llm-wiki` |
| 내 노트를 3D 뇌와 세계수로 보고 싶다 | [**옵시디언 3D 지식그래프**](https://github.com/reedodev/obsidian-brain-3d) | `reedodev/obsidian-brain-3d` |
| 작업 전에 지난 교훈을 먼저 찾아보고 싶다 | [**노트 먼저 찾아보기**](https://github.com/reedodev/vault-recall) | `reedodev/vault-recall` |
| AI와 한 작업을 강의자료로 만들고 싶다 | [**작업 기록 강의자료**](https://github.com/reedodev/work-to-lecture-deck) | `reedodev/work-to-lecture-deck` |
| 존댓말 글에 반말이 섞였는지 보고 싶다 | [**한국어 말투 점검**](https://github.com/reedodev/korean-tone-check) | `reedodev/korean-tone-check` |
| 검색은 많고 글은 적은 키워드를 찾고 싶다 | [**네이버 황금키워드**](https://github.com/reedodev/naver-golden-keywords) | `reedodev/naver-golden-keywords` |
| 한글(HWPX) 신청서 칸을 채우고 싶다 | [**한글 양식 채우기**](https://github.com/reedodev/hwpx-form-fill) | `reedodev/hwpx-form-fill` |
| AI 목소리 끝이 뚝 끊긴다 | [**TTS 끝소리 고치기**](https://github.com/reedodev/tts-tail-fix) | `reedodev/tts-tail-fix` |
| 카드뉴스·썸네일 글자를 정확한 크기로 찍고 싶다 | [**카드뉴스 렌더**](https://github.com/reedodev/html-card-render) | `reedodev/html-card-render` |
| 릴스·쇼츠 올리기 전에 비율을 확인하고 싶다 | [**영상 비율 검사**](https://github.com/reedodev/social-video-gate) | `reedodev/social-video-gate` |
| 유튜브에 올린 뒤 썸네일·고정 댓글을 빠뜨리고 싶지 않다 | [**유튜브 게시 점검**](https://github.com/reedodev/youtube-publish-checklist) | `reedodev/youtube-publish-checklist` |

### 믿고 써도 되나요?

- 모든 스킬은 MIT 라이선스이고 소스가 전부 공개되어 있습니다.
- 저장소마다 자동 시험이 있어서 글을 고칠 때마다 GitHub Actions가 다시 돌립니다.
- 개인 정보와 비밀 키는 들어 있지 않습니다. 네이버 키워드 스킬처럼 키가 필요한 것은 본인의 키를 직접 넣는 방식입니다.
- 다른 분의 아이디어나 도구에서 출발한 부분은 각 저장소의 「출처와 영감」에 밝혀 두었습니다.

### 만든 사람

**리도**, AI 좌충우돌 실습 중인 20년차 엔지니어입니다. [YouTube @Reedodev](https://www.youtube.com/@Reedodev) · [Threads @reedo.dev](https://www.threads.com/@reedo.dev) · [GitHub @reedodev](https://github.com/reedodev)

---

## English

This repository is an index. Each of the twelve Claude Code skills lives in its own repository with its own README, examples and CI. Install only the ones you need.

### New here? A three-minute guide

**What is a skill?** A folder of instructions (a `SKILL.md` plus small tools) that tells Claude Code how to do one kind of job. Once installed, you just ask in plain language, for example "check the tone of this draft", and the agent follows the skill.

**Glossary**

| Term | Meaning |
|---|---|
| Claude Code | An AI coding assistant you talk to inside a terminal (a window where you type commands) |
| Skill | A folder the assistant reads and follows, with its own helper scripts |
| Terminal | "PowerShell" on Windows, "Terminal" on macOS |
| Node.js | The runtime that runs the helper scripts. Type `node -v`; if it prints 18 or higher you are ready. Otherwise install it from [nodejs.org](https://nodejs.org) |

**Install takes two lines.** Example for the 3D graph skill; for any other skill, change the repository name. Start Claude Code and paste:

```
/plugin marketplace add reedodev/obsidian-brain-3d
/plugin install obsidian-brain-3d@obsidian-brain-3d
```

Then ask the assistant in your own words. Each repository README has copy-and-paste prompts, real sample output and a troubleshooting table.

### Which skill do I need?

| If you want to... | Skill |
|---|---|
| Turn one line into an explainer video | [explainer-studio](https://github.com/reedodev/explainer-studio): One line in, a narrated or captioned explainer video out, in eight hand-drawn styles (whiteboard, blueprint, ink-wash, spy titles and more), with a gentle camera, sources file and MP4 plus SRT. |
| Turn an Obsidian vault into an AI-maintained knowledge base | [obsidian-llm-wiki](https://github.com/reedodev/obsidian-llm-wiki): Set up an Obsidian vault as a Karpathy-style LLM Wiki: inbox, sources, wiki, outputs, a rules file every AI reads first, templates and an index, plus scripts to rebuild the index and health-check links, front matter and recheck dates. |
| See your notes as a 3D brain or world tree | [obsidian-brain-3d](https://github.com/reedodev/obsidian-brain-3d): Render an Obsidian vault as points inside an x-ray brain and skull, switch to a world-tree layout with T, and see real note titles, dates and link counts. Optional title/group hiding for public sharing. |
| Recall past lessons before starting a task | [vault-recall](https://github.com/reedodev/vault-recall): Recall relevant past lessons from an Obsidian/markdown vault: Korean-aware bigram search, status and recency weighting, cached index (8k notes in under a second after the first run). |
| Turn AI work logs into lecture slides | [work-to-lecture-deck](https://github.com/reedodev/work-to-lecture-deck): Turn real AI work logs (Claude Code sessions) into a single-file HTML lecture deck with a human/AI swimlane and per-step cards: what I said, what the AI did, what got fixed. |
| Catch mixed Korean speech levels in a draft | [korean-tone-check](https://github.com/reedodev/korean-tone-check): Flags mixed Korean speech levels (formal/polite/plain), stock AI phrases, translationese and choppy sentence runs. Exits 1 on speech-level mismatches so an agent cannot publish a mixed draft. |
| Find Naver keywords with high search volume and few posts | [naver-golden-keywords](https://github.com/reedodev/naver-golden-keywords): Score Naver blog keywords by monthly searches vs. blog document count using the official Search Ad and Search APIs, with related-keyword discovery and S/A/B grades. |
| Fill Hangul (HWPX) application forms | [hwpx-form-fill](https://github.com/reedodev/hwpx-form-fill): Fill Hangul (HWPX) form tables by label without Hancom Office, refuse to overwrite filled cells, re-open the file to verify, and fail loudly on missing or ambiguous labels. |
| Fix AI voice clips that end abruptly | [tts-tail-fix](https://github.com/reedodev/tts-tail-fix): Detect and fix TTS / voice-clone clips whose last syllable is chopped off: sentinel word, cut at the pause, fade where the sound really ends, and verify. |
| Render cards and thumbnails at exact pixel sizes | [html-card-render](https://github.com/reedodev/html-card-render): Zero-dependency HTML to PNG renderer over the Chrome DevTools Protocol: exact pixel sizes, multi-page card batches, and an in-page overflow / broken-image check before capture. |
| Check a video's aspect ratio before posting | [social-video-gate](https://github.com/reedodev/social-video-gate): Check the displayed aspect ratio of a video (rotation metadata and non-square pixels included) for Reels, Shorts, TikTok, YouTube or square, and fail before upload on mismatch. |
| Never forget the thumbnail and pinned comment on YouTube | [youtube-publish-checklist](https://github.com/reedodev/youtube-publish-checklist): Per-video publish gate for YouTube: custom thumbnail (size, ratio, shown on channel) and pinned comment, including a required follow-up task for scheduled releases. |

### Can I trust it?

- Every skill is MIT licensed and fully open source.
- Each repository has automated tests that GitHub Actions re-runs on every change.
- No personal data or secret keys are included. Skills that need a key (for example the Naver keyword skill) ask you to supply your own.
- Where an idea or tool came from someone else, the repository credits it under "Credits and inspiration".

MIT License. Third-party models, fonts and libraries keep their own licenses.