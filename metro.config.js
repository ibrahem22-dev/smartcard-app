const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.watchFolders = [__dirname];

config.resolver.blockList = [
  /C:\\Users\\ebrah\\AppData\\Local\\docker-secrets-engine\\.*/,
];

module.exports = config;