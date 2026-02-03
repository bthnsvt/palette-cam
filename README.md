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

### Install

`npm install`

### Run

`npx expo start`

Then scan the QR code with the Expo Go app or run on an iOS simulator.

## Project Structure

app/
  _layout.tsx
  index.tsx

features/
  palette/
    palette.types.ts
    palette.extractor.ts
    color.utils.ts

camera/
  CameraScreen.tsx

ui/
  ColorSwatch.tsx
  PrimaryButton.tsx
  PaletteModeSwitch.tsx

assets/
  images/

# What I Learned?

Managing camera permissions and capture flow in Expo
Converting images to JPEG and decoding raw pixel data
Why LAB color space is more suitable than RGB for perceptual color clustering
Implementing K-Means clustering for dominant color extraction
Designing algorithm behavior based on product needs (Natural vs Artwork)
Capturing UI screenshots and saving them to the device gallery
Structuring a React Native project using feature-based architecture

# Notes on AI-assisted Development

This project was developed with AI-assisted tools used as a productivity aid.
All architectural decisions, UX design choices, and algorithm tuning were implemented, reviewed, and validated by me.
