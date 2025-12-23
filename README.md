# MCP 메모장 서버 - 학습용 예제

MCP(Model Context Protocol)의 핵심 기능을 학습하기 위한 간단한 메모장 서버입니다.

## 📚 학습 목표

이 예제를 통해 다음을 배울 수 있습니다:

| 기능 | 설명 | 파일 |
|------|------|------|
| **Tools** | AI가 실행할 수 있는 액션 정의 | `src/tools/noteTools.ts` |
| **Resources** | AI가 읽을 수 있는 데이터 제공 | `src/resources/noteResources.ts` |
| **Prompts** | 재사용 가능한 프롬프트 템플릿 | `src/prompts/notePrompts.ts` |

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
cd mcp-notes-server
npm install
```

### 2. 빌드

```bash
npm run build
```

### 3. Claude Desktop에 등록

`~/Library/Application Support/Claude/claude_desktop_config.json` 파일에 추가:

```json
{
  "mcpServers": {
    "mcp-notes": {
      "command": "node",
      "args": ["/절대경로/mcp-notes-server/dist/index.js"]
    }
  }
}
```

### 4. Claude Desktop 재시작

## 📦 제공 기능

### Tools (도구)

| 도구명 | 설명 | 입력 |
|--------|------|------|
| `create_note` | 새 메모 생성 | title, content, tags? |
| `update_note` | 메모 수정 | id, title?, content?, tags? |
| `delete_note` | 메모 삭제 | id |
| `search_notes` | 메모 검색 | keyword |

### Resources (리소스)

| URI | 설명 |
|-----|------|
| `notes://list` | 전체 메모 목록 |
| `notes://note/{id}` | 특정 메모 조회 |

### Prompts (프롬프트)

| 이름 | 설명 | 인자 |
|------|------|------|
| `summarize_note` | 메모 요약 | noteId, style? |
| `extract_tags` | 태그 추출 | noteId, maxTags? |
| `organize_notes` | 정리 제안 | - |

## 🗂 프로젝트 구조

```
mcp-notes-server/
├── src/
│   ├── index.ts           # 진입점, 서버 설정
│   ├── store/
│   │   └── noteStore.ts   # 인메모리 메모 저장소
│   ├── tools/
│   │   └── noteTools.ts   # Tool 정의 및 핸들러
│   ├── resources/
│   │   └── noteResources.ts # Resource 정의 및 핸들러
│   └── prompts/
│       └── notePrompts.ts # Prompt 정의 및 핸들러
├── package.json
└── tsconfig.json
```

## 💡 핵심 개념 정리

### 1. Tool

```typescript
// 정의
{
  name: "create_note",
  description: "새 메모 생성",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      content: { type: "string" }
    },
    required: ["title", "content"]
  }
}

// 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // 도구 실행 로직
});
```

### 2. Resource

```typescript
// 정의
{
  uri: "notes://list",
  name: "메모 목록",
  mimeType: "application/json"
}

// 핸들러
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  // 리소스 읽기 로직
});
```

### 3. Prompt

```typescript
// 정의
{
  name: "summarize_note",
  description: "메모 요약",
  arguments: [
    { name: "noteId", required: true }
  ]
}

// 핸들러
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  return {
    messages: [
      { role: "user", content: { type: "text", text: "..." } }
    ]
  };
});
```

## 🔧 개발 팁

### 디버깅

stderr로 로그 출력 (stdout은 MCP 통신에 사용):

```typescript
console.error("[Debug] 메시지");
```

### 감시 모드 개발

```bash
npm run dev  # tsc --watch
```

## 📖 다음 단계

1. **파일 영속화**: `noteStore.ts`를 수정하여 JSON 파일로 저장
2. **추가 리소스**: 태그별, 날짜별 필터링 추가
3. **SSE 전송**: HTTP 기반 전송으로 변경해보기

## 📚 참고 자료

- [MCP 공식 문서](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
