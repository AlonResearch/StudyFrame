import { describe, expect, it } from "vitest";

import { withRegeneratedStudyPracticeModel } from "./studyDomainModel";
import { studySeedData } from "./studySeedData";

describe("withRegeneratedStudyPracticeModel", () => {
  it("adds normalized practice records for generated variants", () => {
    const sourceQuestion = studySeedData.questions[0]!;
    const sourceTopic = studySeedData.questionTopics[0]!;
    const sourceSupport = studySeedData.questionSupport[0]!;
    const generatedQuestion = {
      ...sourceQuestion,
      id: "generated-question",
      sourceAnchor: `generated-from:${sourceQuestion.id}`,
      sourceQuizLabel: `Generated variant from ${sourceQuestion.sourceQuizLabel}`,
      isRealQuestion: false,
      generatedFromQuestionIds: [sourceQuestion.id],
    };
    const dataset = withRegeneratedStudyPracticeModel({
      ...studySeedData,
      questions: [...studySeedData.questions, generatedQuestion],
      questionTopics: [
        ...studySeedData.questionTopics,
        {
          ...sourceTopic,
          id: "generated-topic",
          questionId: generatedQuestion.id,
        },
      ],
      questionSupport: [
        ...studySeedData.questionSupport,
        {
          ...sourceSupport,
          id: "generated-support",
          questionId: generatedQuestion.id,
        },
      ],
    });

    expect(
      dataset.practiceItems?.find((item) => item.id === "practice-generated-question"),
    ).toMatchObject({
      itemOrigin: "generated_variant",
      sourceQuestionCandidateId: null,
      promptMarkdown: generatedQuestion.rawPrompt,
    });
    expect(
      dataset.practiceSupport?.find(
        (support) => support.practiceItemId === "practice-generated-question",
      )?.expectedAnswerJson,
    ).toEqual(sourceSupport.expectedAnswer);
  });

  it("maps real questions to analyzer-style module ids by topic cluster", () => {
    const dataset = withRegeneratedStudyPracticeModel({
      ...studySeedData,
      topicClusters: studySeedData.topicClusters!.map((cluster) =>
        Object.assign({}, cluster, {
          id: cluster.id.replace("cluster-topic-", "cluster-"),
        }),
      ),
      topicModules: studySeedData.topicModules!.map((module) =>
        Object.assign({}, module, {
          id: module.id.replace("module-topic-", "module-"),
          topicClusterId: module.topicClusterId.replace("cluster-topic-", "cluster-"),
        }),
      ),
    });

    expect(dataset.practiceItems).toHaveLength(studySeedData.questions.length);
    expect(dataset.practiceItems?.every((item) => item.sourceQuestionCandidateId !== null)).toBe(
      true,
    );
  });
});
