import type {
  StudyAttempt,
  StudyCompletionSummary,
  StudyFrameSnapshot,
  StudyGeneratedQuestionBatch,
  StudyPracticeItem,
  StudyPracticeSupport,
  StudyProject,
  StudyQuestion,
  StudyQuestionCandidate,
  StudyQuestionClassification,
  StudyQuestionSupport,
  StudyQuestionTopic,
  StudySourceAsset,
  StudySourceDocument,
  StudyTopicCluster,
  StudyTopicModule,
  StudyTopicThread,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { toPersistenceDecodeCauseError, toPersistenceSqlError } from "../Errors.ts";
import { StudyFrameRepository, type StudyFrameRepositoryShape } from "../Services/StudyFrame.ts";

type StudyProjectRow = {
  readonly id: string;
  readonly name: string;
  readonly sourceRoot: string;
  readonly importedAt: string;
  readonly extractionWarnings: string;
};

type StudyDocumentRow = {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly sourcePath: string;
  readonly year: number | null;
  readonly quizLabel: string;
};

type StudySourceDocumentRow = {
  readonly id: string;
  readonly projectId: string;
  readonly sourcePath: string;
  readonly fileType: StudySourceDocument["fileType"];
  readonly role: StudySourceDocument["role"];
  readonly year: number | null;
  readonly quizLabel: string | null;
  readonly extractionConfidence: number;
  readonly warnings: string;
};

type StudySourceAssetRow = {
  readonly id: string;
  readonly documentId: string;
  readonly kind: StudySourceAsset["kind"];
  readonly sourceAnchor: string;
  readonly contentText: string | null;
  readonly contentJson: string;
  readonly localUri: string | null;
  readonly extractionConfidence: number;
};

type StudyQuestionCandidateRow = {
  readonly id: string;
  readonly projectId: string;
  readonly documentId: string;
  readonly sourceAnchor: string;
  readonly rawPromptMarkdown: string;
  readonly sourceYear: number | null;
  readonly sourceQuizLabel: string | null;
  readonly pointValue: number | null;
  readonly assetIds: string;
  readonly extractionConfidence: number;
  readonly needsManualReview: number;
};

type StudyTopicThreadRow = {
  readonly id: string;
  readonly projectId: string;
  readonly topic: string;
  readonly displayName: string;
  readonly summary: string;
  readonly priorityScore: number;
  readonly firstExposureComplete: number;
  readonly status: StudyTopicThread["status"];
  readonly createdAt: string;
  readonly updatedAt: string;
};

type StudyQuestionRow = {
  readonly id: string;
  readonly projectId: string;
  readonly documentId: string;
  readonly sourceAnchor: string;
  readonly sourceYear: number | null;
  readonly sourceQuizLabel: string;
  readonly rawPrompt: string;
  readonly normalizedPrompt: string;
  readonly pointValue: number;
  readonly isRealQuestion: number;
  readonly generatedFromQuestionIds: string | null;
  readonly dependsOnAssets: number;
  readonly extractionConfidence: number;
  readonly createdAt: string;
};

type StudyQuestionSupportRow = {
  readonly id: string;
  readonly questionId: string;
  readonly summaryContext: string;
  readonly expectedAnswer: string;
  readonly rubric: string;
  readonly hints: string;
  readonly solutionSteps: string;
  readonly commonMistakes: string;
  readonly supportConfidence: number;
  readonly generatedAt: string;
  readonly generationMetadataJson: string;
};

type StudyQuestionTopicRow = {
  readonly id: string;
  readonly questionId: string;
  readonly topicThreadId: string;
  readonly topic: string;
  readonly subtype: string;
  readonly confidence: number;
  readonly isPrimary: number;
};

type StudyTopicClusterRow = {
  readonly id: string;
  readonly projectId: string;
  readonly displayName: string;
  readonly priorityRank: number;
  readonly priorityScore: number;
  readonly priorityLabel: StudyTopicCluster["priorityLabel"];
  readonly priorityRationale: string;
  readonly recentQuestionParts: number;
  readonly olderQuestionAppearances: number;
  readonly weightedPoints: number;
  readonly subtypes: string;
};

type StudyQuestionClassificationRow = {
  readonly id: string;
  readonly questionCandidateId: string;
  readonly topicClusterId: string;
  readonly subtype: string;
  readonly confidence: number;
  readonly isPrimary: number;
};

type StudyTopicModuleRow = {
  readonly id: string;
  readonly projectId: string;
  readonly topicClusterId: string;
  readonly theorySummaryMarkdown: string;
  readonly formulaSheetMarkdown: string;
  readonly commonTrapsMarkdown: string;
  readonly subtypeCoverageJson: string;
  readonly firstExposureComplete: number;
  readonly generationMetadataJson: string;
};

type StudyPracticeItemRow = {
  readonly id: string;
  readonly projectId: string;
  readonly topicModuleId: string;
  readonly sourceQuestionCandidateId: string | null;
  readonly itemOrigin: StudyPracticeItem["itemOrigin"];
  readonly subtype: string;
  readonly promptMarkdown: string;
  readonly answerInputType: StudyPracticeItem["answerInputType"];
  readonly pointValue: number;
  readonly assetIds: string;
  readonly sourceMetadataJson: string;
};

type StudyPracticeSupportRow = {
  readonly id: string;
  readonly practiceItemId: string;
  readonly expectedAnswerJson: string;
  readonly rubricJson: string;
  readonly hintsJson: string;
  readonly stepByStepSolutionMarkdown: string;
  readonly commonMistakesMarkdown: string;
  readonly supportConfidence: number;
  readonly generationMetadataJson: string;
};

type StudyAttemptRow = {
  readonly id: string;
  readonly questionId: string;
  readonly topicThreadId: string;
  readonly answer: string;
  readonly feedback: string;
  readonly score: number;
  readonly maxScore: number;
  readonly scorePercent: number;
  readonly status: StudyAttempt["status"];
  readonly usedHintsCount: number;
  readonly usedCheckDirection: number;
  readonly attemptNumber: number;
  readonly createdAt: string;
};

type StudyCompletionSummaryRow = {
  readonly id: string;
  readonly projectId: string;
  readonly topicThreadId: string | null;
  readonly scope: StudyCompletionSummary["scope"];
  readonly realQuestionsAttempted: number;
  readonly generatedQuestionsAttempted: number;
  readonly weightedScorePercent: number;
  readonly unweightedScorePercent: number;
  readonly questions100Percent: number;
  readonly questionsNot100Percent: number;
  readonly questionsRevealed: number;
  readonly weakSubtypes: string;
  readonly recommendedNextAction: StudyCompletionSummary["recommendedNextAction"];
  readonly createdAt: string;
};

type StudyGeneratedQuestionBatchRow = {
  readonly id: string;
  readonly projectId: string;
  readonly topicThreadId: string;
  readonly sourceQuestionIds: string;
  readonly generationReason: StudyGeneratedQuestionBatch["generationReason"];
  readonly createdAt: string;
  readonly generationMetadataJson: string;
};

const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  const parsed = decodeJsonString(value);
  return parsed as T;
};

