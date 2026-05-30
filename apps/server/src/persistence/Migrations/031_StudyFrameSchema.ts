import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS study_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_root TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      extraction_warnings_json TEXT NOT NULL DEFAULT '[]'
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS study_documents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      source_path TEXT NOT NULL,
      year INTEGER,
      quiz_label TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES study_projects(id) ON DELETE CASCADE
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      source_anchor TEXT NOT NULL,
      source_year INTEGER,
      source_quiz_label TEXT NOT NULL,
      raw_prompt TEXT NOT NULL,
      normalized_prompt TEXT NOT NULL,
      point_value REAL NOT NULL DEFAULT 0,
      is_real_question INTEGER NOT NULL DEFAULT 1,
      generated_from_question_ids TEXT,
      depends_on_assets INTEGER NOT NULL DEFAULT 0,
      extraction_confidence REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES study_projects(id) ON DELETE CASCADE,
      FOREIGN KEY(document_id) REFERENCES study_documents(id) ON DELETE CASCADE
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS question_support (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      summary_context TEXT NOT NULL DEFAULT '',
      expected_answer_json TEXT NOT NULL DEFAULT '[]',
      rubric_json TEXT NOT NULL DEFAULT '[]',
      hints_json TEXT NOT NULL DEFAULT '[]',
      solution_steps_json TEXT NOT NULL DEFAULT '[]',
      common_mistakes_json TEXT NOT NULL DEFAULT '[]',
      support_confidence REAL NOT NULL DEFAULT 0,
      generated_at TEXT NOT NULL,
      FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS question_topics (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      topic_thread_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      subtype TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0,
      is_primary INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE,
      FOREIGN KEY(topic_thread_id) REFERENCES topic_threads(id) ON DELETE CASCADE
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS topic_threads (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      display_name TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      priority_score REAL NOT NULL DEFAULT 0,
      first_exposure_complete INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES study_projects(id) ON DELETE CASCADE
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      topic_thread_id TEXT NOT NULL,
      answer_json TEXT NOT NULL,
      feedback_json TEXT NOT NULL,
      score REAL NOT NULL,
      max_score REAL NOT NULL,
      score_percent REAL NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('correct', 'partially_correct', 'incorrect', 'revealed')),
      used_hints_count INTEGER NOT NULL DEFAULT 0,
      used_check_direction INTEGER NOT NULL DEFAULT 0,
      attempt_number INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE,
      FOREIGN KEY(topic_thread_id) REFERENCES topic_threads(id) ON DELETE CASCADE
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS completion_summaries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      topic_thread_id TEXT,
      scope TEXT NOT NULL CHECK(scope IN ('project', 'topic', 'subtype')),
      real_questions_attempted INTEGER NOT NULL DEFAULT 0,
      generated_questions_attempted INTEGER NOT NULL DEFAULT 0,
      weighted_score_percent REAL NOT NULL DEFAULT 0,
      unweighted_score_percent REAL NOT NULL DEFAULT 0,
      questions_100_percent INTEGER NOT NULL DEFAULT 0,
      questions_not_100_percent INTEGER NOT NULL DEFAULT 0,
      questions_revealed INTEGER NOT NULL DEFAULT 0,
      weak_subtypes_json TEXT NOT NULL DEFAULT '[]',
      recommended_next_action TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(topic_thread_id) REFERENCES topic_threads(id) ON DELETE SET NULL
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS generated_question_batches (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      topic_thread_id TEXT NOT NULL,
      source_question_ids_json TEXT NOT NULL DEFAULT '[]',
      generation_reason TEXT NOT NULL CHECK(generation_reason IN ('exhausted_real_questions', 'weak_subtype_drill', 'exam_simulation')),
      created_at TEXT NOT NULL,
      FOREIGN KEY(topic_thread_id) REFERENCES topic_threads(id) ON DELETE CASCADE
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_questions_project_real_year
    ON questions(project_id, is_real_question, source_year)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_question_topics_thread_subtype
    ON question_topics(topic_thread_id, subtype, question_id)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_attempts_question_attempt_number
    ON attempts(question_id, attempt_number)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_attempts_topic_status
    ON attempts(topic_thread_id, status, score_percent)
  `;
});
