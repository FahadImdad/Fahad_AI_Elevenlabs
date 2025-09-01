# Deployment Guide

## Vercel Deployment

### 1. Prerequisites
- Vercel account
- ElevenLabs API key and voice ID
- (Optional) Vercel KV for caching

### 2. Deploy to Vercel

#### Option A: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add ELEVEN_API_KEY
vercel env add ELEVEN_VOICE_ID
vercel env add KV_REST_API_URL  # Optional
vercel env add KV_REST_API_TOKEN  # Optional
```

#### Option B: GitHub Integration
1. Push code to GitHub repository
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard:
   - `ELEVEN_API_KEY`: Your ElevenLabs API key
   - `ELEVEN_VOICE_ID`: Your cloned Fahad voice ID
   - `KV_REST_API_URL`: (Optional) Vercel KV URL
   - `KV_REST_API_TOKEN`: (Optional) Vercel KV token

### 3. Environment Variables

#### Required
- `ELEVEN_API_KEY`: Your ElevenLabs API key
- `ELEVEN_VOICE_ID`: The voice ID for the cloned "Fahad Voice"

#### Optional
- `KV_REST_API_URL`: Vercel KV database URL for caching
- `KV_REST_API_TOKEN`: Vercel KV database token

### 4. Testing Deployment

1. Visit your deployed URL
2. Allow microphone permissions
3. Say "Hi Fahad" to start a session
4. Ask questions about Fahad's content
5. Say "Bye Fahad" to end the session

### 5. Troubleshooting

#### Common Issues
- **Microphone not working**: Check browser permissions
- **API errors**: Verify ElevenLabs credentials
- **Search not working**: Check if fahadimdad.com is accessible
- **Slow responses**: Consider setting up Vercel KV for caching

#### Logs
Check Vercel function logs for debugging:
```bash
vercel logs
```

### 6. Performance Optimization

- Enable Vercel KV for better caching
- Monitor function execution times
- Consider upgrading to Pro plan for higher limits
- Use Vercel Analytics for usage insights