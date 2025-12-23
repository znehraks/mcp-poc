/**
 * MCP Tools 정의 - 메모 CRUD 및 검색
 *
 * 📚 학습 포인트:
 * - Tool은 AI가 "실행"할 수 있는 액션
 * - inputSchema로 입력 파라미터 정의 (JSON Schema 형식)
 * - 각 Tool은 이름, 설명, 입력 스키마를 가짐
 */

import { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  createNote,
  updateNote,
  deleteNote,
  searchNotes,
} from "../store/noteStore.js";

/**
 * Tool 정의 목록
 * 📚 inputSchema는 JSON Schema 형식으로 작성
 */
export const noteTools: Tool[] = [
  {
    name: "create_note",
    description: "새로운 메모를 생성합니다. 제목과 내용을 입력받고, 선택적으로 태그를 추가할 수 있습니다.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "메모 제목",
        },
        content: {
          type: "string",
          description: "메모 내용",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "메모에 붙일 태그 목록 (선택)",
        },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "update_note",
    description: "기존 메모를 수정합니다. 제목, 내용, 태그를 변경할 수 있습니다.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "수정할 메모의 ID",
        },
        title: {
          type: "string",
          description: "새로운 제목 (선택)",
        },
        content: {
          type: "string",
          description: "새로운 내용 (선택)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "새로운 태그 목록 (선택)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_note",
    description: "메모를 삭제합니다.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "삭제할 메모의 ID",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "search_notes",
    description: "키워드로 메모를 검색합니다. 제목, 내용, 태그에서 검색합니다.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "검색 키워드",
        },
      },
      required: ["keyword"],
    },
  },
];

/**
 * Tool 호출 핸들러
 * 📚 학습 포인트:
 * - 클라이언트가 Tool을 호출하면 이 함수가 실행됨
 * - arguments에서 입력값을 추출하여 처리
 * - 결과는 content 배열로 반환 (text 또는 image 등)
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  switch (name) {
    case "create_note": {
      const { title, content, tags } = args as {
        title: string;
        content: string;
        tags?: string[];
      };

      const note = createNote(title, content, tags);

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

    case "update_note": {
      const { id, title, content, tags } = args as {
        id: string;
        title?: string;
        content?: string;
        tags?: string[];
      };

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

    case "delete_note": {
      const { id } = args as { id: string };
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

    case "search_notes": {
      const { keyword } = args as { keyword: string };
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
                  preview: note.content.substring(0, 100) + (note.content.length > 100 ? "..." : ""),
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    default:
      return {
        content: [
          {
            type: "text",
            text: `알 수 없는 도구: ${name}`,
          },
        ],
        isError: true,
      };
  }
}
