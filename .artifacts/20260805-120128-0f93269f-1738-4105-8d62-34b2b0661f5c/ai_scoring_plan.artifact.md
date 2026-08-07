# AI Auto-Scoring & Camera Detection Plan

To match Dartsmind's accuracy and functionality, we will implement real-time computer vision detection to automatically score darts thrown at the board.

## User Review Required

- **Calibration Style**: Should we use "Three-Point Calibration" (center, top, side) for better perspective correction, or keep the simple "Center + Radius" model?
- **Platform Support**: Priority is Android (Kotlin) and iOS (Swift). Do you have specific hardware (tripods/mounting) you expect players to use?

## Proposed Changes

### [Native Android Implementation]

Refine `DartDetectionActivity.kt` to move from "simulation" to actual Computer Vision.

#### `ImageAnalyzer` logic
- **Frame Differencing**: Compare consecutive frames to detect the "arrival" of a dart.
- **Motion Thresholding**: Ignore minor lighting changes; only trigger when a large enough "streak" (the dart) appears.
- **Dart Tip Extraction**: Identify the pixel coordinate where the dart meets the board.
- **Perspective Warping**: Map pixel coordinates to a perfect circle using the calibration data.

---

### [Native iOS Implementation]

Implement the same logic for iPhone/iPad support.

#### `DartDetectionPlugin.swift`
- Create a Capacitor plugin for iOS.
- Use **AVFoundation** for camera access.
- Use **Vision Framework** or custom Metal shaders for real-time frame subtraction.

---

### [Web Integration]

#### [PlayOnline.jsx](file:///C:/Developer/Elite-Arrows/src/pages/PlayOnline.jsx)
- **Calibration Mode**: UI to guide the user through setting up the board.
- **Real-time Feedback**: Display a "Dart Detected" animation when the native layer sends a score event.

---

### [Orientation & Layout]

- **Orientation Handling**: Native activities will support automatic rotation (Portrait/Landscape).
- **iPad Optimization**: Utilize the larger screen for side-by-side stats and camera feed.

## Technical Approach: Dart Detection Algorithm

1. **Step 1: Calibration**: Store the coordinates of the Bullseye and the Double-Out ring.
2. **Step 2: Monitoring**: Maintain a "clean" background image of the board.
3. **Step 3: Trigger**: When a new dart lands, find the difference between the "clean" image and the current frame.
4. **Step 4: Location**: Find the centroid or tip of the newly appeared object.
5. **Step 5: Score**: Convert pixels -> angle/distance -> board segment.

## Verification Plan

### Manual Verification
1. **Calibration**: Verify the "Center + Top" mapping correctly identifies T20.
2. **Detection**: Throw 3 darts manually. Verify the app scores them without user input.
3. **Orientation**: Rotate the device 90 degrees and verify detection remains accurate.
