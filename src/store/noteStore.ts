/**
 * 메모 저장소 - 파일 기반 영속화
 *
 * 📚 학습 포인트:
 * - MCP 서버는 상태를 가질 수 있음 (이 경우 메모 데이터)
 * - JSON 파일로 데이터를 영속화하여 서버 재시작 후에도 유지
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// 메모 타입 정의
export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// 파일 저장용 타입 (Date를 string으로)
interface NoteData {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface StoreData {
  idCounter: number;
  notes: NoteData[];
}

// 저장 파일 경로 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, "../../data");
const DATA_FILE = join(DATA_DIR, "notes.json");

// 인메모리 저장소
const notes: Map<string, Note> = new Map();

// ID 카운터
let idCounter = 0;

/**
 * 데이터 디렉토리 확인 및 생성
 */
function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
    console.error(`[Store] 데이터 디렉토리 생성: ${DATA_DIR}`);
  }
}

/**
 * 파일에서 데이터 로드
 */
function loadFromFile(): void {
  ensureDataDir();

  if (!existsSync(DATA_FILE)) {
    console.error("[Store] 저장된 데이터 없음, 빈 저장소로 시작");
    return;
  }

  try {
    const raw = readFileSync(DATA_FILE, "utf-8");
    const data: StoreData = JSON.parse(raw);

    idCounter = data.idCounter || 0;

    notes.clear();
    for (const noteData of data.notes) {
      const note: Note = {
        ...noteData,
        createdAt: new Date(noteData.createdAt),
        updatedAt: new Date(noteData.updatedAt),
      };
      notes.set(note.id, note);
    }

    console.error(`[Store] ${notes.size}개의 메모 로드 완료`);
  } catch (error) {
    console.error("[Store] 데이터 로드 실패:", error);
  }
}

/**
 * 파일에 데이터 저장
 */
function saveToFile(): void {
  ensureDataDir();

  const data: StoreData = {
    idCounter,
    notes: Array.from(notes.values()).map(note => ({
      ...note,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })),
  };

  try {
    writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    console.error(`[Store] 데이터 저장 완료: ${DATA_FILE}`);
  } catch (error) {
    console.error("[Store] 데이터 저장 실패:", error);
  }
}

// 서버 시작 시 데이터 로드
loadFromFile();

// ID 생성 헬퍼
function generateId(): string {
  return `note_${++idCounter}_${Date.now()}`;
}

/**
 * 새 메모 생성
 */
export function createNote(title: string, content: string, tags: string[] = []): Note {
  const id = generateId();
  const now = new Date();

  const note: Note = {
    id,
    title,
    content,
    tags,
    createdAt: now,
    updatedAt: now,
  };

  notes.set(id, note);
  saveToFile(); // 파일에 저장
  return note;
}

/**
 * 메모 조회
 */
export function getNote(id: string): Note | undefined {
  return notes.get(id);
}

/**
 * 전체 메모 목록 조회
 */
export function getAllNotes(): Note[] {
  return Array.from(notes.values()).sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );
}

/**
 * 메모 수정
 */
export function updateNote(
  id: string,
  updates: { title?: string; content?: string; tags?: string[] }
): Note | undefined {
  const note = notes.get(id);
  if (!note) return undefined;

  const updatedNote: Note = {
    ...note,
    ...updates,
    updatedAt: new Date(),
  };

  notes.set(id, updatedNote);
  saveToFile(); // 파일에 저장
  return updatedNote;
}

/**
 * 메모 삭제
 */
export function deleteNote(id: string): boolean {
  const result = notes.delete(id);
  if (result) {
    saveToFile(); // 파일에 저장
  }
  return result;
}

/**
 * 키워드로 메모 검색
 */
export function searchNotes(keyword: string): Note[] {
  const lowerKeyword = keyword.toLowerCase();

  return getAllNotes().filter(note =>
    note.title.toLowerCase().includes(lowerKeyword) ||
    note.content.toLowerCase().includes(lowerKeyword) ||
    note.tags.some(tag => tag.toLowerCase().includes(lowerKeyword))
  );
}
