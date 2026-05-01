import {
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type LearningActionButton = {
  className?: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  title?: string;
};

export type LearningActionSection = {
  buttons: LearningActionButton[];
  title: string;
};

export type LearningActionSurface = 'answer' | 'content' | 'question';

type LearningActionMenuSection = {
  buttons: LearningActionButton[];
  title: string;
};

type LearningActionToolbarItem =
  | {
      button: LearningActionButton;
      id: string;
      kind: 'button';
      label: string;
    }
  | {
      id: string;
      kind: 'menu';
      label: string;
      sections: LearningActionMenuSection[];
    };

type LearningActionPanelProps = {
  isVisible: boolean;
  sections: LearningActionSection[];
  surface: LearningActionSurface;
  testId?: string;
};

export default function LearningActionPanel({
  isVisible,
  sections,
  surface,
  testId,
}: LearningActionPanelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const { items, overflowSections } = useMemo(
    () => buildToolbarModel(surface, sections),
    [sections, surface],
  );
  const hasOverflowMenu = overflowSections.some(
    (section) => section.buttons.length > 0,
  );

  useEffect(() => {
    if (!isVisible) {
      setOpenMenuId(null);
    }
  }, [isVisible]);

  useEffect(() => {
    if (!openMenuId) {
      return;
    }

    function handleDocumentPointerDown(event: globalThis.MouseEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpenMenuId(null);
      }
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenMenuId(null);
      }
    }

    document.addEventListener('mousedown', handleDocumentPointerDown);
    document.addEventListener('keydown', handleDocumentKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentPointerDown);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [openMenuId]);

  if (items.length === 0 && !hasOverflowMenu) {
    return null;
  }

  return (
    <div
      className="workspace-nodeActionToolbar"
      data-testid={testId}
      data-visible={isVisible}
      ref={rootRef}
    >
      <div className="workspace-nodeActionToolbarRow">
        {items.map((item) =>
          item.kind === 'button'
            ? renderToolbarButton(item)
            : renderToolbarMenu(item),
        )}
        {hasOverflowMenu ? renderOverflowMenu() : null}
      </div>
    </div>
  );

  function renderToolbarButton(item: Extract<LearningActionToolbarItem, { kind: 'button' }>) {
    return (
      <button
        className={item.button.className ?? 'workspace-nodeActionChip'}
        disabled={item.button.disabled}
        key={item.id}
        onClick={handleToolbarButtonClick(item.button.onClick)}
        title={item.button.title}
        type="button"
      >
        {item.label}
      </button>
    );
  }

  function renderToolbarMenu(item: Extract<LearningActionToolbarItem, { kind: 'menu' }>) {
    const isOpen = openMenuId === item.id;
    const isDisabled = item.sections.every((section) =>
      section.buttons.every((button) => button.disabled),
    );

    return (
      <div
        className="workspace-nodeActionMenu"
        data-open={isOpen}
        key={item.id}
      >
        <button
          aria-expanded={isOpen}
          aria-haspopup="menu"
          className="workspace-nodeActionChip"
          disabled={isDisabled}
          onClick={toggleMenu(item.id)}
          type="button"
        >
          {item.label}
          <span aria-hidden="true" className="workspace-nodeActionChevron">
            ▾
          </span>
        </button>
        {isOpen ? (
          <div className="workspace-nodeActionPopover" role="menu">
            {item.sections.map((section) => (
              <section
                className="workspace-nodeActionPopoverSection"
                key={`${item.id}-${section.title}`}
              >
                <p className="workspace-nodeActionPopoverTitle">{section.title}</p>
                <div className="workspace-nodeActionPopoverList">
                  {section.buttons.map((button) => (
                    <button
                      className="workspace-nodeActionPopoverButton"
                      disabled={button.disabled}
                      key={button.label}
                      onClick={handleMenuButtonClick(button.onClick)}
                      title={button.title}
                      type="button"
                    >
                      {button.label}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  function renderOverflowMenu() {
    const isOpen = openMenuId === 'overflow';

    return (
      <div className="workspace-nodeActionMenu" data-open={isOpen}>
        <button
          aria-expanded={isOpen}
          aria-haspopup="menu"
          className="workspace-nodeActionChip"
          onClick={toggleMenu('overflow')}
          type="button"
        >
          ⋯
        </button>
        {isOpen ? (
          <div className="workspace-nodeActionPopover" role="menu">
            {overflowSections.map((section) => (
              <section
                className="workspace-nodeActionPopoverSection"
                key={`overflow-${section.title}`}
              >
                <p className="workspace-nodeActionPopoverTitle">{section.title}</p>
                <div className="workspace-nodeActionPopoverList">
                  {section.buttons.map((button) => (
                    <button
                      className="workspace-nodeActionPopoverButton"
                      disabled={button.disabled}
                      key={button.label}
                      onClick={handleMenuButtonClick(button.onClick)}
                      title={button.title}
                      type="button"
                    >
                      {button.label}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  function toggleMenu(menuId: string) {
    return (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      setOpenMenuId((currentMenuId) => (currentMenuId === menuId ? null : menuId));
    };
  }

  function handleToolbarButtonClick(action: () => void) {
    return (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      action();
    };
  }

  function handleMenuButtonClick(action: () => void) {
    return (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      setOpenMenuId(null);
      action();
    };
  }
}

function buildToolbarModel(
  surface: LearningActionSurface,
  sections: LearningActionSection[],
) {
  const remainingButtons = sections.flatMap((section) => section.buttons);
  const toolbarItems: LearningActionToolbarItem[] = [];

  const answerMenuSections = createVerbMenuSections([
    ['AI', takeButton(remainingButtons, '直接回答当前问题')],
    ['手动', takeButton(remainingButtons, '插入回答')],
  ]);
  const followUpMenuSections = createVerbMenuSections([
    ['AI', takeButton(remainingButtons, '生成追问')],
    ['手动', takeButton(remainingButtons, '插入追问')],
  ]);
  const summaryMenuSections = createVerbMenuSections([
    ['AI', takeButton(remainingButtons, '生成总结')],
    ['手动', takeButton(remainingButtons, '插入总结')],
  ]);
  const reevaluateButton = takeButton(remainingButtons, '重新评估当前回答');

  if (surface === 'question' && answerMenuSections.length > 0) {
    toolbarItems.push({
      id: 'answer',
      kind: 'menu',
      label: '回答',
      sections: answerMenuSections,
    });
  }

  if (surface === 'answer') {
    toolbarItems.push({
      button:
        reevaluateButton ??
        createDisabledToolbarButton('评估', '只有当前回答可以重新评估。'),
      id: 'evaluate',
      kind: 'button',
      label: '评估',
    });
  }

  if (followUpMenuSections.length > 0) {
    toolbarItems.push({
      id: 'follow-up',
      kind: 'menu',
      label: '追问',
      sections: followUpMenuSections,
    });
  }

  if (summaryMenuSections.length > 0) {
    toolbarItems.push({
      id: 'summary',
      kind: 'menu',
      label: '总结',
      sections: summaryMenuSections,
    });
  }

  return {
    items: toolbarItems,
    overflowSections: remainingButtons.length
      ? [
          {
            buttons: remainingButtons,
            title: '更多',
          },
        ]
      : [],
  };
}

function createVerbMenuSections(
  entries: Array<[title: string, button: LearningActionButton | null]>,
) {
  return entries.flatMap(([title, button]) =>
    button
      ? [
          {
            buttons: [button],
            title,
          },
        ]
      : [],
  );
}

function takeButton(
  buttons: LearningActionButton[],
  label: string,
) {
  const buttonIndex = buttons.findIndex((button) => button.label === label);

  if (buttonIndex === -1) {
    return null;
  }

  return buttons.splice(buttonIndex, 1)[0] ?? null;
}

function createDisabledToolbarButton(label: string, title: string) {
  return {
    disabled: true,
    label,
    onClick() {},
    title,
  } satisfies LearningActionButton;
}
