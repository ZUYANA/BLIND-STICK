import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  AssistantState,
  BLEDeviceState,
  Coordinates,
  NavigationRoute,
  NavigationStatus,
  PlacePOI
} from '../../types';
import { voiceAssistant } from '../../services/voiceAssistant';
import { bleService } from '../../services/bleService';
import { speechService } from '../../services/speechService';
import { CHIKKAMAGALURU_COORDS, CKM_KNOWN_PLACES, placesService } from '../../services/placesService';
import { routingService } from '../../services/routingService';
import { firebaseService } from '../../services/firebaseService';

import { VoiceAssistantWave } from './VoiceAssistantWave';
import { InteractiveMap } from '../common/InteractiveMap';
import { HardwareTestModal } from './HardwareTestModal';

import {
  Search,
  Compass,
  AlertOctagon,
  Volume2,
  Navigation as NavIcon,
  Bluetooth,
  Sliders,
  CheckCircle,
  Copy,
  RotateCcw,
  Footprints,
  PhoneCall,
  MapPin,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

interface BlindDashboardProps {
  bleState: BLEDeviceState;
  onConnectBLE: () => void;
  onOpenHardwareTest: () => void;
  onTriggerEmergency: () => void;
}

export const BlindDashboard: React.FC<BlindDashboardProps> = ({
  bleState,
  onConnectBLE,
  onOpenHardwareTest,
  onTriggerEmergency
}) => {
  const { user, generateNewPairingCode } = useAuth();

  // Navigation & Location States
  const [currentLocation, setCurrentLocation] = useState<Coordinates>(CHIKKAMAGALURU_COORDS);
  const [activeRoute, setActiveRoute] = useState<NavigationRoute | null>(null);
  const [navStatus, setNavStatus] = useState<NavigationStatus>('idle');
  const [heading, setHeading] = useState<number>(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Search input
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PlacePOI[]>([]);

  // Voice Assistant UI state
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');
  const [transcript, setTranscript] = useState('');
  const [assistantResponse, setAssistantResponse] = useState('');

  // Pairing code
  const [pairingCode, setPairingCode] = useState<string>('123456');
  const [copiedCode, setCopiedCode] = useState(false);

  // Initialize GPS Tracking and Voice Assistant subscriptions
  useEffect(() => {
    // 1. Try Geolocation API
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentLocation(coords);
          if (pos.coords.heading !== null && !isNaN(pos.coords.heading)) {
            setHeading(pos.coords.heading);
          }
          voiceAssistant.setUserLocation(coords);
        },
        (err) => {
          console.warn('[BlindDashboard] Geolocation watch error, using Chikkamagaluru fallback:', err.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Sync state to Guardian in Realtime
  useEffect(() => {
    if (!user) return;

    firebaseService.updateBlindUserLocation({
      userId: user.uid,
      displayName: user.displayName,
      location: currentLocation,
      accuracyMeters: 5,
      heading,
      timestamp: Date.now(),
      isSharing: true,
      navigationStatus: navStatus,
      currentRoute: activeRoute
        ? {
            destinationName: activeRoute.destinationName,
            distanceRemainingMeters: activeRoute.distanceMeters,
            durationRemainingSeconds: activeRoute.durationSeconds
          }
        : undefined,
      bleStatus: {
        connected: bleState.connected,
        batteryLevel: bleState.batteryLevel,
        obstacleDetected: bleState.obstacleDetected,
        emergencyTriggered: bleState.emergencyTriggered
      }
    });
  }, [currentLocation, activeRoute, navStatus, bleState, heading, user]);

  // Voice Assistant Integration
  useEffect(() => {
    voiceAssistant.setUserLocation(currentLocation);

    voiceAssistant.setCallbacks({
      onNavigate: (route) => {
        handleStartNavigation(route);
      },
      onEmergency: () => {
        onTriggerEmergency();
      },
      onStopNavigation: () => {
        handleStopNavigation();
      },
      onCallGuardian: () => {
        speechService.speak('Guardian Ananya has been notified with your current coordinates in Chikkamagaluru.');
      }
    });

    const unsubscribe = voiceAssistant.subscribe((ev) => {
      setAssistantState(ev.state);
      setTranscript(ev.transcript);
      if (ev.response) {
        setAssistantResponse(ev.response);
      }
      if (ev.activeRoute) {
        setActiveRoute(ev.activeRoute);
      }
    });

    // Start continuous listening for "Hey STICK"
    voiceAssistant.startListening();

    return () => {
      unsubscribe();
      voiceAssistant.stopListening();
    };
  }, [currentLocation]);

  // Handle Starting Navigation
  const handleStartNavigation = (route: NavigationRoute) => {
    setActiveRoute(route);
    setNavStatus('navigating');
    setCurrentStepIndex(0);
    voiceAssistant.setNavigationState(true, route);

    // Initial instruction speech
    if (route.steps.length > 0) {
      speechService.speak(`Navigation started. ${route.steps[0].instruction}`);
    }
  };

  const handleStopNavigation = () => {
    setActiveRoute(null);
    setNavStatus('idle');
    setCurrentStepIndex(0);
    voiceAssistant.setNavigationState(false, null);
    bleService.sendCommand('CENTER');
  };

  // Step advancement simulation
  const handleAdvanceStep = () => {
    if (!activeRoute) return;
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < activeRoute.steps.length) {
      setCurrentStepIndex(nextIndex);
      const step = activeRoute.steps[nextIndex];
      speechService.speak(step.instruction);

      // Check steering command for BLE
      if (step.modifier?.includes('left')) {
        bleService.sendCommand('LEFT');
      } else if (step.modifier?.includes('right')) {
        bleService.sendCommand('RIGHT');
      } else {
        bleService.sendCommand('CENTER');
      }
    } else {
      speechService.speak('You have arrived at your destination.');
      handleStopNavigation();
    }
  };

  // Search Places
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    const results = await placesService.searchPlaces(searchQuery, currentLocation);
    setSearchResults(results);
    setIsSearching(false);

    if (results.length > 0) {
      speechService.speak(`Found ${results.length} places. Top match is ${results[0].name}.`);
    } else {
      speechService.speak(`No places found for ${searchQuery}.`);
    }
  };

  const handleSelectPlace = async (place: PlacePOI) => {
    speechService.speak(`Calculating walking route to ${place.name}...`);
    const route = await routingService.getWalkingRoute(
      currentLocation,
      { lat: place.lat, lng: place.lng },
      place.name
    );
    handleStartNavigation(route);
    setSearchResults([]);
  };

  const handleTriggerRandomWalk = async () => {
    speechService.speak('Generating safe pedestrian walking loop around Chikkamagaluru...');
    const route = await routingService.planRandomWalk(currentLocation);
    handleStartNavigation(route);
  };

  const handleCopyPairingCode = () => {
    const code = generateNewPairingCode();
    setPairingCode(code);
    navigator.clipboard?.writeText(code);
    setCopiedCode(true);
    speechService.speak(`Pairing code is ${code}. Share with your guardian.`);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-5 space-y-6">
      {/* Personalized User Welcome Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
            {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'B'}
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Blind User Dashboard
            </div>
            <div className="text-base font-extrabold text-white flex items-center gap-2">
              <span>{user?.displayName || 'Blind User'}</span>
              <span className="text-xs text-slate-500 font-normal">•</span>
              <span className="text-xs text-emerald-400 font-medium">
                Guardian: {user?.pairedWithName || 'Guardian'}
              </span>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 font-mono">
          Pairing Code: <span className="text-sky-400 font-bold">{pairingCode}</span>
        </div>
      </div>

      {/* Big Emergency Alert Trigger Banner */}
      <div className="flex items-center justify-between bg-red-950/40 border-2 border-red-500/80 rounded-2xl p-4 sm:p-5 shadow-2xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-red-600 rounded-xl text-white shadow-lg shadow-red-600/30">
            <AlertOctagon className="w-7 h-7 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-wide uppercase">Emergency SOS</h2>
            <p className="text-xs text-red-200">
              Voice: Say <b>"Emergency"</b> or tap button to alert Guardian & trigger ESP32 E-Stop
            </p>
          </div>
        </div>

        <button
          onClick={onTriggerEmergency}
          aria-label="Trigger Emergency Assistance"
          className="px-6 py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-xl shadow-red-600/40 border border-red-400 transition"
        >
          SOS Button
        </button>
      </div>

      {/* Main Grid: Voice Assistant & Real Interactive Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: "Hey STICK" Voice Assistant Panel */}
        <div className="lg:col-span-5 space-y-6">
          <VoiceAssistantWave
            state={assistantState}
            transcript={transcript}
            assistantResponse={assistantResponse}
            isListening={assistantState !== 'idle'}
            onManualTrigger={() => voiceAssistant.triggerWakeWordManual()}
            onSimulateVoiceCommand={(phrase) => voiceAssistant.handleSpokenInput(phrase)}
          />

          {/* Destination Quick Chips (Chikkamagaluru POIs) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-sky-400" />
                Chikkamagaluru Destinations
              </span>
              <button
                onClick={handleTriggerRandomWalk}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold bg-emerald-950/40 border border-emerald-800/60 px-2.5 py-1 rounded-lg transition"
              >
                <Footprints className="w-3.5 h-3.5" />
                <span>Random Walk</span>
              </button>
            </div>

            {/* Manual Search Bar (Fallback to Voice) */}
            <form onSubmit={handleSearchSubmit} className="relative mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search hospital, restaurant, shop in CKM..."
                className="w-full pl-9 pr-20 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-sky-500 outline-none"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
              <button
                type="submit"
                disabled={isSearching}
                className="absolute right-1.5 top-1.5 px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs rounded-lg transition"
              >
                {isSearching ? '...' : 'Search'}
              </button>
            </form>

            {/* Quick POI List across Whole Chikkamagaluru */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {(searchResults.length > 0 ? searchResults : CKM_KNOWN_PLACES).map((place) => (
                <div
                  key={place.id}
                  onClick={() => handleSelectPlace(place)}
                  className="p-2.5 bg-slate-950 hover:bg-sky-950/40 border border-slate-800 hover:border-sky-600/50 rounded-xl cursor-pointer transition flex items-center justify-between group"
                >
                  <div className="flex-1 pr-2 truncate">
                    <div className="text-xs font-bold text-slate-200 group-hover:text-sky-300 truncate">
                      {place.name}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {place.category} · {place.distanceMeters ? `${place.distanceMeters}m away` : 'Chikkamagaluru'}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400" />
                </div>
              ))}
            </div>
          </div>

          {/* Guardian Pairing Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300 mb-0.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Guardian Tracking Code
              </div>
              <p className="text-xs text-slate-400">Share this 6-digit code with your Guardian</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-black text-sky-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-700">
                {pairingCode}
              </span>
              <button
                onClick={handleCopyPairingCode}
                title="Generate / Copy Code"
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
              >
                {copiedCode ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Google Maps-Style Navigation Display */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          {/* Active Navigation Header if navigating */}
          {activeRoute && (
            <div className="bg-sky-950/50 border border-sky-500/50 rounded-2xl p-4 shadow-xl flex items-center justify-between">
              <div className="flex-1 pr-3">
                <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <NavIcon className="w-4 h-4 animate-spin text-sky-400" />
                  <span>Turn-By-Turn Guidance Active</span>
                </div>
                <h3 className="text-base font-bold text-white truncate">
                  {activeRoute.steps[currentStepIndex]?.instruction || 'Continue straight on pedestrian lane'}
                </h3>
                <div className="flex items-center gap-3 text-xs text-slate-300 mt-1">
                  <span>Step {currentStepIndex + 1} of {activeRoute.steps.length}</span>
                  <span>•</span>
                  <span className="font-mono text-sky-300">
                    {activeRoute.steps[currentStepIndex]?.distanceMeters}m to next maneuver
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAdvanceStep}
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
                >
                  Next Step
                </button>
                <button
                  onClick={handleStopNavigation}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition"
                >
                  End
                </button>
              </div>
            </div>
          )}

          {/* Interactive Map View */}
          <div className="flex-1 min-h-[480px] h-[520px] relative">
            <InteractiveMap
              currentLocation={currentLocation}
              route={activeRoute}
              heading={heading}
              obstacleDetected={bleState.obstacleDetected}
              obstacleDistanceCm={bleState.obstacleDistanceCm}
              onRecalculateRoute={() => {
                if (activeRoute) {
                  speechService.speak('Recalculating pedestrian route...');
                  routingService.getWalkingRoute(
                    currentLocation,
                    activeRoute.destinationCoords,
                    activeRoute.destinationName
                  ).then(handleStartNavigation);
                }
              }}
              className="h-full w-full min-h-[480px]"
            />
          </div>

          {/* Bottom Telemetry & Controls Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Front Steering</span>
              <span className="text-xs font-mono font-bold text-sky-400">
                {bleState.steeringAngle === 0 ? 'CENTER (0°)' : `${bleState.steeringAngle}°`}
              </span>
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Radar Scan</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {bleState.scanningActive ? 'ACTIVE (45°-135°)' : 'STANDBY'}
              </span>
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Obstacle Status</span>
              <span
                className={`text-xs font-mono font-bold ${
                  bleState.obstacleDetected ? 'text-red-400 animate-pulse' : 'text-slate-300'
                }`}
              >
                {bleState.obstacleDetected ? `DETECTED (${bleState.obstacleDistanceCm}cm)` : 'CLEAR'}
              </span>
            </div>

            <button
              onClick={onOpenHardwareTest}
              className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-left transition flex items-center justify-between"
            >
              <div>
                <span className="text-[10px] text-yellow-400 font-bold uppercase block">Diagnostics</span>
                <span className="text-xs font-bold text-white">Hardware Test</span>
              </div>
              <Sliders className="w-4 h-4 text-yellow-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
