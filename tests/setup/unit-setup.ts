import { beforeEach } from "vitest";
import { resetServerEnvCache } from "@/config/env";
import { BASE_TEST_ENV, BASE_TEST_ENV_DEFAULTS, setTestEnv, setTestEnvDefaults } from "./test-env";

/**
 * Unit tests exercise pure domain and lib code: no database, no network.
 * Config defaults are still set so modules that read env can be imported.
 */
setTestEnv({ ...BASE_TEST_ENV });
setTestEnvDefaults({ ...BASE_TEST_ENV_DEFAULTS });

beforeEach(() => {
  resetServerEnvCache();
});
