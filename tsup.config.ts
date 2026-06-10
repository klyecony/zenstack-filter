import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    createFilterSystem: "src/createFilterSystem.ts",
    types: "src/types.ts",
    operators: "src/operators.ts",
    registry: "src/registry.ts",
    build: "src/build.ts",
    schema: "src/schema.ts",
    generate: "src/generate.ts",
    merge: "src/merge.ts",
    validate: "src/validate.ts",
    recentStore: "src/recentStore.ts",
    useFilter: "src/useFilter.ts",
    useFilterViews: "src/useFilterViews.ts",
    useFilterOptions: "src/useFilterOptions.ts",
    dates: "src/dates.ts",
    infiniteSource: "src/infiniteSource.ts",
    plugin: "src/plugin.ts",
  },
  format: ["esm"],
  dts: true,
  // No code-splitting: keeps each entry self-contained so leading "use client"
  // directives survive (splitting hoists them into shared chunks, dropping them).
  // The package is small enough that inlining shared internals is negligible.
  splitting: false,
  clean: true,
  treeshake: true,
  // Peers — never bundle these into the output.
  external: [
    "react",
    "zod",
    "@zenstackhq/orm",
    "@zenstackhq/schema",
    "@zenstackhq/sdk",
    "@zenstackhq/language",
  ],
  // esbuild drops module-level directives when bundling; we re-add "use client"
  // to the React entries in onSuccess, so silence the warning here.
  esbuildOptions(options) {
    options.logOverride = { ...options.logOverride, "ignored-bare-import": "silent" };
  },
  async onSuccess() {
    const { readFile, writeFile } = await import("node:fs/promises");
    const clientEntries = ["useFilter", "useFilterViews", "useFilterOptions", "infiniteSource"];
    for (const name of clientEntries) {
      const file = `dist/${name}.js`;
      const code = await readFile(file, "utf8");
      if (!code.startsWith('"use client"')) {
        await writeFile(file, `"use client";\n${code}`);
      }
    }
  },
});
