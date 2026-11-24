import { AssistantState, Coordinates, NavigationRoute, PlacePOI } from '../types';
import { speechService } from './speechService';
import { placesService, CHIKKAMAGALURU_COORDS } from './placesService';
import { routingService } from './routingService';
import { bleService } from './bleService';

export interface AssistantEvent {
  state: AssistantState;
  transcript: string;
  response: string;
  activeRoute?: NavigationRoute | null;
  proposedDestination?: PlacePOI | null;
  micPermissionGranted?: boolean;
}

export type VoiceAssistantListener = (event: AssistantEvent) => void;

class VoiceAssistant {
  private recognition: any = null;
  private isListening = false;
  private shouldBeListening = false;
  private state: AssistantState = 'idle';
  private transcript = '';
  private lastAssistantResponse = '';
  private proposedDestination: PlacePOI | null = null;
  private proposedRoute: NavigationRoute | null = null;
  private listeners: VoiceAssistantListener[] = [];
  private userLocation: Coordinates = CHIKKAMAGALURU_COORDS;
  private onNavigateCallback?: (route: NavigationRoute) => void;
  private onEmergencyCallback?: () => void;
  private onStopNavigationCallback?: () => void;
  private onCallGuardianCallback?: () => void;
  private isNavigating = false;
  private activeRoute: NavigationRoute | null = null;
  private speechDebounceTimer: any = null;
  private restartTimer: any = null;
  private micPermissionGranted = false;
  private lastProcessedInput = '';

  constructor() {
    this.initSpeechRecognition();
  }

  private initSpeechRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[VoiceAssistant] Web Speech API not supported in this browser.');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;

