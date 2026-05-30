import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Radio, RadioGroup } from "~/components/ui/radio-group";
import { Textarea } from "~/components/ui/textarea";
import {
  createStudyAnswerTableRow,
  nextStudyAnswerTableRowId,
  parseStudyAnswerSelections,
  parseStudyAnswerTableRows,
  readStudyAnswerFileName,
  resolveStudyAnswerInputConfig,
  serializeStudyAnswerFile,
  serializeStudyAnswerTableRows,
  updateStudyAnswerSelections,
} from "~/study/studyAnswerInput";
import type { StudyAnswerInputType } from "~/study/studyTypes";

export function StudyAnswerInput({
  answerDraft,
  answerInputType,
  sourceMetadataJson,
  onAnswerDraftChange,
}: {
  readonly answerDraft: string;
  readonly answerInputType: StudyAnswerInputType;
  readonly sourceMetadataJson: unknown;
  readonly onAnswerDraftChange: (answer: string) => void;
}) {
  const config = resolveStudyAnswerInputConfig(sourceMetadataJson);

  if (answerInputType === "numeric") {
    return (
      <Input
        className="h-10"
        inputMode="decimal"
        placeholder="Enter a numeric answer"
        value={answerDraft}
        onChange={(event) => onAnswerDraftChange(event.target.value)}
      />
    );
  }

  if (answerInputType === "formula") {
    return (
      <Textarea
        className="min-h-28 font-mono"
        placeholder="Enter a formula or derivation"
        value={answerDraft}
        onChange={(event) => onAnswerDraftChange(event.target.value)}
      />
    );
  }

  if (answerInputType === "multiple_choice" && config.options.length > 0) {
    return (
      <RadioGroup value={answerDraft} onValueChange={onAnswerDraftChange}>
        {config.options.map((option) => (
          <Label className="rounded-lg border border-border bg-background px-3 py-2" key={option}>
            <Radio value={option} />
            <span>{option}</span>
          </Label>
        ))}
      </RadioGroup>
    );
  }

  if (answerInputType === "multi_select" && config.options.length > 0) {
    return (
      <ChecklistAnswerInput
        answerDraft={answerDraft}
        items={config.options}
        onAnswerDraftChange={onAnswerDraftChange}
      />
    );
  }

  if (answerInputType === "table") {
    return (
      <TableAnswerInput
        answerDraft={answerDraft}
        columns={config.tableColumns}
        onAnswerDraftChange={onAnswerDraftChange}
      />
    );
  }

  if (answerInputType === "plot_checklist" && config.plotChecklistItems.length > 0) {
    return (
      <ChecklistAnswerInput
        answerDraft={answerDraft}
        items={config.plotChecklistItems}
        onAnswerDraftChange={onAnswerDraftChange}
      />
    );
  }

  if (answerInputType === "file_upload") {
    const fileName = readStudyAnswerFileName(answerDraft);
    return (
      <div className="space-y-2">
        <Input
          accept={config.uploadAccept}
          nativeInput
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            onAnswerDraftChange(file ? serializeStudyAnswerFile(file) : "");
          }}
        />
        {fileName ? <div className="text-xs text-muted-foreground">{fileName}</div> : null}
      </div>
    );
  }

  return (
    <Textarea
      className="min-h-44 flex-1"
      placeholder="Work the real question here..."
      value={answerDraft}
      onChange={(event) => onAnswerDraftChange(event.target.value)}
    />
  );
}

function ChecklistAnswerInput({
  answerDraft,
  items,
  onAnswerDraftChange,
}: {
  readonly answerDraft: string;
  readonly items: readonly string[];
  readonly onAnswerDraftChange: (answer: string) => void;
}) {
  const selections = parseStudyAnswerSelections(answerDraft);
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <Label className="rounded-lg border border-border bg-background px-3 py-2" key={item}>
          <Checkbox
            checked={selections.includes(item)}
            onCheckedChange={(checked) =>
              onAnswerDraftChange(updateStudyAnswerSelections(answerDraft, item, checked))
            }
          />
          <span>{item}</span>
        </Label>
      ))}
    </div>
  );
}

function TableAnswerInput({
  answerDraft,
  columns,
  onAnswerDraftChange,
}: {
  readonly answerDraft: string;
  readonly columns: readonly string[];
  readonly onAnswerDraftChange: (answer: string) => void;
}) {
  const rows = parseStudyAnswerTableRows(answerDraft, columns);
  const updateRows = (nextRows: readonly Readonly<Record<string, string>>[]) =>
    onAnswerDraftChange(serializeStudyAnswerTableRows(nextRows, columns));

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-background">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/45 text-xs text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th className="px-2 py-2 font-medium" key={column}>
                {column}
              </th>
            ))}
            <th className="w-10 px-2 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, rowIndex) => (
            <tr key={row.__studyFrameRowId}>
              {columns.map((column) => (
                <td className="min-w-36 px-2 py-2" key={column}>
                  <Input
                    aria-label={`${column} row ${rowIndex + 1}`}
                    value={row[column] ?? ""}
                    onChange={(event) =>
                      updateRows(
                        rows.map((candidate, candidateIndex) =>
                          candidateIndex === rowIndex
                            ? { ...candidate, [column]: event.target.value }
                            : candidate,
                        ),
                      )
                    }
                  />
                </td>
              ))}
              <td className="px-2 py-2">
                <Button
                  aria-label={`Remove row ${rowIndex + 1}`}
                  disabled={rows.length === 1}
                  size="icon-sm"
                  title={`Remove row ${rowIndex + 1}`}
                  variant="ghost"
                  onClick={() => updateRows(rows.filter((_, index) => index !== rowIndex))}
                >
                  <Trash2Icon />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-border px-2 py-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            updateRows([
              ...rows,
              createStudyAnswerTableRow(columns, nextStudyAnswerTableRowId(rows)),
            ])
          }
        >
          <PlusIcon />
          Add row
        </Button>
      </div>
    </div>
  );
}
