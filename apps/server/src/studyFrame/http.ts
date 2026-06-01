import {
  StudyAnalyzeProjectInput,
  StudyFeedbackInput,
  StudyFrameSnapshot,
  StudyGenerateSimilarInput,
  StudyImportFolderInput,
  StudyProcessFolderInput,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse, Multipart } from "effect/unstable/http";

import { respondToAuthError } from "../auth/http.ts";
import { AuthError, ServerAuth } from "../auth/Services/ServerAuth.ts";
import type { PersistenceDecodeError, PersistenceSqlError } from "../persistence/Errors.ts";
import { StudyFrameRepository } from "../persistence/Services/StudyFrame.ts";
import { browserApiCorsHeaders } from "../httpCors.ts";
import { analyzeProjectWithProvider } from "./analyzeProjectWithProvider.ts";
import { generateStudyFeedbackWithProvider } from "./feedbackWithProvider.ts";
import { generateSimilarWithProvider } from "./generateSimilarWithProvider.ts";
import { importFolderToSnapshot } from "./importFolder.ts";
import {
  cancelStudyFrameProcessingJob,
  retryStudyFrameProcessingJob,
  startStudyFrameProcessingJob,
} from "./processFolder.ts";
import { stageStudyFrameSourceMaterials } from "./stageSourceMaterials.ts";

const StudyProcessingJobPathParams = Schema.Struct({
  jobId: Schema.String,
});
const StudySourceRelativePaths = Schema.fromJsonString(Schema.Array(Schema.String));
const decodeStudySourceRelativePaths = Schema.decodeUnknownEffect(StudySourceRelativePaths);

function respondToPersistenceError(error: PersistenceSqlError | PersistenceDecodeError) {
  return Effect.gen(function* () {
    yield* Effect.logError("studyframe route failed", {
      message: error.message,
      cause: error.cause,
    });
    return HttpServerResponse.jsonUnsafe(
      { error: error.message },
      { status: 500, headers: browserApiCorsHeaders },
    );
  });
}

export const studyFrameSnapshotGetRouteLayer = HttpRouter.add(
  "GET",
  "/api/studyframe/snapshot",
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const serverAuth = yield* ServerAuth;
    yield* serverAuth.authenticateHttpRequest(request);

    const repository = yield* StudyFrameRepository;
    const snapshotOption = yield* repository.loadSnapshot();
    const snapshot = Option.match(snapshotOption, {
      onNone: () => null,
      onSome: (value) => value,
    });
    return HttpServerResponse.jsonUnsafe(
      { snapshot },
      { status: 200, headers: browserApiCorsHeaders },
    );
  }).pipe(Effect.catchTag("AuthError", (error) => respondToAuthError(error))),
);

export const studyFrameSnapshotPutRouteLayer = HttpRouter.add(
  "PUT",
  "/api/studyframe/snapshot",
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const serverAuth = yield* ServerAuth;
    yield* serverAuth.authenticateHttpRequest(request);

    const snapshot = yield* HttpServerRequest.schemaBodyJson(StudyFrameSnapshot).pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: "Invalid StudyFrame snapshot payload.",
            status: 400,
            cause,
          }),
      ),
    );
    const repository = yield* StudyFrameRepository;
    yield* repository.saveSnapshot(snapshot);
    return HttpServerResponse.jsonUnsafe(
      { ok: true },
      { status: 200, headers: browserApiCorsHeaders },
    );
  }).pipe(Effect.catchTag("AuthError", (error) => respondToAuthError(error))),
);

export const studyFrameImportFolderRouteLayer = HttpRouter.add(
  "POST",
  "/api/studyframe/import-folder",
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const serverAuth = yield* ServerAuth;
    yield* serverAuth.authenticateHttpRequest(request);

    const input = yield* HttpServerRequest.schemaBodyJson(StudyImportFolderInput).pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: "Invalid StudyFrame folder import payload.",
            status: 400,
            cause,
          }),
      ),
    );
    const imported = yield* importFolderToSnapshot(input).pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: cause.message,
            status: 400,
            cause,
          }),
      ),
    );
    const repository = yield* StudyFrameRepository;
    yield* repository.saveSnapshot(imported.snapshot);

    return HttpServerResponse.jsonUnsafe(imported, {
      status: 200,
      headers: browserApiCorsHeaders,
    });
  }).pipe(Effect.catchTag("AuthError", (error) => respondToAuthError(error))),
);

