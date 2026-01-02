#!/usr/bin/env node
/**
 * MCP 메모장 서버 - 진입점
 *
 * 📚 학습 포인트:
 * - McpServer 클래스로 MCP 서버 생성 (최신 API)
 * - registerTool, registerResource, registerPrompt로 기능 등록
 * - StdioServerTransport로 stdin/stdout 통신
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// 핸들러 등록 함수 import
import { registerNoteTools } from "./tools/noteTools.js";
import { registerNoteResources } from "./resources/noteResources.js";
import { registerNotePrompts } from "./prompts/notePrompts.js";

/**
 * 서버 인스턴스 생성
 * 📚 학습 포인트:
 * - McpServer는 high-level wrapper로 더 간단한 API 제공
 * - 기존 Server + capabilities 설정 대신 자동으로 처리
 */
const server = new McpServer({
  name: "mcp-notes-server",
  version: "1.0.0",
});

/**
 * Tools, Resources, Prompts 등록
 * 📚 학습 포인트:
 * - 각 모듈에서 server 인스턴스에 직접 등록
 * - Zod 스키마로 타입 안전성 보장
 */
registerNoteTools(server);
registerNoteResources(server);
registerNotePrompts(server);

/**
 * 서버 시작
 * 📚 학습 포인트:
 * - StdioServerTransport: 표준 입출력으로 통신
 * - 다른 옵션: StreamableHTTPServerTransport (HTTP), SSE 등
 * @returns {Promise<void>} 서버 연결이 완료되면 resolve
 * @throws {Error} 서버 연결 실패 시 에러 발생
 */
async function main(): Promise<void> {
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
