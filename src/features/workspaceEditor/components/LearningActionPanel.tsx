import type { MouseEvent, ReactNode } from 'react';

type LearningActionButton = {
  className?: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
};

export type LearningActionSection = {
  buttons: LearningActionButton[];
  title: string;
};

type LearningActionPanelProps = {
  children?: ReactNode;
  sections: LearningActionSection[];
  testId?: string;
};

export default function LearningActionPanel({
  children,
  sections,
  testId,
}: LearningActionPanelProps) {
  const visibleSections = sections.filter((section) => section.buttons.length > 0);

  if (visibleSections.length === 0 && !children) {
    return null;
  }

  return (
    <div className="workspace-nodeActionStack" data-testid={testId}>
      {visibleSections.map((section) => (
        <section className="workspace-nodeActionSection" key={section.title}>
          <p className="workspace-nodeActionSectionTitle">{section.title}</p>
          <div className="workspace-nodeActionRow">
            {section.buttons.map((button) => (
              <button
                className={button.className ?? 'workspace-nodeActionButton'}
                disabled={button.disabled}
                key={button.label}
                onClick={handleButtonClick(button.onClick)}
                type="button"
              >
                {button.label}
              </button>
            ))}
          </div>
        </section>
      ))}
      {children}
    </div>
  );
}

function handleButtonClick(action: () => void) {
  return (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    action();
  };
}
