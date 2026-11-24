import { BLEDeviceState } from '../types';
import { speechService } from './speechService';

// Target BLE Service & Characteristics defined for STICK
export const STICK_BLE_CONFIG = {
  DEVICE_NAME: 'STICK',
  SERVICE_UUID: '12345678-1234-1234-1234-123456789000',
  COMMAND_CHAR_UUID: '12345678-1234-1234-1234-123456789001',
  STATUS_CHAR_UUID: '12345678-1234-1234-1234-123456789002',
};

export type SupportedBLECommand = 
  | 'LEFT' 
  | 'RIGHT' 
  | 'CENTER' 
  | 'SCAN_ON' 
  | 'SCAN_OFF' 
  | 'STOP' 
  | 'EMERGENCY' 
  | 'RESET_EMERGENCY';

class BLEService {
  private device: any = null;
  private server: any = null;
  private commandChar: any = null;
  private statusChar: any = null;

  private state: BLEDeviceState = {
    connected: false,
    deviceName: 'Disconnected',
    obstacleDetected: false,
    steeringAngle: 0,
    scanningActive: true,
    emergencyTriggered: false,
    batteryLevel: 88
  };

  private listeners: Array<(state: BLEDeviceState) => void> = [];
  private isSimulated = false;

  constructor() {
    // Check initial environment
  }

  public getState(): BLEDeviceState {
    return { ...this.state };
  }

  public subscribe(listener: (state: BLEDeviceState) => void) {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach(l => l(s));
  }

