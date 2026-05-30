import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS study_source_documents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_path TEXT NOT NULL,
      file_type TEXT NOT NULL CHECK(file_type IN ('docx', 'pdf', 'md', 'txt', 'csv', 'zip', 'doc', 'image', 'other')),
      role TEXT NOT NULL CHECK(role IN ('quiz', 'solution', 'lecture', 'data_asset', 'generated_export', 'unknown')),
      year INTEGER,
      quiz_label TEXT,
      extraction_confidence REAL NOT NULL DEFAULT 0,
      warnings_json TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY(project_id) REFERENCES study_projects(id) ON DELETE CASCADE
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS study_source_assets (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('image', 'table', 'equation', 'pdf_page', 'code_block', 'data_file')),
      source_anchor TEXT NOT NULL,
      content_text TEXT,
      content_json TEXT NOT NULL DEFAULT 'null',
      local_uri TEXT,
      extraction_confidence REAL NOT NULL DEFAULT 0,
      FOREIGN KEY(document_id) REFERENCES study_source_documents(id) ON DELETE CASCADE
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS study_question_candidates (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      source_anchor TEXT NOT NULL,
      raw_prompt_markdown TEXT NOT NULL,
      source_year INTEGER,
      source_quiz_label TEXT,
      point_value REAL,
      asset_ids_json TEXT NOT NULL DEFAULT '[]',
      extraction_confidence REAL NOT NULL DEFAULT 0,
      needs_manual_review INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(project_id) REFERENCES study_projects(id) ON DELETE CASCADE,
      FOREIGN KEY(document_id) REFERENCES study_source_documents(id) ON DELETE CASCADE
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS study_topic_clusters (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      priority_rank INTEGER NOT NULL DEFAULT 0,
      priority_score REAL NOT NULL DEFAULT 0,
      priority_label TEXT NOT NULL CHECK(priority_label IN ('very_high', 'high', 'medium', 'low')),
      priority_rationale TEXT NOT NULL DEFAULT '',
      recent_question_parts INTEGER NOT NULL DEFAULT 0,
      older_question_appearances INTEGER NOT NULL DEFAULT 0,
      weighted_points REAL NOT NULL DEFAULT 0,
      subtypes_json TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY(project_id) REFERENCES study_projects(id) ON DELETE CASCADE
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS study_question_classifications (
      id TEXT PRIMARY KEY,
      question_candidate_id TEXT NOT NULL,
      topic_cluster_id TEXT NOT NULL,
      subtype TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0,
      is_primary INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(question_candidate_id) REFERENCES study_question_candidates(id) ON DELETE CASCADE,
      FOREIGN KEY(topic_cluster_id) REFERENCES study_topic_clusters(id) ON DELETE CASCADE
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS study_topic_modules (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      topic_cluster_id TEXT NOT NULL,
      theory_summary_markdown TEXT NOT NULL DEFAULT '',
      formula_sheet_markdown TEXT NOT NULL DEFAULT '',
      common_traps_markdown TEXT NOT NULL DEFAULT '',
      subtype_coverage_json TEXT NOT NULL DEFAULT 'null',
      first_exposure_complete INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(project_id) REFERENCES study_projects(id) ON DELETE CASCADE,
      FOREIGN KEY(topic_cluster_id) REFERENCES study_topic_clusters(id) ON DELETE CASCADE
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS study_practice_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      topic_module_id TEXT NOT NULL,
      source_question_candidate_id TEXT,
      item_origin TEXT NOT NULL CHECK(item_origin IN ('real_question', 'generated_variant')),
      subtype TEXT NOT NULL,
      prompt_markdown TEXT NOT NULL,
      answer_input_type TEXT NOT NULL CHECK(answer_input_type IN ('free_text', 'numeric', 'formula', 'multiple_choice', 'multi_select', 'table', 'plot_checklist', 'file_upload')),
      point_value REAL NOT NULL DEFAULT 0,
      asset_ids_json TEXT NOT NULL DEFAULT '[]',
      source_metadata_json TEXT NOT NULL DEFAULT 'null',
      FOREIGN KEY(project_id) REFERENCES study_projects(id) ON DELETE CASCADE,
      FOREIGN KEY(topic_module_id) REFERENCES study_topic_modules(id) ON DELETE CASCADE,
      FOREIGN KEY(source_question_candidate_id) REFERENCES study_question_candidates(id) ON DELETE SET NULL
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS study_practice_support (
      id TEXT PRIMARY KEY,
      practice_item_id TEXT NOT NULL,
      expected_answer_json TEXT NOT NULL DEFAULT 'null',
      rubric_json TEXT NOT NULL DEFAULT 'null',
      hints_json TEXT NOT NULL DEFAULT '[]',
      step_by_step_solution_markdown TEXT NOT NULL DEFAULT '',
      common_mistakes_markdown TEXT NOT NULL DEFAULT '',
      support_confidence REAL NOT NULL DEFAULT 0,
      FOREIGN KEY(practice_item_id) REFERENCES study_practice_items(id) ON DELETE CASCADE
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_study_source_documents_project_role
    ON study_source_documents(project_id, role, year)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_study_question_candidates_project_year
    ON study_question_candidates(project_id, source_year, needs_manual_review)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_study_topic_clusters_project_rank
    ON study_topic_clusters(project_id, priority_rank)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_study_practice_items_module_origin
    ON study_practice_items(topic_module_id, item_origin)
  `;
});
