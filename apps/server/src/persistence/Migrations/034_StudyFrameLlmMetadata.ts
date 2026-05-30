import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    ALTER TABLE question_support
    ADD COLUMN generation_metadata_json TEXT NOT NULL DEFAULT 'null'
  `;

  yield* sql`
    ALTER TABLE study_topic_modules
    ADD COLUMN generation_metadata_json TEXT NOT NULL DEFAULT 'null'
  `;

  yield* sql`
    ALTER TABLE study_practice_support
    ADD COLUMN generation_metadata_json TEXT NOT NULL DEFAULT 'null'
  `;

  yield* sql`
    ALTER TABLE generated_question_batches
    ADD COLUMN generation_metadata_json TEXT NOT NULL DEFAULT 'null'
  `;
});
