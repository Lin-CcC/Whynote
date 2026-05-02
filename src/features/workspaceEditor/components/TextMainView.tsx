import {
  type ChangeEvent,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  buildQuestionBlockData,
  findNearestQuestionNodeId,
  getNodeOrThrow,
  type NodeTree,
  type TreeNode,
} from '../../nodeDomain';
import type {
  LearningActionId,
  NodeContentPatch,
  WorkspaceEditorNodeRenderContext,
  WorkspaceEditorToolbarSection,
  WorkspaceViewState,
} from '../workspaceEditorTypes';
import {
  getChildNodes,
  getDisplayTitleForNode,
  getNodeInputPlaceholderForNode,
} from '../utils/treeSelectors';
import {
  getAnswerHistorySectionId,
  getSummaryHistorySectionId,
} from '../utils/workspaceViewState';
import EditorNodeSection from './EditorNodeSection';

type TextMainViewProps = {
  currentModuleId: string | null;
  interactionLockReason: string | null;
  isInteractionLocked: boolean;
  onCreateModule: () => void;
  onDeleteNodeById: (nodeId: string) => void;
  onDirectAnswerQuestion?: (questionNodeId: string) => void;
  onEvaluateAnswer?: (questionNodeId: string, answerNodeId: string) => void;
  onEvaluateSummary?: (summaryNodeId: string) => void;
  onGenerateFollowUpQuestion?: (sourceNodeId: string) => void;
  onGenerateSummary?: (sourceNodeId: string) => void;
  onInsertAnswerForQuestion: (questionNodeId: string) => void;
  onInsertFollowUpQuestion: (sourceNodeId: string) => void;
  onInsertSummaryForNode: (sourceNodeId: string) => void;
  onDeleteNode: () => void;
  onRunLearningAction: (actionId: LearningActionId) => void;
  onRunLearningActionForNode: (
    nodeId: string,
    actionId: LearningActionId,
  ) => void;
  onSelectNode: (nodeId: string) => void;
  onSetCurrentAnswer: (questionNodeId: string, answerNodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: NodeContentPatch) => void;
  onWorkspaceViewStateChange: (state: WorkspaceViewState) => void;
  renderNodeInlineActions?: (
    context: WorkspaceEditorNodeRenderContext,
  ) => ReactNode;
  renderNodeToolbarSections?: (
    context: WorkspaceEditorNodeRenderContext,
  ) => WorkspaceEditorToolbarSection[] | null;
  registerNodeElement: (nodeId: string, element: HTMLElement | null) => void;
  selectedNodeId: string | null;
  tree: NodeTree;
  workspaceViewState: WorkspaceViewState;
};

