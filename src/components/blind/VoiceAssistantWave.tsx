import React from 'react';
import { AssistantState } from '../../types';
import { Mic, MicOff, Volume2, Sparkles, MessageSquare, Compass, AlertCircle } from 'lucide-react';
import { voiceAssistant } from '../../services/voiceAssistant';

interface VoiceAssistantWaveProps {
  state: AssistantState;
  transcript: string;
  assistantResponse: string;
  isListening: boolean;
  onManualTrigger: () => void;
  onSimulateVoiceCommand: (phrase: string) => void;
}

export const VoiceAssistantWave: React.FC<VoiceAssistantWaveProps> = ({
  state,
  transcript,
  assistantResponse,
  isListening,
  onManualTrigger,
  onSimulateVoiceCommand
}) => {
  const isSpeaking = state === 'speaking';
  const isActiveConversation = state !== 'idle';

  // Sample phrases that fit the conversational flow
  const suggestedPhrases = [
    'Hey STICK',
    "I'm great",
    "I'm feeling a little worse",
    'Take me to a hospital',
    'Find a restaurant nearby',
    'Let’s go for a random walk',
    'Yes',
    'Stop'
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Top Status Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                isSpeaking
                  ? 'bg-sky-400 animate-ping'
                  : isActiveConversation
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-slate-500'
              }`}
            />
            <div
              className={`absolute inset-0 w-3.5 h-3.5 rounded-full ${
                isSpeaking ? 'bg-sky-400' : isActiveConversation ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
            />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {isSpeaking
              ? 'STICK Speaking...'
              : state === 'awaiting_sentiment'
              ? 'Listening for reply...'
              : state === 'listening_destination'
              ? 'Listening for destination...'
              : state === 'awaiting_confirmation'
              ? 'Awaiting your confirmation...'
              : state === 'searching_places'
              ? 'Searching places...'
              : 'Listening for "Hey STICK"'}
          </span>
        </div>

        <span className="text-[11px] text-sky-400 bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded-full font-medium">
          Wake: "Hey STICK"
        </span>
      </div>

      {/* Main Interactive Mic & Sound Wave Animation */}
      <div className="flex flex-col items-center justify-center my-3">
        <button
          onClick={onManualTrigger}
          aria-label={isActiveConversation ? 'STICK is listening' : 'Tap to activate Hey STICK'}
          className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
            isSpeaking
              ? 'bg-gradient-to-tr from-sky-600 to-cyan-500 shadow-sky-500/40 ring-4 ring-sky-400/40'
              : isActiveConversation
              ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 animate-voice-active ring-4 ring-emerald-400/40'
              : 'bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 text-slate-300 hover:border-sky-500'
          }`}
        >
          {/* Animated sound wave bars when active */}
          {isActiveConversation && (
            <div className="absolute inset-0 flex items-center justify-center gap-1.5 pointer-events-none opacity-40">
              <span className="w-1 bg-white rounded-full animate-bounce h-6" style={{ animationDelay: '0.1s' }} />
              <span className="w-1 bg-white rounded-full animate-bounce h-10" style={{ animationDelay: '0.2s' }} />
              <span className="w-1 bg-white rounded-full animate-bounce h-14" style={{ animationDelay: '0.3s' }} />
              <span className="w-1 bg-white rounded-full animate-bounce h-10" style={{ animationDelay: '0.4s' }} />
              <span className="w-1 bg-white rounded-full animate-bounce h-6" style={{ animationDelay: '0.5s' }} />
            </div>
          )}

          {isSpeaking ? (
            <Volume2 className="w-10 h-10 text-white animate-pulse" />
          ) : (
            <Mic className="w-10 h-10 text-white" />
          )}
        </button>

        <p className="text-xs text-slate-400 mt-3 font-medium text-center">
          {isActiveConversation
            ? 'Speak naturally · Say "Yes", "No", or your destination'
            : 'Say "Hey STICK" or tap the microphone to begin'}
        </p>
      </div>

      {/* Dialogue Bubble: Assistant Spoken Message */}
      {assistantResponse && (
        <div className="bg-sky-950/40 border border-sky-800/60 rounded-xl p-3.5 mb-3 flex items-start gap-3">
          <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg flex-shrink-0 mt-0.5">
            <Volume2 className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-sky-400 mb-0.5">
              STICK Voice Response
            </div>
            <p className="text-sm font-semibold text-slate-100 leading-relaxed">
              "{assistantResponse}"
            </p>
          </div>
        </div>
      )}

      {/* Spoken Transcript Bubble */}
      {transcript && (
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 mb-4 flex items-start gap-2.5">
          <MessageSquare className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Heard You Say:
            </span>
            <span className="text-xs text-emerald-300 font-mono">"{transcript}"</span>
          </div>
        </div>
      )}

      {/* Voice Shortcut Chips (Accessible backup for noisy environments or browser speech limits) */}
      <div className="pt-2 border-t border-slate-800/80">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
          Voice Command Shortcuts
        </div>
        <div className="flex flex-wrap gap-1.5">
          {suggestedPhrases.map((phrase) => (
            <button
              key={phrase}
              onClick={() => onSimulateVoiceCommand(phrase)}
              className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 active:bg-sky-900 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
            >
              "{phrase}"
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
