/**
 * Speech Service: High-quality Text-To-Speech (TTS) and Web Audio earcon synthesizers
 * Engineered specifically for hands-free, accessible navigation for visually impaired users.
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

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  private initVoices() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    if (!voices.length) return;

    // Prefer clear English voices
    const preferred = voices.find(v => 
      (v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Ravi')))
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

    this.selectedVoice = preferred;
  }

  public subscribeSpeakingState(cb: (speaking: boolean) => void) {
    this.onSpeakingChangeCallbacks.push(cb);
    return () => {
      this.onSpeakingChangeCallbacks = this.onSpeakingChangeCallbacks.filter(c => c !== cb);
    };
  }

  private setSpeaking(state: boolean) {
    this.isSpeaking = state;
    this.onSpeakingChangeCallbacks.forEach(cb => cb(state));
  }

  /**
   * Speak text with high priority or cancel previous if requested.
   */
  public speak(text: string, options?: { priority?: boolean; onEnd?: () => void; rate?: number }): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth) {
        console.warn('[SpeechService] SpeechSynthesis not supported');
        resolve();
        return;
      }

      if (options?.priority) {
        this.synth.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = options?.rate || 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => {
        this.setSpeaking(true);
      };

      utterance.onend = () => {
        this.setSpeaking(false);
        options?.onEnd?.();
        resolve();
      };

      utterance.onerror = (e) => {
        console.error('[SpeechService] TTS error:', e);
        this.setSpeaking(false);
        options?.onEnd?.();
        resolve();
      };

      this.synth.speak(utterance);
    });
  }

  public stop() {
    if (this.synth) {
      this.synth.cancel();
      this.setSpeaking(false);
    }
  }

  public isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  // --- Earcon Sound Synthesizers (Web Audio API) ---

  /**
   * Pleasant ascending 2-tone earcon when STICK wakes up & starts listening.
   */
  public playWakeChime() {
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

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.12);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.35);
  }

  /**
   * Success / confirmation earcon.
   */
  public playConfirmChime() {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now); // A4
    osc.frequency.setValueAtTime(880, now + 0.1); // A5

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  /**
   * Urgent pulse tone for obstacle warning.
   */
  public playObstacleAlert() {
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
  }

  /**
   * Continuous high-priority emergency siren.
   */
  public playEmergencyAlarm() {
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
  }
}

export const speechService = new SpeechService();
