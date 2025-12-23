#!/usr/bin/env node
/**
 * MCP 메모장 서버 - 진입점
 *
 * 📚 학습 포인트:
 * - Server 클래스로 MCP 서버 생성
 * - StdioServerTransport로 stdin/stdout 통신
 * - 각 핸들러를 등록하여 요청 처리
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// 핸들러 import
import { noteTools, handleToolCall } from "./tools/noteTools.js";
import { listResources, readResource } from "./resources/noteResources.js";
import { notePrompts, getPrompt } from "./prompts/notePrompts.js";

/**
 * 서버 인스턴스 생성
 * 📚 학습 포인트:
 * - name: 서버 식별 이름
 * - version: 서버 버전
 * - capabilities: 지원하는 기능 선언 (tools, resources, prompts)
 */
const server = new Server(
  {
    name: "mcp-notes-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},      // Tool 기능 활성화
      resources: {},  // Resource 기능 활성화
      prompts: {},    // Prompt 기능 활성화
    },
  }
);

/**
 * Tools 핸들러 등록
 * 📚 학습 포인트:
 * - tools/list: 사용 가능한 도구 목록 반환
 * - tools/call: 도구 실행 요청 처리
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error("[Server] tools/list 요청 수신");
  return { tools: noteTools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.error(`[Server] tools/call 요청 수신: ${name}`);

  return handleToolCall(name, args ?? {});
});

/**
 * Resources 핸들러 등록
 * 📚 학습 포인트:
 * - resources/list: 사용 가능한 리소스 목록 반환
 * - resources/read: 특정 리소스 내용 반환
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  console.error("[Server] resources/list 요청 수신");
  return { resources: listResources() };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  console.error(`[Server] resources/read 요청 수신: ${uri}`);

  return readResource(uri);
});

/**
 * Prompts 핸들러 등록
 * 📚 학습 포인트:
 * - prompts/list: 사용 가능한 프롬프트 목록 반환
 * - prompts/get: 특정 프롬프트 내용 생성
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  console.error("[Server] prompts/list 요청 수신");
  return { prompts: notePrompts };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.error(`[Server] prompts/get 요청 수신: ${name}`);

  return getPrompt(name, args ?? {});
});

/**
 * 서버 시작
 * 📚 학습 포인트:
 * - StdioServerTransport: 표준 입출력으로 통신
 * - 다른 옵션: SSE, WebSocket 등
 */
async function main() {
  console.error("=== MCP 메모장 서버 시작 ===");
  console.error("Tools: create_note, update_note, delete_note, search_notes");
  console.error("Resources: notes://list, notes://note/{id}");
  console.error("Prompts: summarize_note, extract_tags, organize_notes");
  console.error("============================\n");

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("서버 오류:", error);
  process.exit(1);
});
