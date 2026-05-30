import {
  StudyAnalyzeProjectInput,
  StudyFeedbackInput,
  StudyFrameSnapshot,
  StudyGenerateSimilarInput,
  StudyImportFolderInput,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { respondToAuthError } from "../auth/http.ts";
import { AuthError, ServerAuth } from "../auth/Services/ServerAuth.ts";
import type { PersistenceDecodeError, PersistenceSqlError } from "../persistence/Errors.ts";
import { StudyFrameRepository } from "../persistence/Services/StudyFrame.ts";
import { browserApiCorsHeaders } from "../httpCors.ts";
import { analyzeProjectWithProvider } from "./analyzeProjectWithProvider.ts";
import { generateStudyFeedbackWithProvider } from "./feedbackWithProvider.ts";
import { generateSimilarWithProvider } from "./generateSimilarWithProvider.ts";
import { importFolderToSnapshot } from "./importFolder.ts";

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
  }).pipe(
    Effect.catchTag("AuthError", (error) => respondToAuthError(error)),
    Effect.catchTags({
      PersistenceDecodeError: (error) => respondToPersistenceError(error),
      PersistenceSqlError: (error) => respondToPersistenceError(error),
    }),
  ),
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
  }).pipe(
    Effect.catchTag("AuthError", (error) => respondToAuthError(error)),
    Effect.catchTags({
      PersistenceDecodeError: (error) => respondToPersistenceError(error),
      PersistenceSqlError: (error) => respondToPersistenceError(error),
    }),
  ),
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
  }).pipe(
    Effect.catchTag("AuthError", (error) => respondToAuthError(error)),
    Effect.catchTags({
      PersistenceDecodeError: (error) => respondToPersistenceError(error),
      PersistenceSqlError: (error) => respondToPersistenceError(error),
    }),
  ),
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
  }).pipe(
    Effect.catchTag("AuthError", (error) => respondToAuthError(error)),
    Effect.catchTags({
      PersistenceDecodeError: (error) => respondToPersistenceError(error),
      PersistenceSqlError: (error) => respondToPersistenceError(error),
    }),
  ),
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
      { variants: Option.getOrNull(variants) },
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
