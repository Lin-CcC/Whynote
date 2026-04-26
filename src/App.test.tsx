import { render, screen } from '@testing-library/react';

import App from './App';

test('renders the workspace editor shell', () => {
  render(<App />);

  expect(screen.getByRole('banner', { name: /whynote/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '当前学习模块' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '文本主视图' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '当前焦点' })).toBeInTheDocument();
});
