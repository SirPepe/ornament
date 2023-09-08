import alias from "@rollup/plugin-alias";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { babel } from "@rollup/plugin-babel";

const extensions = [".ts", ".js"];
const plugins = [
  alias({
    entries: [
      { find: "@sirpepe/ornament", replacement: "../dist/esm/index.js" },
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
];

export default [
  {
    input: "my-greeter/src/main.js",
    output: {
      file: "my-greeter/lib/main.js",
    },
    plugins,
  },
  {
    input: "todo-list/src/main.js",
    output: {
      file: "todo-list/lib/main.js",
    },
    plugins,
  },
  {
    input: "todo-list-typescript/src/main.js",
    output: {
      file: "todo-list-typescript/lib/main.js",
    },
    plugins,
  },
];