export const studyFrameAnalyzeProjectRouteLayer = HttpRouter.add(
  "POST",
  "/api/studyframe/analyze-project",
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const serverAuth = yield* ServerAuth;
    yield* serverAuth.authenticateHttpRequest(request);

    const input = yield* HttpServerRequest.schemaBodyJson(StudyAnalyzeProjectInput).pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: "Invalid StudyFrame project analysis payload.",
            status: 400,
            cause,
          }),
      ),
    );
    const repository = yield* StudyFrameRepository;
    const snapshotOption = yield* repository.loadSnapshot();
    if (Option.isNone(snapshotOption)) {
      return yield* new AuthError({
        message: "Import a StudyFrame course before running analysis.",
        status: 400,
      });
    }
    const analyzed = yield* analyzeProjectWithProvider(snapshotOption.value, input).pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: cause.message,
            status: 400,
            cause,
          }),
      ),
    );
    yield* repository.saveSnapshot(analyzed.snapshot);

    return HttpServerResponse.jsonUnsafe(analyzed, {
      status: 200,
      headers: browserApiCorsHeaders,
    });
  }).pipe(Effect.catchTag("AuthError", (error) => respondToAuthError(error))),
);

export const studyFrameProcessFolderRouteLayer = HttpRouter.add(
  "POST",
  "/api/studyframe/process-folder",
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const serverAuth = yield* ServerAuth;
    yield* serverAuth.authenticateHttpRequest(request);

    const input = yield* HttpServerRequest.schemaBodyJson(StudyProcessFolderInput).pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: "Invalid StudyFrame course processing payload.",
            status: 400,
            cause,
          }),
      ),
    );
    const job = yield* startStudyFrameProcessingJob(input).pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: cause.message,
            status: 400,
            cause,
          }),
      ),
    );
    return HttpServerResponse.jsonUnsafe({ job }, { status: 202, headers: browserApiCorsHeaders });
  }).pipe(Effect.catchTag("AuthError", (error) => respondToAuthError(error))),
);

export const studyFrameStageSourceMaterialsRouteLayer = HttpRouter.add(
  "POST",
  "/api/studyframe/stage-source-materials",
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const serverAuth = yield* ServerAuth;
    yield* serverAuth.authenticateHttpRequest(request);
    const multipart = yield* request.multipart.pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: "Could not read the selected source materials.",
            status: 400,
            cause,
          }),
      ),
    );
    const files = multipart.files;
    const relativePaths = yield* readJsonStringArrayField(multipart.relativePaths, "relativePaths");
    const sourceName = yield* readStringField(multipart.sourceName, "sourceName");
    if (!Array.isArray(files) || !files.every(Multipart.isPersistedFile)) {
      return yield* new AuthError({
        message: "The source material upload did not contain any readable files.",
        status: 400,
      });
    }
    const staged = yield* stageStudyFrameSourceMaterials({
      files,
      relativePaths,
      sourceName,
    }).pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: cause.message,
            status: 400,
            cause,
          }),
      ),
    );
    return HttpServerResponse.jsonUnsafe(staged, {
      status: 201,
      headers: browserApiCorsHeaders,
    });
  }).pipe(Effect.catchTag("AuthError", (error) => respondToAuthError(error))),
);

export const studyFrameProcessingJobGetRouteLayer = HttpRouter.add(
  "GET",
  "/api/studyframe/processing-jobs/:jobId",
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const serverAuth = yield* ServerAuth;
    yield* serverAuth.authenticateHttpRequest(request);
    const params = yield* HttpRouter.schemaPathParams(StudyProcessingJobPathParams).pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: "Invalid StudyFrame processing job path.",
            status: 400,
            cause,
          }),
      ),
    );
    const repository = yield* StudyFrameRepository;
    const job = yield* repository.loadProcessingJob(params.jobId);
    return HttpServerResponse.jsonUnsafe(
      { job: Option.getOrNull(job) },
      { status: 200, headers: browserApiCorsHeaders },
    );
  }).pipe(Effect.catchTag("AuthError", (error) => respondToAuthError(error))),
);

function readStringField(
  value: string | readonly string[] | readonly Multipart.PersistedFile[] | undefined,
  fieldName: string,
): Effect.Effect<string, AuthError> {
  return typeof value === "string"
    ? Effect.succeed(value)
    : Effect.fail(
        new AuthError({
          message: `The source material upload is missing ${fieldName}.`,
          status: 400,
        }),
      );
}

function readJsonStringArrayField(
  value: string | readonly string[] | readonly Multipart.PersistedFile[] | undefined,
  fieldName: string,
): Effect.Effect<readonly string[], AuthError> {
  return readStringField(value, fieldName).pipe(
    Effect.flatMap((encoded) =>
      decodeStudySourceRelativePaths(encoded).pipe(
        Effect.mapError(
          (cause) =>
            new AuthError({
              message: `The source material upload contains an invalid ${fieldName} list.`,
              status: 400,
              cause,
            }),
        ),
      ),
    ),
  );
}

export const studyFrameProcessingEventsGetRouteLayer = HttpRouter.add(
  "GET",
  "/api/studyframe/processing-jobs/:jobId/events",
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const serverAuth = yield* ServerAuth;
    yield* serverAuth.authenticateHttpRequest(request);
    const params = yield* HttpRouter.schemaPathParams(StudyProcessingJobPathParams).pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: "Invalid StudyFrame processing event path.",
            status: 400,
            cause,
          }),
      ),
    );
    const repository = yield* StudyFrameRepository;
    const events = yield* repository.listProcessingEvents(params.jobId);
    return HttpServerResponse.jsonUnsafe(
      { events },
      { status: 200, headers: browserApiCorsHeaders },
    );
  }).pipe(Effect.catchTag("AuthError", (error) => respondToAuthError(error))),
);

