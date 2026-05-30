import type { StudyFrameSnapshot } from "@t3tools/contracts";
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
}

export class StudyFrameRepository extends Context.Service<
  StudyFrameRepository,
  StudyFrameRepositoryShape
>()("t3/persistence/Services/StudyFrame/StudyFrameRepository") {}
