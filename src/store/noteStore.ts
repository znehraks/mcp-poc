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
 * @description DATA_DIR이 존재하지 않으면 재귀적으로 생성
 * @returns {void}
 */
function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
    console.error(`[Store] 데이터 디렉토리 생성: ${DATA_DIR}`);
  }
}

/**
 * 파일에서 데이터 로드
 * @description JSON 파일에서 메모 데이터를 읽어 인메모리 Map에 로드
 * @returns {void}
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
 * @description 인메모리 Map의 메모 데이터를 JSON 파일로 영속화
 * @returns {void}
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

/**
 * 고유 ID 생성 헬퍼
 * @description 카운터와 타임스탬프를 조합하여 고유한 메모 ID 생성
 * @returns {string} 생성된 고유 ID (예: "note_1_1735804800000")
 */
function generateId(): string {
  return `note_${++idCounter}_${Date.now()}`;
}

/**
 * 새 메모 생성
 * @param {string} title - 메모 제목
 * @param {string} content - 메모 내용
 * @param {string[]} [tags=[]] - 메모에 붙일 태그 배열 (선택)
 * @returns {Note} 생성된 메모 객체
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
 * @param {string} id - 조회할 메모의 ID
 * @returns {Note | undefined} 메모 객체 또는 undefined (없을 경우)
 */
export function getNote(id: string): Note | undefined {
  return notes.get(id);
}

/**
 * 전체 메모 목록 조회
 * @returns {Note[]} 최신 수정순으로 정렬된 전체 메모 배열
 */
export function getAllNotes(): Note[] {
  return Array.from(notes.values()).sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );
}

/**
 * 메모 수정
 * @param {string} id - 수정할 메모의 ID
 * @param {Object} updates - 수정할 필드들
 * @param {string} [updates.title] - 새로운 제목 (선택)
 * @param {string} [updates.content] - 새로운 내용 (선택)
 * @param {string[]} [updates.tags] - 새로운 태그 배열 (선택)
 * @returns {Note | undefined} 수정된 메모 객체 또는 undefined (없을 경우)
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
 * @param {string} id - 삭제할 메모의 ID
 * @returns {boolean} 삭제 성공 여부 (true: 삭제됨, false: 메모 없음)
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
 * @param {string} keyword - 검색할 키워드 (대소문자 무시)
 * @returns {Note[]} 제목, 내용, 태그에서 키워드가 포함된 메모 배열
 */
export function searchNotes(keyword: string): Note[] {
  const lowerKeyword = keyword.toLowerCase();

  return getAllNotes().filter(note =>
    note.title.toLowerCase().includes(lowerKeyword) ||
    note.content.toLowerCase().includes(lowerKeyword) ||
    note.tags.some(tag => tag.toLowerCase().includes(lowerKeyword))
  );
}
