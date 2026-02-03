import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ViewShot from 'react-native-view-shot';

import ColorSwatch from '@/ui/ColorSwatch';
import PaletteModeSwitch from '@/ui/PaletteModeSwitch';
import PrimaryButton from '@/ui/PrimaryButton';

import { extractPaletteFromPhotoUri } from '../features/palette/palette.extractor';
import type {
  PaletteColor,
  PaletteMode,
} from '../features/palette/palette.types';

type Palettes = {
  natural: PaletteColor[];
  artwork: PaletteColor[];
};

export default function CameraScreen() {
  const cameraRef = useRef<CameraView>(null);

  // ✅ Screenshot alınacak alanın ref’i
  const shotRef = useRef<any>(null);

  const [permission, requestPermission] = useCameraPermissions();

  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [mode, setMode] = useState<PaletteMode>('artwork');
  const [palettes, setPalettes] = useState<Palettes | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) requestPermission();
  }, [permission, requestPermission]);

  async function handleCapture() {
    try {
      setError(null);
      setPalettes(null);
      setIsCapturing(true);

      const cam = cameraRef.current;
      if (!cam) throw new Error('Camera not ready');

      const photo = await cam.takePictureAsync({
        quality: 1,
        skipProcessing: false,
      });

      setPhotoUri(photo.uri);

      const natural = await extractPaletteFromPhotoUri(photo.uri, {
        colorCount: 8,
        mode: 'natural',
      });

      const artwork = await extractPaletteFromPhotoUri(photo.uri, {
        colorCount: 8,
        mode: 'artwork',
      });

      setPalettes({ natural, artwork });
      setMode('artwork');
    } catch (e: any) {
      setError(e?.message ?? 'Unknown error');
    } finally {
      setIsCapturing(false);
    }
  }

  function handleNewPhoto() {
    setError(null);
    setPalettes(null);
    setPhotoUri(null);
    setMode('artwork');
  }

  async function handleSaveScreenshot() {
    try {
      if (!shotRef.current) throw new Error('Screenshot view not ready');

      setIsSaving(true);

      // 1) Medya izni iste
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission needed',
          'Please allow photo library access to save.'
        );
        return;
      }

      // 2) Ekran görüntüsü al (sadece preview+palet alanı)
      const uri = await shotRef.current?.capture();
      if (!uri) throw new Error('Failed to capture screenshot');

      // 3) Galeriye kaydet
      await MediaLibrary.saveToLibraryAsync(uri);

      Alert.alert('Saved', 'Screenshot saved to your Photos.');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.text}>Checking camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Camera permission needed</Text>
        <Text style={styles.text}>
          We need camera access to extract a color palette.
        </Text>
        <PrimaryButton label='Allow camera' onPress={requestPermission} />
      </View>
    );
  }

  const modeHint =
    mode === 'natural'
      ? 'Natural shows the real color distribution from the photo (background can dominate).'
      : 'Artwork highlights dominant and expressive colors by reducing flat background tones.';

  const currentPalette = palettes ? palettes[mode] : null;

  const canSave = Boolean(photoUri && palettes && !isCapturing);

  return (
    <View style={styles.container}>
      {/* ✅ Screenshot alınacak alan: preview + palet */}
      <ViewShot
        ref={shotRef}
        style={styles.shotArea}
        options={{
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        }}
      >
        {/* Üst kısım: kamera veya preview */}
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.preview} />
        ) : (
          <CameraView ref={cameraRef} style={styles.camera} facing='back' />
        )}

        {/* Alt panel: palet vs */}
        <View style={styles.panel}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {palettes ? (
            <>
              <PaletteModeSwitch mode={mode} onChange={setMode} />
              <Text style={styles.modeHint}>{modeHint}</Text>

              <ScrollView contentContainerStyle={styles.paletteWrap}>
                {currentPalette?.map((c) => (
                  <ColorSwatch key={`${mode}-${c.hex}`} color={c} />
                ))}
              </ScrollView>
            </>
          ) : (
            <Text style={styles.hint}>
              {photoUri
                ? 'Extracting palette…'
                : 'Take a photo. After capture, you will see the photo + the extracted palette.'}
            </Text>
          )}
        </View>
      </ViewShot>

      {/* ✅ Screenshot içine girmesin diye butonları shotArea DIŞINA koyduk */}
      <View style={styles.actions}>
        {!photoUri ? (
          <PrimaryButton
            label={isCapturing ? 'Processing…' : 'Take photo & extract palette'}
            onPress={handleCapture}
            disabled={isCapturing}
          />
        ) : (
          <>
            <PrimaryButton label='New photo' onPress={handleNewPhoto} />
            <PrimaryButton
              label={isSaving ? 'Saving…' : 'Save screenshot to gallery'}
              onPress={handleSaveScreenshot}
              disabled={!canSave || isSaving}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0B' },

  // Screenshot alanı (butonlar hariç her şey)
  shotArea: { flex: 1 },

  camera: { flex: 1 },
  preview: { flex: 1, width: '100%', resizeMode: 'cover' },

  panel: {
    padding: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2A2A',
    backgroundColor: '#0B0B0B',
  },

  // Butonlar screenshot’a dahil olmasın diye altta ayrı alan
  actions: {
    padding: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2A2A',
    backgroundColor: '#0B0B0B',
  },

  hint: { color: '#BDBDBD', lineHeight: 20 },
  modeHint: { color: '#9A9A9A', fontSize: 12, lineHeight: 16 },
  error: { color: '#FF6B6B' },
  paletteWrap: { gap: 10, paddingTop: 8, paddingBottom: 20 },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 10,
  },
  title: { fontSize: 18, color: 'white', fontWeight: '600' },
  text: { color: '#BDBDBD', textAlign: 'center', lineHeight: 20 },
});
