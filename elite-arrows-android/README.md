# Elite Arrows Android App (TWA)

Trusted Web Activity wrapper for the Elite Arrows PWA.

## Setup Instructions

### 1. Add google-services.json
Place your `google-services.json` file in this directory (`elite-arrows-android/app/`).

### 2. Open in Android Studio
1. Open Android Studio
2. File → Open → Select the `elite-arrows-android` folder
3. Wait for Gradle sync to complete

### 3. Configure Signing
1. In Android Studio: Build → Generate Signed Bundle / APK
2. Select "Android App Bundle"
3. Create new keystore or use existing one
4. Remember the SHA-256 fingerprint (needed for assetlinks.json)

### 4. Update assetlinks.json
After generating your keystore, extract the SHA-256:
```bash
keytool -list -v -keystore YOUR_KEYSTORE.jks -alias YOUR_ALIAS
```

Update `../public/.well-known/assetlinks.json` with your SHA-256:
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.elitearrows.app",
    "sha256_cert_fingerprints": ["YOUR_SHA256_HERE"]
  }
}]
```

Then deploy: `firebase deploy --only hosting`

### 5. Build App Bundle
In Android Studio: Build → Generate Signed Bundle / APK → Android App Bundle

Output: `app/build/outputs/bundle/release/app-release.aab`

### 6. Upload to Play Store
Upload the `.aab` file to Google Play Console.

## Project Structure
```
elite-arrows-android/
├── app/
│   ├── build.gradle          # App-level Gradle config
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── res/              # Resources (icons, colors, strings)
│   │   └── java/             # Java source (minimal for TWA)
│   └── google-services.json  # ADD THIS FILE
├── build.gradle              # Project-level Gradle config
├── settings.gradle
└── gradle.properties
```

## Updating the App
Since this is a TWA, updates to the website at https://elite-arrows.co.uk are instantly reflected in the app. No rebuild needed for content changes.

To update the app version (for Play Store):
1. Increment `versionCode` and `versionName` in `app/build.gradle`
2. Rebuild and upload new AAB
