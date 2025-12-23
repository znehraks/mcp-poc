/**
 * MCP Tools 정의 - 메모 CRUD 및 검색
 *
 * 📚 학습 포인트:
 * - Tool은 AI가 "실행"할 수 있는 액션
 * - Zod 스키마로 입력 파라미터 정의 (타입 안전성)
 * - registerTool()로 서버에 등록
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createNote,
  updateNote,
  deleteNote,
  searchNotes,
} from "../store/noteStore.js";

/**
 * 모든 Note Tools를 서버에 등록
 * 📚 학습 포인트:
 * - registerTool(name, schema, handler) 형식
 * - Zod로 inputSchema 정의하면 자동으로 JSON Schema로 변환
 */
export function registerNoteTools(server: McpServer): void {
  /**
   * 메모 생성 Tool
   */
  server.tool(
    "create_note",
    "새로운 메모를 생성합니다. 제목과 내용을 입력받고, 선택적으로 태그를 추가할 수 있습니다.",
    {
      title: z.string().describe("메모 제목"),
      content: z.string().describe("메모 내용"),
      tags: z.array(z.string()).optional().describe("메모에 붙일 태그 목록 (선택)"),
    },
    async ({ title, content, tags }) => {
      const note = createNote(title, content, tags || []);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: "메모가 생성되었습니다.",
                note: {
                  id: note.id,
                  title: note.title,
                  tags: note.tags,
                  createdAt: note.createdAt.toISOString(),
                },
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
   * 메모 수정 Tool
   */
  server.tool(
    "update_note",
    "기존 메모를 수정합니다. 제목, 내용, 태그를 변경할 수 있습니다.",
    {
      id: z.string().describe("수정할 메모의 ID"),
      title: z.string().optional().describe("새로운 제목 (선택)"),
      content: z.string().optional().describe("새로운 내용 (선택)"),
      tags: z.array(z.string()).optional().describe("새로운 태그 목록 (선택)"),
    },
    async ({ id, title, content, tags }) => {
      const note = updateNote(id, { title, content, tags });

      if (!note) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `ID가 '${id}'인 메모를 찾을 수 없습니다.`,
              }),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: "메모가 수정되었습니다.",
                note: {
                  id: note.id,
                  title: note.title,
                  updatedAt: note.updatedAt.toISOString(),
                },
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
   * 메모 삭제 Tool
   */
  server.tool(
    "delete_note",
    "메모를 삭제합니다.",
    {
      id: z.string().describe("삭제할 메모의 ID"),
    },
    async ({ id }) => {
      const deleted = deleteNote(id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: deleted,
              message: deleted
                ? "메모가 삭제되었습니다."
                : `ID가 '${id}'인 메모를 찾을 수 없습니다.`,
            }),
          },
        ],
        isError: !deleted,
      };
    }
  );

  /**
   * 메모 검색 Tool
   */
  server.tool(
    "search_notes",
    "키워드로 메모를 검색합니다. 제목, 내용, 태그에서 검색합니다.",
    {
      keyword: z.string().describe("검색 키워드"),
    },
    async ({ keyword }) => {
      const results = searchNotes(keyword);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                keyword,
                count: results.length,
                results: results.map((note) => ({
                  id: note.id,
                  title: note.title,
                  tags: note.tags,
                  preview:
                    note.content.substring(0, 100) +
                    (note.content.length > 100 ? "..." : ""),
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
}
