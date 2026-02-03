# palette-cam

Camera-based color palette extractor built with Expo + TypeScript.

Take a photo of an object/artwork and get dominant colors as a palette. Includes **two modes**:

- **Natural**: shows the real color distribution in the photo (background can dominate).
- **Artwork**: emphasizes expressive colors by reducing flat background tones and surfacing an “accent color family”.

## Demo

- Take a photo → the captured photo stays on screen
- Switch between Natural / Artwork
- Save a screenshot (photo + palette) to your gallery
- Tap “New photo” to return to the camera

## Features

- Capture with `expo-camera`
- Dominant palette extraction (K-Means clustering in LAB color space)
- Two palette modes: Natural vs Artwork
- Save screenshot to Photos (gallery)
- Clean structure (feature-based folders)

## Tech Stack

- Expo (React Native)
- TypeScript
- `expo-camera`
- `expo-image-manipulator`
- `jpeg-js`
- `expo-media-library`
- `react-native-view-shot`

## Getting Started

### 1) Install

```bash
npm install
