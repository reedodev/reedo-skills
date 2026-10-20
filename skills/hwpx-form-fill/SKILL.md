---
name: hwpx-form-fill
description: "한컴오피스 없이 한글(HWPX) 신청서·공문 양식의 표 칸을 라벨로 찾아 채우고, 결과를 다시 열어 검증한 뒤 PDF로 쪽마다 확인한다. '한글 파일 채워줘', 'hwpx 양식 작성', '신청서 칸 채우기', '공모전 서식' 요청에 쓴다. Use to fill Korean Hangul (HWP/HWPX) form tables by label without Hancom Office, verify the result and review rendered PDF pages."
---

# 한글(HWPX) 양식 채우기 (hwpx-form-fill)

공모전 신청서나 관공서 양식은 대부분 한글 파일로 나오는데, 한컴오피스가 없거나 버전이 오래되면 칸이 깨지기 쉽습니다. 이 스킬은 오픈소스 [python-hwpx](https://github.com/airmang/python-hwpx)로 표의 **정확한 칸**을 찾아 채우고, 저장한 파일을 다시 열어 들어간 글자를 확인합니다.

## 준비
```bash
pip install python-hwpx
```
`.hwp`(옛 바이너리 형식)만 있다면 먼저 [hwp2hwpx](https://github.com/neolord0/hwp2hwpx)로 `.hwpx`로 바꿉니다.

## 절차
1. **양식 구조 보기**: 모든 표의 칸 위치와 글자를 봅니다.
   ```bash
   python scripts/hwpx_form.py inspect form.hwpx > cells.json
   ```
2. **채울 값 정하기** (`values.json`):
   ```json
   {
     "성명": "홍길동",
     "생년월일": "1990-01-01",
     "신청 동기@below": "아래 칸에 들어갈 내용",
     "#0:5,1": "표 0번, 5행 1열에 직접 넣기"
   }
   ```
   - 기본은 라벨 **오른쪽** 칸이고, `@below`를 붙이면 **아래** 칸입니다.
   - 같은 라벨이 여러 개면 `ambiguous`로 멈추므로, 1단계 결과를 보고 `#표:행,열` 주소로 지정합니다.
3. **채우기**:
   ```bash
   python scripts/hwpx_form.py fill form.hwpx values.json filled.hwpx
   ```
   - 빈 칸이나 안내 문구(□ ○ ※ -, "적어 주세요" 등)만 덮어씁니다. 이미 내용이 있는 칸은 `skipped_filled`로 남기고 건드리지 않습니다(`--force`로 강제할 수 있지만 꼭 필요할 때만).
   - 저장한 파일을 다시 열어 칸마다 `verified`를 확인하고, 문제가 하나라도 있으면 종료 코드 1을 돌려줍니다.
4. **PDF로 눈으로 확인**: 무료 [LibreOffice](https://www.libreoffice.org/)에 [H2Orestart](https://github.com/ebandal/H2Orestart) 확장을 깔고 변환합니다.
   ```bash
   soffice --headless --convert-to pdf filled.hwpx
   ```
   PDF를 쪽마다 이미지로 열어 칸 넘침, 빈칸, 중복, 남은 안내 기호, 체크박스, 서명란, 첨부 누락을 확인합니다. **이 확인이 끝나기 전에는 완료라고 하지 않습니다.**

## 지키는 것
- XML을 문자열로 직접 바꾸지 않습니다. 같은 문단을 두 번 넣지 않습니다.
- 개인정보(주민번호, 연락처, 주소)는 사용자가 준 값만 쓰고, 로그·파일명·보고에 그대로 옮기지 않습니다.
- 서명란에 손글씨 서명을 흉내 내지 않습니다. 동의 체크와 서명은 사용자가 허락한 범위에서만 합니다.
- 한컴오피스를 자동으로 띄워 변환해야 한다면 창을 숨기고, 사용자가 이미 열어 둔 한글 창은 절대 닫지 않습니다.

## 한계
- 병합된 칸이 복잡한 양식은 라벨 오른쪽 칸이 기대와 다를 수 있습니다. 1단계 결과로 위치를 확인하고 주소로 지정하세요.
- `verified`는 글자가 들어갔는지만 봅니다. 줄바꿈, 글자 크기, 칸 넘침은 4단계 PDF로만 확인할 수 있습니다.
