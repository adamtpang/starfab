import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Static client only. Tests run in Node with no network.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
