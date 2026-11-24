export type UserRole = 'blind_user' | 'guardian';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  pairedWithUid?: string;
  pairedWithName?: string;
  pairingCode?: string;
  createdAt: number;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface PlacePOI {
  id: string;
  name: string;
  category: string;
  address?: string;
  lat: number;
  lng: number;
  distanceMeters?: number;
}

export interface NavigationStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  type: string;
  modifier?: string;
  name?: string;
  location: Coordinates;
}

export interface NavigationRoute {
  id: string;
  destinationName: string;
  destinationCoords: Coordinates;
  startCoords: Coordinates;
  distanceMeters: number;
  durationSeconds: number;
  steps: NavigationStep[];
  geometry: Coordinates[]; // Array of lat/lng for polyline
  isRandomWalk?: boolean;
}

export type NavigationStatus = 'idle' | 'searching' | 'previewing' | 'navigating' | 'paused' | 'arrived';

export interface BLEDeviceState {
  connected: boolean;
  deviceName: string;
  batteryLevel?: number;
  obstacleDetected: boolean;
  obstacleDistanceCm?: number;
  steeringAngle: number; // -45 (Left) to +45 (Right), 0 is Center
  scanningActive: boolean;
  emergencyTriggered: boolean;
  lastCommandSent?: string;
  lastStatusReceived?: string;
  rssi?: number;
}

export type AssistantState = 
  | 'idle' 
  | 'listening_wakeword' 
  | 'greeting' 
  | 'awaiting_sentiment' 
  | 'asking_destination' 
  | 'listening_destination' 
  | 'searching_places' 
  | 'awaiting_confirmation' 
  | 'navigating' 
  | 'speaking' 
  | 'error';

export interface EmergencyAlert {
  id: string;
  blindUserId: string;
  blindUserName: string;
  timestamp: number;
  location: Coordinates;
  resolved: boolean;
  status: 'ACTIVE' | 'RESOLVED';
  batteryLevel?: number;
  message?: string;
}

export interface SharedBlindUserState {
  userId: string;
  displayName: string;
  location: Coordinates;
  accuracyMeters: number;
  heading?: number;
  speed?: number;
  timestamp: number;
  isSharing: boolean;
  navigationStatus: NavigationStatus;
  currentRoute?: {
    destinationName: string;
    distanceRemainingMeters: number;
    durationRemainingSeconds: number;
  };
  bleStatus: {
    connected: boolean;
    batteryLevel?: number;
    obstacleDetected: boolean;
    emergencyTriggered: boolean;
  };
}
