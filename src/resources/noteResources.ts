/**
 * MCP Resources 정의 - 메모 데이터 제공
 *
 * 📚 학습 포인트:
 * - Resource는 AI가 "읽을" 수 있는 데이터
 * - URI 패턴으로 식별 (notes://list, notes://note/123)
 * - Tool과 달리 읽기 전용, 부작용 없음
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAllNotes, getNote } from "../store/noteStore.js";

/**
 * 모든 Note Resources를 서버에 등록
 * 📚 학습 포인트:
 * - server.registerResource()로 정적 리소스 등록
 * - ResourceTemplate으로 동적 URI 패턴 등록
 * @param {McpServer} server - Resource를 등록할 MCP 서버 인스턴스
 * @returns {void}
 */
export function registerNoteResources(server: McpServer): void {
  /**
   * 메모 목록 리소스 (정적)
   * 📚 URI: notes://list
   */
  server.registerResource(
    "notes-list",
    "notes://list",
    {
      title: "메모 목록",
      description: "저장된 모든 메모의 목록을 제공합니다.",
      mimeType: "application/json",
    },
    async (uri) => {
      const notes = getAllNotes();

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                totalCount: notes.length,
                notes: notes.map((note) => ({
                  id: note.id,
                  title: note.title,
                  tags: note.tags,
                  createdAt: note.createdAt.toISOString(),
                  updatedAt: note.updatedAt.toISOString(),
                  preview: note.content.substring(0, 50) + "...",
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  /**
   * 개별 메모 리소스 (동적 템플릿)
   * 📚 URI 패턴: notes://note/{noteId}
   */
  server.registerResource(
    "note-by-id",
    new ResourceTemplate("notes://note/{noteId}", { list: listNoteResources }),
    {
      title: "개별 메모",
      description: "특정 ID의 메모 내용을 제공합니다.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const noteId = variables.noteId as string;
      const note = getNote(noteId);

      if (!note) {
        throw new Error(`메모를 찾을 수 없습니다: ${noteId}`);
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                id: note.id,
                title: note.title,
                content: note.content,
                tags: note.tags,
                createdAt: note.createdAt.toISOString(),
                updatedAt: note.updatedAt.toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}

/**
 * 동적 리소스 목록 생성
 * 📚 ResourceTemplate의 list 콜백으로 사용
 * @returns {Promise<{resources: Array<{uri: string, name: string, description: string, mimeType: string}>}>} 메모 리소스 목록 객체
 */
async function listNoteResources(): Promise<{
  resources: Array<{
    uri: string;
    name: string;
    description: string;
    mimeType: string;
  }>;
}> {
  const notes = getAllNotes();

  return {
    resources: notes.map((note) => ({
      uri: `notes://note/${note.id}`,
      name: `메모: ${note.title}`,
      description: `작성일: ${note.createdAt.toLocaleDateString()}`,
      mimeType: "application/json",
    })),
  };
}