export const studyFrameProcessingJobCancelRouteLayer = HttpRouter.add(
  "POST",
  "/api/studyframe/processing-jobs/:jobId/cancel",
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const serverAuth = yield* ServerAuth;
    yield* serverAuth.authenticateHttpRequest(request);
    const params = yield* HttpRouter.schemaPathParams(StudyProcessingJobPathParams).pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: "Invalid StudyFrame processing cancel path.",
            status: 400,
            cause,
          }),
      ),
    );
    const job = yield* cancelStudyFrameProcessingJob(params.jobId).pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: cause.message,
            status: 400,
            cause,
          }),
      ),
    );
    return HttpServerResponse.jsonUnsafe({ job }, { status: 200, headers: browserApiCorsHeaders });
  }).pipe(Effect.catchTag("AuthError", (error) => respondToAuthError(error))),
);

export const studyFrameProcessingJobRetryRouteLayer = HttpRouter.add(
  "POST",
  "/api/studyframe/processing-jobs/:jobId/retry",
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const serverAuth = yield* ServerAuth;
    yield* serverAuth.authenticateHttpRequest(request);
    const params = yield* HttpRouter.schemaPathParams(StudyProcessingJobPathParams).pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: "Invalid StudyFrame processing retry path.",
            status: 400,
            cause,
          }),
      ),
    );
    const job = yield* retryStudyFrameProcessingJob(params.jobId).pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: cause.message,
            status: 400,
            cause,
          }),
      ),
    );
    return HttpServerResponse.jsonUnsafe({ job }, { status: 202, headers: browserApiCorsHeaders });
  }).pipe(Effect.catchTag("AuthError", (error) => respondToAuthError(error))),
);

export const studyFrameFeedbackRouteLayer = HttpRouter.add(
  "POST",
  "/api/studyframe/feedback",
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const serverAuth = yield* ServerAuth;
    yield* serverAuth.authenticateHttpRequest(request);

    const input = yield* HttpServerRequest.schemaBodyJson(StudyFeedbackInput).pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: "Invalid StudyFrame feedback payload.",
            status: 400,
            cause,
          }),
      ),
    );
    const repository = yield* StudyFrameRepository;
    const snapshotOption = yield* repository.loadSnapshot();
    if (Option.isNone(snapshotOption)) {
      return yield* new AuthError({
        message: "Import a StudyFrame course before requesting feedback.",
        status: 400,
      });
    }
    const feedback = yield* generateStudyFeedbackWithProvider(snapshotOption.value, input).pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: cause.message,
            status: 400,
            cause,
          }),
      ),
    );

    return HttpServerResponse.jsonUnsafe(
      { feedback: Option.getOrNull(feedback) },
      { status: 200, headers: browserApiCorsHeaders },
    );
  }).pipe(
    Effect.catchTag("AuthError", (error) => respondToAuthError(error)),
    Effect.catchTags({
      PersistenceDecodeError: (error) => respondToPersistenceError(error),
      PersistenceSqlError: (error) => respondToPersistenceError(error),
    }),
  ),
);

export const studyFrameGenerateSimilarRouteLayer = HttpRouter.add(
  "POST",
  "/api/studyframe/generate-similar",
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const serverAuth = yield* ServerAuth;
    yield* serverAuth.authenticateHttpRequest(request);

    const input = yield* HttpServerRequest.schemaBodyJson(StudyGenerateSimilarInput).pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: "Invalid StudyFrame generated variant payload.",
            status: 400,
            cause,
          }),
      ),
    );
    const repository = yield* StudyFrameRepository;
    const snapshotOption = yield* repository.loadSnapshot();
    if (Option.isNone(snapshotOption)) {
      return yield* new AuthError({
        message: "Import a StudyFrame course before generating variants.",
        status: 400,
      });
    }
    const variants = yield* generateSimilarWithProvider(snapshotOption.value, input).pipe(
      Effect.mapError(
        (cause) =>
          new AuthError({
            message: cause.message,
            status: 400,
            cause,
          }),
      ),
    );

    return HttpServerResponse.jsonUnsafe(
      Option.match(variants, {
        onNone: () => ({ variants: null, generationMetadataJson: null }),
        onSome: (value) => value,
      }),
      { status: 200, headers: browserApiCorsHeaders },
    );
  }).pipe(
    Effect.catchTag("AuthError", (error) => respondToAuthError(error)),
    Effect.catchTags({
      PersistenceDecodeError: (error) => respondToPersistenceError(error),
      PersistenceSqlError: (error) => respondToPersistenceError(error),
    }),
  ),
);
