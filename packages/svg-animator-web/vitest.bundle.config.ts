import { defineConfig } from "vitest/config";

// Bundle-parity tests read `dist/`, so they must run AFTER a build and therefore cannot
// live in the default `test` task (turbo runs `test` before `build`). Separate config,
// separate script: `npm run test:bundle`.
export default defineConfig({
    test: {
        environment: "node",   // each test builds its own jsdom per bundle
        include: ["bundle-tests/**/*.test.ts"],
    },
});
