import { useEffect, useRef, useState, type MouseEvent } from 'react';

import type { PlanStepStatus } from '../../nodeDomain';

const PLAN_STEP_STATUS_LABELS: Record<PlanStepStatus, string> = {
  todo: '待处理',
  doing: '进行中',
  done: '已完成',
};

type PlanStepStatusMenuProps = {
  disabled: boolean;
  displayTitle: string;
  nodeId: string;
  onOpen: () => void;
  onStatusChange: (status: PlanStepStatus) => void;
  runtimeHintLines?: string[];
  status: PlanStepStatus;
};

export default function PlanStepStatusMenu({
  disabled,
  displayTitle,
  nodeId,
  onOpen,
  onStatusChange,
  runtimeHintLines = [],
  status,
}: PlanStepStatusMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isHintVisible, setIsHintVisible] = useState(false);
  const hasRuntimeHint = runtimeHintLines.length > 0;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleDocumentPointerDown(event: globalThis.MouseEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleDocumentPointerDown);
    document.addEventListener('keydown', handleDocumentKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentPointerDown);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      className="workspace-planStepStatusMenu"
      data-open={isOpen}
      data-testid={`plan-step-status-menu-${nodeId}`}
      ref={rootRef}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`${displayTitle || '步骤'} 状态：${PLAN_STEP_STATUS_LABELS[status]}`}
        className="workspace-planStepStatusBadgeButton"
        data-status={status}
        data-testid={`plan-step-status-trigger-${nodeId}`}
        disabled={disabled}
        onBlur={handleTriggerBlur}
        onClick={handleTriggerClick}
        onFocus={handleTriggerFocus}
        onMouseEnter={handleTriggerMouseEnter}
        onMouseLeave={handleTriggerMouseLeave}
        type="button"
      >
        {PLAN_STEP_STATUS_LABELS[status]}
      </button>
      {hasRuntimeHint && isHintVisible && !isOpen ? (
        <div
          className="workspace-nodeActionPopover workspace-planStepStatusHintPopover"
          role="note"
        >
          {runtimeHintLines.map((line, index) => (
            <p
              className="workspace-planStepStatusHintText"
              data-tone={index === 0 ? 'primary' : 'secondary'}
              key={line}
            >
              {line}
            </p>
          ))}
        </div>
      ) : null}
      {isOpen ? (
        <div className="workspace-nodeActionPopover" role="menu">
          <section className="workspace-nodeActionPopoverSection">
            <p className="workspace-nodeActionPopoverTitle">切换状态</p>
            <div className="workspace-nodeActionPopoverList">
              {(
                Object.keys(PLAN_STEP_STATUS_LABELS) as Array<PlanStepStatus>
              ).map((nextStatus) => (
                <button
                  className="workspace-nodeActionPopoverButton"
                  data-current={nextStatus === status}
                  key={nextStatus}
                  onClick={handleStatusButtonClick(nextStatus)}
                  type="button"
                >
                  {PLAN_STEP_STATUS_LABELS[nextStatus]}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );

  function handleTriggerClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onOpen();
    setIsHintVisible(false);
    setIsOpen((currentIsOpen) => !currentIsOpen);
  }

  function handleStatusButtonClick(nextStatus: PlanStepStatus) {
    return (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      setIsOpen(false);
      onStatusChange(nextStatus);
    };
  }

  function handleTriggerFocus() {
    if (!hasRuntimeHint || isOpen) {
      return;
    }

    setIsHintVisible(true);
  }

  function handleTriggerBlur() {
    setIsHintVisible(false);
  }

  function handleTriggerMouseEnter() {
    if (!hasRuntimeHint || isOpen) {
      return;
    }

    setIsHintVisible(true);
  }

  function handleTriggerMouseLeave() {
    setIsHintVisible(false);
  }
}