  public isWebBluetoothAvailable(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Scan and connect to physical STICK ESP32 device
   */
  public async connect(): Promise<boolean> {
    if (!this.isWebBluetoothAvailable()) {
      console.warn('[BLEService] Web Bluetooth not supported in this browser, enabling simulated hardware mode');
      return this.connectSimulated();
    }

    try {
      console.log('[BLEService] Requesting Bluetooth Device with name STICK...');
      const navBluetooth = (navigator as any).bluetooth;
      this.device = await navBluetooth.requestDevice({
        filters: [{ name: STICK_BLE_CONFIG.DEVICE_NAME }],
        optionalServices: [STICK_BLE_CONFIG.SERVICE_UUID]
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnection();
      });

      if (!this.device.gatt) {
        throw new Error('Device has no GATT server');
      }

      console.log('[BLEService] Connecting to GATT Server...');
      this.server = await this.device.gatt.connect();

      console.log('[BLEService] Getting Service...');
      const service = await this.server.getPrimaryService(STICK_BLE_CONFIG.SERVICE_UUID);

      console.log('[BLEService] Getting Command & Status Characteristics...');
      this.commandChar = await service.getCharacteristic(STICK_BLE_CONFIG.COMMAND_CHAR_UUID);
      this.statusChar = await service.getCharacteristic(STICK_BLE_CONFIG.STATUS_CHAR_UUID);

      // Listen for notifications from ESP32
      await this.statusChar.startNotifications();
      this.statusChar.addEventListener('characteristicvaluechanged', (event: any) => {
        this.handleStatusUpdate(event.target.value);
      });

      this.state.connected = true;
      this.state.deviceName = this.device.name || 'STICK ESP32';
      this.isSimulated = false;
      this.notify();

      speechService.playConfirmChime();
      speechService.speak('STICK navigation device connected successfully.');
      return true;
    } catch (err: any) {
      console.warn('[BLEService] Connection to physical STICK BLE failed or cancelled:', err);
      return false;
    }
  }

  /**
   * Fallback simulated mode for local development and verification without hardware
   */
  public connectSimulated(): boolean {
    this.isSimulated = true;
    this.state = {
      connected: true,
      deviceName: 'STICK (Simulated ESP32)',
      batteryLevel: 94,
      obstacleDetected: false,
      obstacleDistanceCm: 150,
      steeringAngle: 0,
      scanningActive: true,
      emergencyTriggered: false,
      lastStatusReceived: 'STATUS:OK|BAT:94|OBSTACLE:NONE'
    };
    this.notify();
    speechService.playConfirmChime();
    speechService.speak('STICK hardware simulation mode connected.');
    return true;
  }

  public disconnect() {
    if (this.isSimulated) {
      this.handleDisconnection();
      return;
    }
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.handleDisconnection();
  }

  private handleDisconnection() {
    this.state.connected = false;
    this.state.deviceName = 'Disconnected';
    this.device = null;
    this.server = null;
    this.commandChar = null;
    this.statusChar = null;
    this.notify();
    speechService.speak('Warning: STICK physical device disconnected.');
  }

  /**
   * Send control command to ESP32:
   * LEFT, RIGHT, CENTER, SCAN_ON, SCAN_OFF, STOP, EMERGENCY, RESET_EMERGENCY
   */
  public async sendCommand(command: SupportedBLECommand): Promise<boolean> {
    this.state.lastCommandSent = command;

    // Front-wheel steering state tracking
    if (command === 'LEFT') this.state.steeringAngle = -35;
    else if (command === 'RIGHT') this.state.steeringAngle = 35;
    else if (command === 'CENTER') this.state.steeringAngle = 0;
    else if (command === 'SCAN_ON') this.state.scanningActive = true;
    else if (command === 'SCAN_OFF') this.state.scanningActive = false;
    else if (command === 'EMERGENCY') {
      this.state.emergencyTriggered = true;
      speechService.playEmergencyAlarm();
    } else if (command === 'RESET_EMERGENCY') {
      this.state.emergencyTriggered = false;
    }

    this.notify();

    if (this.isSimulated) {
      console.log(`[BLEService-Simulated] Sent command: ${command}`);
      return true;
    }

    if (!this.commandChar) {
      console.warn('[BLEService] Not connected to STICK hardware command characteristic');
      return false;
    }

    try {
      const encoder = new TextEncoder();
      await this.commandChar.writeValue(encoder.encode(command));
      console.log(`[BLEService] Successfully sent command: ${command}`);
      return true;
    } catch (e) {
      console.error(`[BLEService] Failed to send command ${command}:`, e);
      return false;
    }
  }

  /**
   * Parse status updates and obstacle telemetry from ESP32
   */
  private handleStatusUpdate(dataView: DataView) {
    const decoder = new TextDecoder('utf-8');
    const raw = decoder.decode(dataView).trim();
    this.state.lastStatusReceived = raw;
    console.log('[BLEService] Raw telemetry from ESP32:', raw);

    // Format: "OBSTACLE:28" or "BAT:85" or "EMERGENCY:PIN" or "STATUS:OK"
    if (raw.startsWith('OBSTACLE:')) {
      const dist = parseInt(raw.split(':')[1], 10);
      this.state.obstacleDetected = dist < 45; // Threshold: 45cm
      this.state.obstacleDistanceCm = dist;

      if (this.state.obstacleDetected) {
        speechService.playObstacleAlert();
        speechService.speak(`Caution! Obstacle detected ${dist} centimeters ahead.`, { priority: true });
      }
    } else if (raw.startsWith('BAT:')) {
      this.state.batteryLevel = parseInt(raw.split(':')[1], 10);
    } else if (raw.includes('EMERGENCY:TRIGGERED') || raw.includes('ESTOP_PRESSED')) {
      this.state.emergencyTriggered = true;
      speechService.playEmergencyAlarm();
      speechService.speak('Emergency Stop Triggered on physical stick handle!', { priority: true });
    }

    this.notify();
  }

  /**
   * Inject simulated obstacle for testing obstacle warnings & voice announcements
   */
  public triggerSimulatedObstacle(distanceCm = 32) {
    this.state.obstacleDetected = true;
    this.state.obstacleDistanceCm = distanceCm;
    this.notify();
    speechService.playObstacleAlert();
    speechService.speak(`Caution! Obstacle detected ${distanceCm} centimeters ahead.`, { priority: true });
  }

  public clearObstacle() {
    this.state.obstacleDetected = false;
    this.state.obstacleDistanceCm = undefined;
    this.notify();
    speechService.speak('Obstacle cleared. Path is open.');
  }
}

export const bleService = new BLEService();