      // Auto-detect Indian English or fallback to en-US for high-accuracy recognition
      const isIndian =
        typeof navigator !== 'undefined' &&
        (navigator.language?.includes('IN') ||
          navigator.languages?.some((l) => l.includes('IN')));
      this.recognition.lang = isIndian ? 'en-IN' : 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.micPermissionGranted = true;
        this.emitState();
      };

      this.recognition.onresult = (event: any) => {
        let currentSentence = '';
        let isFinal = false;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const piece = event.results[i][0].transcript;
          currentSentence += piece;
          if (event.results[i].isFinal) {
            isFinal = true;
          }
        }

        const trimmed = currentSentence.trim();
        if (!trimmed) return;

        const lowerTrimmed = trimmed.toLowerCase();

        // Echo Guard: completely ignore mic while STICK is speaking aloud UNLESS user is saying wake phrase or emergency to interrupt
        const isInterrupt =
          lowerTrimmed.includes('hey stick') ||
          lowerTrimmed.includes('hi stick') ||
          lowerTrimmed.includes('stop') ||
          lowerTrimmed.includes('emergency') ||
          lowerTrimmed.includes('help');

        if (speechService.isCurrentlySpeaking() || this.state === 'speaking') {
          if (isInterrupt) {
            speechService.stop();
          } else {
            return;
          }
        }

        this.transcript = trimmed;
        this.emitState();

        clearTimeout(this.speechDebounceTimer);

        if (isFinal) {
          this.processVoiceInputDebounced(trimmed);
        } else {
          // Robust Silence Debounce: If user pauses speaking for 800ms, process their input
          this.speechDebounceTimer = setTimeout(() => {
            if (this.transcript && this.transcript === trimmed) {
              this.processVoiceInputDebounced(trimmed);
            }
          }, 800);
        }
      };

      this.recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          this.micPermissionGranted = false;
          console.warn(
            '[VoiceAssistant] Microphone access blocked. Tap the mic button to grant access.'
          );
        } else if (event.error !== 'no-speech') {
          console.warn('[VoiceAssistant] SpeechRecognition error:', event.error);
        }
        this.emitState();
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.emitState();

        // Keep listening alive unless STICK is currently speaking
        if (this.shouldBeListening && this.state !== 'speaking') {
          clearTimeout(this.restartTimer);
          this.restartTimer = setTimeout(() => {
            try {
              if (this.shouldBeListening && !this.isListening && this.state !== 'speaking') {
                this.recognition.start();
              }
            } catch (_) {}
          }, 250);
        }
      };
    } catch (e) {
      console.error('[VoiceAssistant] Failed to init SpeechRecognition:', e);
    }
  }

  private processVoiceInputDebounced(rawText: string) {
    const clean = rawText.trim().toLowerCase();
    // Prevent duplicate rapid triggers of exact same utterance
    if (clean === this.lastProcessedInput) return;
    this.lastProcessedInput = clean;

    setTimeout(() => {
      if (this.lastProcessedInput === clean) {
        this.lastProcessedInput = '';
      }
    }, 1500);

    this.handleSpokenInput(rawText);
  }

  public setUserLocation(coords: Coordinates) {
    this.userLocation = coords;
  }

  public setNavigationState(navigating: boolean, route: NavigationRoute | null) {
    this.isNavigating = navigating;
    this.activeRoute = route;
    if (navigating) {
      this.state = 'navigating';
    } else if (this.state === 'navigating') {
      this.state = 'idle';
    }
    this.emitState();
  }

  public setCallbacks(callbacks: {
    onNavigate: (route: NavigationRoute) => void;
    onEmergency: () => void;
    onStopNavigation: () => void;
    onCallGuardian: () => void;
  }) {
    this.onNavigateCallback = callbacks.onNavigate;
    this.onEmergencyCallback = callbacks.onEmergency;
    this.onStopNavigationCallback = callbacks.onStopNavigation;
    this.onCallGuardianCallback = callbacks.onCallGuardian;
  }

  public subscribe(listener: VoiceAssistantListener) {
    this.listeners.push(listener);
    this.emitState();
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emitState() {
    const event: AssistantEvent = {
      state: this.state,
      transcript: this.transcript,
      response: this.lastAssistantResponse,
      activeRoute: this.activeRoute,
      proposedDestination: this.proposedDestination,
      micPermissionGranted: this.micPermissionGranted
    };
    this.listeners.forEach((l) => l(event));
  }

  public startListening() {
    this.shouldBeListening = true;
    speechService.resumeAudioContext();

    if (!this.recognition) return;
    try {
      this.recognition.start();
    } catch (e) {
      // Already active
    }
  }

  public stopListening() {
    this.shouldBeListening = false;
    clearTimeout(this.restartTimer);
    clearTimeout(this.speechDebounceTimer);
    if (this.recognition && this.isListening) {
      try {
        this.recognition.abort();
      } catch (_) {}
    }
  }

  /**
   * Speak response, clear previous transcript, and resume fresh listening
   */
  private async respondAndSpeak(text: string, nextState: AssistantState = 'idle') {
    this.lastAssistantResponse = text;
    this.state = 'speaking';
    this.emitState();

    // Abort mic during speech to guarantee STICK never hears its own voice
    if (this.recognition && this.isListening) {
      try {
        this.recognition.abort();
      } catch (_) {}
    }

    await speechService.speak(text);

    this.state = nextState;
    this.transcript = ''; // Reset transcript for the next clean user turn
    this.emitState();

    // Re-engage listening cleanly
    if (this.shouldBeListening) {
      setTimeout(() => {
        this.startListening();
      }, 250);
    }
  }

  /**
   * Conversational Brain & Intent Engine
   */
  public async handleSpokenInput(rawText: string) {
    const text = rawText.toLowerCase().trim();
    console.log(`[VoiceAssistant] Processing input: "${text}" (Current State: ${this.state})`);

    // Check for Wake Phrase variations
    const isWakePhrase =
      text.includes('hey stick') ||
      text.includes('hi stick') ||
      text.includes('hello stick') ||
      text.includes('stick') ||
      text.includes('a stick') ||
      text.includes('hey stik') ||
      text.includes('hey steak') ||
      text.includes('hey speak') ||
      text.includes('plastic');

    const isEmergency =
      text.includes('emergency') ||
      text.includes('help me') ||
      text.includes('sos') ||
      text.includes('danger') ||
      text.includes('accident');

    // Priority 1: Emergency commands anytime
    if (isEmergency) {
      speechService.stop();
      speechService.playEmergencyAlarm();
      await this.respondAndSpeak(
        'Emergency triggered. Notifying your guardian and stopping navigation.',
        'idle'
      );
      this.onEmergencyCallback?.();
      return;
    }

    // Priority 2: Call Guardian anytime
    if (
      text.includes('call my guardian') ||
      text.includes('call guardian') ||
      text.includes('contact guardian')
    ) {
      speechService.playConfirmChime();
      await this.respondAndSpeak(
        'Contacting your Guardian now and transmitting your live location in Chikkamagaluru.',
        'idle'
      );
      this.onCallGuardianCallback?.();
      return;
    }

    // Priority 3: Stop / End navigation anytime
    if (
      text.includes('stop navigation') ||
      text.includes('end navigation') ||
      text.includes('cancel navigation') ||
      (this.isNavigating && (text === 'stop' || text.includes('stop now')))
    ) {
      speechService.playConfirmChime();
      this.onStopNavigationCallback?.();
      await this.respondAndSpeak('Navigation stopped. I am here whenever you are ready.', 'idle');
      return;
    }

    // Priority 4: Status queries during active navigation
    if (this.isNavigating) {
      if (
        text.includes('how far') ||
        text.includes('distance') ||
        text.includes('remaining time')
      ) {
        const remainingDist = this.activeRoute?.distanceMeters || 400;
        const mins = Math.max(1, Math.round(remainingDist / 66));
        await this.respondAndSpeak(
          `Your destination is approximately ${remainingDist} metres away. It should take about ${mins} minutes.`,
          'navigating'
        );
        return;
      }

      if (text.includes('where am i') || text.includes('where are we')) {
        await this.respondAndSpeak(
          `You are navigating in Chikkamagaluru towards ${
            this.activeRoute?.destinationName || 'your destination'
          }. The route is clear ahead.`,
          'navigating'
        );
        return;
      }

      if (text.includes('turn left') || text.includes('left')) {
        bleService.sendCommand('LEFT');
        await this.respondAndSpeak('Steering front wheel left.', 'navigating');
        return;
      }

      if (text.includes('turn right') || text.includes('right')) {
        bleService.sendCommand('RIGHT');
        await this.respondAndSpeak('Steering front wheel right.', 'navigating');
        return;
      }

      if (text.includes('straight') || text.includes('center')) {
        bleService.sendCommand('CENTER');
        await this.respondAndSpeak('Steering front wheel centered.', 'navigating');
        return;
      }

      if (text.includes('take me back') || text.includes('go back')) {
        await this.respondAndSpeak(
          'Reversing route back to your starting point. Turn around safely.',
          'navigating'
        );
        return;
      }
    }

    // --- State: Awaiting Confirmation ("Would you like me to take you there?") ---
    if (this.state === 'awaiting_confirmation') {
      const isYes =
        text.includes('yes') ||
        text.includes('yeah') ||
        text.includes('yep') ||
        text.includes('sure') ||
        text.includes('start') ||
        text.includes('lets go') ||
        text.includes("let's go") ||
        text.includes('ok') ||
        text.includes('okay') ||
        text.includes('take me') ||
        text.includes('alright') ||
        text.includes('proceed') ||
        text.includes('please') ||
        text.includes('do it') ||
        text.includes('confirm');

      const isNo =
        text.includes('no') ||
        text.includes('nope') ||
        text.includes('cancel') ||
        text.includes('wait') ||
        text.includes('dont') ||
        text.includes("don't") ||
        text.includes('not now') ||
        text.includes('change') ||
        text.includes('different');

      if (isYes) {
        speechService.playConfirmChime();
        if (this.proposedRoute) {
          const route = this.proposedRoute;
          await this.respondAndSpeak('Alright! Starting turn by turn navigation.', 'navigating');
          this.onNavigateCallback?.(route);
        } else {
          await this.respondAndSpeak('Starting navigation mode.', 'navigating');
        }
        return;
      }

      if (isNo) {
        this.proposedDestination = null;
        this.proposedRoute = null;
        await this.respondAndSpeak(
          'No problem. Where would you like to go instead, or would you like a random walk?',
          'listening_destination'
        );
        return;
      }

      // Check if user changed their mind and named another place directly
      const anotherQuery = this.cleanPlaceQuery(text);
      if (anotherQuery && anotherQuery.length >= 3) {
        await this.handleDestinationSearch(anotherQuery);
        return;
      }

      await this.respondAndSpeak(
        'Please say yes to start navigation, or no to choose another place.',
        'awaiting_confirmation'
      );
      return;
    }

    // --- State: Awaiting Sentiment (STICK just asked: "Hey! How are you doing today?") ---
    if (this.state === 'awaiting_sentiment') {
      // Check if user directly answered with random walk
      if (
        text.includes('random walk') ||
        text.includes('just a walk') ||
        text.includes('stroll') ||
        text.includes('walk around')
      ) {
        await this.handleRandomWalkRequest();
        return;
      }

      // Check if user directly named a destination
      if (
        text.includes('take me to') ||
        text.includes('go to') ||
        text.includes('find') ||
        text.includes('hospital') ||
        text.includes('restaurant') ||
        text.includes('canteen') ||
        text.includes('bus stand') ||
        text.includes('bus stop') ||
        text.includes('railway') ||
        text.includes('shop') ||
        text.includes('market') ||
        text.includes('park') ||
        text.includes('pharmacy')
      ) {
        const placeQuery = this.cleanPlaceQuery(text);
        if (placeQuery && placeQuery.length >= 2) {
          await this.handleDestinationSearch(placeQuery);
          return;
        }
      }

      // Negative Sentiment (Evaluated BEFORE positive)
      const isNegative =
        text.includes('not good') ||
        text.includes('not well') ||
        text.includes('not great') ||
        text.includes('not okay') ||
        text.includes('bad') ||
        text.includes('tired') ||
        text.includes('sad') ||
        text.includes('difficult') ||
        text.includes('rough') ||
        text.includes('terrible') ||
        text.includes('low') ||
        text.includes('unwell') ||
        text.includes('sick') ||
        text.includes('worse') ||
        text.includes('awful');

      if (isNegative) {
        await this.respondAndSpeak(
          "I'm sorry you're having a difficult day. We can take things slowly. Where would you like to go, or would you prefer a random walk?",
          'listening_destination'
        );
        return;
      }

      // Positive Sentiment
      const isPositive =
        text.includes('great') ||
        text.includes('good') ||
        text.includes('fine') ||
        text.includes('awesome') ||
        text.includes('doing well') ||
        text.includes('happy') ||
        text.includes('cool') ||
        text.includes('ok') ||
        text.includes('okay') ||
        text.includes('nice') ||
        text.includes('well') ||
        text.includes('super') ||
        text.includes('better') ||
        text.includes('all good') ||
        text.includes('doing good') ||
        text.includes("i'm good") ||
        text.includes('im good') ||
        text.includes('i am good') ||
        text.includes("i'm fine") ||
        text.includes('im fine') ||
        text.includes('i am fine') ||
        text.includes('not bad');

      if (isPositive) {
        await this.respondAndSpeak(
          'Glad to hear that! Where are we heading today, or would you prefer a random walk?',
          'listening_destination'
        );
        return;
      }

      // Check if user said a specific location name in Chikkamagaluru
      const fallbackQuery = this.cleanPlaceQuery(text);
      if (fallbackQuery && fallbackQuery.length >= 2) {
        await this.handleDestinationSearch(fallbackQuery);
        return;
      }

      // Default conversational prompt
      await this.respondAndSpeak(
        'Where would you like to head today? You can say hospital, restaurant, bus stand, or random walk.',
        'listening_destination'
      );
      return;
    }

    // --- State: Listening for Destination ---
    if (this.state === 'listening_destination') {
      if (
        text.includes('random walk') ||
        text.includes('just take a walk') ||
        text.includes('take a walk') ||
        text.includes('just a walk') ||
        text.includes('stroll') ||
        text.includes('walk around') ||
        text === 'walk'
      ) {
        await this.handleRandomWalkRequest();
        return;
      }

      const placeQuery = this.cleanPlaceQuery(text);
      if (placeQuery && placeQuery.length >= 2) {
        await this.handleDestinationSearch(placeQuery);
        return;
      }

      await this.respondAndSpeak(
        'Where would you like to head? You can say hospital, restaurant, bus stand, or random walk.',
        'listening_destination'
      );
      return;
    }

    // --- State: Idle / Greeting ---
    // If the user says "Hey STICK", activate conversational greeting
    if (isWakePhrase) {
      speechService.playWakeChime();
      await this.respondAndSpeak('Hey! How are you doing today?', 'awaiting_sentiment');
      return;
    }

    // Direct destination from Idle state (e.g. "Hey STICK, take me to hospital" or just "take me to hospital")
    if (
      text.includes('hospital') ||
      text.includes('restaurant') ||
      text.includes('canteen') ||
      text.includes('bus stand') ||
      text.includes('bus stop') ||
      text.includes('railway') ||
      text.includes('train station') ||
      text.includes('shop') ||
      text.includes('market') ||
      text.includes('park') ||
      text.includes('pharmacy') ||
      text.includes('take me to') ||
      text.includes('find a') ||
      text.includes('go to') ||
      text.includes('navigate to')
    ) {
      const placeQuery = this.cleanPlaceQuery(text);
      if (placeQuery && placeQuery.length >= 2) {
        await this.handleDestinationSearch(placeQuery);
        return;
      }
    }

    if (
      text.includes('random walk') ||
      text.includes('just take a walk') ||
      text.includes('take a walk') ||
      text.includes('just a walk') ||
      text.includes('stroll') ||
      text.includes('walk around')
    ) {
      await this.handleRandomWalkRequest();
      return;
    }
  }

  private cleanPlaceQuery(text: string): string {
    return text
      .replace(/hey stick/g, '')
      .replace(/hi stick/g, '')
      .replace(/hello stick/g, '')
      .replace(/stick/g, '')
      .replace(/take me to the/g, '')
      .replace(/take me to a/g, '')
      .replace(/take me to/g, '')
      .replace(/let's go to the/g, '')
      .replace(/let's go to a/g, '')
      .replace(/let's go to/g, '')
      .replace(/lets go to/g, '')
      .replace(/find the/g, '')
      .replace(/find a/g, '')
      .replace(/find/g, '')
      .replace(/i want to visit the/g, '')
      .replace(/i want to visit a/g, '')
      .replace(/i want to visit/g, '')
      .replace(/i want to go to/g, '')
      .replace(/navigate to the/g, '')
      .replace(/navigate to a/g, '')
      .replace(/navigate to/g, '')
      .replace(/go to the/g, '')
      .replace(/go to a/g, '')
      .replace(/go to/g, '')
      .replace(/show me the route to/g, '')
      .replace(/show me the way to/g, '')
      .replace(/nearby/g, '')
      .replace(/please/g, '')
      .replace(/around here/g, '')
      .trim();
  }

  /**
   * Search destination, fetch real walking route, speak distance and ETA, and prompt for confirmation
   */
  public async handleDestinationSearch(destinationQuery: string) {
    this.state = 'searching_places';
    this.emitState();
    speechService.playConfirmChime();

    const places = await placesService.searchPlaces(destinationQuery, this.userLocation);

    if (places.length === 0) {
      await this.respondAndSpeak(
        `I could not find ${destinationQuery} nearby in Chikkamagaluru. Would you like to try another place or take a random walk?`,
        'listening_destination'
      );
      return;
    }

    const bestPlace = places[0];
    this.proposedDestination = bestPlace;

    // Fetch actual walking route from OSRM
    const route = await routingService.getWalkingRoute(
      this.userLocation,
      { lat: bestPlace.lat, lng: bestPlace.lng },
      bestPlace.name
    );
    this.proposedRoute = route;

    const distanceMeters = route.distanceMeters;
    const durationMinutes = Math.max(1, Math.round(route.durationSeconds / 60));

    const promptText = `I found ${bestPlace.name} approximately ${distanceMeters} metres away. It should take around ${durationMinutes} minutes to walk. Would you like me to take you there?`;

    await this.respondAndSpeak(promptText, 'awaiting_confirmation');
  }

  /**
   * Handle Random Walk request
   */
  public async handleRandomWalkRequest() {
    this.state = 'searching_places';
    this.emitState();
    speechService.playConfirmChime();

    const route = await routingService.planRandomWalk(this.userLocation);
    this.proposedRoute = route;
    this.proposedDestination = {
      id: 'random-walk-poi',
      name: 'Safe Pedestrian Loop',
      category: 'Random Walk',
      lat: route.destinationCoords.lat,
      lng: route.destinationCoords.lng,
      distanceMeters: route.distanceMeters
    };

    const dist = route.distanceMeters;
    const durationMinutes = Math.max(1, Math.round(route.durationSeconds / 60));

    const prompt = `I have planned a safe pedestrian walk approximately ${dist} metres around verified pedestrian footpaths. It will take about ${durationMinutes} minutes. Would you like to start this walk?`;

    await this.respondAndSpeak(prompt, 'awaiting_confirmation');
  }

  /**
   * Manual activation button trigger (tap mic or screen)
   */
  public triggerWakeWordManual() {
    this.startListening();
    speechService.playWakeChime();
    this.respondAndSpeak('Hey! How are you doing today?', 'awaiting_sentiment');
  }
}

export const voiceAssistant = new VoiceAssistant();
