import type { Env } from "./types";

export async function getProjectMemory(
  env: Env,
  projectId: string
) {
  if (!env.DB) {
    throw new Error("D1 DB binding missing");
  }

  const result = await env.DB.prepare(
    `
    SELECT *
    FROM project_memory
    WHERE project_id = ?
    ORDER BY updated_at DESC
    `
  )
    .bind(projectId)
    .all();

  return (result.results || []).map(
    (row: any) => ({
      id: row.id,
      projectId: row.project_id,
      type: row.memory_type,
      content: safeParse(
        row.content_json
      ),
      createdAt: Number(
        row.created_at || 0
      ),
      updatedAt: Number(
        row.updated_at || 0
      ),
    })
  );
}

export async function addProjectMemory(
  env: Env,
  input: {
    projectId: string;
    type: string;
    content: unknown;
  }
) {
  if (!env.DB) {
    throw new Error("D1 DB binding missing");
  }

  const now = Date.now();

  const row = {
    id: crypto.randomUUID(),
    project_id: input.projectId,
    memory_type: input.type,
    content_json: JSON.stringify(
      input.content || {}
    ),
    created_at: now,
    updated_at: now,
  };

  await env.DB.prepare(
    `
    INSERT INTO project_memory (
      id,
      project_id,
      memory_type,
      content_json,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      row.id,
      row.project_id,
      row.memory_type,
      row.content_json,
      row.created_at,
      row.updated_at
    )
    .run();

  return row;
}

export async function clearProjectMemory(
  env: Env,
  projectId: string
) {
  if (!env.DB) {
    throw new Error("D1 DB binding missing");
  }

  await env.DB.prepare(
    `
    DELETE FROM project_memory
    WHERE project_id = ?
    `
  )
    .bind(projectId)
    .run();

  return {
    ok: true,
    projectId,
  };
}

function safeParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
