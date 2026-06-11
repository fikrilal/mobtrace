import packageManifest from "../package.json" with { type: "json" };

export const MOBTRACE_VERSION = packageManifest.version;
