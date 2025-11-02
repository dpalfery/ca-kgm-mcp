import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '5-Tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      '*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', // Exclude root-level tests
      'test-*.{js,mjs,cjs,ts}', // Exclude test-* files in root
      'debug-*.{js,mjs,cjs,ts}' // Exclude debug-* files in root
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts'
      ]
    },
    outputFile: {
      json: '5-Tests/test-results.json',
      junit: '5-Tests/test-results.xml'
    }
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname
    }
  }
});