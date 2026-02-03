import type { PaletteMode } from '@/features/palette/palette.types';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  mode: PaletteMode;
  onChange: (m: PaletteMode) => void;
};

export default function PaletteModeSwitch({ mode, onChange }: Props) {
  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.btn, mode === 'natural' && styles.active]}
        onPress={() => onChange('natural')}
      >
        <Text style={styles.text}>Natural</Text>
      </Pressable>

      <Pressable
        style={[styles.btn, mode === 'artwork' && styles.active]}
        onPress={() => onChange('artwork')}
      >
        <Text style={styles.text}>Artwork</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1C',
    borderRadius: 12,
    overflow: 'hidden',
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  active: {
    backgroundColor: '#2E2E2E',
  },
  text: {
    color: 'white',
    fontWeight: '500',
  },
});
