import type {
  Env,
  PersistentJob,
  VirtualFile,
} from "./types";

import {
  safeJsonArray,
  mergeFiles,
} from "./files";

import {
  applyDependencyResolution,
  resolveDependencies,
  virtualBuildCheck,
} from "./build";

import { scoreProject } from "./scoring";
import { detectTarget } from "./targets";

import {
  AUTONOMOUS_PHASES,
  buildPhasePrompt,
} from "./prompts";

import {
  createAndroidCapacitorFiles,
  createFinalPackagingFiles,
  createGeneratedGameAssets,
} from "./assets";

import {
  runAgentPipeline,
  selectAgentRoles,
} from "../agents/runner";

import { exportFilesToGitHub } from "../routes/github";

export async function runScheduledJobs(env: Env) {
  if (!env.DB) return;

  const result = await env.DB
    .prepare(
      `
      SELECT id
      FROM jobs
      WHERE status IN ('running', 'paused')
      AND next_run_at <= ?
      ORDER BY updated_at ASC
      LIMIT 3
      `
    )
    .bind(Date.now())
    .all();

  for (const item of result.results || []) {
    try {
      await runPersistentJobStep(
        env,
        String((item as any).id)
      );
    } catch {
      // Prevent cron crash.
    }
  }
}

export async function createPersistentJob(
  db: D1Database,
  input: {
    prompt: string;
    target?: string;
  }
) {
  const now = Date.now();

  const job: PersistentJob = {
    id: crypto.randomUUID(),
    prompt: input.prompt,
    status: "running",
    phase: "product_spec",
    target:
      input.target ||
      detectTarget(input.prompt),
    score: 0,
    attempts: 0,
    max_attempts: 12,
    files_json: "[]",
    logs_json: JSON.stringify([
      `${new Date().toISOString()} · Job created.`,
    ]),
    error: "",
    created_at: now,
    updated_at: now,
    next_run_at: now,
    last_score: 0,
    stagnant_steps: 0,
    strategy: "normal",
  };

  await db
    .prepare(
      `
      INSERT INTO jobs (
        id,
        prompt,
        status,
        phase,
        target,
        score,
        attempts,
        max_attempts,
        files_json,
        logs_json,
        error,
        created_at,
        updated_at,
        next_run_at,
        last_score,
        stagnant_steps,
        strategy
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      job.id,
      job.prompt,
      job.status,
      job.phase,
      job.target,
      job.score,
      job.attempts,
      job.max_attempts,
      job.files_json,
      job.logs_json,
      job.error,
      job.created_at,
      job.updated_at,
      job.next_run_at,
      job.last_score,
      job.stagnant_steps,
      job.strategy
    )
    .run();

  return job;
}

export async function getPersistentJob(
  db: D1Database,
  id: string
): Promise<PersistentJob | null> {
  const row = await db
    .prepare(
      `
      SELECT *
      FROM jobs
      WHERE id = ?
      `
    )
    .bind(id)
    .first();

  return row
    ? hydratePersistentJob(row as any)
    : null;
}

export async function listPersistentJobs(
  db: D1Database
) {
  const result = await db
    .prepare(
      `
      SELECT
        id,
        prompt,
        status,
        phase,
        target,
        score,
        attempts,
        max_attempts,
        error,
        created_at,
        updated_at,
        next_run_at,
        last_score,
        stagnant_steps,
        strategy
      FROM jobs
      ORDER BY updated_at DESC
      LIMIT 30
      `
    )
    .all();

  return (result.results || []).map(
    (row: any) => ({
      id: row.id,
      prompt: row.prompt,
      status: row.status,
      phase: row.phase,
      target: row.target,
      score: Number(row.score || 0),
      attempts: Number(
        row.attempts || 0
      ),
      max_attempts: Number(
        row.max_attempts || 12
      ),
      error: row.error || "",
      created_at: Number(
        row.created_at || 0
      ),
      updated_at: Number(
        row.updated_at || 0
      ),
      next_run_at: Number(
        row.next_run_at || 0
      ),
      last_score: Number(
        row.last_score || 0
      ),
      stagnant_steps: Number(
        row.stagnant_steps || 0
      ),
      strategy:
        row.strategy || "normal",
    })
  );
}

export async function savePersistentJob(
  db: D1Database,
  job: PersistentJob
) {
  job.updated_at = Date.now();

  await db
    .prepare(
      `
      UPDATE jobs
      SET
        status = ?,
        phase = ?,
        score = ?,
        attempts = ?,
        files_json = ?,
        logs_json = ?,
        error = ?,
        last_score = ?,
        stagnant_steps = ?,
        strategy = ?,
        updated_at = ?,
        next_run_at = ?
      WHERE id = ?
      `
    )
    .bind(
      job.status,
      job.phase,
      job.score,
      job.attempts,
      job.files_json,
      job.logs_json,
      job.error || "",
      job.last_score || 0,
      job.stagnant_steps || 0,
      job.strategy || "normal",
      job.updated_at,
      job.next_run_at,
      job.id
    )
    .run();

  return job;
}

export async function resumePersistentJob(
  db: D1Database,
  id: string
) {
  const job =
    await getPersistentJob(db, id);

  if (!job) {
    throw new Error("Job not found");
  }

  job.status = "running";
  job.error = "";
  job.next_run_at = Date.now();

  return savePersistentJob(db, job);
}

export async function runPersistentJobStep(
  env: Env,
  id: string
) {
  if (!env.DB) {
    throw new Error(
      "D1 DB binding missing"
    );
  }

  const job =
    await getPersistentJob(
      env.DB,
      id
    );

  if (!job) {
    throw new Error("Job not found");
  }

  if (job.status === "done") {
    return job;
  }

  if (
    job.status === "paused" &&
    job.next_run_at > Date.now()
  ) {
    return job;
  }

  if (
    job.attempts >= job.max_attempts
  ) {
    job.status = "paused";
    job.error =
      "Max attempts reached.";
    job.next_run_at =
      Date.now() + 10 * 60_000;

    appendJobLog(
      job,
      "Paused: max attempts reached."
    );

    await savePersistentJob(
      env.DB,
      job
    );

    return job;
  }

  try {
    const files = safeJsonArray(
      job.files_json
    ) as VirtualFile[];

    appendJobLog(
      job,
      `Running phase: ${job.phase}`
    );

    const buildBefore =
      virtualBuildCheck(files);

    const scoreBefore =
      scoreProject(files);

    const roles =
      selectAgentRoles({
        target: job.target,
        build: buildBefore,
        score: scoreBefore,
        phase: job.phase,
        strategy:
          job.strategy || "normal",
      });

    const phasePrompt =
      buildPhasePrompt({
        phase: job.phase,
        prompt: job.prompt,
        target: job.target,
        files,
        build: buildBefore,
        score: scoreBefore,
        strategy:
          job.strategy || "normal",
      });

    const pipeline =
      await runAgentPipeline({
        env,
        aiConfig: {},
        userPrompt: phasePrompt,
        files,
        target: job.target,
        roles,
        phase: job.phase,
      });

    let nextFiles =
      pipeline.files;

    if (
      job.phase ===
      "sprites_and_assets"
    ) {
      nextFiles = mergeFiles(
        nextFiles,
        createGeneratedGameAssets(
          job.prompt
        )
      );
    }

    if (
      job.target.includes(
        "android"
      )
    ) {
      nextFiles = mergeFiles(
        nextFiles,
        createAndroidCapacitorFiles(
          job.prompt
        )
      );
    }

    nextFiles =
      applyDependencyResolution(
        nextFiles,
        resolveDependencies(
          nextFiles
        ).packageJson
      );

    let build =
      virtualBuildCheck(nextFiles);

    let score =
      scoreProject(nextFiles);

    if (
      job.phase ===
      "final_packaging"
    ) {
      nextFiles = mergeFiles(
        nextFiles,
        createFinalPackagingFiles({
          prompt: job.prompt,
          target: job.target,
          files: nextFiles,
          score,
        })
      );

      build =
        virtualBuildCheck(
          nextFiles
        );

      score =
        scoreProject(nextFiles);
    }

    const previousScore = Number(
      job.score ||
        job.last_score ||
        0
    );

    const improvement =
      score.total - previousScore;

    job.last_score =
      previousScore;

    job.stagnant_steps =
      improvement <= 1
        ? Number(
            job.stagnant_steps ||
              0
          ) + 1
        : 0;

    job.strategy =
      chooseNextStrategy({
        job,
        phase: job.phase,
        build,
        score,
        improvement,
      });

    const completedPhase =
      job.phase;

    job.phase =
      getNextPhaseWithStrategy({
        phase: completedPhase,
        build,
        score,
        job,
      });

    job.score = score.total;
    job.attempts += 1;
    job.files_json =
      JSON.stringify(nextFiles);
    job.error = "";

    job.status =
      job.phase === "done"
        ? "done"
        : "running";

    job.next_run_at =
      Date.now() + 5 * 60_000;

    appendJobLog(
      job,
      `${completedPhase}: agents ${roles.join(
        ", "
      )} · score ${
        score.total
      }/100 · strategy ${
        job.strategy
      } · next ${job.phase}`
    );

    if (
      job.status === "done" &&
      env.GITHUB_TOKEN
    ) {
      const repo =
        getRepoFromPrompt(
          job.prompt
        );

      if (repo) {
        try {
          const exportResult =
            await exportFilesToGitHub(
              {
                token:
                  env.GITHUB_TOKEN,
                repo,
                branch:
                  getBranchFromPrompt(
                    job.prompt
                  ) || "main",
                commitMessage:
                  "AutoApp autonomous final export",
                files: nextFiles,
              }
            );

          appendJobLog(
            job,
            `GitHub export complete: ${exportResult.commitUrl}`
          );
        } catch (error: any) {
          appendJobLog(
            job,
            `GitHub export failed: ${
              error?.message ||
              "unknown error"
            }`
          );
        }
      } else {
        appendJobLog(
          job,
          "GitHub export skipped: no repo found in prompt."
        );
      }
    }

    await savePersistentJob(
      env.DB,
      job
    );

    return job;
  } catch (error: any) {
    job.status = "running";

    job.error =
      error?.message ||
      "Step failed";

    job.next_run_at =
      Date.now() + 10 * 60_000;

    appendJobLog(
      job,
      `Paused after error: ${job.error}`
    );

    await savePersistentJob(
      env.DB,
      job
    );

    return job;
  }
}

export function hydratePersistentJob(
  row: any
): PersistentJob {
  return {
    id: String(row.id),
    prompt: String(
      row.prompt || ""
    ),
    status:
      row.status || "running",
    phase:
      row.phase ||
      "product_spec",
    target:
      row.target || "web-app",
    score: Number(
      row.score || 0
    ),
    attempts: Number(
      row.attempts || 0
    ),
    max_attempts: Number(
      row.max_attempts || 12
    ),
    files_json: String(
      row.files_json || "[]"
    ),
    logs_json: String(
      row.logs_json || "[]"
    ),
    error: row.error || "",
    created_at: Number(
      row.created_at || 0
    ),
    updated_at: Number(
      row.updated_at || 0
    ),
    next_run_at: Number(
      row.next_run_at || 0
    ),
    last_score: Number(
      row.last_score || 0
    ),
    stagnant_steps: Number(
      row.stagnant_steps || 0
    ),
    strategy:
      row.strategy || "normal",
  };
}

export function publicJob(
  job: PersistentJob
) {
  return {
    id: job.id,
    prompt: job.prompt,
    status: job.status,
    phase: job.phase,
    target: job.target,
    score: job.score,
    attempts: job.attempts,
    max_attempts:
      job.max_attempts,
    error: job.error || "",
    created_at:
      job.created_at,
    updated_at:
      job.updated_at,
    next_run_at:
      job.next_run_at,
    last_score:
      job.last_score || 0,
    stagnant_steps:
      job.stagnant_steps || 0,
    strategy:
      job.strategy || "normal",
  };
}

export function appendJobLog(
  job: PersistentJob,
  message: string
) {
  const logs = safeJsonArray(
    job.logs_json
  ) as string[];

  logs.unshift(
    `${new Date().toISOString()} · ${message}`
  );

  job.logs_json =
    JSON.stringify(
      logs.slice(0, 250)
    );
}

export function chooseNextStrategy({
  job,
  phase,
  build,
  score,
  improvement,
}: {
  job: PersistentJob;
  phase: string;
  build: any;
  score: any;
  improvement: number;
}) {
  if (!build.ok) {
    return "repair";
  }

  if (
    Number(
      job.stagnant_steps || 0
    ) >= 3
  ) {
    if (
      score.productDepth < 80
    ) {
      return "force_product_depth";
    }

    if (score.ui < 85) {
      return "force_ui";
    }

    if (score.mobile < 85) {
      return "force_mobile";
    }

    if (
      score.reliability < 85
    ) {
      return "force_reliability";
    }

    return "finalize";
  }

  if (improvement >= 5) {
    return "normal";
  }

  if (
    phase ===
    "sprites_and_assets"
  ) {
    return "force_assets";
  }

  if (
    phase ===
    "animations_and_feedback"
  ) {
    return "force_feedback";
  }

  if (
    phase ===
    "final_packaging"
  ) {
    return "finalize";
  }

  return (
    job.strategy || "normal"
  );
}

export function getNextPhaseWithStrategy({
  phase,
  build,
  score,
  job,
}: {
  phase: string;
  build: any;
  score: any;
  job: PersistentJob;
}) {
  if (!build.ok) {
    return "repair";
  }

  const strategy =
    job.strategy || "normal";

  if (
    score.total >= 92 &&
    build.ok
  ) {
    return "done";
  }

  if (
    strategy ===
    "force_product_depth"
  ) {
    return "core_features";
  }

  if (
    strategy === "force_ui"
  ) {
    return "ui_system";
  }

  if (
    strategy ===
    "force_mobile"
  ) {
    return "ui_system";
  }

  if (
    strategy ===
    "force_reliability"
  ) {
    return "animations_and_feedback";
  }

  if (
    strategy ===
    "force_assets"
  ) {
    return "sprites_and_assets";
  }

  if (
    strategy ===
    "force_feedback"
  ) {
    return "animations_and_feedback";
  }

  if (
    strategy === "repair"
  ) {
    return "repair";
  }

  if (
    strategy ===
      "finalize" &&
    score.total >= 82
  ) {
    return "final_packaging";
  }

  const index =
    AUTONOMOUS_PHASES.indexOf(
      phase as any
    );

  if (index < 0) {
    return "product_spec";
  }

  return AUTONOMOUS_PHASES[
    Math.min(
      index + 1,
      AUTONOMOUS_PHASES.length -
        1
    )
  ];
}

function getRepoFromPrompt(
  prompt: string
) {
  const match = String(
    prompt
  ).match(
    /github\s*repo\s*:\s*([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/i
  );

  return match?.[1] || "";
}

function getBranchFromPrompt(
  prompt: string
) {
  const match = String(
    prompt
  ).match(
    /github\s*branch\s*:\s*([a-zA-Z0-9_.\/-]+)/i
  );

  return match?.[1] || "main";
      }
