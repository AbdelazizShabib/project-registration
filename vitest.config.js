import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    globals: true,
    include: ['tests/unit/**/*.{test,spec}.{js,jsx}', 'tests/component/**/*.{test,spec}.{js,jsx}'],
  },
});
