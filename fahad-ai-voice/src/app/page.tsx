'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioManager } from '@/lib/audio';

type SessionState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'ended';

interface Source {
  url: string;
  title?: string;
  snippet: string;
}

export default function Home() {
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const audioManagerRef = useRef<AudioManager | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);

  const startSession = useCallback(async () => {
    try {
      setError(null);
      setSessionState('listening');
      setIsSessionActive(true);
      sessionStartTimeRef.current = Date.now();
      
      if (audioManagerRef.current) {
        await audioManagerRef.current.startListening();
      }
    } catch (error) {
      console.error('Failed to start session:', error);
      setError('Failed to start listening. Please check your microphone permissions.');
      setSessionState('idle');
      setIsSessionActive(false);
    }
  }, []);

  const endSession = useCallback(async () => {
    try {
      setSessionState('ended');
      setIsSessionActive(false);
      
      if (audioManagerRef.current) {
        await audioManagerRef.current.stopListening();
      }
      
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      
      // Reset to idle after 3 seconds
      setTimeout(() => {
        setSessionState('idle');
        setSources([]);
      }, 3000);
    } catch (error) {
      console.error('Failed to end session:', error);
      setSessionState('idle');
      setIsSessionActive(false);
    }
  }, []);

  const processUserInput = useCallback(async (transcript: string) => {
    try {
      setSessionState('thinking');
      
      // Search for relevant content
      const searchResponse = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: transcript, max: 8 }),
      });

      if (!searchResponse.ok) {
        throw new Error('Search failed');
      }

      const searchResults = await searchResponse.json();
      setSources(searchResults.sources || []);

      // Generate response using heuristic summarization
      const response = generateResponse(searchResults.results || []);
      
      // Convert to speech
      setSessionState('speaking');
      await speakResponse(response);
      
      // Return to listening
      setSessionState('listening');
    } catch (error) {
      console.error('Failed to process input:', error);
      setError('Sorry, I encountered an error processing your request.');
      setSessionState('listening');
    }
  }, []);

  const handleTranscript = useCallback(async (transcript: string) => {
    console.log('Transcript:', transcript);
    
    // Check for wake words
    if (!isSessionActive && transcript.toLowerCase().includes('hi fahad')) {
      startSession();
      return;
    }

    if (isSessionActive && transcript.toLowerCase().includes('bye fahad')) {
      endSession();
      return;
    }

    // If session is active, process the transcript
    if (isSessionActive && sessionState === 'listening') {
      await processUserInput(transcript);
    }
  }, [isSessionActive, sessionState, startSession, endSession, processUserInput]);

  const handleSilence = useCallback(() => {
    if (isSessionActive && sessionState === 'listening') {
      // 20 second silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      
      silenceTimeoutRef.current = setTimeout(() => {
        endSession();
      }, 20000);
    }
  }, [isSessionActive, sessionState, endSession]);

  const handleAudioError = useCallback((error: string) => {
    console.error('Audio error:', error);
    setError(error);
    setSessionState('idle');
    setIsSessionActive(false);
  }, []);

  // Initialize audio manager
  useEffect(() => {
    audioManagerRef.current = new AudioManager({
      onTranscript: handleTranscript,
      onSilence: handleSilence,
      onError: handleAudioError,
    });

    return () => {
      if (audioManagerRef.current) {
        audioManagerRef.current.cleanup();
      }
    };
  }, [handleTranscript, handleSilence, handleAudioError]);

  const generateResponse = (results: Array<{text?: string; snippet?: string}>): string => {
    if (results.length === 0) {
      return "I don't have the details on that right now.";
    }

    // Simple heuristic: take top 3-6 sentences from highest scoring results
    const topResults = results.slice(0, 3);
    const sentences: string[] = [];

    for (const result of topResults) {
      const text = result.text || result.snippet || '';
      const resultSentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
      sentences.push(...resultSentences.slice(0, 2)); // Max 2 sentences per result
    }

    // Deduplicate and limit length
    const uniqueSentences = [...new Set(sentences)].slice(0, 4);
    let response = uniqueSentences.join('. ').trim();
    
    // Convert to first person
    response = response.replace(/\b(Muhammad Fahad Imdad|Fahad Imdad|Fahad)\b/gi, 'I');
    response = response.replace(/\b(he|him|his)\b/gi, (match, offset, string) => {
      const prevWord = string.substring(0, offset).split(/\s+/).pop()?.toLowerCase();
      return prevWord === 'i' ? match : (match === 'he' ? 'I' : match === 'him' ? 'me' : 'my');
    });

    // Cap length to ~60-120 words
    const words = response.split(' ');
    if (words.length > 120) {
      response = words.slice(0, 120).join(' ') + '...';
    }

    return response || "I don't have the details on that right now.";
  };

  const speakResponse = async (text: string): Promise<void> => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('TTS failed');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
    } catch (error) {
      console.error('Failed to speak response:', error);
      throw error;
    }
  };

  // Keyboard fallback
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isSessionActive) {
        event.preventDefault();
        startSession();
      } else if (event.code === 'Escape' && isSessionActive) {
        event.preventDefault();
        endSession();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isSessionActive, startSession, endSession]);

  return (
    <div className={`min-h-screen bg-black text-white flex flex-col items-center justify-center relative ${isSessionActive ? 'session-active' : ''}`}>
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <AnimatePresence mode="wait">
          {sessionState === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center"
            >
              <motion.h1 
                className="text-4xl md:text-6xl font-light mb-8 glow"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Say &quot;Hi Fahad&quot; to begin
              </motion.h1>
              <p className="text-sm text-gray-400">
                Press SPACE to start • Press ESC to end
              </p>
            </motion.div>
          )}

          {sessionState === 'listening' && (
            <motion.div
              key="listening"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <motion.div
                className="w-24 h-24 border-2 border-white rounded-full mx-auto mb-8"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <h2 className="text-2xl font-light">Listening…</h2>
            </motion.div>
          )}

          {sessionState === 'thinking' && (
            <motion.div
              key="thinking"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <motion.div className="flex space-x-2 justify-center mb-8">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-3 h-3 bg-white rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </motion.div>
              <h2 className="text-2xl font-light">Thinking…</h2>
            </motion.div>
          )}

          {sessionState === 'speaking' && (
            <motion.div
              key="speaking"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <div className="flex space-x-1 justify-center mb-8">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 bg-white equalizer-bar"
                    animate={{ height: [4, 20, 4] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                  />
                ))}
              </div>
              <h2 className="text-2xl font-light glow">Speaking…</h2>
            </motion.div>
          )}

          {sessionState === 'ended' && (
            <motion.div
              key="ended"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center"
            >
              <h2 className="text-2xl font-light mb-4">Session ended</h2>
              <p className="text-gray-400">Say &quot;Hi Fahad&quot; again to start a new session</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-300 text-center max-w-md"
          >
            {error}
          </motion.div>
        )}
      </div>

      {/* Sources */}
      {sources.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-4 right-4 max-w-xs"
        >
          <div className="text-xs text-gray-400 mb-2">Sources:</div>
          <div className="space-y-1 sources-scroll max-h-32 overflow-y-auto">
            {sources.slice(0, 3).map((source, index) => (
              <a
                key={index}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-gray-300 hover:text-white transition-colors truncate"
                title={source.title || source.url}
              >
                {source.title || new URL(source.url).pathname}
              </a>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}