export default function TextMainView({
  currentModuleId,
  interactionLockReason,
  isInteractionLocked,
  onCreateModule,
  onDeleteNodeById,
  onDirectAnswerQuestion,
  onEvaluateAnswer,
  onEvaluateSummary,
  onGenerateFollowUpQuestion,
  onGenerateSummary,
  onDeleteNode,
  onInsertAnswerForQuestion,
  onInsertFollowUpQuestion,
  onInsertSummaryForNode,
  onRunLearningAction,
  onRunLearningActionForNode,
  onSelectNode,
  onSetCurrentAnswer,
  onUpdateNode,
  onWorkspaceViewStateChange,
  renderNodeInlineActions,
  renderNodeToolbarSections,
  registerNodeElement,
  selectedNodeId,
  tree,
  workspaceViewState,
}: TextMainViewProps) {
  const activeQuestionBlockId = findNearestQuestionNodeId(tree, selectedNodeId);
  const lastAutoExpandedSelectionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedNodeId === lastAutoExpandedSelectionIdRef.current) {
      return;
    }

    lastAutoExpandedSelectionIdRef.current = selectedNodeId;

    const nextViewState = expandWorkspaceViewStateForSelection(
      tree,
      selectedNodeId,
      workspaceViewState,
    );

    if (nextViewState !== workspaceViewState) {
      onWorkspaceViewStateChange(nextViewState);
    }
  }, [onWorkspaceViewStateChange, selectedNodeId, tree, workspaceViewState]);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const selectedNodeElement = document.querySelector<HTMLElement>(
        `[data-testid="editor-node-${selectedNodeId}"]`,
      );
      const activeElement = document.activeElement;

      if (
        !selectedNodeElement ||
        selectedNodeElement.contains(activeElement)
      ) {
        return;
      }

      selectedNodeElement.focus();
      selectedNodeElement.scrollIntoView?.({
        block: 'nearest',
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [selectedNodeId, tree, workspaceViewState]);

  if (!currentModuleId || !tree.nodes[currentModuleId]) {
    return (
      <div className="workspace-mainPanel">
        <div
          className="workspace-documentShell workspace-documentShell-empty"
          data-layout="single-column"
          data-testid="workspace-document-shell"
        >
          <header
            className="workspace-documentHeader"
            data-testid="workspace-document-header"
          >
            <p className="workspace-kicker">主视图</p>
            <h2 className="workspace-documentTitle">还没有可编辑的模块</h2>
          </header>
          <div className="workspace-emptyState">
            <p className="workspace-helpText">
              先创建一个模块，主视图才会进入 question block 编辑表面。
            </p>
            <button
              className="workspace-inlineAction"
              disabled={isInteractionLocked}
              onClick={onCreateModule}
              type="button"
            >
              新建模块
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentModule = getNodeOrThrow(tree, currentModuleId);
  const moduleChildNodes = getChildNodes(tree, currentModule.id);

  return (
    <div className="workspace-mainPanel">
      <div
        className="workspace-documentShell"
        data-layout="single-column"
        data-testid="workspace-document-shell"
      >
        <ModuleDocumentSurface
          currentModule={currentModule}
          interactionLockReason={interactionLockReason}
          isInteractionLocked={isInteractionLocked}
          onSelectNode={onSelectNode}
          onUpdateNode={onUpdateNode}
          registerNodeElement={registerNodeElement}
          selectedNodeId={selectedNodeId}
          tree={tree}
        />
        <div className="workspace-documentBody">
          {moduleChildNodes.map((childNode) => (
            <EditorNodeSection
              activeQuestionBlockId={activeQuestionBlockId}
              depth={1}
              isInteractionLocked={isInteractionLocked}
              key={childNode.id}
              nodeId={childNode.id}
              onDeleteNode={onDeleteNode}
              onDeleteNodeById={onDeleteNodeById}
              onDirectAnswerQuestion={onDirectAnswerQuestion}
              onEvaluateAnswer={onEvaluateAnswer}
              onEvaluateSummary={onEvaluateSummary}
              onGenerateFollowUpQuestion={onGenerateFollowUpQuestion}
              onGenerateSummary={onGenerateSummary}
              onInsertAnswerForQuestion={onInsertAnswerForQuestion}
              onInsertFollowUpQuestion={onInsertFollowUpQuestion}
              onInsertSummaryForNode={onInsertSummaryForNode}
              onRunLearningAction={onRunLearningAction}
              onRunLearningActionForNode={onRunLearningActionForNode}
              onSelectNode={onSelectNode}
              onSetCurrentAnswer={onSetCurrentAnswer}
              onUpdateNode={onUpdateNode}
              onWorkspaceViewStateChange={onWorkspaceViewStateChange}
              registerNodeElement={registerNodeElement}
              renderNodeInlineActions={renderNodeInlineActions}
              renderNodeToolbarSections={renderNodeToolbarSections}
              selectedNodeId={selectedNodeId}
              tree={tree}
              workspaceViewState={workspaceViewState}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type ModuleDocumentSurfaceProps = {
  currentModule: TreeNode;
  interactionLockReason: string | null;
  isInteractionLocked: boolean;
  onSelectNode: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: NodeContentPatch) => void;
  registerNodeElement: (nodeId: string, element: HTMLElement | null) => void;
  selectedNodeId: string | null;
  tree: NodeTree;
};

type ModuleEditableField = 'content' | 'title' | null;

function ModuleDocumentSurface({
  currentModule,
  interactionLockReason,
  isInteractionLocked,
  onSelectNode,
  onUpdateNode,
  registerNodeElement,
  selectedNodeId,
  tree,
}: ModuleDocumentSurfaceProps) {
  const [activeField, setActiveField] = useState<ModuleEditableField>(null);
  const [hasFocusWithin, setHasFocusWithin] = useState(false);
  const [pendingFocusField, setPendingFocusField] =
    useState<ModuleEditableField>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const introInputRef = useRef<HTMLTextAreaElement | null>(null);
  const isSelected = selectedNodeId === currentModule.id;
  const displayTitle = getDisplayTitleForNode(tree, currentModule);
  const trimmedDisplayTitle = displayTitle.trim();
  const titlePlaceholder = getNodeInputPlaceholderForNode(
    tree,
    currentModule,
    'title',
  );
  const introPlaceholder = '补充模块引言';
  const titleInputVisible =
    pendingFocusField === 'title' || activeField === 'title';
  const introInputVisible =
    pendingFocusField === 'content' || activeField === 'content';
  const showIntro =
    currentModule.content.trim().length > 0 || isSelected || introInputVisible;
  const isEditing = activeField !== null || pendingFocusField !== null;
  const frameVisible = isSelected || hasFocusWithin || isEditing;

  useEffect(() => {
    if (isSelected) {
      return;
    }

    setActiveField(null);
    setHasFocusWithin(false);
    setPendingFocusField(null);
  }, [isSelected]);

  useEffect(() => {
    if (!pendingFocusField) {
      return;
    }

    const target =
      pendingFocusField === 'title'
        ? titleInputRef.current
        : introInputRef.current;

    if (!target) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      target.focus();
      if (pendingFocusField === 'title') {
        target.select();
      }
      setPendingFocusField(null);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [pendingFocusField, titleInputVisible]);

  useEffect(() => {
    if (!introInputVisible) {
      return;
    }

    syncTextareaHeight(introInputRef.current);
  }, [currentModule.content, introInputVisible]);

  function handleWrapperClick() {
    onSelectNode(currentModule.id);
  }

  function handleFocusCapture() {
    setHasFocusWithin(true);
    if (!isSelected) {
      onSelectNode(currentModule.id);
    }
  }

  function handleBlurCapture(event: FocusEvent<HTMLElement>) {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }

    setHasFocusWithin(false);
  }

  function handleEditableBlur(event: FocusEvent<HTMLElement>) {
    if (
      event.relatedTarget instanceof Node &&
      (titleInputRef.current?.contains(event.relatedTarget) ||
        introInputRef.current?.contains(event.relatedTarget))
    ) {
      return;
    }

    setActiveField(null);
  }

  function handleTitleFocus() {
    setActiveField('title');
  }

  function handleIntroFocus() {
    setActiveField('content');
  }

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    onUpdateNode(currentModule.id, { title: event.target.value });
  }

  function handleIntroChange(event: ChangeEvent<HTMLTextAreaElement>) {
    syncTextareaHeight(event.currentTarget);
    onUpdateNode(currentModule.id, { content: event.target.value });
  }

  function startEditingField(
    field: Exclude<ModuleEditableField, null>,
    event: MouseEvent<HTMLElement>,
  ) {
    event.stopPropagation();

    if (isInteractionLocked) {
      return;
    }

    onSelectNode(currentModule.id);
    setActiveField(field);
    setPendingFocusField(field);
  }

  return (
    <div
      aria-selected={isSelected}
      className="workspace-documentModuleSurface"
      data-node-editing={isEditing}
      data-node-frame-visible={frameVisible}
      data-node-selected={isSelected}
      data-node-type="module"
      data-testid={`editor-node-${currentModule.id}`}
      onBlurCapture={handleBlurCapture}
      onClick={handleWrapperClick}
      onFocusCapture={handleFocusCapture}
      ref={(element) => registerNodeElement(currentModule.id, element)}
      tabIndex={-1}
    >
      <header
        className="workspace-documentHeader"
        data-testid="workspace-document-header"
      >
        <div className="workspace-documentHeaderMain">
          <p className="workspace-kicker workspace-documentKicker">当前模块</p>
          {titleInputVisible ? (
            <input
              aria-label="当前模块 标题"
              className="workspace-documentTitleInput"
              disabled={isInteractionLocked}
              onBlur={handleEditableBlur}
              onChange={handleTitleChange}
              onClick={(event) => event.stopPropagation()}
              onFocus={handleTitleFocus}
              placeholder={titlePlaceholder}
              ref={titleInputRef}
              value={displayTitle}
            />
          ) : (
            <h2 className="workspace-documentTitle">
              <button
                className="workspace-documentTitleDisplay"
                data-testid="workspace-document-title-display"
                disabled={isInteractionLocked}
                onClick={(event) => startEditingField('title', event)}
                type="button"
              >
                {trimmedDisplayTitle.length > 0 ? (
                  trimmedDisplayTitle
                ) : (
                  <span className="workspace-documentTitlePlaceholder">
                    {titlePlaceholder}
                  </span>
                )}
              </button>
            </h2>
          )}
        </div>
        {isInteractionLocked && interactionLockReason ? (
          <p className="workspace-lockText" role="status">
            {interactionLockReason}
          </p>
        ) : null}
      </header>
      {showIntro ? (
        <div className="workspace-documentIntro">
          {introInputVisible ? (
            <textarea
              aria-label="当前模块 引言"
              className="workspace-documentIntroInput"
              disabled={isInteractionLocked}
              onBlur={handleEditableBlur}
              onChange={handleIntroChange}
              onClick={(event) => event.stopPropagation()}
              onFocus={handleIntroFocus}
              placeholder={introPlaceholder}
              ref={introInputRef}
              rows={2}
              value={currentModule.content}
            />
          ) : (
            <button
              aria-label="当前模块 引言"
              className="workspace-documentIntroDisplay"
              data-placeholder={currentModule.content.trim().length === 0}
              data-testid="workspace-document-intro-display"
              disabled={isInteractionLocked}
              onClick={(event) => startEditingField('content', event)}
              type="button"
            >
              {currentModule.content.trim().length > 0 ? (
                currentModule.content
              ) : (
                <span className="workspace-documentIntroPlaceholder">
                  {introPlaceholder}
                </span>
              )}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function expandWorkspaceViewStateForSelection(
  tree: NodeTree,
  selectedNodeId: string | null,
  workspaceViewState: WorkspaceViewState,
) {
  if (!selectedNodeId || !tree.nodes[selectedNodeId]) {
    return workspaceViewState;
  }

  let nextViewState = workspaceViewState;
  const ancestorPlanStepIds = collectAncestorPlanStepIds(tree, selectedNodeId);
  const ancestorQuestionIds = collectAncestorQuestionIds(tree, selectedNodeId);

  for (const planStepId of ancestorPlanStepIds) {
    nextViewState = expandPlanStep(nextViewState, planStepId);
  }

  for (const questionId of ancestorQuestionIds) {
    nextViewState = expandQuestionBlock(nextViewState, questionId);
  }

  nextViewState = expandNodeBody(nextViewState, selectedNodeId);

  for (const questionId of ancestorQuestionIds) {
    const questionBlock = buildQuestionBlockData(tree, questionId);

    for (const answerGroup of questionBlock.answerGroups) {
      if (
        answerGroup.historicalClosureNodes.some((node) => node.id === selectedNodeId)
      ) {
        nextViewState = expandHistorySection(
          nextViewState,
          getAnswerHistorySectionId(answerGroup.answer.id),
        );
      }
    }

    for (const summaryGroup of questionBlock.summaryGroups) {
      const isSummaryNode =
        summaryGroup.summary.id === selectedNodeId ||
        summaryGroup.latestCheckNode?.id === selectedNodeId ||
        summaryGroup.historicalCheckNodes.some((node) => node.id === selectedNodeId);

      if (!isSummaryNode) {
        continue;
      }

      if (
        summaryGroup.historicalCheckNodes.some((node) => node.id === selectedNodeId)
      ) {
        nextViewState = expandHistorySection(
          nextViewState,
          getSummaryHistorySectionId(summaryGroup.summary.id),
        );
      }
    }
  }

  return nextViewState;
}

function collectAncestorPlanStepIds(tree: NodeTree, nodeId: string) {
  const ancestorPlanStepIds: string[] = [];
  let currentNode: TreeNode | undefined = getNodeOrThrow(tree, nodeId);

  while (currentNode.parentId !== null) {
    currentNode = tree.nodes[currentNode.parentId];

    if (!currentNode) {
      break;
    }

    if (currentNode.type === 'plan-step') {
      ancestorPlanStepIds.unshift(currentNode.id);
    }
  }

  return ancestorPlanStepIds;
}

function collectAncestorQuestionIds(tree: NodeTree, nodeId: string) {
  const ancestorQuestionIds: string[] = [];
  let currentNode: TreeNode | undefined = getNodeOrThrow(tree, nodeId);

  while (currentNode) {
    if (currentNode.type === 'question') {
      ancestorQuestionIds.unshift(currentNode.id);
    }

    currentNode =
      currentNode.parentId === null
        ? undefined
        : tree.nodes[currentNode.parentId];
  }

  return ancestorQuestionIds;
}

function expandPlanStep(
  workspaceViewState: WorkspaceViewState,
  planStepNodeId: string,
) {
  if (!workspaceViewState.collapsedPlanStepIds.includes(planStepNodeId)) {
    return workspaceViewState;
  }

  return {
    ...workspaceViewState,
    collapsedPlanStepIds: workspaceViewState.collapsedPlanStepIds.filter(
      (collapsedId) => collapsedId !== planStepNodeId,
    ),
  };
}

function expandQuestionBlock(
  workspaceViewState: WorkspaceViewState,
  questionNodeId: string,
) {
  if (!workspaceViewState.collapsedQuestionBlockIds.includes(questionNodeId)) {
    return workspaceViewState;
  }

  return {
    ...workspaceViewState,
    collapsedQuestionBlockIds: workspaceViewState.collapsedQuestionBlockIds.filter(
      (collapsedId) => collapsedId !== questionNodeId,
    ),
  };
}

function expandNodeBody(
  workspaceViewState: WorkspaceViewState,
  nodeId: string,
) {
  if (!workspaceViewState.collapsedNodeBodyIds.includes(nodeId)) {
    return workspaceViewState;
  }

  return {
    ...workspaceViewState,
    collapsedNodeBodyIds: workspaceViewState.collapsedNodeBodyIds.filter(
      (collapsedId) => collapsedId !== nodeId,
    ),
  };
}

function expandHistorySection(
  workspaceViewState: WorkspaceViewState,
  sectionId: string,
) {
  if (workspaceViewState.expandedHistorySectionIds.includes(sectionId)) {
    return workspaceViewState;
  }

  return {
    ...workspaceViewState,
    expandedHistorySectionIds: [
      ...workspaceViewState.expandedHistorySectionIds,
      sectionId,
    ],
  };
}

function syncTextareaHeight(textarea: HTMLTextAreaElement | null) {
  if (!textarea) {
    return;
  }

  textarea.style.height = '0px';
  textarea.style.height = `${textarea.scrollHeight}px`;
}
