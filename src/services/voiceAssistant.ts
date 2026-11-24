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
  private restartTimer: any = null;
  private micPermissionGranted = false;

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
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.micPermissionGranted = true;
        this.emitState();
      };

      this.recognition.onresult = (event: any) => {
        // Echo Guard: Ignore all incoming speech while STICK is speaking aloud
        if (speechService.isCurrentlySpeaking() || this.state === 'speaking') {
          return;
        }

        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const piece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += piece;
          } else {
            interimTranscript += piece;
          }
        }

        const currentText = (finalTranscript || interimTranscript).trim();
        if (currentText) {
          this.transcript = currentText;
          this.emitState();
        }

        if (finalTranscript) {
          this.handleSpokenInput(finalTranscript.trim());
        }
      };

      this.recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          this.micPermissionGranted = false;
          console.warn('[VoiceAssistant] Microphone access not allowed. Tap microphone button to grant permission.');
        } else if (event.error !== 'no-speech') {
          console.warn('[VoiceAssistant] Speech recognition notice:', event.error);
        }
        this.emitState();
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.emitState();

        // Mobile browsers frequently stop recognition on silence; auto-restart cleanly
        if (this.shouldBeListening && this.state !== 'speaking') {
          clearTimeout(this.restartTimer);
          this.restartTimer = setTimeout(() => {
            try {
              if (this.shouldBeListening && !this.isListening) {
                this.recognition.start();
              }
            } catch (_) {}
          }, 300);
        }
      };
    } catch (e) {
      console.error('[VoiceAssistant] Failed to init SpeechRecognition:', e);
    }
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

  /**
   * Start listening for voice input (unlocked via user tap gesture)
   */
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
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (_) {}
    }
  }

  /**
   * Speak response and transition assistant state smoothly
   */
  private async respondAndSpeak(text: string, nextState: AssistantState = 'idle') {
    this.lastAssistantResponse = text;
    this.state = 'speaking';
    this.emitState();

    await speechService.speak(text);

    this.state = nextState;
    this.emitState();

    // Resume listening after speaking finishes
    if (this.shouldBeListening) {
      setTimeout(() => {
        this.startListening();
      }, 350);
    }
  }

  /**
   * Natural Conversation Engine & Intent Router
   */
  public async handleSpokenInput(rawText: string) {
    // Echo guard
    if (speechService.isCurrentlySpeaking() || this.state === 'speaking') {
      return;
    }

    const text = rawText.toLowerCase().trim();
    console.log(`[VoiceAssistant] Processing input: "${text}" in state "${this.state}"`);

    // Priority 1: Emergency commands anytime
    if (
      text.includes('emergency') ||
      text.includes('help me') ||
      text.includes('sos') ||
      text.includes('danger')
    ) {
      speechService.playEmergencyAlarm();
      await this.respondAndSpeak('Emergency triggered. Notifying your guardian and stopping navigation.', 'idle');
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
      await this.respondAndSpeak('Contacting your Guardian now and transmitting your live location.', 'idle');
      this.onCallGuardianCallback?.();
      return;
    }

    // Priority 3: Stop / End navigation anytime
    if (
      text.includes('stop navigation') ||
      text.includes('end navigation') ||
      text.includes('cancel navigation') ||
      (this.isNavigating && text === 'stop')
    ) {
      speechService.playConfirmChime();
      this.onStopNavigationCallback?.();
      await this.respondAndSpeak('Navigation stopped. I am here whenever you are ready.', 'idle');
      return;
    }

    // Priority 4: Status questions during active navigation
    if (this.isNavigating) {
      if (text.includes('how far') || text.includes('distance') || text.includes('remaining time')) {
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
          `You are navigating in Chikkamagaluru towards ${this.activeRoute?.destinationName || 'your destination'}. The route is clear ahead.`,
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
        await this.respondAndSpeak('Reversing route back to your starting point. Turn around safely.', 'navigating');
        return;
      }
    }

    // Wake phrase variations
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

    // --- Smart Combined Commands: User says wake phrase + command in one sentence ---
    // e.g. "Hey STICK take me to hospital" or "STICK let's go for a random walk"
    if (text.includes('random walk') || text.includes('just take a walk') || text.includes('stroll')) {
      await this.handleRandomWalkRequest();
      return;
    }

    if (
      text.includes('hospital') ||
      text.includes('restaurant') ||
      text.includes('bus stand') ||
      text.includes('railway') ||
      text.includes('shop') ||
      text.includes('market') ||
      text.includes('park') ||
      text.includes('take me to') ||
      text.includes('find a')
    ) {
      const destinationQuery = this.extractDestinationQuery(text);
      if (destinationQuery) {
        await this.handleDestinationSearch(destinationQuery);
        return;
      }
    }

    // If only the wake phrase was spoken:
    if (isWakePhrase && (this.state === 'idle' || this.state === 'listening_destination')) {
      speechService.playWakeChime();
      await this.respondAndSpeak('Hey! How are you doing today?', 'awaiting_sentiment');
      return;
    }

    // --- State 1: Awaiting Sentiment ("How are you doing today?") ---
    if (this.state === 'awaiting_sentiment') {
      const isPositive =
        text.includes('great') ||
        text.includes('good') ||
        text.includes('fine') ||
        text.includes('awesome') ||
        text.includes('doing well') ||
        text.includes('happy') ||
        text.includes('cool') ||
        text.includes('ok') ||
        text.includes('okay');

      const isNegative =
        text.includes('worse') ||
        text.includes('bad') ||
        text.includes('tired') ||
        text.includes('sad') ||
        text.includes('difficult') ||
        text.includes('rough') ||
        text.includes('not good') ||
        text.includes('terrible');

      if (isPositive) {
        if (text.includes('great') || text.includes('awesome')) {
          await this.respondAndSpeak(
            "That's good to hear! Where would you like to go today? Or would you like to take a random walk?",
            'listening_destination'
          );
        } else {
          await this.respondAndSpeak(
            "Glad to hear that! Where are we heading today, or would you prefer a random walk?",
            'listening_destination'
          );
        }
        return;
      }

      if (isNegative) {
        await this.respondAndSpeak(
          "I'm sorry you're having a difficult day. We can take things slowly. Would you like to go somewhere or just take a walk?",
          'listening_destination'
        );
        return;
      }

      // If user directly answers with a place or random walk
      const directQuery = this.extractDestinationQuery(text);
      if (directQuery) {
        await this.handleDestinationSearch(directQuery);
        return;
      }

      await this.respondAndSpeak(
        "Thanks for sharing. Where would you like to go today, or would you prefer a random walk?",
        'listening_destination'
      );
      return;
    }

    // --- State 2: Destination or Random Walk Intent ---
    if (this.state === 'listening_destination' || this.state === 'asking_destination') {
      const query = this.extractDestinationQuery(text);
      if (query && query.length >= 2) {
        await this.handleDestinationSearch(query);
        return;
      }

      await this.respondAndSpeak(
        'Where would you like to head? You can say hospital, restaurant, bus stand, or random walk.',
        'listening_destination'
      );
      return;
    }

    // --- State 3: Confirmation ("Would you like me to take you there?") ---
    if (this.state === 'awaiting_confirmation') {
      const isAffirmative =
        text.includes('yes') ||
        text.includes('yeah') ||
        text.includes('yep') ||
        text.includes('sure') ||
        text.includes('start') ||
        text.includes('lets go') ||
        text.includes("let's go") ||
        text.includes('ok') ||
        text.includes('okay') ||
        text.includes('take me there');

      const isNegative =
        text.includes('no') ||
        text.includes('nope') ||
        text.includes('cancel') ||
        text.includes('wait') ||
        text.includes('dont');

      if (isAffirmative) {
        speechService.playConfirmChime();
        if (this.proposedRoute) {
          const route = this.proposedRoute;
          await this.respondAndSpeak("Alright! Let's get started.", 'navigating');
          this.onNavigateCallback?.(route);
        } else {
          await this.respondAndSpeak('Starting navigation mode.', 'navigating');
        }
        return;
      }

      if (isNegative) {
        this.proposedDestination = null;
        this.proposedRoute = null;
        await this.respondAndSpeak(
          'No problem. Where would you like to go instead, or would you like a random walk?',
          'listening_destination'
        );
        return;
      }

      await this.respondAndSpeak(
        'Please say yes to start navigation, or no to choose another place.',
        'awaiting_confirmation'
      );
      return;
    }
  }

  private extractDestinationQuery(text: string): string {
    return text
      .replace(/hey stick/g, '')
      .replace(/hi stick/g, '')
      .replace(/stick/g, '')
      .replace(/take me to/g, '')
      .replace(/let's go to/g, '')
      .replace(/lets go to/g, '')
      .replace(/find a/g, '')
      .replace(/find/g, '')
      .replace(/i want to visit/g, '')
      .replace(/i want to go to/g, '')
      .replace(/navigate to/g, '')
      .replace(/go to/g, '')
      .replace(/nearby/g, '')
      .replace(/please/g, '')
      .trim();
  }

  /**
   * Search destination, fetch real walking route, speak distance and ETA, and prompt for confirmation
   */
  public async handleDestinationSearch(destinationQuery: string) {
    this.state = 'searching_places';
    this.emitState();
    speechService.speak('Searching for matching destinations in Chikkamagaluru...');

    const places = await placesService.searchPlaces(destinationQuery, this.userLocation);

    if (places.length === 0) {
      await this.respondAndSpeak(
        `I could not find ${destinationQuery} nearby. Would you like to try another place or take a random walk?`,
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
    speechService.speak('Planning a safe, accessible pedestrian walk nearby...');

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
