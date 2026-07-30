import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // Pure-module tests only (track compiler, prop mapping) — component
        // rendering is validated in the Expo example app. Node environment:
        // the tested modules must not touch DOM or React Native.
        environment: "node",
        include: ["src/**/*.test.ts"],
    },
});
