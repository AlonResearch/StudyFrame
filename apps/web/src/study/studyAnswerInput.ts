export interface StudyAnswerInputConfig {
  readonly options: readonly string[];
  readonly tableColumns: readonly string[];
  readonly plotChecklistItems: readonly string[];
  readonly uploadAccept: string | undefined;
}

export type StudyAnswerTableRow = Readonly<Record<string, string>>;

const DEFAULT_TABLE_COLUMNS = ["Value"];

export function resolveStudyAnswerInputConfig(metadata: unknown): StudyAnswerInputConfig {
  if (!isRecord(metadata)) {
    return {
      options: [],
      tableColumns: DEFAULT_TABLE_COLUMNS,
      plotChecklistItems: [],
      uploadAccept: undefined,
    };
  }

  return {
    options: readStringArray(metadata.answerOptions),
    tableColumns: readStringArray(metadata.tableColumns, DEFAULT_TABLE_COLUMNS),
    plotChecklistItems: readStringArray(metadata.plotChecklistItems),
    uploadAccept: readOptionalString(metadata.uploadAccept),
  };
}

export function parseStudyAnswerSelections(draft: string): string[] {
  const parsed = parseJson(draft);
  return Array.isArray(parsed)
    ? uniqueStrings(parsed.filter((value): value is string => typeof value === "string"))
    : [];
}

export function updateStudyAnswerSelections(
  draft: string,
  selection: string,
  checked: boolean,
): string {
  const selections = parseStudyAnswerSelections(draft);
  return JSON.stringify(
    checked
      ? uniqueStrings([...selections, selection])
      : selections.filter((value) => value !== selection),
  );
}

export function parseStudyAnswerTableRows(
  draft: string,
  columns: readonly string[],
): StudyAnswerTableRow[] {
  const normalizedColumns = columns.length > 0 ? columns : DEFAULT_TABLE_COLUMNS;
  const parsed = parseJson(draft);
  if (!Array.isArray(parsed)) {
    return [emptyTableRow(normalizedColumns)];
  }

  const rows = parsed
    .filter(isRecord)
    .map((row) =>
      Object.fromEntries(
        normalizedColumns.map((column) => [
          column,
          typeof row[column] === "string" ? row[column] : "",
        ]),
      ),
    );
  return rows.length > 0 ? rows : [emptyTableRow(normalizedColumns)];
}

export function serializeStudyAnswerTableRows(
  rows: readonly StudyAnswerTableRow[],
  columns: readonly string[],
): string {
  const normalizedColumns = columns.length > 0 ? columns : DEFAULT_TABLE_COLUMNS;
  return JSON.stringify(
    rows.map((row) =>
      Object.fromEntries(normalizedColumns.map((column) => [column, row[column] ?? ""])),
    ),
  );
}

export function serializeStudyAnswerFile(file: Pick<File, "name" | "size" | "type">): string {
  return JSON.stringify({
    name: file.name,
    size: file.size,
    type: file.type,
  });
}

export function readStudyAnswerFileName(draft: string): string | null {
  const parsed = parseJson(draft);
  return isRecord(parsed) && typeof parsed.name === "string" ? parsed.name : null;
}

function emptyTableRow(columns: readonly string[]): StudyAnswerTableRow {
  return Object.fromEntries(columns.map((column) => [column, ""]));
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function readStringArray(value: unknown, fallback: readonly string[] = []): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const normalized = uniqueStrings(
    value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
  return normalized.length > 0 ? normalized : [...fallback];
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
