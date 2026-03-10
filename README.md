# Runtime Notes

GitHub Pages를 활용하여 호스팅하는 **개발 블로그(정적 웹사이트)**입니다.
Jekyll이나 번들러 같은 별도 빌드 도구 없이, 순수 HTML/CSS/JS 파일만으로 빠르고 가볍게 운영됩니다.

---

## 🛠️ 블로그 폴더 구조

```text
📦 blog
 ┣ 📂 assets       # 공통 스타일시트(CSS), 자바스크립트(JS), 이미지 파일
 ┣ 📂 p            # 개별 포스팅 폴더 모음 (예: p/database-normalization/index.html)
 ┣ 📂 posts        # 전체 포스트 목록을 보여주는 아카이브 페이지
 ┣ 📜 index.html   # 블로그 랜딩 페이지 (메인 홈)
 ┣ 📜 posts.json   # 홈과 아카이브 목록에서 사용할 메타데이터(제목, 날짜, 태그 등)
 ┗ 📜 .nojekyll    # GitHub Pages에서 Jekyll 빌드를 우회하도록 지시하는 빈 파일
```

## 📝 포스팅 작성 방법

1. `p` 폴더 내부에 새로운 글 제목(영문 slug 권장)으로 폴더를 생성합니다.
2. 해당 폴더 안에 `index.html` 파일을 작성합니다.
3. 기존 글의 HTML 구조를 복사한 뒤, `<article>` 태그 내부의 내용만 수정하면 편리합니다.
4. 작성이 완료되면 글 목록 갱신을 위해 최상단의 `posts.json` 파일에 새 포스트 정보를 추가합니다.

## 🚀 로컬 프리뷰 (실행 방법)

작성된 글을 로컬 환경에서 미리 확인하고 싶다면 아래 파이썬 명령어를 실행하세요.

```bash
# 터미널에서 프로젝트 루트 디렉토리 이동 후 실행
python3 -m http.server 8080
```
브라우저를 열고 `http://localhost:8080` 에 접속하여 확인합니다.

## 🌍 GitHub Pages 배포 연동 가이드

1. GitHub 레포지토리의 **[Settings]** ➡️ **[Pages]** 메뉴로 이동합니다.
2. **Build and deployment** 섹션의 Source를 `Deploy from a branch`로 선택합니다.
3. 배포 브랜치(보통 `main` 또는 `master`)와 폴더(`/ (root)`)를 지정하고 **Save**를 누릅니다.
4. 잠시 후 상단에 표시되는 블로그 URL을 클릭하여 접속합니다. (빌드 과정 없이 즉시 반영됩니다.)