const decodeJsonString = Schema.decodeUnknownSync(Schema.UnknownFromJsonString);
const toJson = Schema.encodeUnknownSync(Schema.UnknownFromJsonString);

function toBoolean(value: number): boolean {
  return value !== 0;
}

function fromBoolean(value: boolean): number {
  return value ? 1 : 0;
}

const makeStudyFrameRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const loadSnapshot: StudyFrameRepositoryShape["loadSnapshot"] = () =>
    Effect.gen(function* () {
      const projectRows = yield* sql<StudyProjectRow>`
        SELECT
          id AS "id",
          name AS "name",
          source_root AS "sourceRoot",
          imported_at AS "importedAt",
          extraction_warnings_json AS "extractionWarnings"
        FROM study_projects
        ORDER BY imported_at ASC, id ASC
      `;

      if (projectRows.length === 0) {
        return Option.none();
      }

      const documentRows = yield* sql<StudyDocumentRow>`
        SELECT
          id AS "id",
          project_id AS "projectId",
          title AS "title",
          source_path AS "sourcePath",
          year AS "year",
          quiz_label AS "quizLabel"
        FROM study_documents
        ORDER BY year DESC, id ASC
      `;
      const sourceDocumentRows = yield* sql<StudySourceDocumentRow>`
        SELECT
          id AS "id",
          project_id AS "projectId",
          source_path AS "sourcePath",
          file_type AS "fileType",
          role AS "role",
          year AS "year",
          quiz_label AS "quizLabel",
          extraction_confidence AS "extractionConfidence",
          warnings_json AS "warnings"
        FROM study_source_documents
        ORDER BY year DESC, source_path ASC, id ASC
      `;
      const sourceAssetRows = yield* sql<StudySourceAssetRow>`
        SELECT
          id AS "id",
          document_id AS "documentId",
          kind AS "kind",
          source_anchor AS "sourceAnchor",
          content_text AS "contentText",
          content_json AS "contentJson",
          local_uri AS "localUri",
          extraction_confidence AS "extractionConfidence"
        FROM study_source_assets
        ORDER BY document_id ASC, source_anchor ASC, id ASC
      `;
      const questionCandidateRows = yield* sql<StudyQuestionCandidateRow>`
        SELECT
          id AS "id",
          project_id AS "projectId",
          document_id AS "documentId",
          source_anchor AS "sourceAnchor",
          raw_prompt_markdown AS "rawPromptMarkdown",
          source_year AS "sourceYear",
          source_quiz_label AS "sourceQuizLabel",
          point_value AS "pointValue",
          asset_ids_json AS "assetIds",
          extraction_confidence AS "extractionConfidence",
          needs_manual_review AS "needsManualReview"
        FROM study_question_candidates
        ORDER BY source_year DESC, id ASC
      `;
      const topicThreadRows = yield* sql<StudyTopicThreadRow>`
        SELECT
          id AS "id",
          project_id AS "projectId",
          topic AS "topic",
          display_name AS "displayName",
          summary AS "summary",
          priority_score AS "priorityScore",
          first_exposure_complete AS "firstExposureComplete",
          status AS "status",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM topic_threads
        ORDER BY priority_score DESC, display_name ASC
      `;
      const questionRows = yield* sql<StudyQuestionRow>`
        SELECT
          id AS "id",
          project_id AS "projectId",
          document_id AS "documentId",
          source_anchor AS "sourceAnchor",
          source_year AS "sourceYear",
          source_quiz_label AS "sourceQuizLabel",
          raw_prompt AS "rawPrompt",
          normalized_prompt AS "normalizedPrompt",
          point_value AS "pointValue",
          is_real_question AS "isRealQuestion",
          generated_from_question_ids AS "generatedFromQuestionIds",
          depends_on_assets AS "dependsOnAssets",
          extraction_confidence AS "extractionConfidence",
          created_at AS "createdAt"
        FROM questions
        ORDER BY is_real_question DESC, source_year DESC, id ASC
      `;
      const supportRows = yield* sql<StudyQuestionSupportRow>`
        SELECT
          id AS "id",
          question_id AS "questionId",
          summary_context AS "summaryContext",
          expected_answer_json AS "expectedAnswer",
          rubric_json AS "rubric",
          hints_json AS "hints",
          solution_steps_json AS "solutionSteps",
          common_mistakes_json AS "commonMistakes",
          support_confidence AS "supportConfidence",
          generated_at AS "generatedAt",
          generation_metadata_json AS "generationMetadataJson"
        FROM question_support
        ORDER BY question_id ASC, id ASC
      `;
      const topicRows = yield* sql<StudyQuestionTopicRow>`
        SELECT
          id AS "id",
          question_id AS "questionId",
          topic_thread_id AS "topicThreadId",
          topic AS "topic",
          subtype AS "subtype",
          confidence AS "confidence",
          is_primary AS "isPrimary"
        FROM question_topics
        ORDER BY topic_thread_id ASC, subtype ASC, question_id ASC
      `;
      const topicClusterRows = yield* sql<StudyTopicClusterRow>`
        SELECT
          id AS "id",
          project_id AS "projectId",
          display_name AS "displayName",
          priority_rank AS "priorityRank",
          priority_score AS "priorityScore",
          priority_label AS "priorityLabel",
          priority_rationale AS "priorityRationale",
          recent_question_parts AS "recentQuestionParts",
          older_question_appearances AS "olderQuestionAppearances",
          weighted_points AS "weightedPoints",
          subtypes_json AS "subtypes"
        FROM study_topic_clusters
        ORDER BY priority_rank ASC, display_name ASC
      `;
      const classificationRows = yield* sql<StudyQuestionClassificationRow>`
        SELECT
          id AS "id",
          question_candidate_id AS "questionCandidateId",
          topic_cluster_id AS "topicClusterId",
          subtype AS "subtype",
          confidence AS "confidence",
          is_primary AS "isPrimary"
        FROM study_question_classifications
        ORDER BY topic_cluster_id ASC, subtype ASC, question_candidate_id ASC
      `;
      const topicModuleRows = yield* sql<StudyTopicModuleRow>`
        SELECT
          id AS "id",
          project_id AS "projectId",
          topic_cluster_id AS "topicClusterId",
          theory_summary_markdown AS "theorySummaryMarkdown",
          formula_sheet_markdown AS "formulaSheetMarkdown",
          common_traps_markdown AS "commonTrapsMarkdown",
          subtype_coverage_json AS "subtypeCoverageJson",
          first_exposure_complete AS "firstExposureComplete",
          generation_metadata_json AS "generationMetadataJson"
        FROM study_topic_modules
        ORDER BY id ASC
      `;
      const practiceItemRows = yield* sql<StudyPracticeItemRow>`
        SELECT
          id AS "id",
          project_id AS "projectId",
          topic_module_id AS "topicModuleId",
          source_question_candidate_id AS "sourceQuestionCandidateId",
          item_origin AS "itemOrigin",
          subtype AS "subtype",
          prompt_markdown AS "promptMarkdown",
          answer_input_type AS "answerInputType",
          point_value AS "pointValue",
          asset_ids_json AS "assetIds",
          source_metadata_json AS "sourceMetadataJson"
        FROM study_practice_items
        ORDER BY topic_module_id ASC, item_origin DESC, id ASC
      `;
      const practiceSupportRows = yield* sql<StudyPracticeSupportRow>`
        SELECT
          id AS "id",
          practice_item_id AS "practiceItemId",
          expected_answer_json AS "expectedAnswerJson",
          rubric_json AS "rubricJson",
          hints_json AS "hintsJson",
          step_by_step_solution_markdown AS "stepByStepSolutionMarkdown",
          common_mistakes_markdown AS "commonMistakesMarkdown",
          support_confidence AS "supportConfidence",
          generation_metadata_json AS "generationMetadataJson"
        FROM study_practice_support
        ORDER BY practice_item_id ASC, id ASC
      `;
      const attemptRows = yield* sql<StudyAttemptRow>`
        SELECT
          id AS "id",
          question_id AS "questionId",
          topic_thread_id AS "topicThreadId",
          answer_json AS "answer",
          feedback_json AS "feedback",
          score AS "score",
          max_score AS "maxScore",
          score_percent AS "scorePercent",
          status AS "status",
          used_hints_count AS "usedHintsCount",
          used_check_direction AS "usedCheckDirection",
          attempt_number AS "attemptNumber",
          created_at AS "createdAt"
        FROM attempts
        ORDER BY created_at ASC, attempt_number ASC
      `;
      const summaryRows = yield* sql<StudyCompletionSummaryRow>`
        SELECT
          id AS "id",
          project_id AS "projectId",
          topic_thread_id AS "topicThreadId",
          scope AS "scope",
          real_questions_attempted AS "realQuestionsAttempted",
          generated_questions_attempted AS "generatedQuestionsAttempted",
          weighted_score_percent AS "weightedScorePercent",
          unweighted_score_percent AS "unweightedScorePercent",
          questions_100_percent AS "questions100Percent",
          questions_not_100_percent AS "questionsNot100Percent",
          questions_revealed AS "questionsRevealed",
          weak_subtypes_json AS "weakSubtypes",
          recommended_next_action AS "recommendedNextAction",
          created_at AS "createdAt"
        FROM completion_summaries
        ORDER BY created_at ASC
      `;
      const batchRows = yield* sql<StudyGeneratedQuestionBatchRow>`
        SELECT
          id AS "id",
          project_id AS "projectId",
          topic_thread_id AS "topicThreadId",
          source_question_ids_json AS "sourceQuestionIds",
          generation_reason AS "generationReason",
          created_at AS "createdAt",
          generation_metadata_json AS "generationMetadataJson"
        FROM generated_question_batches
        ORDER BY created_at ASC
      `;

      const snapshot: StudyFrameSnapshot = {
        dataset: {
          projects: projectRows.map(
            (row): StudyProject => ({
              id: row.id,
              name: row.name,
              sourceRoot: row.sourceRoot,
              importedAt: row.importedAt,
              extractionWarnings: parseJson(row.extractionWarnings, [] as string[]),
            }),
          ),
          documents: documentRows,
          sourceDocuments: sourceDocumentRows.map(
            (row): StudySourceDocument => ({
              id: row.id,
              projectId: row.projectId,
              sourcePath: row.sourcePath,
              fileType: row.fileType,
              role: row.role,
              year: row.year,
              quizLabel: row.quizLabel,
              extractionConfidence: row.extractionConfidence,
              warnings: parseJson(row.warnings, [] as string[]),
            }),
          ),
          sourceAssets: sourceAssetRows.map(
            (row): StudySourceAsset => ({
              id: row.id,
              documentId: row.documentId,
              kind: row.kind,
              sourceAnchor: row.sourceAnchor,
              contentText: row.contentText,
              contentJson: parseJson(row.contentJson, null as unknown),
              localUri: row.localUri,
              extractionConfidence: row.extractionConfidence,
            }),
          ),
          questionCandidates: questionCandidateRows.map(
            (row): StudyQuestionCandidate => ({
              id: row.id,
              projectId: row.projectId,
              documentId: row.documentId,
              sourceAnchor: row.sourceAnchor,
              rawPromptMarkdown: row.rawPromptMarkdown,
              sourceYear: row.sourceYear,
              sourceQuizLabel: row.sourceQuizLabel,
              pointValue: row.pointValue,
              assetIds: parseJson(row.assetIds, [] as string[]),
              extractionConfidence: row.extractionConfidence,
              needsManualReview: toBoolean(row.needsManualReview),
            }),
          ),
          questions: questionRows.map(
            (row): StudyQuestion => ({
              id: row.id,
              projectId: row.projectId,
              documentId: row.documentId,
              sourceAnchor: row.sourceAnchor,
              sourceYear: row.sourceYear,
              sourceQuizLabel: row.sourceQuizLabel,
              rawPrompt: row.rawPrompt,
              normalizedPrompt: row.normalizedPrompt,
              pointValue: row.pointValue,
              isRealQuestion: toBoolean(row.isRealQuestion),
              generatedFromQuestionIds: parseJson(row.generatedFromQuestionIds, [] as string[]),
              dependsOnAssets: toBoolean(row.dependsOnAssets),
              extractionConfidence: row.extractionConfidence,
              createdAt: row.createdAt,
            }),
          ),
          questionSupport: supportRows.map(
            (row): StudyQuestionSupport => ({
              id: row.id,
              questionId: row.questionId,
              summaryContext: row.summaryContext,
              expectedAnswer: parseJson(row.expectedAnswer, [] as string[]),
              rubric: parseJson(row.rubric, []),
              hints: parseJson(row.hints, [] as string[]),
              solutionSteps: parseJson(row.solutionSteps, [] as string[]),
              commonMistakes: parseJson(row.commonMistakes, [] as string[]),
              supportConfidence: row.supportConfidence,
              generatedAt: row.generatedAt,
              generationMetadataJson: parseJson(row.generationMetadataJson, null),
            }),
          ),
          questionTopics: topicRows.map(
            (row): StudyQuestionTopic => ({
              id: row.id,
              questionId: row.questionId,
              topicThreadId: row.topicThreadId,
              topic: row.topic,
              subtype: row.subtype,
              confidence: row.confidence,
              isPrimary: toBoolean(row.isPrimary),
            }),
          ),
          topicThreads: topicThreadRows.map(
            (row): StudyTopicThread => ({
              id: row.id,
              projectId: row.projectId,
              topic: row.topic,
              displayName: row.displayName,
              summary: row.summary,
              priorityScore: row.priorityScore,
              firstExposureComplete: toBoolean(row.firstExposureComplete),
              status: row.status,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
            }),
          ),
          topicClusters: topicClusterRows.map(
            (row): StudyTopicCluster => ({
              id: row.id,
              projectId: row.projectId,
              displayName: row.displayName,
              priorityRank: row.priorityRank,
              priorityScore: row.priorityScore,
              priorityLabel: row.priorityLabel,
              priorityRationale: row.priorityRationale,
              recentQuestionParts: row.recentQuestionParts,
              olderQuestionAppearances: row.olderQuestionAppearances,
              weightedPoints: row.weightedPoints,
              subtypes: parseJson(row.subtypes, [] as string[]),
            }),
          ),
          questionClassifications: classificationRows.map(
            (row): StudyQuestionClassification => ({
              id: row.id,
              questionCandidateId: row.questionCandidateId,
              topicClusterId: row.topicClusterId,
              subtype: row.subtype,
              confidence: row.confidence,
              isPrimary: toBoolean(row.isPrimary),
            }),
          ),
          topicModules: topicModuleRows.map(
            (row): StudyTopicModule => ({
              id: row.id,
              projectId: row.projectId,
              topicClusterId: row.topicClusterId,
              theorySummaryMarkdown: row.theorySummaryMarkdown,
              formulaSheetMarkdown: row.formulaSheetMarkdown,
              commonTrapsMarkdown: row.commonTrapsMarkdown,
              subtypeCoverageJson: parseJson(row.subtypeCoverageJson, null as unknown),
              firstExposureComplete: toBoolean(row.firstExposureComplete),
              generationMetadataJson: parseJson(row.generationMetadataJson, null),
            }),
          ),
          practiceItems: practiceItemRows.map(
            (row): StudyPracticeItem => ({
              id: row.id,
              projectId: row.projectId,
              topicModuleId: row.topicModuleId,
              sourceQuestionCandidateId: row.sourceQuestionCandidateId,
              itemOrigin: row.itemOrigin,
              subtype: row.subtype,
              promptMarkdown: row.promptMarkdown,
              answerInputType: row.answerInputType,
              pointValue: row.pointValue,
              assetIds: parseJson(row.assetIds, [] as string[]),
              sourceMetadataJson: parseJson(row.sourceMetadataJson, null as unknown),
            }),
          ),
          practiceSupport: practiceSupportRows.map(
            (row): StudyPracticeSupport => ({
              id: row.id,
              practiceItemId: row.practiceItemId,
              expectedAnswerJson: parseJson(row.expectedAnswerJson, null as unknown),
              rubricJson: parseJson(row.rubricJson, null as unknown),
              hintsJson: parseJson(row.hintsJson, [] as string[]),
              stepByStepSolutionMarkdown: row.stepByStepSolutionMarkdown,
              commonMistakesMarkdown: row.commonMistakesMarkdown,
              supportConfidence: row.supportConfidence,
              generationMetadataJson: parseJson(row.generationMetadataJson, null),
            }),
          ),
        },
        attempts: attemptRows.map(
          (row): StudyAttempt => ({
            id: row.id,
            questionId: row.questionId,
            topicThreadId: row.topicThreadId,
            answer: parseJson(row.answer, ""),
            feedback: parseJson(row.feedback, {
              tone: "graded",
              status: row.status,
              score: row.score,
              maxScore: row.maxScore,
              scorePercent: row.scorePercent,
              matchedRubricLabels: [],
              missingRubricLabels: [],
              feedback: "",
              nextStep: "",
            }),
            score: row.score,
            maxScore: row.maxScore,
            scorePercent: row.scorePercent,
            status: row.status,
            usedHintsCount: row.usedHintsCount,
            usedCheckDirection: toBoolean(row.usedCheckDirection),
            attemptNumber: row.attemptNumber,
            createdAt: row.createdAt,
          }),
        ),
        completionSummaries: summaryRows.map(
          (row): StudyCompletionSummary => ({
            id: row.id,
            projectId: row.projectId,
            topicThreadId: row.topicThreadId,
            scope: row.scope,
            realQuestionsAttempted: row.realQuestionsAttempted,
            generatedQuestionsAttempted: row.generatedQuestionsAttempted,
            weightedScorePercent: row.weightedScorePercent,
            unweightedScorePercent: row.unweightedScorePercent,
            questions100Percent: row.questions100Percent,
            questionsNot100Percent: row.questionsNot100Percent,
            questionsRevealed: row.questionsRevealed,
            weakSubtypes: parseJson(row.weakSubtypes, [] as string[]),
            recommendedNextAction: row.recommendedNextAction,
            createdAt: row.createdAt,
          }),
        ),
        generatedQuestionBatches: batchRows.map(
          (row): StudyGeneratedQuestionBatch => ({
            id: row.id,
            projectId: row.projectId,
            topicThreadId: row.topicThreadId,
            sourceQuestionIds: parseJson(row.sourceQuestionIds, [] as string[]),
            generationReason: row.generationReason,
            createdAt: row.createdAt,
            generationMetadataJson: parseJson(row.generationMetadataJson, null),
          }),
        ),
      };

      return Option.some(snapshot);
    }).pipe(
      Effect.mapError((cause) =>
        cause instanceof SyntaxError
          ? toPersistenceDecodeCauseError("StudyFrameRepository.loadSnapshot:decode")(cause)
          : toPersistenceSqlError("StudyFrameRepository.loadSnapshot:query")(cause),
      ),
    );

  const saveSnapshot: StudyFrameRepositoryShape["saveSnapshot"] = (snapshot) =>
    sql
      .withTransaction(
        Effect.gen(function* () {
          yield* sql`DELETE FROM generated_question_batches`;
          yield* sql`DELETE FROM completion_summaries`;
          yield* sql`DELETE FROM attempts`;
          yield* sql`DELETE FROM study_practice_support`;
          yield* sql`DELETE FROM study_practice_items`;
          yield* sql`DELETE FROM study_topic_modules`;
          yield* sql`DELETE FROM study_question_classifications`;
          yield* sql`DELETE FROM study_topic_clusters`;
          yield* sql`DELETE FROM study_question_candidates`;
          yield* sql`DELETE FROM study_source_assets`;
          yield* sql`DELETE FROM study_source_documents`;
          yield* sql`DELETE FROM question_support`;
          yield* sql`DELETE FROM question_topics`;
          yield* sql`DELETE FROM questions`;
          yield* sql`DELETE FROM topic_threads`;
          yield* sql`DELETE FROM study_documents`;
          yield* sql`DELETE FROM study_projects`;

          for (const project of snapshot.dataset.projects) {
            yield* sql`
              INSERT INTO study_projects (
                id,
                name,
                source_root,
                imported_at,
                extraction_warnings_json
              )
              VALUES (
                ${project.id},
                ${project.name},
                ${project.sourceRoot},
                ${project.importedAt},
                ${toJson(project.extractionWarnings)}
              )
            `;
          }

          for (const document of snapshot.dataset.documents) {
            yield* sql`
              INSERT INTO study_documents (
                id,
                project_id,
                title,
                source_path,
                year,
                quiz_label
              )
              VALUES (
                ${document.id},
                ${document.projectId},
                ${document.title},
                ${document.sourcePath},
                ${document.year},
                ${document.quizLabel}
              )
            `;
          }

          for (const document of snapshot.dataset.sourceDocuments ?? []) {
            yield* sql`
              INSERT INTO study_source_documents (
                id,
                project_id,
                source_path,
                file_type,
                role,
                year,
                quiz_label,
                extraction_confidence,
                warnings_json
              )
              VALUES (
                ${document.id},
                ${document.projectId},
                ${document.sourcePath},
                ${document.fileType},
                ${document.role},
                ${document.year},
                ${document.quizLabel},
                ${document.extractionConfidence},
                ${toJson(document.warnings)}
              )
            `;
          }

          for (const asset of snapshot.dataset.sourceAssets ?? []) {
            yield* sql`
              INSERT INTO study_source_assets (
                id,
                document_id,
                kind,
                source_anchor,
                content_text,
                content_json,
                local_uri,
                extraction_confidence
              )
              VALUES (
                ${asset.id},
                ${asset.documentId},
                ${asset.kind},
                ${asset.sourceAnchor},
                ${asset.contentText},
                ${toJson(asset.contentJson)},
                ${asset.localUri},
                ${asset.extractionConfidence}
              )
            `;
          }

          for (const candidate of snapshot.dataset.questionCandidates ?? []) {
            yield* sql`
              INSERT INTO study_question_candidates (
                id,
                project_id,
                document_id,
                source_anchor,
                raw_prompt_markdown,
                source_year,
                source_quiz_label,
                point_value,
                asset_ids_json,
                extraction_confidence,
                needs_manual_review
              )
              VALUES (
                ${candidate.id},
                ${candidate.projectId},
                ${candidate.documentId},
                ${candidate.sourceAnchor},
                ${candidate.rawPromptMarkdown},
                ${candidate.sourceYear},
                ${candidate.sourceQuizLabel},
                ${candidate.pointValue},
                ${toJson(candidate.assetIds)},
                ${candidate.extractionConfidence},
                ${fromBoolean(candidate.needsManualReview)}
              )
            `;
          }

          for (const topicThread of snapshot.dataset.topicThreads) {
            yield* sql`
              INSERT INTO topic_threads (
                id,
                project_id,
                topic,
                display_name,
                summary,
                priority_score,
                first_exposure_complete,
                status,
                created_at,
                updated_at
              )
              VALUES (
                ${topicThread.id},
                ${topicThread.projectId},
                ${topicThread.topic},
                ${topicThread.displayName},
                ${topicThread.summary},
                ${topicThread.priorityScore},
                ${fromBoolean(topicThread.firstExposureComplete)},
                ${topicThread.status},
                ${topicThread.createdAt},
                ${topicThread.updatedAt}
              )
            `;
          }

          for (const question of snapshot.dataset.questions) {
            yield* sql`
              INSERT INTO questions (
                id,
                project_id,
                document_id,
                source_anchor,
                source_year,
                source_quiz_label,
                raw_prompt,
                normalized_prompt,
                point_value,
                is_real_question,
                generated_from_question_ids,
                depends_on_assets,
                extraction_confidence,
                created_at
              )
              VALUES (
                ${question.id},
                ${question.projectId},
                ${question.documentId},
                ${question.sourceAnchor},
                ${question.sourceYear},
                ${question.sourceQuizLabel},
                ${question.rawPrompt},
                ${question.normalizedPrompt},
                ${question.pointValue},
                ${fromBoolean(question.isRealQuestion)},
                ${toJson(question.generatedFromQuestionIds)},
                ${fromBoolean(question.dependsOnAssets)},
                ${question.extractionConfidence},
                ${question.createdAt}
              )
            `;
          }

          for (const support of snapshot.dataset.questionSupport) {
            yield* sql`
              INSERT INTO question_support (
                id,
                question_id,
                summary_context,
                expected_answer_json,
                rubric_json,
                hints_json,
                solution_steps_json,
                common_mistakes_json,
                support_confidence,
                generated_at,
                generation_metadata_json
              )
              VALUES (
                ${support.id},
                ${support.questionId},
                ${support.summaryContext},
                ${toJson(support.expectedAnswer)},
                ${toJson(support.rubric)},
                ${toJson(support.hints)},
                ${toJson(support.solutionSteps)},
                ${toJson(support.commonMistakes)},
                ${support.supportConfidence},
                ${support.generatedAt},
                ${toJson(support.generationMetadataJson ?? null)}
              )
            `;
          }

          for (const topic of snapshot.dataset.questionTopics) {
            yield* sql`
              INSERT INTO question_topics (
                id,
                question_id,
                topic_thread_id,
                topic,
                subtype,
                confidence,
                is_primary
              )
              VALUES (
                ${topic.id},
                ${topic.questionId},
                ${topic.topicThreadId},
                ${topic.topic},
                ${topic.subtype},
                ${topic.confidence},
                ${fromBoolean(topic.isPrimary)}
              )
            `;
          }

          for (const cluster of snapshot.dataset.topicClusters ?? []) {
            yield* sql`
              INSERT INTO study_topic_clusters (
                id,
                project_id,
                display_name,
                priority_rank,
                priority_score,
                priority_label,
                priority_rationale,
                recent_question_parts,
                older_question_appearances,
                weighted_points,
                subtypes_json
              )
              VALUES (
                ${cluster.id},
                ${cluster.projectId},
                ${cluster.displayName},
                ${cluster.priorityRank},
                ${cluster.priorityScore},
                ${cluster.priorityLabel},
                ${cluster.priorityRationale},
                ${cluster.recentQuestionParts},
                ${cluster.olderQuestionAppearances},
                ${cluster.weightedPoints},
                ${toJson(cluster.subtypes)}
              )
            `;
          }

          for (const classification of snapshot.dataset.questionClassifications ?? []) {
            yield* sql`
              INSERT INTO study_question_classifications (
                id,
                question_candidate_id,
                topic_cluster_id,
                subtype,
                confidence,
                is_primary
              )
              VALUES (
                ${classification.id},
                ${classification.questionCandidateId},
                ${classification.topicClusterId},
                ${classification.subtype},
                ${classification.confidence},
                ${fromBoolean(classification.isPrimary)}
              )
            `;
          }

          for (const module of snapshot.dataset.topicModules ?? []) {
            yield* sql`
              INSERT INTO study_topic_modules (
                id,
                project_id,
                topic_cluster_id,
                theory_summary_markdown,
                formula_sheet_markdown,
                common_traps_markdown,
                subtype_coverage_json,
                first_exposure_complete,
                generation_metadata_json
              )
              VALUES (
                ${module.id},
                ${module.projectId},
                ${module.topicClusterId},
                ${module.theorySummaryMarkdown},
                ${module.formulaSheetMarkdown},
                ${module.commonTrapsMarkdown},
                ${toJson(module.subtypeCoverageJson)},
                ${fromBoolean(module.firstExposureComplete)},
                ${toJson(module.generationMetadataJson ?? null)}
              )
            `;
          }

          for (const item of snapshot.dataset.practiceItems ?? []) {
            yield* sql`
              INSERT INTO study_practice_items (
                id,
                project_id,
                topic_module_id,
                source_question_candidate_id,
                item_origin,
                subtype,
                prompt_markdown,
                answer_input_type,
                point_value,
                asset_ids_json,
                source_metadata_json
              )
              VALUES (
                ${item.id},
                ${item.projectId},
                ${item.topicModuleId},
                ${item.sourceQuestionCandidateId},
                ${item.itemOrigin},
                ${item.subtype},
                ${item.promptMarkdown},
                ${item.answerInputType},
                ${item.pointValue},
                ${toJson(item.assetIds)},
                ${toJson(item.sourceMetadataJson)}
              )
            `;
          }

          for (const support of snapshot.dataset.practiceSupport ?? []) {
            yield* sql`
              INSERT INTO study_practice_support (
                id,
                practice_item_id,
                expected_answer_json,
                rubric_json,
                hints_json,
                step_by_step_solution_markdown,
                common_mistakes_markdown,
                support_confidence,
                generation_metadata_json
              )
              VALUES (
                ${support.id},
                ${support.practiceItemId},
                ${toJson(support.expectedAnswerJson)},
                ${toJson(support.rubricJson)},
                ${toJson(support.hintsJson)},
                ${support.stepByStepSolutionMarkdown},
                ${support.commonMistakesMarkdown},
                ${support.supportConfidence},
                ${toJson(support.generationMetadataJson ?? null)}
              )
            `;
          }

          for (const attempt of snapshot.attempts) {
            yield* sql`
              INSERT INTO attempts (
                id,
                question_id,
                topic_thread_id,
                answer_json,
                feedback_json,
                score,
                max_score,
                score_percent,
                status,
                used_hints_count,
                used_check_direction,
                attempt_number,
                created_at
              )
              VALUES (
                ${attempt.id},
                ${attempt.questionId},
                ${attempt.topicThreadId},
                ${toJson(attempt.answer)},
                ${toJson(attempt.feedback)},
                ${attempt.score},
                ${attempt.maxScore},
                ${attempt.scorePercent},
                ${attempt.status},
                ${attempt.usedHintsCount},
                ${fromBoolean(attempt.usedCheckDirection)},
                ${attempt.attemptNumber},
                ${attempt.createdAt}
              )
            `;
          }

          for (const summary of snapshot.completionSummaries) {
            yield* sql`
              INSERT INTO completion_summaries (
                id,
                project_id,
                topic_thread_id,
                scope,
                real_questions_attempted,
                generated_questions_attempted,
                weighted_score_percent,
                unweighted_score_percent,
                questions_100_percent,
                questions_not_100_percent,
                questions_revealed,
                weak_subtypes_json,
                recommended_next_action,
                created_at
              )
              VALUES (
                ${summary.id},
                ${summary.projectId},
                ${summary.topicThreadId},
                ${summary.scope},
                ${summary.realQuestionsAttempted},
                ${summary.generatedQuestionsAttempted},
                ${summary.weightedScorePercent},
                ${summary.unweightedScorePercent},
                ${summary.questions100Percent},
                ${summary.questionsNot100Percent},
                ${summary.questionsRevealed},
                ${toJson(summary.weakSubtypes)},
                ${summary.recommendedNextAction},
                ${summary.createdAt}
              )
            `;
          }

          for (const batch of snapshot.generatedQuestionBatches) {
            yield* sql`
              INSERT INTO generated_question_batches (
                id,
                project_id,
                topic_thread_id,
                source_question_ids_json,
                generation_reason,
                created_at,
                generation_metadata_json
              )
              VALUES (
                ${batch.id},
                ${batch.projectId},
                ${batch.topicThreadId},
                ${toJson(batch.sourceQuestionIds)},
                ${batch.generationReason},
                ${batch.createdAt},
                ${toJson(batch.generationMetadataJson ?? null)}
              )
            `;
          }
        }),
      )
      .pipe(
        Effect.mapError(toPersistenceSqlError("StudyFrameRepository.saveSnapshot:transaction")),
      );

  return {
    loadSnapshot,
    saveSnapshot,
  } satisfies StudyFrameRepositoryShape;
});

export const StudyFrameRepositoryLive = Layer.effect(
  StudyFrameRepository,
  makeStudyFrameRepository,
);
