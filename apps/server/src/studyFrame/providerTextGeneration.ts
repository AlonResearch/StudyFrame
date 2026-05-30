import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { ProviderInstanceRegistry } from "../provider/Services/ProviderInstanceRegistry.ts";
import { ServerSettingsService } from "../serverSettings.ts";
import {
  makeTextGenerationFromRegistry,
  TextGeneration,
} from "../textGeneration/TextGeneration.ts";

export const resolveOptionalStudyFrameTextGeneration = Effect.gen(function* () {
  const textGenerationService = yield* Effect.serviceOption(TextGeneration);
  const providerInstanceRegistry = yield* Effect.serviceOption(ProviderInstanceRegistry);
  const serverSettings = yield* Effect.serviceOption(ServerSettingsService);
  const textGeneration =
    Option.getOrUndefined(textGenerationService) ??
    Option.getOrUndefined(
      providerInstanceRegistry.pipe(Option.map(makeTextGenerationFromRegistry)),
    );
  if (!textGeneration || Option.isNone(serverSettings)) return Option.none();

  const settings = yield* serverSettings.value.getSettings;
  return Option.some({
    textGeneration,
    modelSelection: settings.textGenerationModelSelection,
  });
});
