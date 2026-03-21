module.exports = function (api) {
  api.cache(true);
  let plugins = [];

  // এই line টা পরিবর্তন করুন:
  // plugins.push("react-native-worklets/plugin");  ← পুরনো, কাজ করে না
  plugins.push("react-native-reanimated/plugin");   // ← এটা দিন

  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    plugins,
  };
};
