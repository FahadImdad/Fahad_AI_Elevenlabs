# Fahad AI – Voice Assistant

A voice-first AI assistant that speaks as Muhammad Fahad Imdad in first person. Built with Next.js 14 and ElevenLabs for real-time voice interaction.

## Features

- **Voice-First Interface**: Wake word "Hi Fahad" to start, "Bye Fahad" or 20s silence to end
- **Real-time Speech**: ElevenLabs STT and TTS with cloned "Fahad Voice"
- **Live Knowledge**: Fetches and searches fahadimdad.com in real-time
- **Cinematic UI**: Black and white theme with smooth animations
- **No External LLMs**: Uses extractive summarization from live website content

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion
- **Voice**: ElevenLabs API (STT + TTS)
- **Search**: BM25 text search with live website crawling
- **Caching**: Vercel KV with in-memory fallback
- **Deployment**: Vercel serverless functions

## Setup

1. **Clone and install dependencies**:
   ```bash
   cd fahad-ai-voice
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local` with your ElevenLabs credentials:
   ```
   ELEVEN_API_KEY=your_elevenlabs_api_key
   ELEVEN_VOICE_ID=your_cloned_fahad_voice_id
   ```

3. **Optional: Configure Vercel KV** (for better caching):
   ```
   KV_REST_API_URL=your_vercel_kv_url
   KV_REST_API_TOKEN=your_vercel_kv_token
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```

## Deployment

### Vercel (Recommended)

1. **Connect your repository** to Vercel
2. **Set environment variables** in Vercel dashboard:
   - `ELEVEN_API_KEY`
   - `ELEVEN_VOICE_ID`
   - `KV_REST_API_URL` (optional)
   - `KV_REST_API_TOKEN` (optional)
3. **Deploy** - Vercel will automatically build and deploy

### Manual Deployment

```bash
npm run build
npm start
```

## Usage

1. **Start a session**: Say "Hi Fahad" or press SPACE
2. **Ask questions**: The assistant will search fahadimdad.com for relevant information
3. **End session**: Say "Bye Fahad", press ESC, or wait 20 seconds of silence

## API Endpoints

- `POST /api/stt` - Speech-to-text conversion
- `POST /api/tts` - Text-to-speech generation
- `POST /api/search` - Search fahadimdad.com content
- `POST /api/preview` - Fetch and parse individual pages

## Architecture

### Voice Pipeline
1. **Audio Capture**: Microphone → VAD → Audio chunks
2. **Speech Recognition**: ElevenLabs STT → Transcript
3. **Content Search**: BM25 search → Relevant snippets
4. **Response Generation**: Heuristic summarization → First-person text
5. **Speech Synthesis**: ElevenLabs TTS → Audio playback

### Search System
1. **Site Crawling**: Sitemap.xml or shallow crawl
2. **Content Processing**: HTML → Text extraction → Chunking
3. **Indexing**: BM25 search index with caching
4. **Query Processing**: Real-time search with result ranking

### Caching Strategy
- **Sitemap**: 6 hours
- **Page Content**: 24 hours
- **Search Results**: 6 hours
- **Fallback**: In-memory cache (5 minutes)

## Security

- Domain allowlist: Only fahadimdad.com
- Rate limiting on API endpoints
- Server-side API key storage
- Robots.txt compliance

## Browser Support

- Modern browsers with WebRTC support
- Microphone permissions required
- Audio playback support needed

## Troubleshooting

### Microphone Issues
- Ensure microphone permissions are granted
- Check browser compatibility
- Verify audio input devices

### API Errors
- Verify ElevenLabs API key and voice ID
- Check network connectivity
- Review browser console for errors

### Search Issues
- Check if fahadimdad.com is accessible
- Verify KV configuration (if using)
- Review server logs for crawl errors

## Development

### Project Structure
```
src/
├── app/
│   ├── api/          # Serverless API routes
│   ├── globals.css   # Global styles
│   └── page.tsx      # Main UI component
├── lib/
│   ├── audio.ts      # Audio management
│   ├── bm25.ts       # Search functionality
│   ├── cache.ts      # Caching utilities
│   └── html.ts       # HTML processing
```

### Key Components
- **AudioManager**: Handles microphone, VAD, and audio processing
- **SearchIndex**: BM25-based search with live content
- **CacheManager**: KV and in-memory caching
- **StateMachine**: UI state management (idle/listening/thinking/speaking/ended)

## License

Private project for Muhammad Fahad Imdad.