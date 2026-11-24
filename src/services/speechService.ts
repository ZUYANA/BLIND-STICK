import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

/**
 * Speech Service: High-performance Text-To-Speech (TTS) and Web Audio earcon synthesizers
 * Hardened for Android APK (Capacitor Native) and Desktop/Mobile Web.
 * 
 * Key Features:
 *  1. Android Native TTS via @capacitor-community/text-to-speech (Direct hardware speaker)
 *  2. Resilient language negotiation (en-IN, en-US, system default)
 *  3. Zero-hang promise watchdog & immediate unblock on interrupt
 *  4. High-clarity Web Audio earcons for accessible navigation feedback
 */

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private audioCtx: AudioContext | null = null;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isSpeaking = false;
  private onSpeakingChangeCallbacks: Array<(speaking: boolean) => void> = [];
  private isNative = false;
  private preferredLang = 'en-US';
  private currentSpeakResolve: (() => void) | null = null;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();

    if (this.isNative) {
      this.initNativeTts();
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.initVoices();
      }
    }
  }

  /**
   * Pre-warm and negotiate best supported language on Android (e.g. en-IN or en-US)
   */
  private async initNativeTts() {
    try {
      const res = await TextToSpeech.getSupportedLanguages();
      if (res && res.languages && res.languages.length > 0) {
        const langs = res.languages;
        const enIn = langs.find((l) => l.includes('en-IN') || l.includes('en_IN'));
        const enUs = langs.find((l) => l.includes('en-US') || l.includes('en_US') || l === 'en');
        const anyEn = langs.find((l) => l.toLowerCase().startsWith('en'));

        if (enIn) {
          this.preferredLang = enIn;
        } else if (enUs) {
          this.preferredLang = enUs;
        } else if (anyEn) {
          this.preferredLang = anyEn;
        } else {
          this.preferredLang = langs[0];
        }
        console.log('[SpeechService] Android native TTS initialized with language:', this.preferredLang);
      }
    } catch (_) {
      this.preferredLang = 'en-US';
    }
  }

  public getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public resumeAudioContext() {
    this.getAudioContext();
    if (this.synth && this.synth.paused) {
      this.synth.resume();
    }
  }

  private initVoices() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    if (!voices.length) return;

    // Prefer natural English voices
    const preferred =
      voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Natural') ||
            v.name.includes('Google') ||
            v.name.includes('Samantha') ||
            v.name.includes('Daniel') ||
            v.name.includes('Ravi') ||
            v.name.includes('English'))
      ) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      voices[0];

    this.selectedVoice = preferred;
  }

  public subscribeSpeakingState(cb: (speaking: boolean) => void) {
    this.onSpeakingChangeCallbacks.push(cb);
    return () => {
      this.onSpeakingChangeCallbacks = this.onSpeakingChangeCallbacks.filter((c) => c !== cb);
    };
  }

  private setSpeaking(state: boolean) {
    this.isSpeaking = state;
    this.onSpeakingChangeCallbacks.forEach((cb) => cb(state));
  }

  /**
   * Main Speak Method
   * On Android APK: Routes to Native Android TextToSpeech for loud, clear physical speaker output.
   * On Web: Routes to Web Speech API with watchdog timers.
   */
  public speak(
    text: string,
    options?: { priority?: boolean; onEnd?: () => void; rate?: number }
  ): Promise<void> {
    const cleanText = text.trim();
    if (!cleanText) {
      options?.onEnd?.();
      return Promise.resolve();
    }

    this.resumeAudioContext();

    // Cancel any previous speech immediately
    if (options?.priority || this.isSpeaking) {
      this.stop();
    }

    return new Promise<void>((resolve) => {
      let isResolved = false;
      const complete = () => {
        if (!isResolved) {
          isResolved = true;
          this.currentSpeakResolve = null;
          this.setSpeaking(false);
          options?.onEnd?.();
          resolve();
        }
      };

      this.currentSpeakResolve = complete;
      this.setSpeaking(true);

      // Watchdog timeout based on speech length
      const maxMs = Math.max(1800, Math.min(10000, cleanText.length * 85 + 900));
      const watchdogTimer = setTimeout(() => {
        complete();
      }, maxMs);

      if (this.isNative) {
        this.speakNative(cleanText, options?.rate || 1.0)
          .then(() => {
            clearTimeout(watchdogTimer);
            complete();
          })
          .catch((err) => {
            console.warn('[SpeechService] Native TTS error, falling back to browser:', err);
            this.speakBrowser(cleanText, options?.rate || 1.0)
              .finally(() => {
                clearTimeout(watchdogTimer);
                complete();
              });
          });
      } else {
        this.speakBrowser(cleanText, options?.rate || 1.0)
          .finally(() => {
            clearTimeout(watchdogTimer);
            complete();
          });
      }
    });
  }

  /**
   * Android Native TTS with automatic language retry
   */
  private async speakNative(text: string, rate: number): Promise<void> {
    try {
      await TextToSpeech.speak({
        text,
        lang: this.preferredLang,
        rate,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient'
      });
    } catch (err: any) {
      const errStr = String(err);
      // If service was still binding, wait 350ms and try once
      if (errStr.includes('Not yet initialized') || errStr.includes('unavailable')) {
        await new Promise((r) => setTimeout(r, 350));
        await TextToSpeech.speak({
          text,
          lang: this.preferredLang,
          rate,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient'
        });
        return;
      }
      // If language was rejected, fallback to en-US or en
      if (errStr.includes('language is not supported')) {
        this.preferredLang = 'en-US';
        await TextToSpeech.speak({
          text,
          lang: 'en-US',
          rate,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient'
        });
        return;
      }
      throw err;
    }
  }

  /**
   * Browser Web Speech API implementation
   */
  private speakBrowser(text: string, rate: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth) {
        console.warn('[SpeechService] Web SpeechSynthesis not available.');
        resolve();
        return;
      }

      if (this.synth.speaking) {
        try {
          this.synth.cancel();
        } catch (_) {}
      }

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = rate;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Keep global reference to prevent Chrome garbage collection
      (window as any)._currentStickUtterance = utterance;

      let ended = false;
      const finish = () => {
        if (!ended) {
          ended = true;
          resolve();
        }
      };

      utterance.onend = finish;
      utterance.onerror = (e) => {
        console.warn('[SpeechService] Browser TTS event error:', e);
        finish();
      };

      try {
        this.synth.speak(utterance);
      } catch (err) {
        console.error('[SpeechService] Browser speak error:', err);
        finish();
      }
    });
  }

  /**
   * Immediate Stop / Interrupt
   */
  public stop() {
    if (this.currentSpeakResolve) {
      this.currentSpeakResolve();
      this.currentSpeakResolve = null;
    }

    if (this.isNative) {
      try {
        TextToSpeech.stop().catch(() => {});
      } catch (_) {}
    }

    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (_) {}
    }

    this.setSpeaking(false);
  }

  public isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  // --- Earcon Sound Synthesizers (Web Audio API) ---

  public playWakeChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.12); // E5

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.12);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.35);
    } catch (_) {}
  }

  public playConfirmChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.1);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (_) {}
  }

  public playObstacleAlert() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.setValueAtTime(600, now + 0.1);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (_) {}
  }

  public playEmergencyAlarm() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.linearRampToValueAtTime(400, now + 0.3);
      osc.frequency.linearRampToValueAtTime(900, now + 0.6);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.6);
    } catch (_) {}
  }
}

export const speechService = new SpeechService();
