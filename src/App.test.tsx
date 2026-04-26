import { render, screen } from '@testing-library/react';

import App from './App';

test('renders the minimal app shell placeholders', () => {
  render(<App />);

  expect(screen.getByRole('banner', { name: /whynote/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '结构视图占位' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '文本主视图占位' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '资料区占位' })).toBeInTheDocument();
});
