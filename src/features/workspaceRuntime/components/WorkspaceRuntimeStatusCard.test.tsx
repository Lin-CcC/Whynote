import { render, screen } from '@testing-library/react';

import type { CompletionSuggestionResult } from '../../learningEngine';
import WorkspaceRuntimeStatusCard from './WorkspaceRuntimeStatusCard';

test('keeps a stable detail slot while runtime status switches between save and completion states', () => {
  const { rerender } = render(
    <WorkspaceRuntimeStatusCard
      activeAiActionLabel={null}
      aiError={null}
      completionSuggestion={null}
      isAiRunning={false}
      isInitializing={false}
      loadError={null}
      runtimeMessage={null}
      saveError={null}
      saveStatus="saving"
    />,
  );

  const detailSlot = screen.getByTestId('workspace-runtime-status-detail');

  expect(detailSlot).toBeInTheDocument();
  expect(detailSlot).toHaveAttribute('aria-hidden', 'true');

  rerender(
    <WorkspaceRuntimeStatusCard
      activeAiActionLabel={null}
      aiError={null}
      completionSuggestion={createCompletionSuggestion()}
      isAiRunning={false}
      isInitializing={false}
      loadError={null}
      runtimeMessage={null}
      saveError={null}
      saveStatus="saved"
    />,
  );

  expect(screen.getByTestId('workspace-runtime-status-detail')).toBe(detailSlot);
  expect(detailSlot).toHaveTextContent('当前步骤已满足最小学习闭环。');
  expect(detailSlot).not.toHaveAttribute('aria-hidden', 'true');

  rerender(
    <WorkspaceRuntimeStatusCard
      activeAiActionLabel={null}
      aiError={null}
      completionSuggestion={null}
      isAiRunning={false}
      isInitializing={false}
      loadError={null}
      runtimeMessage={null}
      saveError={null}
      saveStatus="saved"
    />,
  );

  expect(screen.getByTestId('workspace-runtime-status-detail')).toBe(detailSlot);
  expect(detailSlot).toHaveAttribute('aria-hidden', 'true');
});

function createCompletionSuggestion(): CompletionSuggestionResult {
  return {
    evidence: {
      answerCount: 1,
      answeredQuestionCount: 1,
      blockingJudgmentCount: 0,
      blockingTagNames: [],
      closedLeafQuestionCount: 1,
      directClosureCount: 1,
      judgmentCount: 1,
      leafQuestionCount: 1,
      questionCount: 1,
      referencedNodeCount: 0,
      refinedQuestionCount: 0,
      scaffoldSummaryCount: 0,
      stepStatus: 'doing',
      summaryCount: 1,
      unresolvedQuestionTitles: [],
    },
    reasonSummary: '当前步骤已满足最小学习闭环。',
    reasons: ['问题、回答、判断与总结都已就绪。'],
    shouldSuggestComplete: true,
  };
}
