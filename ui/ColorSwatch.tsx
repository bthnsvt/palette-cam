import type { PaletteColor } from '@/features/palette/palette.types';
import { StyleSheet, Text, View } from 'react-native';

export default function ColorSwatch({ color }: { color: PaletteColor }) {
  return (
    <View style={styles.row}>
      <View style={[styles.box, { backgroundColor: color.hex }]} />
      <View style={styles.meta}>
        <Text style={styles.hex}>{color.hex}</Text>
        <Text style={styles.sub}>
          RGB {color.rgb[0]}, {color.rgb[1]}, {color.rgb[2]} •{' '}
          {Math.round(color.weight * 100)}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  box: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  meta: { flex: 1 },
  hex: { color: 'white', fontSize: 16, fontWeight: '700' },
  sub: { color: '#BDBDBD', marginTop: 2 },
});
