process.env.EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED = "true";

jest.mock("react-native-reanimated", () => {
  const View = require("react-native").View;
  const passthrough = ({ children, style }) => {
    const React = require("react");
    return React.createElement(View, { style }, children);
  };
  const animatedFn = () => {
    const obj = {
      duration: () => obj,
      springify: () => obj,
      damping: () => obj,
      stiffness: () => obj,
      delay: () => obj,
      withCallback: () => obj,
    };
    return obj;
  };
  return {
    __esModule: true,
    default: {
      View: passthrough,
      createAnimatedComponent: (c) => c,
    },
    View: passthrough,
    FadeIn: animatedFn(),
    FadeOut: animatedFn(),
    FadeInDown: animatedFn(),
    FadeInUp: animatedFn(),
    FadeOutDown: animatedFn(),
    FadeOutUp: animatedFn(),
    SlideInDown: animatedFn(),
    SlideOutDown: animatedFn(),
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: (cb) => cb(),
    withTiming: (v) => v,
    withSpring: (v) => v,
    runOnJS: (fn) => fn,
  };
});

jest.mock("expo-blur", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    BlurView: ({ children, style }) => React.createElement(View, { style }, children),
  };
});

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Icon = ({ name }) => React.createElement(Text, null, `icon:${name}`);
  return {
    Feather: Icon,
    Ionicons: Icon,
    MaterialIcons: Icon,
    MaterialCommunityIcons: Icon,
    AntDesign: Icon,
    FontAwesome: Icon,
    FontAwesome5: Icon,
    Entypo: Icon,
  };
});

jest.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      primary: "#0A84FF",
      backgroundDefault: "#FFFFFF",
      glassModal: "#1C1C1E",
      glassBorder: "#E5E5EA",
      textSecondary: "#8E8E93",
    },
    isDark: false,
    highContrast: false,
    largeText: false,
    fontScale: 1,
    reducedMotion: false,
  }),
}));
