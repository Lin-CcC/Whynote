import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setupTests.ts',
  },
});
