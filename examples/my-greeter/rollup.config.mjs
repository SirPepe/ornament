import alias from "@rollup/plugin-alias";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { babel } from "@rollup/plugin-babel";

export const extensions = [".ts", ".js"];

export default {
  input: "src/main.js",
  output: {
    file: "lib/main.js",
  },
  plugins: [
    alias({
      entries: [
        { find: "@sirpepe/ornament", replacement: "../../dist/esm/index.js" },
      ],
    }),
    nodeResolve({ extensions }),
    babel({
      extensions,
      presets: [["@babel/preset-env", {}], "@babel/preset-typescript"],
      plugins: [["@babel/plugin-proposal-decorators", { version: "2023-05" }]],
      babelHelpers: "bundled",
      exclude: "node_modules/**",
    }),
  ],
};
