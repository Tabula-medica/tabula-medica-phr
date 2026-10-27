module.exports = {
  preset: "jest-expo/ios",
  setupFiles: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/client/$1",
    "^@shared/(.*)$": "<rootDir>/shared/$1",
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-reanimated|react-native-gesture-handler|@shopify/.*|react-native-purchases.*))",
  ],
  testMatch: [
    "<rootDir>/client/**/__tests__/**/*.test.[jt]s?(x)",
    "<rootDir>/client/**/*.test.[jt]s?(x)",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/server/"],
  modulePathIgnorePatterns: ["<rootDir>/.cache/", "<rootDir>/dist/", "<rootDir>/server_dist/", "<rootDir>/static-build/"],
  haste: {
    forceNodeFilesystemAPI: true,
    retainAllFiles: false,
  },
};
