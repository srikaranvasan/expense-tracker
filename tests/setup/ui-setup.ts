import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { BASE_TEST_ENV, BASE_TEST_ENV_DEFAULTS, setTestEnv, setTestEnvDefaults } from "./test-env";

setTestEnv({ ...BASE_TEST_ENV });
setTestEnvDefaults({ ...BASE_TEST_ENV_DEFAULTS });

afterEach(() => {
  cleanup();
});
