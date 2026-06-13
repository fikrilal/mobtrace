import { describe, expect, it } from "vitest";

import { rankSuspiciousChanges } from "../src/diagnosis/rank.js";

const changedFiles = (paths: readonly string[]) =>
  paths.map((path) => ({
    path,
    staged: false,
    status: "modified",
    unstaged: true,
  }));

describe("suspicious change ranking", () => {
  it("ranks an exact changed selector and Maestro flow first", () => {
    const result = rankSuspiciousChanges({
      changedFiles: changedFiles([
        "lib/features/auth/login_page.dart",
        ".maestro/flows/login.yaml",
      ]),
      diff: `diff --git a/lib/features/auth/login_page.dart b/lib/features/auth/login_page.dart
+const key = "other";
diff --git a/.maestro/flows/login.yaml b/.maestro/flows/login.yaml
- assertVisible: old_home
+ assertVisible: home_screen`,
      failedSelector: "home_screen",
      failureClass: "selector-mismatch",
    });

    expect(result[0]).toMatchObject({
      path: ".maestro/flows/login.yaml",
      rank: 1,
      reasons: expect.arrayContaining([
        expect.objectContaining({ code: "changed-selector" }),
        expect.objectContaining({ code: "changed-flow" }),
      ]),
    });
  });

  it("ranks API payload and repository changes for backend failures", () => {
    const result = rankSuspiciousChanges({
      changedFiles: changedFiles([
        "lib/features/auth/presentation/login_page.dart",
        "lib/features/auth/data/auth_repository.dart",
      ]),
      diff: `diff --git a/lib/features/auth/presentation/login_page.dart b/lib/features/auth/presentation/login_page.dart
+const label = "Login";
diff --git a/lib/features/auth/data/auth_repository.dart b/lib/features/auth/data/auth_repository.dart
-final payload = {"email": email};
+final payload = {"username": email};`,
      failedSelector: null,
      failureClass: "backend-http-error",
    });

    expect(result[0]).toMatchObject({
      path: "lib/features/auth/data/auth_repository.dart",
      reasons: expect.arrayContaining([
        expect.objectContaining({ code: "changed-api-contract" }),
        expect.objectContaining({ code: "api-layer-path" }),
      ]),
    });
  });

  it("ranks route and session hunks for navigation failures", () => {
    const result = rankSuspiciousChanges({
      changedFiles: changedFiles([
        "lib/features/home/widget.dart",
        "lib/navigation/auth_router.dart",
      ]),
      diff: `diff --git a/lib/features/home/widget.dart b/lib/features/home/widget.dart
+const title = "Home";
diff --git a/lib/navigation/auth_router.dart b/lib/navigation/auth_router.dart
-return loginRoute;
+return session.isValid ? homeRoute : loginRoute;`,
      failedSelector: null,
      failureClass: "app-did-not-navigate",
    });

    expect(result[0]).toMatchObject({
      path: "lib/navigation/auth_router.dart",
      reasons: expect.arrayContaining([
        expect.objectContaining({ code: "changed-navigation-session" }),
      ]),
    });
  });

  it("ranks fixture cleanup changes for cleanup failures", () => {
    const result = rankSuspiciousChanges({
      changedFiles: changedFiles([
        "tool/create_user.sh",
        "tool/cleanup_fixture.sh",
      ]),
      diff: `diff --git a/tool/create_user.sh b/tool/create_user.sh
+echo create
diff --git a/tool/cleanup_fixture.sh b/tool/cleanup_fixture.sh
-delete_fixture "$ID"
+delete_test_user "$ID"`,
      failedSelector: null,
      failureClass: "fixture-cleanup-failed",
    });

    expect(result[0]).toMatchObject({
      path: "tool/cleanup_fixture.sh",
      reasons: expect.arrayContaining([
        expect.objectContaining({ code: "changed-fixture-lifecycle" }),
      ]),
    });
  });

  it("uses bytewise path ordering for equal scores", () => {
    const result = rankSuspiciousChanges({
      changedFiles: changedFiles(["z.dart", "a.dart", "m.dart"]),
      diff: "",
      failedSelector: null,
      failureClass: "unknown",
    });

    expect(result.map((entry) => entry.path)).toEqual([
      "a.dart",
      "m.dart",
      "z.dart",
    ]);
    expect(result.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  it("does not rank source files for device infrastructure failures", () => {
    const result = rankSuspiciousChanges({
      changedFiles: changedFiles(["lib/features/auth/login_page.dart"]),
      diff: `diff --git a/lib/features/auth/login_page.dart b/lib/features/auth/login_page.dart
+const title = "Login";`,
      failedSelector: null,
      failureClass: "device-not-ready",
    });

    expect(result).toEqual([]);
  });

  it("produces byte-equivalent rankings for repeated inputs", () => {
    const input = {
      changedFiles: changedFiles(["b.dart", "a.dart"]),
      diff: "",
      failedSelector: null,
      failureClass: "unknown" as const,
    };

    expect(JSON.stringify(rankSuspiciousChanges(input))).toBe(
      JSON.stringify(rankSuspiciousChanges(input)),
    );
  });
});
