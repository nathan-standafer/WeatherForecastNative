# 🌤️ Weather Forecast Native

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-0.80.0-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React Native" />
  <img src="https://img.shields.io/badge/TypeScript-5.0.4-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Platform-iOS%20%7C%20Android-lightgrey?style=for-the-badge" alt="Platform" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
</p>

<p align="center">
  A beautiful, native mobile weather application that provides detailed forecasts powered by the National Weather Service (NWS) API. No backend server required – all data is fetched directly from official government weather services.
</p>

---

## ✨ Features

- **🔍 Smart Location Search** – Search by ZIP code or city name with auto-complete suggestions
- **🌡️ Current Conditions** – Real-time temperature, humidity, wind speed, heat index, dew point, and barometric pressure
- **📅 7-Day Forecast** – Daily high/low temperatures with weather descriptions
- **🕐 Hourly Forecast** – Detailed hour-by-hour predictions (tap any day to expand)
- **📝 Detailed Narratives** – Full NWS forecast descriptions for day and night periods
- **🛰️ NOAA Radar** – One-tap access to interactive weather radar for your location
- **💾 Persistent Storage** – Remembers your last searched location
- **📱 Native Performance** – Smooth, responsive UI built with React Native

## 🌐 Data Sources & APIs

This application fetches weather data directly from official U.S. government services:

| Service | Description | Endpoint |
|---------|-------------|----------|
| **NWS Points API** | Resolves coordinates to forecast grid | `api.weather.gov/points/{lat},{lon}` |
| **NWS Forecast API** | 7-day daily forecast data | `api.weather.gov/gridpoints/{office}/{x},{y}/forecast` |
| **NWS Hourly API** | Hour-by-hour forecast data | `api.weather.gov/gridpoints/{office}/{x},{y}/forecast/hourly` |
| **NWS Stations API** | Current observation data | `api.weather.gov/stations/{id}/observations` |
| **NOAA Radar** | Interactive weather radar | `radar.weather.gov` |

> **Note:** The NWS API is free, requires no API key, and provides data for U.S. locations only.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) – [Download](https://nodejs.org/)
- **Yarn** (recommended) or npm
- **React Native CLI** – `npm install -g @react-native-community/cli`
- **Xcode** (for iOS development, macOS only)
- **Android Studio** (for Android development)
- **CocoaPods** (for iOS) – `sudo gem install cocoapods`

For detailed environment setup, follow the official [React Native Environment Setup Guide](https://reactnative.dev/docs/set-up-your-environment).

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/nathan-standafer/WeatherForecastNative.git
cd WeatherForecastNative
```

### 2. Install Dependencies

```bash
# Using Yarn (recommended)
yarn install

# OR using npm
npm install
```

### 3. iOS Setup (macOS only)

Install CocoaPods dependencies:

```bash
# First time setup - install CocoaPods via Bundler
bundle install

# Install iOS native dependencies
cd ios && bundle exec pod install && cd ..
```

### 4. Start the Metro Bundler

In a terminal window, start the Metro development server:

```bash
yarn start
# OR
npm start
```

### 5. Run the Application

Open a **new terminal window** and run:

#### Android
```bash
yarn android
# OR
npm run android
```

#### iOS
```bash
yarn ios
# OR
npm run ios
```

## 📱 Running on a Physical Device

### Android
1. Enable **Developer Options** and **USB Debugging** on your device
2. Connect your device via USB
3. Run `adb devices` to verify connection
4. Run `yarn android`

### iOS
1. Open `ios/WeatherForecastNative.xcworkspace` in Xcode
2. Select your device from the device dropdown
3. Configure signing with your Apple Developer account
4. Click **Run** or press `Cmd + R`

## 🏗️ Project Structure

```
WeatherForecastNative/
├── App.tsx                 # Main application component
├── data/
│   └── zipData.ts          # ZIP code database for location lookup
├── ios/                    # iOS native code
├── android/                # Android native code
├── __tests__/              # Test files
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
└── README.md               # You are here!
```

## 🛠️ Technology Stack

| Category | Technology |
|----------|------------|
| **Framework** | React Native 0.80 |
| **Language** | TypeScript 5.0 |
| **State Management** | React Hooks (useState, useEffect) |
| **Storage** | AsyncStorage |
| **HTTP Client** | Fetch API |
| **Styling** | React Native StyleSheet |

## 🔧 Available Scripts

| Command | Description |
|---------|-------------|
| `yarn start` | Start the Metro bundler |
| `yarn android` | Build and run on Android |
| `yarn ios` | Build and run on iOS |
| `yarn lint` | Run ESLint for code quality |
| `yarn test` | Run Jest test suite |

## 🐛 Troubleshooting

### Common Issues

**Metro bundler port in use:**
```bash
yarn start --reset-cache
```

**iOS build fails after dependency update:**
```bash
cd ios && rm -rf Pods Podfile.lock && bundle exec pod install && cd ..
```

**Android build fails:**
```bash
cd android && ./gradlew clean && cd ..
yarn android
```

**Clear all caches:**
```bash
watchman watch-del-all
rm -rf node_modules
yarn install
yarn start --reset-cache
```

For more troubleshooting tips, see the [React Native Troubleshooting Guide](https://reactnative.dev/docs/troubleshooting).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [National Weather Service API](https://www.weather.gov/documentation/services-web-api) for providing free, reliable weather data
- [NOAA](https://www.noaa.gov/) for the interactive radar service
- [React Native Community](https://reactnative.dev/) for the excellent framework and documentation

---

<p align="center">
  Made with ❤️ and ☕
</p>
