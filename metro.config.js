const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Allow Metro to bundle .tflite model files as assets (for react-native-fast-tflite)
config.resolver.assetExts.push("tflite");

module.exports = config;
