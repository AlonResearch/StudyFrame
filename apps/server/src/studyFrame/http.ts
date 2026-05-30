import { StudyFrameSnapshot, StudyImportFolderInput } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { respondToAuthError } from "../auth/http.ts";
import { AuthError, ServerAuth } from "../auth/Services/ServerAuth.ts";
import type { PersistenceDecodeError, PersistenceSqlError } from "../persistence/Errors.ts";
import { StudyFrameRepository } from "../persistence/Services/StudyFrame.ts";
import { browserApiCorsHeaders } from "../httpCors.ts";
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
