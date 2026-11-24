# STICK – Smart Navigation System

> **An intelligent voice-controlled navigation companion and safety tracking system for blind and visually impaired individuals.**
> Built with React, TypeScript, Vite, Leaflet, Web Speech & Audio APIs, Bluetooth Low Energy (BLE), Firebase, and Capacitor Android.

---

## 🌟 Key Architecture Highlights

- **Single APK – Dual Account Roles**:
  - **Blind User Dashboard**: High-contrast, hands-free voice-first interface powered by `"Hey STICK"` conversational AI, interactive real map, pedestrian routing, random walk mode, BLE hardware diagnostics, and large SOS emergency controls.
  - **Guardian Dashboard**: Real-time GPS tracking dashboard with live map trail, device battery/obstacle telemetry, 6-digit pairing approval, and instant audio/visual emergency alert center.
- **Natural Conversational AI ("Hey STICK")**:
  - Continuous wake-phrase detection (`"Hey STICK"`).
  - Sentiment-aware dynamic greeting (`"Hey! How are you doing today?"` -> handles `"I'm great"`, `"I'm good"`, `"I'm feeling a little worse"`).
  - Conversational destination extraction, real distance/duration calculation, route synthesis, and voice confirmation (`"Would you like me to take you there?"`).
- **Interactive Real-World Map (No Blank Screens)**:
  - Powered by **OpenStreetMap** & CartoDB Voyager out-of-the-box with **OSRM Pedestrian Routing Engine**.
  - Default Fallback Coordinates: **Chikkamagaluru (CKM), Karnataka, India (`13.3161, 75.7720`)**.
  - Real landmarks: District Hospital CKM, KSRTC Bus Stand, CKM Railway Station, Town Canteen, MG Road, Azad Park.
  - Turn-by-turn spoken guidance, blue pedestrian polyline, recalculation, and heading compass.
- **Random Walk Mode**:
  - Safe pedestrian circular loop planner generating accessible routes avoiding highways and unsuitable roads.
- **Physical ESP32 BLE Hardware Integration**:
  - Device Name: `STICK`
  - Service UUID: `12345678-1234-1234-1234-123456789000`
  - Command UUID: `12345678-1234-1234-1234-123456789001`
  - Status UUID: `12345678-1234-1234-1234-123456789002`
  - Front-wheel steering via **MG996R servo and mechanical linkage** (not skid steering).
  - Ultrasonic radar obstacle scanning (**HC-SR04** on sweep servo).
  - Dual 12V 60RPM DC motors via **L298N**.
  - Supervised hardware test mode with software safety interlock.
  - Physical emergency stop interrupts motor power at the hardware level.

---

## 📁 Project Structure

```text
stick/
├── android/                           # Capacitor Native Android Project
│   └── app/src/main/
│       └── AndroidManifest.xml        # Fine/Coarse GPS, Audio, BLE, Foreground Service permissions
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── AuthScreen.tsx         # Unified Blind User / Guardian Login & Demo Switcher
│   │   ├── blind/
│   │   │   ├── BlindDashboard.tsx     # Full Blind User Voice Navigation Dashboard
│   │   │   ├── VoiceAssistantWave.tsx # Hey STICK Animated Wave, Speech Transcription & Chips
│   │   │   └── HardwareTestModal.tsx  # Supervised Front-Wheel Steer & Ultrasonic Diagnostics
│   │   ├── guardian/
│   │   │   └── GuardianDashboard.tsx  # Live Blind User Tracking Map & Emergency Alert Center
│   │   └── common/
│   │       ├── Header.tsx             # Accessible App Header & BLE Quick Status
│   │       ├── InteractiveMap.tsx     # Leaflet Map with Blue Pedestrian Route & POIs
│   │       └── EmergencyModal.tsx     # Urgent SOS Alert Modal & Emergency Contacts
│   ├── context/
│   │   └── AuthContext.tsx            # Role Management & Dual Session Authentication
│   ├── firmware/
│   │   └── stick_esp32_firmware.ino   # Production C++ Firmware for ESP32 BLE, MG996R, HC-SR04, L298N
│   ├── services/
│   │   ├── bleService.ts              # Web Bluetooth API & ESP32 GATT Controller
│   │   ├── firebaseService.ts         # Realtime DB, Firestore & Cross-Tab Broadcast Sync
│   │   ├── placesService.ts           # Chikkamagaluru Known POIs + Nominatim Geocoding
│   │   ├── routingService.ts          # OSRM Pedestrian Foot Routing & Random Walk Loop Generator
│   │   ├── speechService.ts           # Text-To-Speech (TTS) & Web Audio Sound Earcons
│   │   └── voiceAssistant.ts          # Hey STICK Conversational State Machine & Intent Parser
│   ├── types/
│   │   └── index.ts                   # Core Data Models & TypeScript Interfaces
│   ├── App.tsx                        # Main App Shell
│   ├── main.tsx                       # React DOM Entrypoint
│   └── index.css                      # Tailwind Directives & High-Contrast Accessible Styles
├── capacitor.config.ts                # Capacitor Android Configuration
├── firestore.rules                    # Secure Firestore Security Rules
├── database.rules.json                # Secure Realtime Database Rules
└── package.json                       # Project Dependencies & Build Scripts
```

---

## 🚀 Running on Localhost

### 1. Prerequisites
- **Node.js**: v18+ or v20+
- **Modern Browser**: Chrome, Edge, or Brave (supports Web Speech API & Web Bluetooth API)

### 2. Start the Development Server
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser.

