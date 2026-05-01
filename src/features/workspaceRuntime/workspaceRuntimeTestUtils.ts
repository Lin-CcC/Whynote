import { fireEvent, screen } from '@testing-library/react';

export function getTitleControl(displayTitle: string) {
  return screen.getByLabelText(`${displayTitle} 标题`);
}

export function getTitleInput(displayTitle: string) {
  let control = getTitleControl(displayTitle);

  if (control instanceof HTMLButtonElement) {
    fireEvent.click(control);
    control = getTitleControl(displayTitle);
  }

  if (!(control instanceof HTMLInputElement)) {
    throw new Error(`Unable to find title input for "${displayTitle}".`);
  }

  return control;
}

export function selectNodeByTitle(displayTitle: string) {
  const control = getTitleControl(displayTitle);

  if (control instanceof HTMLButtonElement) {
    fireEvent.click(control);
    return getTitleControl(displayTitle);
  }

  fireEvent.focus(control);
  return control;
}

export function getNodeByDisplayTitle(displayTitle: string) {
  const control = getTitleControl(displayTitle);
  const node = control.closest('section[data-testid^="editor-node-"]');

  if (!(node instanceof HTMLElement)) {
    throw new Error(`Unable to find editor node for "${displayTitle}".`);
  }

  return node;
}

export async function findNodeByDisplayTitle(displayTitle: string) {
  const control = await screen.findByLabelText(`${displayTitle} 标题`);
  const node = control.closest('section[data-testid^="editor-node-"]');

  if (!(node instanceof HTMLElement)) {
    throw new Error(`Unable to find editor node for "${displayTitle}".`);
  }

  return node;
}
