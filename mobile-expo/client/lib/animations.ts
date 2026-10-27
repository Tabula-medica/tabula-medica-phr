import { Pressable } from "react-native";
import Animated, { WithSpringConfig } from "react-native-reanimated";

export const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
  energyThreshold: 0.001,
};

export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