### 3. Testing Dual Account Roles Simultaneously
1. Open Window 1: Choose **"Blind User"** (or click *Enter as Blind User*).
2. Open Window 2 (or an Incognito window): Choose **"Guardian"** (or click *Enter as Guardian*).
3. The app includes **built-in cross-window broadcast synchronization**:
   - Starting a route or moving in the Blind User dashboard immediately updates the Guardian's live map.
   - Triggering SOS from the Blind User triggers the urgent alarm on the Guardian's dashboard.

---

## 🎙️ "Hey STICK" Voice Interaction Flow

You can speak aloud or use the on-screen voice shortcuts:

| User Speaks | STICK Response |
| :--- | :--- |
| *"Hey STICK"* | *"Hey! How are you doing today?"* |
| *"I'm great"* | *"That's good to hear! Where would you like to go today? Or would you like to take a random walk?"* |
| *"I'm good"* | *"Glad to hear that! Where are we heading today?"* |
| *"I'm feeling a little worse"* | *"I'm sorry you're having a difficult day. We can take things slowly. Would you like to go somewhere or just take a walk?"* |
| *"Take me to a hospital"* | *"I found District General Hospital Chikkamagaluru approximately 820 metres away. It should take around 11 minutes to walk. Would you like me to take you there?"* |
| *"Yes"* | *"Alright! Let's get started."* (Enters turn-by-turn pedestrian navigation) |
| *"Let's go for a random walk"* | *"I have planned a safe pedestrian walk approximately 850 metres around verified pedestrian footpaths. It will take about 12 minutes. Would you like to start this walk?"* |
| *"Emergency"* | Instantly sounds alarm, halts rear motors, locks front steering, and alerts Guardian with GPS coordinates. |

---

## 🗺️ Mapping & API Key Configuration

### OpenStreetMap & OSRM (Default - Active)
- Requires **no API keys** and **no credit card**.
- Default center: **Chikkamagaluru, Karnataka, India (`13.3161, 75.7720`)**.
- Uses OpenStreetMap Carto Voyager tiles and OSRM walking routes.

### Optional: Google Maps Platform
To use Google Maps:
1. Copy `.env.example` to `.env`.
2. Add your key: `VITE_GOOGLE_MAPS_API_KEY=AIzaSy...`
3. Enable in Google Cloud Console:
   - **Maps SDK for Android**
   - **Places API (New)**
   - **Routes API**

---

## 🔒 Firebase Configuration

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/).
2. Enable:
   - **Authentication**: Email/Password.
   - **Cloud Firestore**: Apply rules from `firestore.rules`.
   - **Realtime Database**: Apply rules from `database.rules.json`.
3. Set your environment variables in `.env`:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-app
   VITE_FIREBASE_DATABASE_URL=https://your-app-default-rtdb.firebaseio.com
   ```
*(Note: If left unconfigured, STICK uses automatic local synchronized storage for seamless localhost testing).*

---

## 🤖 ESP32 Hardware Wiring & Firmware

The complete production firmware is located in:
`src/firmware/stick_esp32_firmware.ino`

### Pin Configuration
| Component | Function | ESP32 GPIO |
| :--- | :--- | :--- |
| **MG996R Servo** | Front-Wheel Steering | `GPIO 18` |
| **SG90 / Sweep Servo** | Ultrasonic Sweep | `GPIO 19` |
| **HC-SR04 Trig** | Ultrasonic Trigger | `GPIO 23` |
| **HC-SR04 Echo** | Ultrasonic Echo | `GPIO 22` |
| **Physical E-Stop** | Interrupt Button (Active LOW) | `GPIO 21` |
| **Buzzer** | Warning Beeper | `GPIO 15` |
| **L298N ENA** | Rear Left PWM Speed | `GPIO 25` |
| **L298N IN1, IN2** | Rear Left Direction | `GPIO 26, 27` |
| **L298N ENB** | Rear Right PWM Speed | `GPIO 14` |
| **L298N IN3, IN4** | Rear Right Direction | `GPIO 12, 13` |

### Safety Philosophy
- **Front-Wheel Steering**: The MG996R actuates the mechanical tie-rod front wheel (not differential skid steering).
- **Independent Hardware E-Stop**: The emergency button cuts power to the L298N H-bridge independently of software.
- **Software Motor Interlock**: Traction motors remain software-locked until the user or guardian runs the **Supervised Hardware Test Mode** to verify steering alignment and obstacle radar.

---

## 📱 Android Native Build (Capacitor)

The native Android project is generated in `android/`.

To build the APK:
```bash
# 1. Build web bundle
npm run build

# 2. Sync web bundle to Android project
npx cap sync android

# 3. Open in Android Studio
npx cap open android
```
In Android Studio: Select **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

---

## ✅ Status of Deliverables

- [x] Single APK with Dual Roles (Blind User & Guardian)
- [x] Natural Voice Assistant with "Hey STICK" wake phrase & sentiment awareness
- [x] Real Destination Voice & Text Search (Nominatim + Verified CKM POIs)
- [x] Real-world Leaflet & OSRM Interactive Pedestrian Map (Zero blank screen)
- [x] Chikkamagaluru (CKM) Default Coordinates (`13.3161, 75.7720`)
- [x] Random Walk Mode with safe pedestrian loop generation
- [x] Turn-by-Turn Spoken Navigation with maneuver announcements
- [x] ESP32 Bluetooth Low Energy (BLE) Integration with custom GATT UUIDs
- [x] Front-wheel steering architecture & HC-SR04 ultrasonic obstacle warning
- [x] Emergency SOS system linking Blind User to Guardian with live GPS
- [x] Guardian live tracking dashboard with stale location detection
- [x] Supervised Hardware Test diagnostics panel
- [x] ESP32 Arduino C++ firmware ready to flash
- [x] Capacitor Android configuration with complete permissions
- [x] 100% Passing TypeScript compilation and production bundle
