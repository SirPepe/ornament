/* eslint-env node */

const config = {
  presets: [
    ["@babel/preset-env", {}],
    ["@babel/preset-typescript", { allowDeclareFields: true }],
    // See https://github.com/babel/babel/issues/16373#issuecomment-2013163733
  ],
};

if (process.env.NODE_ENV === "test") {
  config.plugins = [
    [
      "@babel/plugin-proposal-decorators",
      {
        version: "2023-11",
      },
    ],
  ];
}

export default config;
