/**
 * ============================================================================
 * STICK – Smart Navigation System Physical Device Firmware
 * Target: ESP32 DevKit V1
 * 
 * Hardware Architecture:
 * - Front-Wheel Steering: MG996R High-Torque Servo on mechanical tie-rod linkage
 * - Ultrasonic Obstacle Scanning: HC-SR04 mounted on SG90/MG90S sweep servo
 * - Rear Traction: Dual 12V 60RPM DC Geared Motors driven via L298N Dual H-Bridge
 * - Safety & Emergency: Physical E-Stop button with hardware interrupt + power cut
 * - Connectivity: BLE 4.2 / 5.0 GATT Server
 * 
 * UUIDs:
 * Service: 12345678-1234-1234-1234-123456789000
 * Command: 12345678-1234-1234-1234-123456789001
 * Status:  12345678-1234-1234-1234-123456789002
 * ============================================================================
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ESP32Servo.h>

// BLE Definitions
#define DEVICE_NAME "STICK"
#define SERVICE_UUID        "12345678-1234-1234-1234-123456789000"
#define COMMAND_CHAR_UUID   "12345678-1234-1234-1234-123456789001"
#define STATUS_CHAR_UUID    "12345678-1234-1234-1234-123456789002"

// Pin Assignments
#define PIN_STEERING_SERVO   18   // MG996R Front Wheel Steering Servo
#define PIN_SCAN_SERVO       19   // Ultrasonic Scan Sweep Servo
#define PIN_TRIG             23   // HC-SR04 Ultrasonic Trigger
#define PIN_ECHO             22   // HC-SR04 Ultrasonic Echo
#define PIN_ESTOP_BUTTON     21   // Physical Emergency Stop Pin (Active LOW with pullup)
#define PIN_BUZZER           15   // Warning Buzzer

// L298N Motor Driver Pins (Rear Wheels)
#define PIN_ENA              25   // Rear Left Speed (PWM)
#define PIN_IN1              26   // Rear Left Dir 1
#define PIN_IN2              27   // Rear Left Dir 2
#define PIN_ENB              14   // Rear Right Speed (PWM)
#define PIN_IN3              12   // Rear Right Dir 1
#define PIN_IN4              13   // Rear Right Dir 2

// Servo Steering Angles (Front Wheel MG996R)
#define STEER_CENTER_DEG     90
#define STEER_LEFT_DEG       55   // 35 degrees left
#define STEER_RIGHT_DEG      125  // 35 degrees right

// Safety Thresholds
#define OBSTACLE_DISTANCE_ALERT_CM  45
#define OBSTACLE_DISTANCE_CRITICAL_CM 25

// Global Objects
Servo steeringServo;
Servo scanServo;
BLEServer* pServer = nullptr;
BLECharacteristic* pCommandChar = nullptr;
BLECharacteristic* pStatusChar = nullptr;

bool deviceConnected = false;
bool oldDeviceConnected = false;
volatile bool emergencyLatched = false;
bool scanningActive = true;
int scanAngle = 90;
int scanDirection = 1;
unsigned long lastScanTime = 0;
unsigned long lastTelemetryTime = 0;

// Motor Safety Lock (Unlocked only after supervised testing)
bool motorControlSoftwareLocked = true;

// ISR for Physical Emergency Button
void IRAM_ATTR handleEmergencyInterrupt() {
  emergencyLatched = true;
  // Instantly cut motor drive in hardware/register level
  digitalWrite(PIN_IN1, LOW);
  digitalWrite(PIN_IN2, LOW);
  digitalWrite(PIN_IN3, LOW);
  digitalWrite(PIN_IN4, LOW);
  analogWrite(PIN_ENA, 0);
  analogWrite(PIN_ENB, 0);
}

// Ultrasonic Distance Reader
long measureDistanceCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  long duration = pulseIn(PIN_ECHO, HIGH, 25000); // 25ms timeout (~4m max)
  if (duration == 0) return 999; // No obstacle or out of range
  return duration * 0.034 / 2;
}

// Forward declaration of status sending
void sendStatusNotification(const String& message);

// BLE Server Callbacks
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("[STICK] BLE Client Connected");
  };

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println("[STICK] BLE Client Disconnected");
    // Failsafe stop
    emergencyLatched = true;
  }
};

// BLE Command Characteristic Callbacks
class CommandCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) {
    String rxValue = pCharacteristic->getValue().c_str();
    rxValue.trim();

    if (rxValue.length() > 0) {
      Serial.print("[STICK] Received Command: ");
      Serial.println(rxValue);

      if (rxValue == "EMERGENCY") {
        emergencyLatched = true;
        motorControlSoftwareLocked = true;
        sendStatusNotification("EMERGENCY:TRIGGERED");
      }
      else if (rxValue == "RESET_EMERGENCY") {
        emergencyLatched = false;
        sendStatusNotification("STATUS:EMERGENCY_RESET");
      }
      else if (rxValue == "STOP") {
        // Stop rear motors
        digitalWrite(PIN_IN1, LOW);
        digitalWrite(PIN_IN2, LOW);
        digitalWrite(PIN_IN3, LOW);
        digitalWrite(PIN_IN4, LOW);
        sendStatusNotification("STATUS:STOPPED");
      }
      else if (rxValue == "LEFT") {
        steeringServo.write(STEER_LEFT_DEG);
        sendStatusNotification("STEER:LEFT");
      }
      else if (rxValue == "RIGHT") {
        steeringServo.write(STEER_RIGHT_DEG);
        sendStatusNotification("STEER:RIGHT");
      }
      else if (rxValue == "CENTER") {
        steeringServo.write(STEER_CENTER_DEG);
        sendStatusNotification("STEER:CENTER");
      }
      else if (rxValue == "SCAN_ON") {
        scanningActive = true;
        sendStatusNotification("SCAN:ENABLED");
      }
      else if (rxValue == "SCAN_OFF") {
        scanningActive = false;
        scanServo.write(90);
        sendStatusNotification("SCAN:DISABLED");
      }
    }
  }
};

void sendStatusNotification(const String& message) {
  if (deviceConnected && pStatusChar != nullptr) {
    pStatusChar->setValue(message.c_str());
    pStatusChar->notify();
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("[STICK] Starting Smart Navigation Firmware...");

  // Initialize GPIOs
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_ESTOP_BUTTON, INPUT_PULLUP);
  pinMode(PIN_BUZZER, OUTPUT);

  pinMode(PIN_ENA, OUTPUT);
  pinMode(PIN_IN1, OUTPUT);
  pinMode(PIN_IN2, OUTPUT);
  pinMode(PIN_ENB, OUTPUT);
  pinMode(PIN_IN3, OUTPUT);
  pinMode(PIN_IN4, OUTPUT);

  // Safety initial motor cut
  digitalWrite(PIN_IN1, LOW);
  digitalWrite(PIN_IN2, LOW);
  digitalWrite(PIN_IN3, LOW);
  digitalWrite(PIN_IN4, LOW);
  analogWrite(PIN_ENA, 0);
  analogWrite(PIN_ENB, 0);

  // Attach Hardware Interrupt for Physical Emergency Stop
  attachInterrupt(digitalPinToInterrupt(PIN_ESTOP_BUTTON), handleEmergencyInterrupt, FALLING);

  // Initialize Servos
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  steeringServo.setPeriodHertz(50);
  scanServo.setPeriodHertz(50);

  steeringServo.attach(PIN_STEERING_SERVO, 500, 2500);
  scanServo.attach(PIN_SCAN_SERVO, 500, 2500);

  // Home positions
  steeringServo.write(STEER_CENTER_DEG);
  scanServo.write(90);

  // Initialize BLE
  BLEDevice::init(DEVICE_NAME);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);

  // Command characteristic (Write)
  pCommandChar = pService->createCharacteristic(
    COMMAND_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  pCommandChar->setCallbacks(new CommandCallbacks());

  // Status characteristic (Notify & Read)
  pStatusChar = pService->createCharacteristic(
    STATUS_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pStatusChar->addDescriptor(new BLE2902());

  pService->start();

  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("[STICK] BLE GATT Server Advertising as 'STICK'. Ready.");
}

void loop() {
  unsigned long now = millis();

  // 1. Check physical emergency stop
  if (emergencyLatched) {
    digitalWrite(PIN_BUZZER, (now / 200) % 2); // Pulsed alarm tone
    digitalWrite(PIN_IN1, LOW);
    digitalWrite(PIN_IN2, LOW);
    digitalWrite(PIN_IN3, LOW);
    digitalWrite(PIN_IN4, LOW);
    return;
  } else {
    digitalWrite(PIN_BUZZER, LOW);
  }

  // 2. Ultrasonic Sensor Sweeping
  if (scanningActive && (now - lastScanTime >= 60)) {
    lastScanTime = now;
    scanAngle += (scanDirection * 15);
    if (scanAngle >= 135) {
      scanAngle = 135;
      scanDirection = -1;
    } else if (scanAngle <= 45) {
      scanAngle = 45;
      scanDirection = 1;
    }
    scanServo.write(scanAngle);

    // Read distance
    long dist = measureDistanceCm();
    if (dist <= OBSTACLE_DISTANCE_ALERT_CM) {
      Serial.printf("[STICK] Obstacle at %ld cm (Angle: %d)\n", dist, scanAngle);
      String obsMsg = "OBSTACLE:" + String(dist);
      sendStatusNotification(obsMsg);

      if (dist <= OBSTACLE_DISTANCE_CRITICAL_CM) {
        // Instant motor stop for safety
        digitalWrite(PIN_IN1, LOW);
        digitalWrite(PIN_IN2, LOW);
        digitalWrite(PIN_IN3, LOW);
        digitalWrite(PIN_IN4, LOW);
      }
    }
  }

  // 3. Periodic Telemetry (Battery / Status heartbeat every 3 seconds)
  if (now - lastTelemetryTime >= 3000) {
    lastTelemetryTime = now;
    if (deviceConnected) {
      int simulatedBattery = 92; // Can be read via analogRead(PIN_BAT_DIVIDER)
      sendStatusNotification("BAT:" + String(simulatedBattery));
    }
  }

  // BLE reconnection handling
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    Serial.println("[STICK] Re-started advertising");
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }
}
