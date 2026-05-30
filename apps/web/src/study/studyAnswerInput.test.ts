import { describe, expect, it } from "vitest";

import {
  parseStudyAnswerSelections,
  parseStudyAnswerTableRows,
  readStudyAnswerFileName,
  resolveStudyAnswerInputConfig,
  serializeStudyAnswerFile,
  serializeStudyAnswerTableRows,
  updateStudyAnswerSelections,
} from "./studyAnswerInput";

describe("studyAnswerInput", () => {
  it("reads structured input configuration from practice metadata", () => {
    expect(
      resolveStudyAnswerInputConfig({
        answerOptions: ["A", "B", "A"],
        tableColumns: ["Threshold", "Rate"],
        plotChecklistItems: ["Axes", "Legend"],
        uploadAccept: ".csv",
      }),
    ).toEqual({
      options: ["A", "B"],
      tableColumns: ["Threshold", "Rate"],
      plotChecklistItems: ["Axes", "Legend"],
      uploadAccept: ".csv",
    });
  });

  it("serializes checkbox selections without duplicates", () => {
    const first = updateStudyAnswerSelections("", "Axes", true);
    const second = updateStudyAnswerSelections(first, "Axes", true);
    const third = updateStudyAnswerSelections(second, "Legend", true);

    expect(parseStudyAnswerSelections(third)).toEqual(["Axes", "Legend"]);
    expect(parseStudyAnswerSelections(updateStudyAnswerSelections(third, "Axes", false))).toEqual([
      "Legend",
    ]);
  });

  it("normalizes editable table drafts against configured columns", () => {
    const columns = ["Threshold", "Rate"];
    const rows = parseStudyAnswerTableRows('[{"Threshold":"0.5","Ignored":"x"}]', columns);

    expect(rows).toEqual([{ Threshold: "0.5", Rate: "" }]);
    expect(serializeStudyAnswerTableRows(rows, columns)).toBe('[{"Threshold":"0.5","Rate":""}]');
  });

  it("stores only a selected file descriptor", () => {
    const draft = serializeStudyAnswerFile({
      name: "analysis.csv",
      size: 42,
      type: "text/csv",
    });

    expect(readStudyAnswerFileName(draft)).toBe("analysis.csv");
  });
});
