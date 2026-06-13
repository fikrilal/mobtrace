import { describe, expect, it } from "vitest";

import { platformSupport } from "../src/platform/support.js";

describe("platform support", () => {
  it.each([
    "linux",
    "darwin",
  ] as const)("recognizes %s as a supported POSIX host", (platform) => {
    expect(platformSupport(platform)).toMatchObject({
      platform,
      supported: true,
    });
  });

  it.each([
    "win32",
    "aix",
    "freebsd",
  ] as const)("reports %s as unsupported", (platform) => {
    expect(platformSupport(platform)).toMatchObject({
      platform,
      supported: false,
    });
  });
});
