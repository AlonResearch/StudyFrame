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

  const topicThreadColumns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(topic_threads)
  `;
  if (!topicThreadColumns.some((column) => column.name === "summary")) {
    yield* sql`
      ALTER TABLE topic_threads
      ADD COLUMN summary TEXT NOT NULL DEFAULT ''
    `;
  }

  const questionTopicColumns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(question_topics)
  `;
  if (!questionTopicColumns.some((column) => column.name === "topic_thread_id")) {
    yield* sql`
      ALTER TABLE question_topics
      ADD COLUMN topic_thread_id TEXT NOT NULL DEFAULT ''
    `;
    yield* sql`
      UPDATE question_topics
      SET topic_thread_id = COALESCE(
        (
          SELECT topic_threads.id
          FROM topic_threads
          JOIN questions ON questions.project_id = topic_threads.project_id
          WHERE questions.id = question_topics.question_id
            AND topic_threads.topic = question_topics.topic
          LIMIT 1
        ),
        question_topics.topic
      )
      WHERE topic_thread_id = ''
    `;
  }

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_question_topics_thread_subtype
    ON question_topics(topic_thread_id, subtype, question_id)
  `;
});
