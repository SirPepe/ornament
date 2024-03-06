/* eslint-env node */

const config = {
  presets: [["@babel/preset-env", {}], "@babel/preset-typescript"],
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
