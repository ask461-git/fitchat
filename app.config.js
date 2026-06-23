// @ts-check
/** @type {import('expo/config').ExpoConfig} */
export default {
  name: 'FitChat',
  slug: 'fitchat',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0D0D0D',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0D0D0D',
    },
    package: 'com.fitchat.app',
    permissions: ['INTERNET'],
  },
  plugins: ['expo-sqlite'],
  extra: {
    // Stamped at config-evaluation time (i.e. at build time). Displayed on the
    // splash/loading screen via expo-constants.
    buildTime: new Date().toISOString(),
    eas: {
      projectId: '9aeae0cb-40de-47e1-86c7-17fd83860ba4',
    },
  },
};
