/**
 * Speech Service: High-quality Text-To-Speech (TTS) and Web Audio earcon synthesizers
 * Engineered specifically for hands-free, accessible navigation for visually impaired users.
 * Hardened for Chrome Android, mobile WebViews, and desktop browsers.
 */

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private audioCtx: AudioContext | null = null;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isSpeaking = false;
  private onSpeakingChangeCallbacks: Array<(speaking: boolean) => void> = [];

  constructor() {
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
   * Speak text with safety watchdog timeout to prevent mobile Chrome from hanging indefinitely.
   */
  public speak(
    text: string,
    options?: { priority?: boolean; onEnd?: () => void; rate?: number }
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth) {
        console.warn('[SpeechService] SpeechSynthesis not supported in this browser.');
        options?.onEnd?.();
        resolve();
        return;
      }

      this.resumeAudioContext();

      if (options?.priority || this.synth.speaking) {
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

      // Watchdog Timer: Guarantee the promise resolves even if mobile browser drops onend
      const estimatedDurationMs = Math.max(2500, Math.min(10000, text.length * 85 + 1000));
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
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (_) {}
      this.setSpeaking(false);
    }
  }

  public isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  // --- Earcon Sound Synthesizers (Web Audio API) ---

  public playWakeChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.12); // E5

      gain.gain.setValueAtTime(0.2, now);
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
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.1);

      gain.gain.setValueAtTime(0.2, now);
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
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.setValueAtTime(600, now + 0.1);

      gain.gain.setValueAtTime(0.3, now);
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
