import type {
  StudyFrameSnapshot,
  StudyProcessingArtifact,
  StudyProcessingEvent,
  StudyProcessingJob,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import type { StudyFrameRepositoryError } from "../Errors.ts";

export interface StudyFrameRepositoryShape {
  readonly loadSnapshot: () => Effect.Effect<
    Option.Option<StudyFrameSnapshot>,
    StudyFrameRepositoryError
  >;
  readonly saveSnapshot: (
    snapshot: StudyFrameSnapshot,
  ) => Effect.Effect<void, StudyFrameRepositoryError>;
  readonly loadProcessingJob: (
    jobId: string,
  ) => Effect.Effect<Option.Option<StudyProcessingJob>, StudyFrameRepositoryError>;
  readonly saveProcessingJob: (
    job: StudyProcessingJob,
  ) => Effect.Effect<void, StudyFrameRepositoryError>;
  readonly appendProcessingEvent: (
    event: StudyProcessingEvent,
  ) => Effect.Effect<void, StudyFrameRepositoryError>;
  readonly listProcessingEvents: (
    jobId: string,
  ) => Effect.Effect<readonly StudyProcessingEvent[], StudyFrameRepositoryError>;
  readonly saveProcessingArtifact: (
    artifact: StudyProcessingArtifact,
  ) => Effect.Effect<void, StudyFrameRepositoryError>;
}

export class StudyFrameRepository extends Context.Service<
  StudyFrameRepository,
  StudyFrameRepositoryShape
>()("t3/persistence/Services/StudyFrame/StudyFrameRepository") {}
