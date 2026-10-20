<p align="center"><img src="docs/banner.png" alt="Reedo Skills: 매일 쓰면서 고친 한국어 AI 에이전트 스킬 5개" width="100%"></p>

# Reedo Skills

블로그, SNS, 영상, 서류 작업을 AI 에이전트에게 맡기면서 실제로 막혔던 부분을 고쳐 가며 만든 [Claude Code](https://docs.claude.com/en/docs/claude-code) 스킬 모음입니다. 한국어 사용자가 자주 부딪히는데 영어권 스킬에는 잘 없는 문제(존댓말·반말이 섞이는 글, 네이버 키워드, 한글 HWPX 서식)를 먼저 골랐습니다.

> English summary is [below](#english).

## 스킬 목록

| 스킬 | 하는 일 | 필요한 것 |
|---|---|---|
| [korean-tone-check](skills/korean-tone-check) | 글에 섞인 반말·존댓말 종결을 찾아내고, AI 티가 나는 상투어·번역투·짧은 문장 나열을 표시합니다 | Node 18+ |
| [naver-golden-keywords](skills/naver-golden-keywords) | 월간 검색량과 블로그 문서수로 경쟁률을 계산해 S·A·B 등급 황금키워드를 고릅니다 | Node 18+, 네이버 검색광고·검색 API 키 |
| [hwpx-form-fill](skills/hwpx-form-fill) | 한컴오피스 없이 한글(HWPX) 양식의 표 칸을 라벨로 찾아 채우고, 다시 열어 검증합니다 | Python, `python-hwpx` |
| [tts-tail-fix](skills/tts-tail-fix) | AI 음성의 마지막 음절이 뚝 끊기는 문제를 버리는 단어(센티널)와 끝 페이드로 고치고 검사합니다 | Python, `numpy`, `soundfile` |
| [work-to-lecture-deck](skills/work-to-lecture-deck) | AI와 나눈 실제 작업 기록을 '사람이 한 일 / AI가 한 일' 흐름표와 단계 카드로 된 HTML 강의자료로 만듭니다 | Node 18+ |

## 설치

**Claude Code 플러그인으로 설치**

```
/plugin marketplace add reedodev/reedo-skills
/plugin install korean-creator-skills@reedo-skills
```

**필요한 스킬만 직접 복사**

```bash
git clone https://github.com/reedodev/reedo-skills.git
cp -r reedo-skills/skills/korean-tone-check ~/.claude/skills/
```

설치한 뒤에는 "이 글 존댓말로 통일됐는지 봐 줘", "캠핑의자 황금키워드 찾아 줘", "이 hwpx 신청서 채워 줘"처럼 평소 말투로 요청하면 에이전트가 맞는 스킬을 골라 씁니다.

## 바로 해 보기

```bash
# 말투 검사: 예시 글에 섞인 반말 3문장을 찾아냅니다
node skills/korean-tone-check/scripts/check-tone.mjs skills/korean-tone-check/examples/sample.md --target hamnida

# 한글 양식 채우기: 예시 신청서의 성명·생년월일 칸을 채우고 검증합니다
pip install python-hwpx
python skills/hwpx-form-fill/scripts/hwpx_form.py fill skills/hwpx-form-fill/examples/form-sample.hwpx skills/hwpx-form-fill/examples/values.example.json filled.hwpx

# 강의자료: 예시 덱을 한 파일짜리 HTML로 만듭니다
node skills/work-to-lecture-deck/scripts/build-deck.cjs skills/work-to-lecture-deck/examples/deck.json deck.html
```

## 만든 원칙

- **직접 써 본 것만 올립니다.** 스크립트마다 예시 파일이나 실제 API로 돌려 본 뒤 올렸고, 검사가 통과해도 사람이 확인해야 하는 부분은 SKILL.md의 '한계'에 적었습니다.
- **조용히 성공한 척하지 않습니다.** 칸을 못 찾았거나, 이미 내용이 있는 칸이거나, 끝소리가 끊겨 있으면 종료 코드 1로 멈춥니다. 에이전트가 "완료했습니다"라고 넘어가지 못하게 하려는 장치입니다.
- **꾸며 내지 않습니다.** 글을 고칠 때 없는 경험이나 수치를 만들지 않고, 강의자료의 '내가 한 말'은 기록 원문만 씁니다.
- **키와 개인정보를 출력하지 않습니다.** API 키는 `.env`에 두고, 스크립트는 그 값을 화면에 찍지 않습니다.

## 고마운 프로젝트

- [airmang/python-hwpx](https://github.com/airmang/python-hwpx): HWPX 읽기·쓰기
- [ebandal/H2Orestart](https://github.com/ebandal/H2Orestart), [neolord0/hwp2hwpx](https://github.com/neolord0/hwp2hwpx): 한글 파일 변환
- [epoko77-ai/im-not-ai](https://github.com/epoko77-ai/im-not-ai): 한국어 AI 문체 분류 체계(말투 점검 스킬의 참고 자료)
- [Pretendard](https://github.com/orioncactus/pretendard), [Gaegu](https://fonts.google.com/specimen/Gaegu): 강의자료 글꼴(SIL OFL 1.1, 저장소에는 포함하지 않고 필요할 때 받습니다)
- [anthropics/skills](https://github.com/anthropics/skills): 스킬 구조와 플러그인 형식

## 만든 사람

**리도**, AI 좌충우돌 실습 중인 20년차 엔지니어입니다. AI로 직접 해 본 작업과 고친 과정을 영상과 글로 남기고 있습니다.

[YouTube @Reedodev](https://www.youtube.com/@Reedodev) · [Threads @reedo.dev](https://www.threads.com/@reedo.dev) · [링크 모음](https://links.metacint.com/)

버그나 개선 아이디어는 [Issues](https://github.com/reedodev/reedo-skills/issues)에 남겨 주세요.

---

## English

Five [Claude Code](https://docs.claude.com/en/docs/claude-code) skills I built while handing blog, social, video and paperwork tasks to AI agents, each fixed after it broke in real use. They focus on Korean-specific problems that English skill collections rarely cover.

| Skill | What it does |
|---|---|
| `korean-tone-check` | Flags mixed Korean speech levels (formal/polite/plain), stock AI phrases, translationese and choppy sentence runs. Exits 1 on speech-level mismatches. |
| `naver-golden-keywords` | Scores Naver blog keywords by monthly searches vs. blog document count using the official Search Ad and Search APIs. |
| `hwpx-form-fill` | Fills Hangul (HWPX) form tables by label without Hancom Office, refuses to overwrite filled cells, and re-opens the file to verify. |
| `tts-tail-fix` | Detects and fixes TTS clips whose last syllable is cut off (sentinel word + cut at the pause + fade at the real end). |
| `work-to-lecture-deck` | Turns real AI work logs into a single-file HTML lecture deck with a human/AI swimlane and per-step cards. |

Install with `/plugin marketplace add reedodev/reedo-skills` and `/plugin install korean-creator-skills@reedo-skills`, or copy a folder from `skills/` into `~/.claude/skills/`.

MIT License. Third-party fonts and libraries keep their own licenses.
