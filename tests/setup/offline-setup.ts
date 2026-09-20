import "fake-indexeddb/auto";
import { afterEach } from "vitest";
import { BASE_TEST_ENV, BASE_TEST_ENV_DEFAULTS, setTestEnv, setTestEnvDefaults } from "./test-env";
import { closeLocalDb } from "@/offline/db/client";

/**
 * Offline tests run the real Dexie stack against `fake-indexeddb`.
 *
 * The alternative - mocking the repositories - would test nothing that matters here.
 * The behaviour worth verifying *is* the storage behaviour: that a transaction and its
 * splits commit together, that a soft delete leaves the row in place, that the queue
 * survives a reload. None of that is observable against a mock.
 *
 * `fake-indexeddb/auto` installs `indexedDB` on `globalThis` before any test imports
 * Dexie, which is why this import must come first.
 */
setTestEnv({ ...BASE_TEST_ENV });
setTestEnvDefaults({ ...BASE_TEST_ENV_DEFAULTS });

/**
 * `localStorage` is used only for the device id. A minimal in-memory stand-in keeps the
 * jsdom dependency out of this project.
 */
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

afterEach(async () => {
  await closeLocalDb();
});
