import { StyleSheet } from 'react-native';

// Must run at module load — before any component mounts
export const rtl = StyleSheet.create({
  // ─── Text & Input ───────────────────────────────────────────
  // Use on every <Text> with Hebrew or Arabic content
  text: {
    textAlign: 'right',
  },

  // Use on every <TextInput> with Hebrew or Arabic
  input: {
    textAlign: 'right',
  },

  // ─── Layout ─────────────────────────────────────────────────
  // Use on top-level screen <View> containers (NOT on ScrollView)
  screen: {
    flex: 1,
  },

  // Use on horizontal <View> rows: [icon + label] or [label + value]
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },

  // ─── ScrollView ──────────────────────────────────────────────
  // scrollOuter → goes on ScrollView's `style` prop ONLY
  // Rule: NO layout props here (no alignItems, no flexDirection, no padding)
  scrollOuter: {
    flex: 1,
  },

  // scrollInner → goes on ScrollView's `contentContainerStyle` prop ONLY
  // Rule: NEVER put this on `style` prop — causes Invariant Violation crash
  scrollInner: {
    flexGrow: 1,
    paddingBottom: 24,
    // NOTE: No alignItems here — RTL text alignment is handled per-Text with rtl.text
    // Adding alignItems:'flex-end' to contentContainerStyle conflicts with
    // NativeWind's CSSInterop.ScrollView on Android and triggers layout warnings
  },

  // ─── FlatList ────────────────────────────────────────────────
  // listInner → goes on FlatList's `contentContainerStyle` prop ONLY
  listInner: {
    flexGrow: 1,
  },
});
