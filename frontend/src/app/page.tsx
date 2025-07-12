'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Download, Loader2, Menu, X, Image as ImageIcon, Box } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl: string;
  timestamp: Date;
}

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [generatedImages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError('');

    try {
      // Direct URL - bypass config completely
      const apiUrl = 'http://localhost:8080/api/generate';
      console.log('DEBUG: API URL being called:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`Backend returned status ${response.status}`);
      }

      const data = await response.json();

      const newImage: GeneratedImage = {
        id: Date.now().toString(),
        prompt: prompt.trim(),
        imageUrl: data.imageUrl,
        timestamp: new Date(),
      };

      setGeneratedImages((prev) => [...prev, newImage]);
      setPrompt('');
    } catch (err) {
      console.error('Error generating image:', err);
      setError('Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex flex-col">
      {/* Header with Navigation */}
      <header className="bg-black/20 backdrop-blur-md border-b border-white/10 p-6 relative z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Navigation Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                {showMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              {showMenu && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-black/80 backdrop-blur-md rounded-lg border border-white/20 shadow-lg z-50 -ml-4">
                  <Link
                    href="/"
                    className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 transition-colors border-l-2 border-blue-500"
                    onClick={() => setShowMenu(false)}
                  >
                    <ImageIcon className="w-5 h-5" />
                    Image Generator
                  </Link>
                  <Link
                    href="/3d-generator"
                    className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 transition-colors"
                    onClick={() => setShowMenu(false)}
                  >
                    <Box className="w-5 h-5" />
                    3D Generator
                  </Link>
                </div>
              )}
            </div>

            <div>
              <h1 className="text-3xl font-bold text-white mb-2">AI Image Generator</h1>
              <p className="text-gray-300">
                Create stunning images from text descriptions using AI
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-6 flex flex-col">
        {/* Generated Images Grid */}
        <div
          className={`relative mb-4 ${
            generatedImages.length === 0
              ? 'h-[55vh] flex items-center justify-center'
              : 'flex-1'
          }`}
        >
          {generatedImages.length === 0 ? (
            <div className="text-center text-gray-400 w-full">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
                <Send className="w-12 h-12" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Start Creating</h3>
              <p>Enter a description below to generate your first AI image</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {generatedImages.map((image) => (
                <div
                  key={image.id}
                  className="bg-white/10 backdrop-blur-md rounded-lg overflow-hidden border border-white/20 hover:border-white/40 transition-all duration-300 relative z-10"
                >
                  <div className="relative aspect-square">
                    <Image
                      src={image.imageUrl}
                      alt={image.prompt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                  <div className="p-4">
                    <p className="text-white text-sm mb-3 line-clamp-2">{image.prompt}</p>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{image.timestamp.toLocaleString()}</span>
                      <button
                        onClick={() => downloadImage(image.imageUrl, `ai-image-${image.id}`)}
                        className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded hover:bg-white/30 transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Area */}
        <div className="bg-black/30 backdrop-blur-md rounded-lg border border-white/20 p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image you want to generate..."
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-white/40 focus:ring-2 focus:ring-blue-500/20"
                disabled={isGenerating}
              />
            </div>

            <button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Generate
                </>
              )}
            </button>
          </form>

          <div className="mt-4 text-xs text-gray-400 text-center">
            Enter a detailed description for better results. Example:{' '}
            &quot;A futuristic city at sunset with flying cars&quot;
          </div>
        </div>
      </main>
    </div>
  );
}