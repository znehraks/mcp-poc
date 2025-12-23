/**
 * MCP Prompts 정의 - 메모 관련 프롬프트 템플릿
 *
 * 📚 학습 포인트:
 * - Prompt는 재사용 가능한 프롬프트 템플릿
 * - arguments로 동적 값을 주입 가능
 * - AI가 특정 작업을 수행하도록 유도하는 미리 정의된 지시문
 */

import { Prompt, GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { getNote, getAllNotes } from "../store/noteStore.js";

/**
 * Prompt 정의 목록
 * 📚 학습 포인트:
 * - name: 프롬프트 식별자
 * - description: 사용자에게 보여줄 설명
 * - arguments: 동적으로 받을 인자 정의
 */
export const notePrompts: Prompt[] = [
  {
    name: "summarize_note",
    description: "선택한 메모의 내용을 요약합니다.",
    arguments: [
      {
        name: "noteId",
        description: "요약할 메모의 ID",
        required: true,
      },
      {
        name: "style",
        description: "요약 스타일 (brief, detailed, bullet)",
        required: false,
      },
    ],
  },
  {
    name: "extract_tags",
    description: "메모 내용에서 적절한 태그를 추출하여 제안합니다.",
    arguments: [
      {
        name: "noteId",
        description: "태그를 추출할 메모의 ID",
        required: true,
      },
      {
        name: "maxTags",
        description: "최대 태그 개수 (기본: 5)",
        required: false,
      },
    ],
  },
  {
    name: "organize_notes",
    description: "저장된 모든 메모를 분석하여 정리 방법을 제안합니다.",
    arguments: [],
  },
];

/**
 * Prompt 내용 생성 핸들러
 * 📚 학습 포인트:
 * - 인자를 받아 실제 프롬프트 메시지 생성
 * - messages 배열로 대화 컨텍스트 구성 가능
 * - role: "user" 또는 "assistant"
 */
export async function getPrompt(
  name: string,
  args: Record<string, string>
): Promise<GetPromptResult> {
  switch (name) {
    case "summarize_note": {
      const { noteId, style = "brief" } = args;
      const note = getNote(noteId);

      if (!note) {
        throw new Error(`메모를 찾을 수 없습니다: ${noteId}`);
      }

      const styleGuide = {
        brief: "2-3문장으로 핵심만",
        detailed: "모든 중요 포인트를 포함하여 상세하게",
        bullet: "글머리 기호로 나열하여",
      }[style] || "간결하게";

      return {
        description: `"${note.title}" 메모 요약`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `다음 메모의 내용을 ${styleGuide} 요약해주세요.

제목: ${note.title}
태그: ${note.tags.join(", ") || "없음"}
내용:
${note.content}`,
            },
          },
        ],
      };
    }

    case "extract_tags": {
      const { noteId, maxTags = "5" } = args;
      const note = getNote(noteId);

      if (!note) {
        throw new Error(`메모를 찾을 수 없습니다: ${noteId}`);
      }

      return {
        description: `"${note.title}" 메모에서 태그 추출`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `다음 메모 내용을 분석하여 적절한 태그를 최대 ${maxTags}개 추출해주세요.
태그는 짧고 핵심적인 키워드여야 합니다.

제목: ${note.title}
현재 태그: ${note.tags.join(", ") || "없음"}
내용:
${note.content}

형식: #태그1 #태그2 #태그3 형태로 응답해주세요.`,
            },
          },
        ],
      };
    }

    case "organize_notes": {
      const allNotes = getAllNotes();

      if (allNotes.length === 0) {
        return {
          description: "메모 정리 제안",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "현재 저장된 메모가 없습니다. 먼저 메모를 작성해주세요.",
              },
            },
          ],
        };
      }

      const notesSummary = allNotes
        .map(
          (n, i) =>
            `${i + 1}. "${n.title}" (태그: ${n.tags.join(", ") || "없음"}) - ${n.content.substring(0, 50)}...`
        )
        .join("\n");

      return {
        description: "전체 메모 정리 제안",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `저장된 ${allNotes.length}개의 메모를 분석하여 다음을 제안해주세요:
1. 카테고리별 분류 방법
2. 태그 통일 방안
3. 병합하거나 분리하면 좋을 메모
4. 전체적인 정리 전략

현재 메모 목록:
${notesSummary}`,
            },
          },
        ],
      };
    }

    default:
      throw new Error(`알 수 없는 프롬프트: ${name}`);
  }
}
