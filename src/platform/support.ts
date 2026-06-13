export interface PlatformSupport {
  readonly platform: NodeJS.Platform;
  readonly reason: string;
  readonly supported: boolean;
}

export function platformSupport(
  platform: NodeJS.Platform = process.platform,
): PlatformSupport {
  switch (platform) {
    case "linux":
      return {
        platform,
        reason: "Linux is the primary verified MobTrace host platform.",
        supported: true,
      };
    case "darwin":
      return {
        platform,
        reason:
          "macOS uses the supported POSIX process and filesystem behavior.",
        supported: true,
      };
    default:
      return {
        platform,
        reason: `Host platform '${platform}' is not supported by MobTrace v0.1.`,
        supported: false,
      };
  }
}
