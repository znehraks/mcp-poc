/**
 * MCP Tools 정의 - 메모 CRUD 및 검색
 *
 * 📚 학습 포인트:
 * - Tool은 AI가 "실행"할 수 있는 액션
 * - Zod 스키마로 입력/출력 파라미터 정의 (타입 안전성)
 * - registerTool()로 서버에 등록 (최신 API)
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
 * - registerTool(name, options, handler) 형식 (최신 API)
 * - options에 title, description, inputSchema, outputSchema 포함
 * - structuredContent로 타입 안전한 응답 반환
 * @param {McpServer} server - Tool을 등록할 MCP 서버 인스턴스
 * @returns {void}
 */
export function registerNoteTools(server: McpServer): void {
  /**
   * 메모 생성 Tool
   */
  server.registerTool(
    "create_note",
    {
      title: "메모 생성",
      description:
        "새로운 메모를 생성합니다. 제목과 내용을 입력받고, 선택적으로 태그를 추가할 수 있습니다.",
      inputSchema: {
        title: z.string().describe("메모 제목"),
        content: z.string().describe("메모 내용"),
        tags: z
          .array(z.string())
          .optional()
          .describe("메모에 붙일 태그 목록 (선택)"),
      },
      outputSchema: {
        success: z.boolean(),
        message: z.string(),
        note: z.object({
          id: z.string(),
          title: z.string(),
          tags: z.array(z.string()),
          createdAt: z.string(),
        }),
      },
    },
    async ({ title, content, tags }) => {
      const note = createNote(title, content, tags || []);

      const output = {
        success: true,
        message: "메모가 생성되었습니다.",
        note: {
          id: note.id,
          title: note.title,
          tags: note.tags,
          createdAt: note.createdAt.toISOString(),
        },
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(output, null, 2),
          },
        ],
        structuredContent: output,
      };
    }
  );

  /**
   * 메모 수정 Tool
   */
  server.registerTool(
    "update_note",
    {
      title: "메모 수정",
      description: "기존 메모를 수정합니다. 제목, 내용, 태그를 변경할 수 있습니다.",
      inputSchema: {
        id: z.string().describe("수정할 메모의 ID"),
        title: z.string().optional().describe("새로운 제목 (선택)"),
        content: z.string().optional().describe("새로운 내용 (선택)"),
        tags: z.array(z.string()).optional().describe("새로운 태그 목록 (선택)"),
      },
      outputSchema: {
        success: z.boolean(),
        message: z.string().optional(),
        error: z.string().optional(),
        note: z
          .object({
            id: z.string(),
            title: z.string(),
            updatedAt: z.string(),
          })
          .optional(),
      },
    },
    async ({ id, title, content, tags }) => {
      const note = updateNote(id, { title, content, tags });

      if (!note) {
        const output = {
          success: false,
          error: `ID가 '${id}'인 메모를 찾을 수 없습니다.`,
        };
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(output),
            },
          ],
          structuredContent: output,
          isError: true,
        };
      }

      const output = {
        success: true,
        message: "메모가 수정되었습니다.",
        note: {
          id: note.id,
          title: note.title,
          updatedAt: note.updatedAt.toISOString(),
        },
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(output, null, 2),
          },
        ],
        structuredContent: output,
      };
    }
  );

  /**
   * 메모 삭제 Tool
   */
  server.registerTool(
    "delete_note",
    {
      title: "메모 삭제",
      description: "메모를 삭제합니다.",
      inputSchema: {
        id: z.string().describe("삭제할 메모의 ID"),
      },
      outputSchema: {
        success: z.boolean(),
        message: z.string(),
      },
    },
    async ({ id }) => {
      const deleted = deleteNote(id);

      const output = {
        success: deleted,
        message: deleted
          ? "메모가 삭제되었습니다."
          : `ID가 '${id}'인 메모를 찾을 수 없습니다.`,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(output),
          },
        ],
        structuredContent: output,
        isError: !deleted,
      };
    }
  );

  /**
   * 메모 검색 Tool
   */
  server.registerTool(
    "search_notes",
    {
      title: "메모 검색",
      description: "키워드로 메모를 검색합니다. 제목, 내용, 태그에서 검색합니다.",
      inputSchema: {
        keyword: z.string().describe("검색 키워드"),
      },
      outputSchema: {
        success: z.boolean(),
        keyword: z.string(),
        count: z.number(),
        results: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            tags: z.array(z.string()),
            preview: z.string(),
          })
        ),
      },
    },
    async ({ keyword }) => {
      const results = searchNotes(keyword);

      const output = {
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
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(output, null, 2),
          },
        ],
        structuredContent: output,
      };
    }
  );
}
