import type { ChildQuestionDraft, SubQuestionOrderingStrategy } from '../domain';

export interface SubQuestionOrderingResult {
  childQuestions: ChildQuestionDraft[];
  orderingStrategy: SubQuestionOrderingStrategy;
  fallbackReason?: string;
}

export function orderChildQuestions(
  childQuestions: ChildQuestionDraft[],
  confidenceThreshold = 0.6,
): SubQuestionOrderingResult {
  const originalOrder = [...childQuestions].sort(
    (left, right) => left.originalIndex - right.originalIndex,
  );

  if (originalOrder.length < 2) {
    return {
      childQuestions: originalOrder,
      orderingStrategy: 'original',
    };
  }

  if (
    originalOrder.some(
      (childQuestion) =>
        childQuestion.dependsOnIndices.length > 0 &&
        childQuestion.dependencyConfidence < confidenceThreshold,
    )
  ) {
    return {
      childQuestions: originalOrder,
      orderingStrategy: 'original',
      fallbackReason: '依赖置信度过低，已退回原句顺序。',
    };
  }

  const questionByIndex = new Map<number, ChildQuestionDraft>();
  const outgoingEdges = new Map<number, number[]>();
  const indegreeByIndex = new Map<number, number>();
  let hasDependency = false;

  for (const childQuestion of originalOrder) {
    questionByIndex.set(childQuestion.originalIndex, childQuestion);
    outgoingEdges.set(childQuestion.originalIndex, []);
    indegreeByIndex.set(childQuestion.originalIndex, 0);
  }

  for (const childQuestion of originalOrder) {
    for (const dependencyIndex of childQuestion.dependsOnIndices) {
      hasDependency = true;

      if (
        dependencyIndex === childQuestion.originalIndex ||
        !questionByIndex.has(dependencyIndex)
      ) {
        return {
          childQuestions: originalOrder,
          orderingStrategy: 'original',
          fallbackReason: '依赖关系无效，已退回原句顺序。',
        };
      }

      outgoingEdges.get(dependencyIndex)?.push(childQuestion.originalIndex);
      indegreeByIndex.set(
        childQuestion.originalIndex,
        (indegreeByIndex.get(childQuestion.originalIndex) ?? 0) + 1,
      );
    }
  }

  if (!hasDependency) {
    return {
      childQuestions: originalOrder,
      orderingStrategy: 'original',
    };
  }

  const readyQueue = [...indegreeByIndex.entries()]
    .filter(([, indegree]) => indegree === 0)
    .map(([index]) => index)
    .sort((left, right) => left - right);
  const orderedIndices: number[] = [];

  while (readyQueue.length > 0) {
    const currentIndex = readyQueue.shift();

    if (typeof currentIndex !== 'number') {
      continue;
    }

    orderedIndices.push(currentIndex);

    for (const nextIndex of outgoingEdges.get(currentIndex) ?? []) {
      const nextIndegree = (indegreeByIndex.get(nextIndex) ?? 0) - 1;

      indegreeByIndex.set(nextIndex, nextIndegree);

      if (nextIndegree === 0) {
        readyQueue.push(nextIndex);
        readyQueue.sort((left, right) => left - right);
      }
    }
  }

  if (orderedIndices.length !== originalOrder.length) {
    return {
      childQuestions: originalOrder,
      orderingStrategy: 'original',
      fallbackReason: '依赖关系存在环，已退回原句顺序。',
    };
  }

  return {
    childQuestions: orderedIndices.map((index) => questionByIndex.get(index)!),
    orderingStrategy: 'dependency',
  };
}
