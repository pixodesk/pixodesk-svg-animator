import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['docs.test.ts'],
        // One TS program over five .d.ts files is built once per run; give it room.
        testTimeout: 60_000,
        hookTimeout: 60_000,
    },
});
