import { resolve } from "node:path";
import alias from "@rollup/plugin-alias";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { babel } from "@rollup/plugin-babel";

const extensions = [".ts", ".js", ".jsx"];
const plugins = [
  alias({
    entries: [
      {
        find: "@sirpepe/ornament",
        replacement: resolve(import.meta.dirname, "../dist/esm/index.js"),
      },
    ],
  }),
  nodeResolve({ extensions }),
  babel({
    extensions,
    presets: [["@babel/preset-env", {}], "@babel/preset-typescript"],
    plugins: [
      [
        "@babel/plugin-proposal-decorators",
        {
          version: "2023-11",
        },
      ],
      [
        "@babel/plugin-transform-react-jsx",
        {
          pragma: "h",
          pragmaFrag: "Fragment",
        },
      ],
    ],
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
    input: "click-counter-preact/src/main.jsx",
    output: {
      file: "click-counter-preact/lib/main.js",
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
    input: "todo-list-typescript/src/main.ts",
    output: {
      file: "todo-list-typescript/lib/main.js",
    },
    plugins,
  },
];
