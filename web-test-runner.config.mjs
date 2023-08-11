import babelConfig from "./babel.config.mjs";
import { fromRollup } from "@web/dev-server-rollup";
import { babel } from "@rollup/plugin-babel";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { extensions } from "./rollup.config.mjs";

const babelPlugin = fromRollup(babel);
const nodeResolvePlugin = fromRollup(nodeResolve);

export default {
  mimeTypes: {
    "**/*.ts": "js",
  },
  plugins: [
    nodeResolvePlugin({ extensions }),
    babelPlugin({
      extensions,
      ...babelConfig,
      babelHelpers: "bundled",
      exclude: "node_modules/**",
    }),
  ],
};
