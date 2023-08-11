import babelConfig from "./babel.config.mjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { babel } from "@rollup/plugin-babel";
import terser from "@rollup/plugin-terser";

export const extensions = [".ts", ".js"];

const commonConfig = {
  plugins: [
    nodeResolve({ extensions }),
    babel({
      extensions,
      ...babelConfig,
      babelHelpers: "bundled",
      exclude: "node_modules/**",
    }),
  ],
};

export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/esm/index.js",
      format: "esm",
    },
    external: ["zod"],
    ...commonConfig,
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/min/index.min.js",
      format: "umd",
      name: "Ornament",
      plugins: [terser()],
    },
    ...commonConfig,
  },
];
