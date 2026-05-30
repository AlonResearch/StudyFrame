import * as Schema from "effect/Schema";

import { StudyFeedbackResult } from "./study.ts";

export const StudyFeedbackAction = Schema.Literals(["check_direction", "grade_attempt"]);
export type StudyFeedbackAction = typeof StudyFeedbackAction.Type;

export const StudyFeedbackInput = Schema.Struct({
  questionId: Schema.String,
  answer: Schema.String,
  action: StudyFeedbackAction,
});
export type StudyFeedbackInput = typeof StudyFeedbackInput.Type;

export const StudyFeedbackResponse = Schema.Struct({
  feedback: Schema.NullOr(StudyFeedbackResult),
});
export type StudyFeedbackResponse = typeof StudyFeedbackResponse.Type;
