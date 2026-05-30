import * as Schema from "effect/Schema";

export const StudyGenerateSimilarInput = Schema.Struct({
  topicThreadId: Schema.String,
  sourceQuestionIds: Schema.Array(Schema.String),
});
export type StudyGenerateSimilarInput = typeof StudyGenerateSimilarInput.Type;

export const StudyGeneratedVariant = Schema.Struct({
  sourceQuestionId: Schema.String,
  promptMarkdown: Schema.String,
});
export type StudyGeneratedVariant = typeof StudyGeneratedVariant.Type;

export const StudyGenerateSimilarResponse = Schema.Struct({
  variants: Schema.NullOr(Schema.Array(StudyGeneratedVariant)),
});
export type StudyGenerateSimilarResponse = typeof StudyGenerateSimilarResponse.Type;
