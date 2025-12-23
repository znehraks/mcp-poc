/**
 * MCP Resources 정의 - 메모 데이터 제공
 *
 * 📚 학습 포인트:
 * - Resource는 AI가 "읽을" 수 있는 데이터
 * - URI 패턴으로 식별 (notes://list, notes://note/123)
 * - Tool과 달리 읽기 전용, 부작용 없음
 */

import { Resource, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { getAllNotes, getNote } from "../store/noteStore.js";

/**
 * 리소스 목록 생성
 * 📚 학습 포인트:
 * - resources/list 요청 시 사용 가능한 리소스 목록 반환
 * - 동적 리소스는 템플릿으로 표현 가능
 */
export function listResources(): Resource[] {
  const resources: Resource[] = [
    {
      uri: "notes://list",
      name: "메모 목록",
      description: "저장된 모든 메모의 목록을 제공합니다.",
      mimeType: "application/json",
    },
  ];

  // 각 메모도 개별 리소스로 노출
  for (const note of getAllNotes()) {
    resources.push({
      uri: `notes://note/${note.id}`,
      name: `메모: ${note.title}`,
      description: `작성일: ${note.createdAt.toLocaleDateString()}`,
      mimeType: "application/json",
    });
  }

  return resources;
}

/**
 * 리소스 읽기 핸들러
 * 📚 학습 포인트:
 * - URI를 파싱하여 요청된 리소스 식별
 * - 텍스트 또는 blob 형태로 내용 반환
 */
export async function readResource(uri: string): Promise<ReadResourceResult> {
  const url = new URL(uri);

  // notes://list - 전체 목록
  if (url.host === "list") {
    const notes = getAllNotes();

    return {
      contents: [
        {
          uri,
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

  // notes://note/{id} - 개별 메모
  if (url.host === "note") {
    const noteId = url.pathname.slice(1); // '/' 제거
    const note = getNote(noteId);

    if (!note) {
      throw new Error(`메모를 찾을 수 없습니다: ${noteId}`);
    }

    return {
      contents: [
        {
          uri,
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

  throw new Error(`알 수 없는 리소스 URI: ${uri}`);
}
