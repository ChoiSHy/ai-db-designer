import { Pool } from "pg";
import { ChatMessage, SchemaJSON } from "./types";

// ── 커넥션 풀 ─────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 테이블 초기화는 최초 1회만 실행
let initPromise: Promise<void> | null = null;
function ensureInit() {
  if (!initPromise) initPromise = initDB();
  return initPromise;
}

// db 함수들이 호출될 때 자동으로 ensureInit()을 먼저 실행하는 헬퍼
async function q(text: string, values?: unknown[]) {
  await ensureInit();
  return pool.query(text, values);
}

// ── 테이블 초기화 ────────────────────────────────────────────
export async function initDB(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      username   TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username    TEXT NOT NULL REFERENCES users(username),
      name        TEXT NOT NULL DEFAULT '새 프로젝트',
      schema_json JSONB NOT NULL DEFAULT '{"tables":[]}',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content    TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS schema_history (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      schema_json JSONB NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

// ── 타입 ─────────────────────────────────────────────────────
export interface Project {
  id: string;
  username: string;
  name: string;
  schema_json: SchemaJSON;
  created_at: string;
  updated_at: string;
}

export interface ProjectData {
  project: Project;
  messages: ChatMessage[];
  schemaHistory: SchemaJSON[];
}

const MAX_HISTORY = 20;

// ── 사용자 ───────────────────────────────────────────────────
export async function getOrCreateUser(username: string): Promise<void> {
  await q(
    `INSERT INTO users (username) VALUES ($1) ON CONFLICT (username) DO NOTHING`,
    [username]
  );
}

// ── 프로젝트 ─────────────────────────────────────────────────
export async function getProjects(username: string): Promise<Project[]> {
  const { rows } = await q(
    `SELECT * FROM projects WHERE username = $1 ORDER BY updated_at DESC`,
    [username]
  );
  return rows as Project[];
}

export async function createProject(
  username: string,
  name: string = "새 프로젝트"
): Promise<Project> {
  const { rows } = await q(
    `INSERT INTO projects (username, name) VALUES ($1, $2) RETURNING *`,
    [username, name]
  );
  return rows[0] as Project;
}

export async function deleteProject(id: string): Promise<void> {
  await q(`DELETE FROM projects WHERE id = $1`, [id]);
}

export async function renameProject(id: string, name: string): Promise<void> {
  await q(
    `UPDATE projects SET name = $1, updated_at = NOW() WHERE id = $2`,
    [name, id]
  );
}

// ── 프로젝트 전체 데이터 로드 ────────────────────────────────
export async function getProjectData(id: string): Promise<ProjectData> {
  const [projectRes, messagesRes, historyRes] = await Promise.all([
    q(`SELECT * FROM projects WHERE id = $1`, [id]),
    q(`SELECT role, content FROM messages WHERE project_id = $1 ORDER BY created_at ASC`, [id]),
    q(
      `SELECT schema_json FROM schema_history WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [id, MAX_HISTORY]
    ),
  ]);

  return {
    project: projectRes.rows[0] as Project,
    messages: projectRes.rows.length === 0 ? [] : messagesRes.rows as ChatMessage[],
    schemaHistory: historyRes.rows.map((r) => r.schema_json as SchemaJSON),
  };
}

// ── 메시지 ───────────────────────────────────────────────────
export async function appendMessage(
  projectId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  await q(
    `INSERT INTO messages (project_id, role, content) VALUES ($1, $2, $3)`,
    [projectId, role, content]
  );
}

// ── 스키마 업데이트 ──────────────────────────────────────────
export async function updateSchema(
  projectId: string,
  newSchema: SchemaJSON,
  prevSchema?: SchemaJSON
): Promise<void> {
  const ops: Promise<unknown>[] = [
    q(
      `UPDATE projects SET schema_json = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(newSchema), projectId]
    ),
  ];

  if (prevSchema) {
    ops.push(
      q(
        `INSERT INTO schema_history (project_id, schema_json) VALUES ($1, $2)`,
        [projectId, JSON.stringify(prevSchema)]
      )
    );
  }

  await Promise.all(ops);

  // 히스토리 MAX 초과분 정리
  if (prevSchema) {
    await q(
      `DELETE FROM schema_history
       WHERE project_id = $1
         AND id NOT IN (
           SELECT id FROM schema_history
           WHERE project_id = $1
           ORDER BY created_at DESC
           LIMIT $2
         )`,
      [projectId, MAX_HISTORY]
    );
  }
}

// ── 실행 취소 ─────────────────────────────────────────────────
export async function undoSchema(projectId: string): Promise<SchemaJSON | null> {
  const { rows } = await q(
    `SELECT id, schema_json FROM schema_history WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [projectId]
  );

  if (rows.length === 0) return null;

  const { id, schema_json } = rows[0] as { id: string; schema_json: SchemaJSON };

  await Promise.all([
    q(`DELETE FROM schema_history WHERE id = $1`, [id]),
    q(
      `UPDATE projects SET schema_json = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(schema_json), projectId]
    ),
  ]);

  return schema_json;
}

// ── 프로젝트 초기화 ──────────────────────────────────────────
export async function resetProject(projectId: string): Promise<void> {
  await Promise.all([
    q(`DELETE FROM messages WHERE project_id = $1`, [projectId]),
    q(`DELETE FROM schema_history WHERE project_id = $1`, [projectId]),
    q(
      `UPDATE projects SET schema_json = '{"tables":[]}'::jsonb, updated_at = NOW() WHERE id = $1`,
      [projectId]
    ),
  ]);
}

// ── 마이그레이션 (localStorage → DB) ─────────────────────────
export async function migrateFromLocalStorage(
  username: string,
  messages: ChatMessage[],
  schema: SchemaJSON,
  schemaHistory: SchemaJSON[]
): Promise<Project> {
  const project = await createProject(username, "이전 대화");

  const ops: Promise<unknown>[] = [];

  if (messages.length > 0) {
    const values = messages
      .map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`)
      .join(", ");
    const params: unknown[] = [project.id];
    messages.forEach((m) => params.push(m.role, m.content));
    ops.push(q(`INSERT INTO messages (project_id, role, content) VALUES ${values}`, params));
  }

  if (schema.tables.length > 0) {
    ops.push(
      q(
        `UPDATE projects SET schema_json = $1 WHERE id = $2`,
        [JSON.stringify(schema), project.id]
      )
    );
  }

  const historyToInsert = schemaHistory.slice(0, MAX_HISTORY);
  if (historyToInsert.length > 0) {
    const values = historyToInsert.map((_, i) => `($1, $${i + 2})`).join(", ");
    const params: unknown[] = [project.id, ...historyToInsert.map((s) => JSON.stringify(s))];
    ops.push(q(`INSERT INTO schema_history (project_id, schema_json) VALUES ${values}`, params));
  }

  await Promise.all(ops);
  return project;
}
