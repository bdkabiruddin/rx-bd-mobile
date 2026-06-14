// Babel config for Expo + Expo Router.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated/worklets plugin must be last when added.
    ],
  };
};
