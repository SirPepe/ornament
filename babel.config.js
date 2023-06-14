/* eslint-env node */
module.exports = (api) => {
  const config = {
    presets: [
      [
        "@babel/preset-env",
        {
          modules: false,
        },
      ],
      "@babel/preset-typescript",
    ],
    plugins: [
      [
        "@babel/plugin-proposal-decorators",
        {
          version: "2023-01",
        },
      ],
    ],
  };
  const isTest = api.env("test");
  if (isTest) {
    delete config.presets[0][1].modules;
  }
  return config;
};
