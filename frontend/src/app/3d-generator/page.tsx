/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Download, Loader2, Menu, X, Image as ImageIcon, Box, Eye, RotateCcw, Send, ZoomIn, ZoomOut } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface Generated3DModel {
  id: string;
  prompt: string;
  imageUrl: string;
  modelFiles: Array<{
    filename: string;
    size: number;
    download_url: string;
  }>;
  processingTime: number;
  timestamp: Date;
  requestId: string;
}

// 3D Model Viewer Component
function ModelViewer({ 
  isOpen, 
  onClose, 
  modelUrl, 
  modelName 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  modelUrl: string; 
  modelName: string; 
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const sceneRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen || !modelUrl) return;

    let animationId: number;

    const initViewer = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load Three.js from CDN if not already loaded
        if (!(window as any).THREE) {
          await loadThreeJS();
        }

        const THREE = (window as any).THREE;

        // Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);
        
        // Camera - better positioning
        const camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000);
        camera.position.set(3, 3, 3);
        camera.lookAt(0, 0, 0);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(800, 600);
        renderer.setPixelRatio(window.devicePixelRatio);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        scene.add(directionalLight);

        const pointLight = new THREE.PointLight(0xffffff, 0.3);
        pointLight.position.set(-10, -10, -5);
        scene.add(pointLight);

        // Controls - use basic rotation instead of OrbitControls to avoid import issues
        let mouseDown = false;
        let mouseX = 0;
        let mouseY = 0;
        let targetRotationX = 0;
        let targetRotationY = 0;
        let rotationX = 0;
        let rotationY = 0;

        const onMouseDown = (event: MouseEvent) => {
          mouseDown = true;
          mouseX = event.clientX;
          mouseY = event.clientY;
        };

        const onMouseUp = () => {
          mouseDown = false;
        };

        const onMouseMove = (event: MouseEvent) => {
          if (!mouseDown) return;
          
          const deltaX = event.clientX - mouseX;
          const deltaY = event.clientY - mouseY;
          
          targetRotationY += deltaX * 0.01;
          targetRotationX += deltaY * 0.01;
          
          mouseX = event.clientX;
          mouseY = event.clientY;
        };

        const onWheel = (event: WheelEvent) => {
          camera.position.multiplyScalar(1 + event.deltaY * 0.001);
          // Update zoom level for display
          const distance = camera.position.length();
          setZoomLevel(Math.max(0.1, Math.min(10, 5 / distance)));
        };

        // Add to DOM
        if (mountRef.current) {
          mountRef.current.innerHTML = ''; // Clear previous content
          mountRef.current.appendChild(renderer.domElement);
          
          // Add event listeners
          renderer.domElement.addEventListener('mousedown', onMouseDown);
          renderer.domElement.addEventListener('mouseup', onMouseUp);
          renderer.domElement.addEventListener('mousemove', onMouseMove);
          renderer.domElement.addEventListener('wheel', onWheel);
        }

        // Store references
        sceneRef.current = scene;
        rendererRef.current = renderer;
        cameraRef.current = camera;
        controlsRef.current = { 
          reset: () => {
            camera.position.set(3, 3, 3);
            camera.lookAt(0, 0, 0);
            targetRotationX = 0;
            targetRotationY = 0;
            rotationX = 0;
            rotationY = 0;
            setZoomLevel(1);
          }
        };

        // Load model
        await loadModel(modelUrl, scene, THREE);

        // Animation loop
        const animate = () => {
          animationId = requestAnimationFrame(animate);
          
          // Smooth rotation
          rotationX += (targetRotationX - rotationX) * 0.1;
          rotationY += (targetRotationY - rotationY) * 0.1;
          
          if (scene.children.length > 3) { // Skip lights
            const model = scene.children[3];
            model.rotation.x = rotationX;
            model.rotation.y = rotationY;
          }
          
          renderer.render(scene, camera);
        };
        animate();

        setLoading(false);

      } catch (err: any) {
        console.error('Error initializing 3D viewer:', err);
        setError('Failed to load 3D viewer: ' + err.message);
        setLoading(false);
      }
    };

    const loadThreeJS = () => {
      return new Promise((resolve) => {
        if ((window as any).THREE) {
          // If Three.js is already loaded, just resolve
          resolve((window as any).THREE);
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        script.onload = () => {
          // Load OBJ loader from a working CDN
          const objLoaderScript = document.createElement('script');
          objLoaderScript.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/OBJLoader.js';
          objLoaderScript.onload = () => {
            // Ensure OBJLoader is available
            if ((window as any).THREE && (window as any).THREE.OBJLoader) {
              resolve((window as any).THREE);
            } else {
              console.warn('OBJ Loader not found, using fallback');
              resolve((window as any).THREE);
            }
          };
          objLoaderScript.onerror = () => {
            console.warn('OBJ Loader failed to load, using fallback');
            resolve((window as any).THREE);
          };
          document.head.appendChild(objLoaderScript);
        };
        script.onerror = () => {
          console.warn('Three.js failed to load');
          resolve(null);
        };
        document.head.appendChild(script);
      });
    };

    const loadModel = async (url: string, scene: any, THREE: any) => {
      const fileExtension = url.split('.').pop()?.toLowerCase();

      if (fileExtension === 'obj') {
        // Load OBJ model - with better fallback handling
        return new Promise((resolve) => {
          // Check if OBJLoader is available
          if (!(window as any).THREE.OBJLoader) {
            console.warn('OBJ Loader not available, showing placeholder cube');
            // Show a placeholder cube instead of failing
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
            const cube = new THREE.Mesh(geometry, material);
            scene.add(cube);
            resolve(cube);
            return;
          }

          const loader = new (window as any).THREE.OBJLoader();
          
          loader.load(
            url,
            (object: any) => {
              // Center and scale the model
              const box = new THREE.Box3().setFromObject(object);
              const center = box.getCenter(new THREE.Vector3());
              const size = box.getSize(new THREE.Vector3());
              const maxDimension = Math.max(size.x, size.y, size.z);
              
              if (maxDimension > 0) {
                const scale = 2 / maxDimension;
                object.scale.setScalar(scale);
                object.position.sub(center.multiplyScalar(scale));
              }

              // Add white color to the model
              object.traverse((child: any) => {
                if (child.isMesh) {
                  child.material = new THREE.MeshLambertMaterial({ color: 0xffffff });
                }
              });

              scene.add(object);
              resolve(object);
            },
            (progress: any) => {
              console.log('Loading progress:', (progress.loaded / progress.total) * 100 + '%');
            },
            (error: any) => {
              console.error('Error loading OBJ:', error);
              // Fallback to cube if loading fails
              const geometry = new THREE.BoxGeometry(1, 1, 1);
              const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
              const cube = new THREE.Mesh(geometry, material);
              scene.add(cube);
              resolve(cube);
            }
          );
        });
      } else {
        // For other formats, show a placeholder with white color
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const mesh = new THREE.Mesh(geometry, material);
        
        // Center the placeholder
        mesh.position.set(0, 0, 0);
        scene.add(mesh);
        return Promise.resolve(mesh);
      }
    };

    initViewer();

    // Cleanup
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [isOpen, modelUrl]);

  const resetView = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const zoomIn = () => {
    if (cameraRef.current) {
      cameraRef.current.position.multiplyScalar(0.8);
      const distance = cameraRef.current.position.length();
      setZoomLevel(Math.max(0.1, Math.min(10, 5 / distance)));
    }
  };

  const zoomOut = () => {
    if (cameraRef.current) {
      cameraRef.current.position.multiplyScalar(1.25);
      const distance = cameraRef.current.position.length();
      setZoomLevel(Math.max(0.1, Math.min(10, 5 / distance)));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="rounded-lg border border-gray-600 max-w-4xl w-full max-h-[90vh] overflow-hidden" style={{backgroundColor: '#1a1a2e'}}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-600">
          <div>
            <h3 className="text-lg font-semibold text-white">3D Model Viewer</h3>
            <p className="text-sm text-gray-300">{modelName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={zoomOut}
              className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <div className="px-3 py-1 bg-white/10 rounded text-white text-sm min-w-[60px] text-center">
              {(zoomLevel * 100).toFixed(0)}%
            </div>
            <button
              onClick={zoomIn}
              className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              onClick={resetView}
              className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Reset View"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer Content - No side panels, fills the space */}
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p>Loading 3D model...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <div className="text-center text-red-300">
                <p className="mb-2">❌ {error}</p>
                <p className="text-sm">Try a different model format</p>
              </div>
            </div>
          )}

          <div 
            ref={mountRef} 
            className="w-full flex justify-center"
            style={{ minHeight: '600px', backgroundColor: '#1a1a2e' }}
          />
        </div>

        {/* Controls Info */}
        <div className="p-4 border-t border-gray-600" style={{backgroundColor: '#1a1a2e'}}>
          <div className="text-xs text-gray-300 grid grid-cols-3 gap-4">
            <div><strong>Mouse:</strong> Rotate view</div>
            <div><strong>Wheel:</strong> Zoom in/out</div>
            <div><strong>Buttons:</strong> Zoom & reset</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Component
export default function ThreeDGenerator() {
  const [prompt, setPrompt] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated3DModels, setGenerated3DModels] = useState<Generated3DModel[]>([]);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<{url: string; name: string} | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [generated3DModels]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files[0]) {
      setSelectedFile(files[0]);
      setError('');
      const url = URL.createObjectURL(files[0]);
      setPreviewUrl(url);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!prompt.trim() && !selectedFile) || isGenerating) return;

    setIsGenerating(true);
    setError('');

    try {
      let response;

      if (selectedFile) {
        // Image-to-3D generation
        const formData = new FormData();
        formData.append('image', selectedFile);

        response = await fetch('http://localhost:8080/api/3d/generate', {
          method: 'POST',
          body: formData,
          mode: 'cors',
        });
      } else {
        // Text-to-3D generation
        response = await fetch('http://localhost:8080/api/3d/generate-from-text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: prompt.trim() }),
          mode: 'cors',
        });
      }

      if (!response.ok) {
        throw new Error(`Backend returned status ${response.status}`);
      }

      const data = await response.json();
      console.log('API Response:', data); // Debug log

      // Check for files in the response (your backend returns "files" array)
      if (data.files && data.files.length > 0) {
        // Extract request_id from the download_url
        const firstFile = data.files[0];
        const downloadUrl = firstFile.download_url;
        const requestIdMatch = downloadUrl.match(/\/download\/([^\/]+)\//);
        const extractedRequestId = requestIdMatch ? requestIdMatch[1] : Date.now().toString();

        const newModel: Generated3DModel = {
          id: Date.now().toString(),
          prompt: selectedFile ? `Image: ${selectedFile.name}` : prompt.trim(),
          // Use the generated image URL from backend, fallback to preview or placeholder
          imageUrl: data.generated_image_url || previewUrl || '/placeholder-image.png',
          modelFiles: data.files.map((file: any) => ({
            filename: file.filename,
            size: file.size || 0,
            download_url: file.download_url
          })),
          processingTime: data.processing_time || 0,
          timestamp: new Date(),
          requestId: extractedRequestId,
        };

        setGenerated3DModels((prev) => [...prev, newModel]);
        
        // Clear inputs
        setPrompt('');
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else if (data.error) {
        // Handle error response but still show generated image if available
        if (data.generated_image_url) {
          setError(`3D generation failed, but image was generated. Error: ${data.error}`);
          // You could still show the generated image here if needed
        } else {
          setError(data.error);
        }
      } else {
        setError('Failed to generate 3D model - no files returned');
      }
    } catch (err) {
      console.error('Error generating 3D model:', err);
      setError('Failed to generate 3D model. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const viewModel = (requestId: string, filename: string) => {
    const modelUrl = `http://localhost:8080/api/3d/download/${requestId}/${filename}`;
    setSelectedModel({ url: modelUrl, name: filename });
    setViewerOpen(true);
  };

  const downloadModel = (requestId: string, filename: string) => {
    const downloadUrl = `http://localhost:8080/api/3d/download/${requestId}/${filename}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex flex-col">
      {/* Header with Navigation */}
      <header className="bg-black/20 backdrop-blur-md border-b border-white/10 p-6 relative z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
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
                    className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 transition-colors"
                    onClick={() => setShowMenu(false)}
                  >
                    <ImageIcon className="w-5 h-5" />
                    Image Generator
                  </Link>
                  <Link 
                    href="/3d-generator"
                    className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 transition-colors border-l-2 border-blue-500"
                    onClick={() => setShowMenu(false)}
                  >
                    <Box className="w-5 h-5" />
                    3D Generator
                  </Link>
                </div>
              )}
            </div>
            
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">AI 3D Model Generator</h1>
              <p className="text-gray-300">Create 3D models from text descriptions or images using AI</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-6 flex flex-col">
        {/* Generated 3D Models Grid */}
        <div className={`relative mb-4 ${generated3DModels.length === 0 ? 'h-[34vh] flex items-center justify-center' : 'flex-1'}`}>
          {generated3DModels.length === 0 ? (
            <div className="text-center text-gray-400 w-full">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
                <Box className="w-12 h-12" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Start Creating 3D Models</h3>
              <p>Describe your 3D model or upload an image below to generate your first model</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {generated3DModels.map((model) => (
                <div key={model.id} className="bg-white/10 backdrop-blur-md rounded-lg overflow-hidden border border-white/20 hover:border-white/40 transition-all duration-300 relative z-10">
                  <div className="relative aspect-square">
                    <Image src={model.imageUrl} alt={model.prompt} fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                  </div>
                  
                  <div className="p-4">
                    <p className="text-white text-sm mb-3 line-clamp-2">{model.prompt}</p>
                    <p className="text-gray-300 text-xs mb-3">Processing time: {model.processingTime}s • {model.modelFiles.length} files</p>
                    
                    <div className="space-y-2 mb-3">
                      {model.modelFiles.map((file, index) => (
                        <div key={index} className="flex gap-2">
                          <button
                            onClick={() => viewModel(model.requestId, file.filename)}
                            className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-600/20 border border-blue-500/30 rounded hover:bg-blue-600/30 transition-colors text-sm"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            <span className="text-blue-300 font-medium">View 3D</span>
                          </button>
                          <button
                            onClick={() => downloadModel(model.requestId, file.filename)}
                            className="flex-1 flex items-center justify-center px-3 py-2 bg-white/20 rounded hover:bg-white/30 transition-colors text-sm"
                          >
                            <span className="text-white font-medium">{file.filename.split('.').pop()?.toUpperCase()}</span>
                            <Download className="w-4 h-4 ml-2" />
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{model.timestamp.toLocaleString()}</span>
                      <span className="text-blue-300">ID: {model.requestId.slice(0, 8)}</span>
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
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-200 text-sm">{error}</div>
          )}

          {/* Image Upload Area */}
          <div className="mb-4">
            <div
              className="border-2 border-dashed border-white/30 rounded-lg p-6 text-center hover:border-white/50 transition-colors cursor-pointer"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" disabled={isGenerating} />
              
              {previewUrl ? (
                <div className="space-y-3">
                  <div className="relative w-24 h-24 mx-auto">
                    <Image src={previewUrl} alt="Preview" fill className="object-cover rounded-lg" />
                  </div>
                  <p className="text-white text-sm">{selectedFile?.name}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); clearSelection(); }}
                    className="text-red-400 hover:text-red-300 text-sm underline"
                    disabled={isGenerating}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-gray-400"><Upload className="mx-auto h-8 w-8" /></div>
                  <div>
                    <p className="text-sm font-medium text-white">Drop an image here to generate 3D from image</p>
                    <p className="text-xs text-gray-400">Or use text description below</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the 3D model you want to generate..."
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-white/40 focus:ring-2 focus:ring-blue-500/20"
                disabled={isGenerating}
              />
            </div>

            <button
              type="submit"
              disabled={(!prompt.trim() && !selectedFile) || isGenerating}
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
            Enter a detailed description for better results. Examples:{' '}
            &quot;A futuristic robot with blue armor, a wooden sailing ship, a modern sports car&quot;
          </div>
        </div>
      </main>

      {/* 3D Viewer */}
      <ModelViewer
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        modelUrl={selectedModel?.url || ''}
        modelName={selectedModel?.name || ''}
      />
    </div>
  );
}