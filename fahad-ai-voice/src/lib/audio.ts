interface AudioManagerOptions {
  onTranscript: (transcript: string) => void;
  onSilence: () => void;
  onError: (error: string) => void;
}

export class AudioManager {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private audioChunks: Blob[] = [];
  private silenceTimeout: NodeJS.Timeout | null = null;
  private lastSoundTime = 0;
  
  private options: AudioManagerOptions;

  constructor(options: AudioManagerOptions) {
    this.options = options;
  }

  async startListening(): Promise<void> {
    try {
      // Get microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Set up audio context for VAD
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);

      // Set up MediaRecorder for audio capture
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processAudioChunk();
      };

      // Start recording
      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;

      // Start VAD monitoring
      this.startVADMonitoring();

    } catch (error) {
      console.error('Failed to start listening:', error);
      this.options.onError('Microphone access denied or not available');
    }
  }

  async stopListening(): Promise<void> {
    this.isRecording = false;
    
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    if (this.audioContext) {
      await this.audioContext.close();
    }

    this.cleanup();
  }

  private startVADMonitoring(): void {
    if (!this.analyser || !this.isRecording) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkVolume = () => {
      if (!this.isRecording || !this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate RMS (Root Mean Square) for volume detection
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength);
      
      // Threshold for voice activity detection (adjust as needed)
      const threshold = 15;
      
      if (rms > threshold) {
        this.lastSoundTime = Date.now();
        
        // Clear any existing silence timeout
        if (this.silenceTimeout) {
          clearTimeout(this.silenceTimeout);
          this.silenceTimeout = null;
        }
      } else {
        // Check if we've been silent for too long
        const silenceDuration = Date.now() - this.lastSoundTime;
        if (silenceDuration > 2000 && !this.silenceTimeout) { // 2 seconds of silence
          this.silenceTimeout = setTimeout(() => {
            this.options.onSilence();
          }, 18000); // 18 more seconds = 20 total
        }
      }

      if (this.isRecording) {
        requestAnimationFrame(checkVolume);
      }
    };

    checkVolume();
  }

  private async processAudioChunk(): Promise<void> {
    if (this.audioChunks.length === 0) return;

    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    this.audioChunks = [];

    // Only process if the audio chunk is substantial enough
    if (audioBlob.size < 1000) return; // Less than 1KB is likely silence

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      const response = await fetch('/api/stt', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`STT API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.transcript && result.transcript.trim().length > 0) {
        this.options.onTranscript(result.transcript);
      }
    } catch (error) {
      console.error('Failed to process audio:', error);
      this.options.onError('Failed to process speech');
    }
  }

  cleanup(): void {
    this.isRecording = false;
    
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.mediaRecorder = null;
    this.analyser = null;
    this.microphone = null;
    this.audioChunks = [];
  }

  // Get current audio level for visualization (0-100)
  getAudioLevel(): number {
    if (!this.analyser) return 0;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    
    return Math.min(100, (rms / 50) * 100); // Normalize to 0-100
  }
}