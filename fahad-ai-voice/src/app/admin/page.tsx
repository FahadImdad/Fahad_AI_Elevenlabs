'use client';

import { useState } from 'react';

export default function AdminPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const warmCache = async () => {
    setIsLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: 'about fahad', max: 8 }),
      });
      
      if (response.ok) {
        setMessage('Cache warmed successfully!');
      } else {
        setMessage('Failed to warm cache');
      }
    } catch {
      setMessage('Error warming cache');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-light mb-8">Fahad AI Admin</h1>
        
        <div className="space-y-6">
          <div className="p-6 border border-gray-800 rounded-lg">
            <h2 className="text-xl font-light mb-4">Cache Management</h2>
            <p className="text-gray-400 mb-4">
              Warm the search cache by triggering a crawl of fahadimdad.com
            </p>
            <button
              onClick={warmCache}
              disabled={isLoading}
              className="px-6 py-2 bg-white text-black rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Warming Cache...' : 'Warm Cache'}
            </button>
            {message && (
              <p className="mt-4 text-sm text-gray-300">{message}</p>
            )}
          </div>
          
          <div className="p-6 border border-gray-800 rounded-lg">
            <h2 className="text-xl font-light mb-4">System Status</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>ElevenLabs API:</span>
                <span className="text-gray-400">Configured</span>
              </div>
              <div className="flex justify-between">
                <span>Search Index:</span>
                <span className="text-gray-400">Ready</span>
              </div>
              <div className="flex justify-between">
                <span>Cache:</span>
                <span className="text-gray-400">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}