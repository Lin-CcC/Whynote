import { render, screen } from '@testing-library/react';

import App from './App';

test('renders the workspace editor shell', async () => {
  render(<App />);

  expect(screen.getByRole('banner', { name: /whynote/i })).toBeInTheDocument();
  expect(
    await screen.findByRole('heading', { name: '当前学习模块' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '主视图编辑流' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '当前焦点' })).toBeInTheDocument();
});
