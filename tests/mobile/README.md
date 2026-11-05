# Local mobile test runbook

The SwiftUI and Kotlin apps open a workspace, list tasks, create a task, and mark it complete. They use the same HTTP API and Postgres database as the web app. iOS reaches the host on `127.0.0.1:8080`. The Android emulator reaches the host on its [10.0.2.2 alias](https://developer.android.com/studio/run/emulator-networking). Both apps are for disposable simulator data.

Maestro runs one YAML flow on both platforms using accessibility identifiers. The Node runner creates a fresh workspace, invokes the local CLI on the specified device, confirms completion through the API, and deletes the workspace. Its JUnit report and debug output are in `test-results/mobile-ios/` or `test-results/mobile-android/`. The mobile flow runs locally and requires no device farm.

Start the [Compose stack](../../README.md#run-the-full-app-locally) on its default port 8080 and keep it running while testing. Use Node 22.23.1, [Maestro CLI 2.11.0](https://github.com/mobile-dev-inc/Maestro/releases/tag/cli-2.11.0), and [Temurin JDK 21.0.11+10](https://github.com/adoptium/temurin21-binaries/releases/tag/jdk-21.0.11%2B10). Put the Java and Maestro executables on `PATH`. The runner disables Maestro analytics and points its error-report API at loopback.

## iOS

Use Xcode 27.1 and the iOS 26.5 simulator runtime. Run these commands from the repo root. The command creates a simulator just for this demo.

```sh
IOS_DEVICE="$(xcrun simctl create TIP-Mobile com.apple.CoreSimulator.SimDeviceType.iPhone-17 com.apple.CoreSimulator.SimRuntime.iOS-26-5)"
xcrun simctl boot "$IOS_DEVICE"
xcrun simctl bootstatus "$IOS_DEVICE" -b
xcodebuild -project apps/ios/TaskDemo.xcodeproj -scheme TaskDemo \
  -destination "platform=iOS Simulator,id=$IOS_DEVICE" \
  -derivedDataPath .local/mobile-ios build
xcrun simctl install "$IOS_DEVICE" .local/mobile-ios/Build/Products/Debug-iphonesimulator/TaskDemo.app
npm run test:mobile -- ios "$IOS_DEVICE"
xcrun simctl shutdown "$IOS_DEVICE"
xcrun simctl delete "$IOS_DEVICE"
```

The Xcode project also opens directly in Xcode. Its simulator target builds with signing disabled.

## Android

Use [Gradle 8.13](https://docs.gradle.org/8.13/release-notes.html), Android SDK Platform 35, Build Tools 35.0.0, and an Android API 32 Google APIs emulator image. The project pins Android Gradle Plugin 8.13.2 and Kotlin 2.2.21. The verification machine used ARM64 system image revision 3 and Android Emulator 31.3.13.0. Set `ANDROID_HOME` to your SDK and put its platform tools and emulator on `PATH`. For a new SDK installation, use Google's [SDK package manager](https://developer.android.com/tools/sdkmanager). Select the emulator image architecture that matches your machine.

For example, create a fresh ARM64 AVD and run it in a dedicated terminal. Use a free port if 5562 is occupied.

```sh
export ANDROID_AVD_HOME="$(mktemp -d)"
avdmanager create avd --name tip-mobile --package 'system-images;android-32;google_apis;arm64-v8a'
emulator -avd tip-mobile -port 5562 -no-window -no-audio -no-snapshot
```

Build the APK and use the disposable emulator's serial from another terminal at the repo root.

```sh
gradle -p apps/android --no-daemon assembleDebug
adb devices
ANDROID_DEVICE=emulator-5562
adb -s "$ANDROID_DEVICE" install -r apps/android/build/outputs/apk/debug/TaskDemo-debug.apk
npm run test:mobile -- android "$ANDROID_DEVICE"
```

Replace the example serial with the value from `adb devices`. Shut down your disposable emulator with `adb -s "$ANDROID_DEVICE" emu kill` when finished. Then tear down the Compose stack.

The flow checks the empty list, enters a title, sees the new open task, completes it, and reopens the workspace after relaunching the app. If the workspace fails to open, first check `curl -fsS http://127.0.0.1:8080/ready` on the host and confirm that the selected device is a simulator or emulator.
