import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS study_source_chunks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      source_anchor TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      sanitized_text TEXT NOT NULL,
      token_estimate INTEGER NOT NULL DEFAULT 0,
      security_finding_ids_json TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY(project_id) REFERENCES study_projects(id) ON DELETE CASCADE,
      FOREIGN KEY(document_id) REFERENCES study_source_documents(id) ON DELETE CASCADE
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS study_source_security_findings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      question_candidate_id TEXT,
      asset_id TEXT,
      source_anchor TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN (
        'prompt_injection',
        'instruction_override',
        'false_answer_instruction',
        'tool_use_instruction',
        'data_exfiltration_request',
        'hidden_text_instruction',
        'suspicious_encoding',
        'benign_course_content'
      )),
      severity TEXT NOT NULL CHECK(severity IN ('info', 'low', 'medium', 'high', 'critical')),
      confidence REAL NOT NULL DEFAULT 0,
      instruction_text TEXT NOT NULL DEFAULT '',
      normalized_intent TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL CHECK(action IN ('ignored', 'quarantined', 'requires_review', 'blocked')),
      detection_method TEXT NOT NULL CHECK(detection_method IN ('heuristic', 'ai_audit', 'validator')),
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES study_projects(id) ON DELETE CASCADE,
      FOREIGN KEY(document_id) REFERENCES study_source_documents(id) ON DELETE CASCADE,
      FOREIGN KEY(question_candidate_id) REFERENCES study_question_candidates(id) ON DELETE SET NULL,
      FOREIGN KEY(asset_id) REFERENCES study_source_assets(id) ON DELETE SET NULL
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS study_processing_jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      source_root TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
      stage TEXT NOT NULL,
      progress_current INTEGER NOT NULL DEFAULT 0,
      progress_total INTEGER NOT NULL DEFAULT 0,
      message TEXT NOT NULL DEFAULT '',
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS study_processing_events (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      level TEXT NOT NULL CHECK(level IN ('info', 'warning', 'error')),
      message TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT 'null',
      created_at TEXT NOT NULL,
      FOREIGN KEY(job_id) REFERENCES study_processing_jobs(id) ON DELETE CASCADE
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS study_processing_artifacts (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      artifact_json TEXT NOT NULL DEFAULT 'null',
      created_at TEXT NOT NULL,
      FOREIGN KEY(job_id) REFERENCES study_processing_jobs(id) ON DELETE CASCADE
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_study_source_chunks_document
    ON study_source_chunks(document_id, chunk_index)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_study_security_findings_document
    ON study_source_security_findings(document_id, severity)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_study_processing_events_job_created
    ON study_processing_events(job_id, created_at)
  `;
});
