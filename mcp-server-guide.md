# MCP (Model Context Protocol) 서버 구현 가이드

## MCP란?

**LLM이 외부 도구·데이터·시스템을 표준 방식으로 사용할 수 있게 해주는 프로토콜**

- 과거: 플러그인/툴/함수 호출 → 모델/플랫폼마다 다름
- MCP: 한 번 만든 서버를 여러 LLM/IDE가 공통 규격으로 사용

---

## 핵심 구성요소 3가지

| 구성요소 | 역할 | 비유 |
|---------|------|------|
| **Tools** | LLM이 실행할 수 있는 함수 | 버튼/리모컨 |
| **Resources** | LLM이 참고할 수 있는 데이터 | 교과서/사전 |
| **Prompts** | 재사용 가능한 프롬프트 템플릿 | 사고 프레임 |

---

## 1. Tools

### 정의
LLM이 호출할 수 있는 서버 함수

### 특징
- Create/Update/Delete(CUD) 가능
- Read도 가능 (동적 조회용)
- LLM이 선택해서 호출

### 예시
```typescript
server.tool(
  "getUser",
  { userId: z.string() },
  async ({ userId }) => {
    return { name: "Kim", age: 30 };
  }
);
```

### CUD 사용 시 주의사항

⚠️ LLM은 "확률적으로" 실행하므로 안전장치 필수

**Level 1 - Read Only (권장)**
```typescript
listOrders()
getUserById()
```

**Level 2 - Controlled CUD**
```typescript
// 명시적 확인 필수
server.tool(
  "deleteOrder",
  {
    orderId: z.string(),
    confirm: z.literal(true)  // 필수 확인
  },
  async ({ orderId }) => { /* 실행 */ }
);
```

**Level 3 - High Risk (사람 승인 필수)**
```typescript
// LLM은 제안만, 실행은 사람이
proposeDeleteOrder()
```

---

## 2. Resources

### 정의
LLM이 "문맥(context)"으로 참고하는 Read-only 데이터

### 특징
- CUD 불가 (Read Only)
- 세션에 자동 포함
- LLM이 "사실"로 믿음

### 예시
```typescript
server.resource(
  "design-guidelines",
  async () => ({
    contents: [{ text: "버튼은 primary 색상을 사용한다" }]
  })
);
```

### 외부 API Read 가능
```typescript
server.resource(
  "user-profile",
  async () => {
    const res = await fetch("https://api.example.com/user/123");
    const data = await res.json();
    return {
      contents: [{ text: JSON.stringify(data, null, 2) }],
    };
  }
);
```

---

## 3. Prompts

### 정의
LLM에게 제공하는 "공식 프롬프트 템플릿 레지스트리"

### 특징
- 일관된 사고 틀 강제
- 외부 파일/DB/API에서 읽어와 고정적으로 사용 가능
- 틀은 고정, 변수만 동적 주입

### 예시: 파일 기반
```typescript
// prompts/code-review.md 파일에서 읽기
server.prompt("code-review", async () => {
  const content = await fs.readFile("./prompts/code-review.md", "utf-8");
  return {
    messages: [{ role: "system", content }],
  };
});
```

### 예시: 변수 주입
```typescript
server.prompt("pr-review", async ({ projectName, diff }) => {
  const template = await loadPrompt();
  return {
    messages: [{
      role: "system",
      content: template
        .replace("{{projectName}}", projectName)
        .replace("{{diff}}", diff),
    }],
  };
});
```

---

## Resources vs Tools: Read 구분 기준

### 핵심 질문
> 이 데이터를 LLM이 어떻게 써야 하는가?

| 상황 | 선택 |
|-----|------|
| "알고 있어야 생각을 잘한다" | **Resources** |
| "지금 뭔가를 하려고 조회한다" | **Tools** |

### 비교표

| 기준 | Resources | Tools |
|-----|-----------|-------|
| LLM 역할 | 이해/판단 | 실행/행동 |
| 성격 | 사실, 규칙, 문맥 | 요청에 따른 조회 |
| 호출 주체 | 시스템(자동 포함) | LLM이 선택 |
| 결과 신뢰도 | "사실로 믿음" | "상황적 결과" |
| 값 변동 | 거의 없음 | 자주 바뀜 |

### 결정 트리

```
1. 이 데이터가 "판단 기준/사실"인가?
   └─ YES → resource
   └─ NO ↓

2. 사용자/시간/ID에 따라 바뀌는가?
   └─ YES → tool
   └─ NO ↓

3. 모든 응답에 항상 포함돼도 되는가?
   └─ YES → resource
   └─ NO → tool
```

### 실제 예시

| 케이스 | 선택 | 이유 |
|-------|------|------|
| 사용자 등급 정책 | Resource | 모든 판단의 기준, 규칙 |
| 특정 사용자 정보 조회 | Tool | userId에 따라 값이 다름 |
| 에러 로그 요약 | Resource | 사고 맥락 제공 |
| 특정 조건 로그 검색 | Tool | 질문에 대한 실행 |
| 주문 상태 정의(PENDING, PAID) | Resource | 도메인 지식/해석 기준 |
| 최근 24시간 주문 수 | Tool | 시간에 따라 변함 |

---

## 통합 흐름 예시

**시나리오**: "결제 실패가 왜 늘었는지 분석해줘"

```
[입력] → 사용자 질문

    ↓

[Resources 로드]
├─ service-glossary: 용어 정의
├─ runbook: 장애 대응 정책
└─ error-logs-24h: 최근 로그 요약

    ↓

[Prompt 적용]
└─ incident-analysis: 보고서 형식 고정

    ↓

[Tools 호출] (필요시)
└─ queryPaymentsMetrics(): 추가 지표 조회

    ↓

[결과] → 분석 보고서 출력
```

---

## 안티패턴 ⚠️

### Tools
```typescript
// ❌ 위험: SQL 직접 실행
runSQL(query: string)

// ✅ 안전: 업무 단위로 제한
getOrdersByDateRange(startDate, endDate)
```

### Resources
```typescript
// ❌ 잘못됨: 동적 조회를 resource로
resource: getOrderById(orderId)

// ❌ 잘못됨: 조건 분기
resource: logs?date=2025-01-01

// ✅ 올바름: 고정된 정책/규칙
resource: order-status-definitions
```

### Prompts
```typescript
// ❌ tool 안에서 프롬프트 하드코딩
tool("review", () => "너는 최고의 개발자야...");

// ✅ 외부 파일에서 관리
const template = await fs.readFile("./prompts/review.md");
```

---

## 필수 지식 요약

| 카테고리 | 필요 지식 |
|---------|----------|
| 필수 | JSON, HTTP, Node.js/Python, TypeScript |
| 필수 | Tools/Resources/Prompts 개념 |
| 필수 | JSON Schema / Zod 타입 정의 |
| 권장 | 파일시스템, 외부 API, 인증 |
| 고급 | 상태 관리, 보안, 성능 최적화 |

---

## 핵심 요약

> **Tools**: LLM이 "실행"하는 함수 (Read/CUD 가능, 주의 필요)
> 
> **Resources**: LLM이 "이해"하는 데이터 (Read Only, 사실로 믿음)
> 
> **Prompts**: LLM의 "사고 틀" (외부 파일로 고정 관리)

**Read 구분 핵심**:
- "이해를 위한 사실" → Resources
- "행동을 위한 조회" → Tools
