# MCP 메모장 서버 개발 가이드

MCP(Model Context Protocol)의 핵심 개념과 구현 방법을 설명하는 상세 가이드입니다.

## 목차

1. [MCP 용어 정의](#1-mcp-용어-정의)
2. [전체 아키텍처](#2-전체-아키텍처) (JSON-RPC 포함)
3. [파일별 상세 설명](#3-파일별-상세-설명)
4. [데이터 흐름](#4-데이터-흐름-상세)
5. [MCP 3대 기능 비교](#5-mcp-3대-기능-비교)
6. [파일 영속화](#6-파일-영속화)
7. [개발 팁](#7-개발-팁)
8. [참고 자료](#8-참고-자료)

---

## 1. MCP 용어 정의

### 핵심 구성요소

```
┌─────────────────────────────────────────────────────────────────────┐
│                              Host                                    │
│  (Claude Desktop, Claude Code, Cursor, Cline, Windsurf 등)          │
│                                                                      │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐    │
│  │     LLM        │    │   MCP Client   │    │   User UI      │    │
│  │  (Claude 등)   │◄──►│  (프로토콜     │◄──►│  (채팅창 등)   │    │
│  │                │    │   처리 담당)    │    │                │    │
│  └────────────────┘    └───────┬────────┘    └────────────────┘    │
│                                │                                     │
└────────────────────────────────┼─────────────────────────────────────┘
                                 │ JSON-RPC (stdin/stdout, SSE, WebSocket)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           MCP Server                                 │
│                    (mcp-notes-server 등)                            │
│                                                                      │
│  외부 기능 제공: Tools, Resources, Prompts                          │
└─────────────────────────────────────────────────────────────────────┘
```

### 용어 설명

| 용어 | 설명 | 예시 |
|------|------|------|
| **Host** | MCP Client를 포함하는 AI 애플리케이션. 사용자와 LLM 사이의 인터페이스 제공 | Claude Desktop, Claude Code, Cursor, Cline, Windsurf, Zed |
| **MCP Client** | Host 내에서 MCP 프로토콜을 처리하는 컴포넌트. Server와 JSON-RPC 통신 담당 | Host에 내장됨 |
| **MCP Server** | 외부 기능(Tools, Resources, Prompts)을 제공하는 서버 프로그램 | mcp-notes-server, filesystem, github 등 |
| **LLM** | 대규모 언어 모델. 사용자 요청을 이해하고 적절한 Tool/Resource/Prompt 선택 | Claude, GPT 등 |

### Host 애플리케이션 예시

| Host | 설명 | 용도 |
|------|------|------|
| **Claude Desktop** | Anthropic 공식 데스크톱 앱 | 일반 사용자용 AI 어시스턴트 |
| **Claude Code** | Anthropic CLI 기반 코딩 에이전트 | 터미널에서 코딩 작업 |
| **Cursor** | AI 기반 코드 에디터 | IDE에서 AI 코딩 지원 |
| **Cline** | VS Code 확장 AI 에이전트 | VS Code 내 AI 코딩 |
| **Windsurf** | AI 기반 IDE | 전체 IDE 환경에서 AI 지원 |
| **Zed** | 고성능 코드 에디터 | 빠른 AI 코드 편집 |

### MCP Server 예시

| Server | 제공 기능 |
|--------|----------|
| **mcp-notes-server** (본 프로젝트) | 메모 CRUD, 검색, 프롬프트 |
| **@modelcontextprotocol/server-filesystem** | 파일 시스템 읽기/쓰기 |
| **@modelcontextprotocol/server-github** | GitHub 저장소 조작 |
| **@modelcontextprotocol/server-postgres** | PostgreSQL 쿼리 실행 |
| **@modelcontextprotocol/server-slack** | Slack 메시지 전송/읽기 |

---

## 2. 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│            Host (Claude Code, Cursor, Claude Desktop 등)            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                        MCP Client                              │  │
│  │  - 사용자 요청 해석                                            │  │
│  │  - LLM과 협력하여 적절한 Tool/Resource/Prompt 선택             │  │
│  │  - MCP Server와 JSON-RPC 통신                                  │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────────┘
                               │ stdin/stdout (JSON-RPC 2.0)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  MCP Server (mcp-notes-server)                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                     index.ts (진입점)                          │  │
│  │  - Server 인스턴스 생성                                        │  │
│  │  - StdioServerTransport (stdin/stdout 통신)                   │  │
│  │  - capabilities: { tools, resources, prompts }                │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                               │                                      │
│          ┌────────────────────┼────────────────────┐                │
│          ▼                    ▼                    ▼                │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
│   │ noteTools   │     │noteResources│     │ notePrompts │          │
│   │ (도구 실행)  │     │(데이터 읽기) │     │(프롬프트생성)│          │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘          │
│          │                   │                   │                  │
│          └───────────────────┼───────────────────┘                  │
│                              ▼                                       │
│   ┌───────────────────────────────────────────────────────────────┐ │
│   │                      noteStore.ts                              │ │
│   │  - Map<string, Note> (인메모리 저장소)                         │ │
│   │  - data/notes.json (파일 영속화)                               │ │
│   └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 통신 방식

| 항목 | 설명 |
|------|------|
| **프로토콜** | JSON-RPC 2.0 |
| **전송 방식** | stdin/stdout (StdioServerTransport) |
| **대안** | SSE (Server-Sent Events), WebSocket |

### 전송 방식 비교

| 방식 | 장점 | 단점 | 사용 사례 |
|------|------|------|----------|
| **stdio** | 간단, 로컬 프로세스 간 통신 | 네트워크 불가 | 로컬 MCP 서버 |
| **SSE** | HTTP 기반, 방화벽 친화적 | 단방향 (서버→클라이언트) | 웹 기반 클라이언트 |
| **WebSocket** | 양방향, 실시간 | 복잡한 연결 관리 | 실시간 협업 |

### JSON-RPC 2.0이란?

**JSON-RPC**는 JSON 형식을 사용하는 원격 프로시저 호출(RPC) 프로토콜입니다.
MCP는 이 프로토콜을 사용하여 Client와 Server 간에 통신합니다.

#### 핵심 개념

| 개념 | 설명 |
|------|------|
| **Request** | Client → Server로 보내는 요청 (메서드 호출) |
| **Response** | Server → Client로 보내는 응답 (결과 또는 에러) |
| **Notification** | 응답을 기대하지 않는 단방향 메시지 (`id` 없음) |

#### Request 구조

```json
{
  "jsonrpc": "2.0",       // 프로토콜 버전 (필수, 항상 "2.0")
  "method": "tools/call", // 호출할 메서드 이름 (필수)
  "params": {             // 메서드 파라미터 (선택)
    "name": "create_note",
    "arguments": { "title": "제목", "content": "내용" }
  },
  "id": 1                 // 요청 식별자 (필수, 응답과 매칭용)
}
```

#### Response 구조 (성공)

```json
{
  "jsonrpc": "2.0",       // 프로토콜 버전
  "result": {             // 성공 시 결과 데이터
    "content": [{
      "type": "text",
      "text": "{ \"success\": true }"
    }]
  },
  "id": 1                 // 요청의 id와 동일
}
```

#### Response 구조 (에러)

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32600,       // 에러 코드 (정수)
    "message": "Invalid Request",  // 에러 메시지
    "data": { ... }       // 추가 정보 (선택)
  },
  "id": 1
}
```

#### 표준 에러 코드

| 코드 | 이름 | 설명 |
|------|------|------|
| `-32700` | Parse error | JSON 파싱 실패 |
| `-32600` | Invalid Request | 유효하지 않은 요청 |
| `-32601` | Method not found | 메서드를 찾을 수 없음 |
| `-32602` | Invalid params | 잘못된 파라미터 |
| `-32603` | Internal error | 내부 서버 에러 |

#### MCP에서 사용하는 메서드들

| 메서드 | 방향 | 설명 |
|--------|------|------|
| `initialize` | Client → Server | 연결 초기화 및 기능 협상 |
| `tools/list` | Client → Server | 사용 가능한 도구 목록 요청 |
| `tools/call` | Client → Server | 도구 실행 요청 |
| `resources/list` | Client → Server | 리소스 목록 요청 |
| `resources/read` | Client → Server | 리소스 읽기 요청 |
| `prompts/list` | Client → Server | 프롬프트 목록 요청 |
| `prompts/get` | Client → Server | 프롬프트 가져오기 요청 |

#### 왜 JSON-RPC인가?

| 특징 | 설명 |
|------|------|
| **간단함** | JSON 기반으로 구현이 쉬움 |
| **언어 독립적** | 어떤 언어로든 구현 가능 |
| **전송 독립적** | stdin/stdout, HTTP, WebSocket 등 다양한 전송 방식 사용 가능 |
| **상태 비저장** | 각 요청이 독립적, 서버가 상태를 유지할 필요 없음 |

#### 실제 통신 예시 (stdio)

```
┌─────────────────────────────────────────────────────────────────┐
│ Host (Claude Code)                                              │
│                                                                 │
│  1. 사용자: "메모 만들어줘"                                      │
│  2. LLM: create_note Tool 선택                                  │
│  3. MCP Client가 JSON-RPC Request 생성                          │
└────────────────────────┬────────────────────────────────────────┘
                         │ stdin으로 전송
                         │ {"jsonrpc":"2.0","method":"tools/call",...}
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ MCP Server (mcp-notes-server)                                   │
│                                                                 │
│  4. stdin에서 JSON 읽기                                         │
│  5. method 확인: "tools/call"                                   │
│  6. handleToolCall() 실행                                       │
│  7. JSON-RPC Response 생성                                      │
└────────────────────────┬────────────────────────────────────────┘
                         │ stdout으로 전송
                         │ {"jsonrpc":"2.0","result":{...},"id":1}
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Host (Claude Code)                                              │
│                                                                 │
│  8. MCP Client가 Response 수신                                  │
│  9. id로 Request와 매칭                                         │
│  10. LLM이 결과 해석 → 사용자에게 응답                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 파일별 상세 설명

### 3.1 `src/index.ts` - 진입점

MCP Server 인스턴스를 생성하고 Tools, Resources, Prompts를 등록합니다.

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "mcp-notes-server",
  version: "1.0.0",
});

// 각 모듈에서 등록 함수 호출
registerNoteTools(server);
registerNoteResources(server);
registerNotePrompts(server);

// 서버 시작
const transport = new StdioServerTransport();
await server.connect(transport);
```

#### 기존 API와 비교

| 기존 (Deprecated) | 최신 API (v1.12+) |
|-------------------|-------------------|
| `Server` 클래스 | `McpServer` 클래스 |
| `setRequestHandler(Schema, handler)` | `tool()`, `registerResource()`, `registerPrompt()` |
| JSON Schema 수동 정의 | Zod 스키마 (자동 변환) |

#### 주의사항

```typescript
// stdout은 MCP 통신 전용이므로 디버깅은 stderr 사용
console.error("[Debug] 메시지");  // ✅ 올바름
console.log("[Debug] 메시지");    // ❌ MCP 통신 방해
```

---

### 3.2 `src/tools/noteTools.ts` - 도구 정의

**Tool이란?**
- LLM이 **실행**할 수 있는 액션
- CRUD 작업처럼 **부작용(side effect)**이 있는 작업
- LLM이 사용자 요청을 분석하여 적절한 Tool 선택

#### 정의된 도구

| 도구명 | 설명 | 필수 파라미터 | 선택 파라미터 |
|--------|------|---------------|---------------|
| `create_note` | 메모 생성 | `title`, `content` | `tags` |
| `update_note` | 메모 수정 | `id` | `title`, `content`, `tags` |
| `delete_note` | 메모 삭제 | `id` | - |
| `search_notes` | 메모 검색 | `keyword` | - |

#### Tool 등록 방식 (최신 API)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerNoteTools(server: McpServer): void {
  server.tool(
    "create_note",                    // Tool 이름
    "새로운 메모를 생성합니다...",      // 설명 (LLM이 이걸 보고 Tool 선택)
    {                                  // Zod 스키마 (자동으로 JSON Schema로 변환)
      title: z.string().describe("메모 제목"),
      content: z.string().describe("메모 내용"),
      tags: z.array(z.string()).optional().describe("태그 목록"),
    },
    async ({ title, content, tags }) => {  // 핸들러 (타입 자동 추론)
      const note = createNote(title, content, tags || []);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, note }) }]
      };
    }
  );
}
```

#### 핸들러 응답 형식

```typescript
// 성공 시
return {
  content: [{ type: "text", text: JSON.stringify(result) }]
};

// 에러 시
return {
  content: [{ type: "text", text: "에러 메시지" }],
  isError: true
};
```

---

### 3.3 `src/resources/noteResources.ts` - 리소스 정의

**Resource란?**
- LLM이 **읽을** 수 있는 데이터
- **읽기 전용**, 부작용 없음
- URI로 식별

#### 정의된 리소스

| URI 패턴 | 설명 | 반환 데이터 |
|----------|------|-------------|
| `notes://list` | 전체 메모 목록 | 모든 메모 요약 정보 |
| `notes://note/{id}` | 개별 메모 상세 | 특정 메모 전체 내용 |

#### Resource 등록 방식 (최신 API)

```typescript
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerNoteResources(server: McpServer): void {
  // 정적 리소스
  server.registerResource(
    "notes-list",           // 내부 식별자
    "notes://list",         // URI
    {
      title: "메모 목록",
      description: "저장된 모든 메모의 목록",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(data) }]
    })
  );

  // 동적 리소스 (URI 템플릿)
  server.registerResource(
    "note-by-id",
    new ResourceTemplate("notes://note/{noteId}", { list: listNoteResources }),
    { title: "개별 메모", description: "특정 ID의 메모", mimeType: "application/json" },
    async (uri, variables) => {
      const noteId = variables.noteId as string;
      const note = getNote(noteId);
      return { contents: [{ uri: uri.href, text: JSON.stringify(note) }] };
    }
  );
}
```

#### 응답 형식

```typescript
return {
  contents: [
    {
      uri: "notes://list",
      mimeType: "application/json",
      text: JSON.stringify(data)
    }
  ]
};
```

---

### 3.4 `src/prompts/notePrompts.ts` - 프롬프트 정의

**Prompt란?**
- 재사용 가능한 **프롬프트 템플릿**
- LLM에게 특정 작업을 요청하는 미리 정의된 지시문
- 인자를 받아 동적으로 프롬프트 생성
- Tool/Resource와 달리 **사용자가 명시적으로 선택**

#### 정의된 프롬프트

| 이름 | 설명 | 필수 인자 | 선택 인자 |
|------|------|-----------|-----------|
| `summarize_note` | 메모 요약 | `noteId` | `style` (brief/detailed/bullet) |
| `extract_tags` | 태그 추출 제안 | `noteId` | `maxTags` (기본: 5) |
| `organize_notes` | 전체 메모 정리 제안 | - | - |

#### Prompt 등록 방식 (최신 API)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerNotePrompts(server: McpServer): void {
  server.registerPrompt(
    "summarize_note",
    {
      title: "메모 요약",
      description: "선택한 메모의 내용을 요약합니다.",
      argsSchema: {
        noteId: z.string().describe("요약할 메모의 ID"),
        style: z.enum(["brief", "detailed", "bullet"]).optional(),
      },
    },
    async ({ noteId, style = "brief" }) => {
      const note = getNote(noteId);
      return {
        description: `"${note.title}" 메모 요약`,
        messages: [{ role: "user", content: { type: "text", text: `요약해주세요: ${note.content}` }}]
      };
    }
  );
}
```

#### 응답 형식

```typescript
return {
  description: "메모 요약",
  messages: [
    {
      role: "user",
      content: {
        type: "text",
        text: "다음 메모의 내용을 요약해주세요..."
      }
    }
  ]
};
```

---

### 3.5 `src/store/noteStore.ts` - 데이터 저장소

#### 이중 저장 구조

```
┌─────────────────────┐     ┌─────────────────────┐
│  Map<string, Note>  │ ←→  │  data/notes.json    │
│    (인메모리)        │     │    (파일 영속화)     │
└─────────────────────┘     └─────────────────────┘
```

#### Note 타입

```typescript
interface Note {
  id: string;        // "note_1_1766475873568"
  title: string;
  content: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

#### 제공 함수

| 함수 | 역할 | 파일 저장 |
|------|------|-----------|
| `createNote(title, content, tags?)` | 메모 생성 | ✅ |
| `getNote(id)` | 단일 조회 | ❌ |
| `getAllNotes()` | 전체 조회 (최신순 정렬) | ❌ |
| `updateNote(id, updates)` | 메모 수정 | ✅ |
| `deleteNote(id)` | 메모 삭제 | ✅ |
| `searchNotes(keyword)` | 키워드 검색 | ❌ |

---

## 4. 데이터 흐름 상세

### 4.1 메모 생성 요청 (`create_note`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. 사용자 입력 (Host: Claude Code, Cursor 등)                        │
│    └─ "새 메모 만들어줘. 제목은 '회의록'이고 내용은..."               │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. LLM (Claude) 분석                                                 │
│    └─ "create_note Tool을 사용해야겠다"                              │
│    └─ 파라미터 추출: title="회의록", content="..."                   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. MCP Client → Server (stdin, JSON-RPC)                            │
│    {                                                                 │
│      "jsonrpc": "2.0",                                               │
│      "method": "tools/call",                                         │
│      "params": {                                                     │
│        "name": "create_note",                                        │
│        "arguments": { "title": "회의록", "content": "..." }          │
│      },                                                              │
│      "id": 1                                                         │
│    }                                                                 │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. index.ts - CallToolRequestSchema 핸들러                          │
│    └─ handleToolCall("create_note", args)                           │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. noteTools.ts - handleToolCall()                                  │
│    └─ case "create_note": createNote(title, content, tags)          │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. noteStore.ts - createNote()                                      │
│    ├─ generateId() → "note_1_1766475873568"                         │
│    ├─ notes.set(id, note)    // Map에 저장                          │
│    └─ saveToFile()           // data/notes.json에 저장              │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 7. Server → Client (stdout, JSON-RPC)                               │
│    {                                                                 │
│      "jsonrpc": "2.0",                                               │
│      "result": {                                                     │
│        "content": [{                                                 │
│          "type": "text",                                             │
│          "text": "{ \"success\": true, \"note\": {...} }"            │
│        }]                                                            │
│      },                                                              │
│      "id": 1                                                         │
│    }                                                                 │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 8. LLM이 결과 해석 → 사용자에게 응답                                 │
│    └─ "메모가 생성되었습니다. ID: note_1_..."                        │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 리소스 읽기 요청 (`notes://list`)

```
1. 사용자 (Host: Cursor 등)
   └─ "저장된 메모 목록 보여줘"

2. LLM 분석
   └─ "notes://list Resource를 읽어야겠다"

3. MCP Client → Server
   {
     "method": "resources/read",
     "params": { "uri": "notes://list" }
   }

4. index.ts
   └─ ReadResourceRequestSchema 핸들러
      └─ readResource("notes://list")

5. noteResources.ts
   └─ readResource()
      └─ url.host === "list"
         └─ getAllNotes()

6. noteStore.ts
   └─ getAllNotes()
      └─ Map에서 모든 메모 반환 (파일 읽기 없음)

7. Server → Client
   {
     "result": {
       "contents": [{
         "uri": "notes://list",
         "mimeType": "application/json",
         "text": "{ \"totalCount\": 2, \"notes\": [...] }"
       }]
     }
   }

8. LLM이 결과 해석 → 사용자에게 목록 표시
```

### 4.3 프롬프트 요청 (`summarize_note`)

```
1. 사용자 (Host: Claude Desktop 등)
   └─ summarize_note 프롬프트 선택 (UI에서)
   └─ noteId: "note_1_..." 입력

2. MCP Client → Server
   {
     "method": "prompts/get",
     "params": {
       "name": "summarize_note",
       "arguments": { "noteId": "note_1_...", "style": "brief" }
     }
   }

3. notePrompts.ts - getPrompt()
   ├─ getNote(noteId)로 메모 조회
   └─ 프롬프트 메시지 생성

4. Server → Client
   {
     "result": {
       "description": "메모 요약",
       "messages": [{
         "role": "user",
         "content": {
           "type": "text",
           "text": "다음 메모의 내용을 2-3문장으로 요약해주세요..."
         }
       }]
     }
   }

5. LLM이 프롬프트를 받아 요약 수행
   └─ 사용자에게 요약 결과 표시
```

---

## 5. MCP 3대 기능 비교

| 구분 | Tool | Resource | Prompt |
|------|------|----------|--------|
| **목적** | 액션 실행 | 데이터 읽기 | 프롬프트 생성 |
| **부작용** | 있음 (CUD) | 없음 (R) | 없음 |
| **식별** | `name` | `uri` | `name` |
| **선택 주체** | LLM이 자동 선택 | LLM이 자동 선택 | 사용자가 명시적 선택 |
| **예시** | `create_note` | `notes://list` | `summarize_note` |
| **용도** | DB 수정, API 호출 | 파일/DB 조회 | AI 작업 지시 |
| **메서드** | `tools/call` | `resources/read` | `prompts/get` |

### Tool vs Resource vs Prompt 선택 기준

```
사용자: "메모 만들어줘"
  └─ LLM 판단: 데이터 변경 필요 → Tool (create_note)

사용자: "메모 목록 보여줘"
  └─ LLM 판단: 데이터 읽기만 필요 → Resource (notes://list)

사용자: (UI에서 summarize_note 선택)
  └─ 사용자가 명시적으로 프롬프트 선택 → Prompt (summarize_note)
```

### 언제 무엇을 사용하나?

| 사용자 요청 | 선택 | 이유 |
|------------|------|------|
| "메모 만들어줘" | Tool (`create_note`) | 데이터 생성 (부작용 있음) |
| "메모 목록 보여줘" | Resource (`notes://list`) | 데이터 읽기만 (부작용 없음) |
| "이 메모 요약해줘" | Prompt (`summarize_note`) | 미리 정의된 프롬프트 템플릿 사용 |
| "메모 삭제해줘" | Tool (`delete_note`) | 데이터 삭제 (부작용 있음) |
| "메모 내용 알려줘" | Resource (`notes://note/{id}`) | 데이터 읽기만 |
| "태그 추천해줘" | Prompt (`extract_tags`) | AI 분석 작업 |

---

## 6. 파일 영속화

### 동작 방식

```
서버 시작 시:
┌─────────────────────────────────────┐
│ loadFromFile()                      │
│  └─ data/notes.json 존재?           │
│      ├─ Yes → JSON 파싱 → Map에 로드 │
│      └─ No  → 빈 Map으로 시작        │
└─────────────────────────────────────┘

데이터 변경 시 (Create/Update/Delete):
┌─────────────────────────────────────┐
│ saveToFile()                        │
│  └─ Map → JSON 직렬화               │
│      └─ data/notes.json에 쓰기       │
└─────────────────────────────────────┘
```

### JSON 파일 구조

```json
{
  "idCounter": 2,
  "notes": [
    {
      "id": "note_1_1766475873568",
      "title": "메모 제목",
      "content": "메모 내용",
      "tags": ["태그1", "태그2"],
      "createdAt": "2025-12-23T07:44:33.568Z",
      "updatedAt": "2025-12-23T07:44:33.568Z"
    }
  ]
}
```

### 파일 경로

```typescript
const DATA_DIR = join(__dirname, "../../data");
const DATA_FILE = join(DATA_DIR, "notes.json");
// 결과: mcp-notes-server/data/notes.json
```

---

## 7. 개발 팁

### 디버깅

```typescript
// stdout은 MCP 통신용이므로 stderr 사용
console.error("[Debug] 변수값:", variable);
```

### 새 Tool 추가하기

```typescript
// noteTools.ts의 registerNoteTools() 함수 내에 추가
server.tool(
  "new_tool_name",
  "도구 설명",
  { param: z.string().describe("파라미터 설명") },
  async ({ param }) => {
    // 로직 구현
    return { content: [{ type: "text", text: "결과" }] };
  }
);
```

### 새 Resource 추가하기

```typescript
// noteResources.ts의 registerNoteResources() 함수 내에 추가
server.registerResource(
  "resource-name",
  "custom://uri",
  { title: "리소스 제목", description: "설명" },
  async (uri) => ({ contents: [{ uri: uri.href, text: "데이터" }] })
);
```

### 새 Prompt 추가하기

```typescript
// notePrompts.ts의 registerNotePrompts() 함수 내에 추가
server.registerPrompt(
  "new_prompt",
  {
    title: "프롬프트 제목",
    description: "프롬프트 설명",
    argsSchema: { arg: z.string().describe("인자 설명") },
  },
  async ({ arg }) => ({
    messages: [{ role: "user", content: { type: "text", text: `프롬프트: ${arg}` }}]
  })
);
```

### Host 설정 (Claude Desktop 예시)

`~/Library/Application Support/Claude/claude_desktop_config.json`:

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

---

## 8. 참고 자료

- [MCP 공식 문서](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [JSON-RPC 2.0 명세](https://www.jsonrpc.org/specification)
- [MCP 서버 예제들](https://github.com/modelcontextprotocol/servers)
