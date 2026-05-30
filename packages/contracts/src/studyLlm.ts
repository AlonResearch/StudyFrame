import * as Schema from "effect/Schema";

export const StudyLlmGenerationMetadata = Schema.Struct({
  providerInstanceId: Schema.String,
  model: Schema.String,
  promptVersion: Schema.String,
  generatedAt: Schema.String,
  warnings: Schema.Array(Schema.String),
  rawStructuredResult: Schema.optionalKey(Schema.Unknown),
});
export type StudyLlmGenerationMetadata = typeof StudyLlmGenerationMetadata.Type;
