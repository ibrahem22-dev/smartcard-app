/**
 * JS-only stub so NativeWind/css-interop can bundle without the native
 * react-native-reanimated module (no npx expo run:android rebuild required).
 * Animation utility classes are unsupported with this shim.
 */
function useAnimatedStyle(factory) {
  return factory();
}

function createAnimatedComponent(Component) {
  return Component;
}

module.exports = {
  __esModule: true,
  default: {
    createAnimatedComponent,
  },
  useAnimatedStyle,
  createAnimatedComponent,
};
