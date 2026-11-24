import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

/**
 * Speech Service: High-performance Text-To-Speech (TTS) and Web Audio earcon synthesizers
 * Engineered specifically for hands-free, accessible navigation for visually impaired users.
 * Supports:
 *  1. Android Native TTS via @capacitor-community/text-to-speech (Direct hardware speaker output)
 *  2. Web Speech API (speechSynthesis) for desktop/mobile browsers
 *  3. Robust Fallback watchdog to ensure the assistant never hangs
 */

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private audioCtx: AudioContext | null = null;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isSpeaking = false;
  private onSpeakingChangeCallbacks: Array<(speaking: boolean) => void> = [];
  private isNative = false;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();

    if (this.isNative) {
      // Pre-warm the native Android TextToSpeech engine
      TextToSpeech.getSupportedLanguages().catch(() => {});
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.initVoices();
      }
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
  public async speak(
    text: string,
    options?: { priority?: boolean; onEnd?: () => void; rate?: number }
  ): Promise<void> {
    const cleanText = text.trim();
    if (!cleanText) {
      options?.onEnd?.();
      return;
    }

    this.resumeAudioContext();

    if (options?.priority || this.isSpeaking) {
      this.stop();
    }

    this.setSpeaking(true);

    if (this.isNative) {
      try {
        await TextToSpeech.speak({
          text: cleanText,
          lang: 'en-US',
          rate: options?.rate || 1.0,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient'
        });
        this.setSpeaking(false);
        options?.onEnd?.();
        return;
      } catch (nativeErr: any) {
        console.warn('[SpeechService] Native TTS attempt 1 failed, retrying:', nativeErr);
        // If Android TTS service was still binding, wait 350ms and retry once
        if (
          String(nativeErr).includes('Not yet initialized') ||
          String(nativeErr).includes('unavailable')
        ) {
          await new Promise((r) => setTimeout(r, 350));
          try {
            await TextToSpeech.speak({
              text: cleanText,
              lang: 'en-US',
              rate: options?.rate || 1.0,
              pitch: 1.0,
              volume: 1.0,
              category: 'ambient'
            });
            this.setSpeaking(false);
            options?.onEnd?.();
            return;
          } catch (retryErr) {
            console.warn('[SpeechService] Native TTS retry failed:', retryErr);
          }
        }
        // Fall back to browser Web Speech API
        await this.speakBrowser(cleanText, options);
        return;
      }
    } else {
      // Running on Web Browser
      await this.speakBrowser(cleanText, options);
    }
  }

  /**
   * Browser Web Speech API implementation with watchdog timer
   */
  private speakBrowser(
    text: string,
    options?: { onEnd?: () => void; rate?: number }
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth) {
        console.warn('[SpeechService] SpeechSynthesis not supported in this browser.');
        this.setSpeaking(false);
        options?.onEnd?.();
        resolve();
        return;
      }

      if (this.synth.speaking) {
        this.synth.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = options?.rate || 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Keep global reference to prevent Chrome garbage collector bug
      (window as any)._currentStickUtterance = utterance;

      let hasResolved = false;
      const finish = () => {
        if (!hasResolved) {
          hasResolved = true;
          this.setSpeaking(false);
          options?.onEnd?.();
          resolve();
        }
      };

      utterance.onstart = () => {
        this.setSpeaking(true);
      };

      utterance.onend = () => {
        finish();
      };

      utterance.onerror = (e) => {
        console.warn('[SpeechService] TTS event:', e);
        finish();
      };

      // Watchdog Timer: Guarantee the promise resolves even if browser drops onend
      const estimatedDurationMs = Math.max(1800, Math.min(8000, text.length * 80 + 800));
      setTimeout(() => {
        finish();
      }, estimatedDurationMs);

      try {
        this.synth.speak(utterance);
      } catch (err) {
        console.error('[SpeechService] speak error:', err);
        finish();
      }
    });
  }

  public stop() {
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
