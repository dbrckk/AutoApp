import React, { useState, useEffect, useRef } from 'react';
import { Download, Loader2, Send, Wand2, Play, Plus, Clock, Terminal, X, Code2, Smartphone, LayoutTemplate, Trash2, Menu, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FileTree } from './components/FileTree';
import { CodeViewer } from './components/CodeViewer';
import { Button } from './components/ui/button';
import { Project, Commit, VirtualFile, GenerationResponse } from './types';
import { downloadProjectAsZip } from './lib/zip';

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('forge_projects');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(
    projects.length > 0 ? projects[0].id : null
  );

  const [showSettings, setShowSettings] = useState(false);
  const [aiConfig, setAiConfig] = useState(() => {
    const saved = localStorage.getItem('forge_ai_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return { provider: 'gemini', apiKey: '', baseUrl: '', model: '' };
  });

  useEffect(() => {
    localStorage.setItem('forge_ai_config', JSON.stringify(aiConfig));
  }, [aiConfig]);

  const currentProject = projects.find(p => p.id === currentProjectId) || null;
  const commits = currentProject?.commits || [];

  const updateProjectCommits = (projectId: string, newCommits: Commit[]) => {
    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        return { ...p, commits: newCommits, updatedAt: Date.now() };
      }
      return p;
    }));
  };

  useEffect(() => {
    localStorage.setItem('forge_projects', JSON.stringify(projects));
  }, [projects]);

  const [currentPrompt, setCurrentPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  
  const allCurrentFiles = commits.length > 0 ? commits[commits.length - 1].files : [];
  // Dedup files by normalized path to handle any legacy dirty state
  const currentFiles = Array.from(new Map(allCurrentFiles.map(f => [f.path.replace(/^\//, ''), f])).values());
  const selectedFile = currentFiles.find(f => f.path === selectedFilePath || f.path === selectedFilePath?.replace(/^\//, '')) || null;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto scroll commits history
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [commits]);

  const handleSelectFile = (path: string) => {
    setOpenFiles(prev => prev.includes(path) ? prev : [...prev, path]);
    setSelectedFilePath(path);
  };

  const handleCloseFile = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const newOpenFiles = openFiles.filter(p => p !== path);
    setOpenFiles(newOpenFiles);
    if (selectedFilePath === path) {
      setSelectedFilePath(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null);
    }
  };

  const handleTemplateClick = (templatePrompt: string) => {
    setCurrentPrompt(templatePrompt);
  };

  const handleReset = () => {
    if (!currentProjectId) return;
    if (confirm('Are you sure you want to clear this project and start over?')) {
      updateProjectCommits(currentProjectId, []);
      setOpenFiles([]);
      setSelectedFilePath(null);
      setCurrentPrompt('');
    }
  };

  const currentProjectName = currentProject?.name || "Untitled Project";

  const handleCreateProject = () => {
    const name = prompt("Enter project name:");
    if (!name) return;
    const newProject: Project = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      commits: []
    };
    setProjects(prev => [...prev, newProject]);
    setCurrentProjectId(newProject.id);
    setOpenFiles([]);
    setSelectedFilePath(null);
    setCurrentPrompt('');
  };

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project?')) {
      setProjects(prev => prev.filter(p => p.id !== id));
      if (currentProjectId === id) {
        const remaining = projects.filter(p => p.id !== id);
        setCurrentProjectId(remaining.length > 0 ? remaining[0].id : null);
        setOpenFiles([]);
        setSelectedFilePath(null);
        setCurrentPrompt('');
      }
    }
  };

  const [isAutoImproving, setIsAutoImproving] = useState(false);
  const stopAutoImproveRef = useRef(false);

  const performSingleGeneration = async (promptText: string, filesContext: VirtualFile[], isAutoMode: boolean) => {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: promptText,
        currentFiles: filesContext,
        isAutoImprove: isAutoMode,
        aiConfig
      })
    });

    if (!response.ok) {
      let errText = 'API Request Failed';
      try {
        const errJson = await response.json();
        if (errJson.error) errText = errJson.error;
      } catch (e) {
        errText = await response.text();
      }
      throw new Error(errText);
    }
    return await response.json() as GenerationResponse;
  };

  const handleStopAutoImprove = () => {
    stopAutoImproveRef.current = true;
    setIsAutoImproving(false);
  };

  const handleGenerate = async (startAutoImprove: boolean = false) => {
    if ((!currentPrompt.trim() && !startAutoImprove) || isGenerating) return;

    let targetProjectId = currentProjectId;
    if (!targetProjectId) {
      const title = currentPrompt.trim().substring(0, 24) || "New Project";
      const newProject: Project = {
        id: Math.random().toString(36).substring(2, 9),
        name: title + '...',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        commits: []
      };
      setProjects(prev => [...prev, newProject]);
      targetProjectId = newProject.id;
      setCurrentProjectId(targetProjectId);
    }

    setIsGenerating(true);
    if (startAutoImprove) {
      setIsAutoImproving(true);
      stopAutoImproveRef.current = false;
    }

    try {
      let isPerfect = false;
      let loopPrompt = currentPrompt.trim() || 'Improve the app.';
      let loopFiles = [...currentFiles];
      let runningCommits = [...commits];

      while (!isPerfect) {
        if (stopAutoImproveRef.current) break;

        const data = await performSingleGeneration(loopPrompt, loopFiles, startAutoImprove);

        // Merge new files into existing files
        let combinedFiles = [...loopFiles];
        data.files.forEach(newFile => {
          // Normalize path: remove leading slash
          const normalizedPath = newFile.path.replace(/^\//, '');
          newFile.path = normalizedPath;
          if (newFile.content === null) {
            // It's a deletion
            combinedFiles = combinedFiles.filter(f => f.path !== normalizedPath);
            setOpenFiles(prev => prev.filter(p => p !== normalizedPath));
            if (selectedFilePath === normalizedPath) setSelectedFilePath(null);
          } else {
            const existingIndex = combinedFiles.findIndex(f => f.path === normalizedPath);
            if (existingIndex >= 0) {
              combinedFiles[existingIndex] = newFile;
            } else {
              combinedFiles.push(newFile);
            }
          }
        });

        const newCommit: Commit = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: Date.now(),
          message: startAutoImprove ? 'Auto Improvement Step' : 'Generated App',
          prompt: loopPrompt,
          files: combinedFiles,
          changelog: data.changelog,
          estimatedTimeSaved: data.estimatedTimeSaved
        };

        runningCommits.push(newCommit);
        updateProjectCommits(targetProjectId, runningCommits);
        
        loopFiles = combinedFiles;

        if (data.files.length > 0 && !selectedFilePath) {
          const newPath = data.files[0].path;
          handleSelectFile(newPath);
        }

        if (startAutoImprove) {
          if ((data.changelog || '').includes('PERFECT_READY_TO_PUBLISH')) {
            isPerfect = true;
          } else {
            loopPrompt = "Continue automatically improving the app towards Play Store perfection.";
          }
        } else {
          break;
        }
      }
      
      setCurrentPrompt('');
    } catch (err) {
      console.error(err);
      alert('Failed to generate application. Please try again.');
    } finally {
      setIsGenerating(false);
      setIsAutoImproving(false);
      stopAutoImproveRef.current = false;
    }
  };

  const handleDownload = () => {
    downloadProjectAsZip(currentFiles);
  };

  const renderWelcomeState = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#1e1e1e] overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full"
      >
        <div className="w-24 h-24 bg-blue-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-blue-500/20 shadow-2xl shadow-blue-500/10">
          <Terminal className="w-12 h-12 text-blue-500" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500 mb-6 tracking-tight">
          Forge Your Next App
        </h1>
        <p className="text-gray-400 text-lg mb-10 leading-relaxed max-w-xl mx-auto">
          Describe the app you want to build. Forge will simulate generating the entire cross-platform codebase, UI components, and mock assets.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <button onClick={() => handleTemplateClick("Build a fully styled Instagram clone in React Native with a dark theme, using Expo and mock image assets for posts.")} className="p-4 rounded-xl bg-[#252525] border border-[#333] hover:border-blue-500/50 hover:bg-[#2a2a2a] transition-all group flex items-start space-x-4">
            <div className="p-3 bg-pink-500/10 rounded-lg group-hover:bg-pink-500/20 transition-colors">
              <Smartphone className="w-6 h-6 text-pink-400" />
            </div>
            <div>
              <h3 className="text-gray-200 font-semibold mb-1">Social Media Feed</h3>
              <p className="text-xs text-gray-500">React Native / Expo mock app</p>
            </div>
          </button>
          
          <button onClick={() => handleTemplateClick("Create a web-based Kanban task manager using React and Tailwind CSS. Must have draggable columns and cards with a modern tech UI.")} className="p-4 rounded-xl bg-[#252525] border border-[#333] hover:border-indigo-500/50 hover:bg-[#2a2a2a] transition-all group flex items-start space-x-4">
            <div className="p-3 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
              <LayoutTemplate className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-gray-200 font-semibold mb-1">Kanban Board</h3>
              <p className="text-xs text-gray-500">React web app task manager</p>
            </div>
          </button>
          
          <button onClick={() => handleTemplateClick("Build a classic Snake game in React using HTML5 Canvas or styled divs. Include a retro arcade theme and score tracker.")} className="p-4 rounded-xl bg-[#252525] border border-[#333] hover:border-green-500/50 hover:bg-[#2a2a2a] transition-all group flex items-start space-x-4">
            <div className="p-3 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
              <Play className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="text-gray-200 font-semibold mb-1">Retro Snake Game</h3>
              <p className="text-xs text-gray-500">HTML5 Canvas / React Game</p>
            </div>
          </button>
          
          <button onClick={() => handleTemplateClick("Create a Developer Portfolio website template with a hero section, skills grid, and project gallery using shadcn-like minimal UI.")} className="p-4 rounded-xl bg-[#252525] border border-[#333] hover:border-purple-500/50 hover:bg-[#2a2a2a] transition-all group flex items-start space-x-4">
            <div className="p-3 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
              <Code2 className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-gray-200 font-semibold mb-1">Dev Portfolio</h3>
              <p className="text-xs text-gray-500">Minimalist Web Template</p>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-[#1e1e1e] text-gray-200 overflow-hidden font-sans">
      
      {/* Mobile Sidebar Toggle Header */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-12 bg-[#1a1a1a] border-b border-[#333] z-40 flex items-center px-4 justify-between">
        <div className="flex items-center font-semibold tracking-wide text-white">
          <Terminal className="w-5 h-5 mr-2 text-blue-500" /> FORGE
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 -mr-2 text-gray-400 hover:text-white">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Files & History */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative flex flex-col w-72 md:w-64 border-r border-[#333] bg-[#141414] z-40 h-full md:h-full top-0 md:top-0 left-0 pt-12 md:pt-0 transition-transform duration-300 ease-in-out`}>
        <div className="hidden md:flex flex-col border-b border-[#333] bg-[#1a1a1a] shrink-0">
          <div className="h-12 flex items-center px-4 font-semibold text-white tracking-wide">
            <Terminal className="w-5 h-5 mr-2 text-blue-500" />
            FORGE AI
          </div>
          <div className="px-3 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Projects</span>
              <button onClick={handleCreateProject} className="text-blue-400 hover:text-blue-300 transition-colors p-1" title="New Project">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="relative">
              <select 
                value={currentProjectId || ''} 
                onChange={(e) => {
                  setCurrentProjectId(e.target.value);
                  setOpenFiles([]);
                  setSelectedFilePath(null);
                  setCurrentPrompt('');
                }}
                className="w-full bg-[#252525] border border-[#333] rounded-md text-sm text-gray-200 py-1.5 pl-2 pr-8 appearance-none focus:outline-none focus:border-blue-500"
              >
                {projects.length === 0 ? (
                  <option value="" disabled>No projects</option>
                ) : (
                  projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))
                )}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <Menu className="w-3 h-3 text-gray-500" />
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden flex flex-col bg-[#1e1e1e]">
          <div className="px-4 py-2 font-semibold text-[11px] tracking-wider text-gray-400 uppercase border-b border-[#333] bg-[#1a1a1a] flex justify-between items-center">
            <span>Explorer</span>
            {currentProjectId && (
              <button onClick={(e) => handleDeleteProject(e, currentProjectId)} className="text-red-400 hover:text-red-300 transition-colors" title="Delete Project">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <FileTree 
            files={currentFiles} 
            selectedPath={selectedFilePath} 
            onSelectFile={handleSelectFile} 
          />
        </div>
        
        {/* Version History Area */}
        <div className="h-[40%] flex flex-col border-t border-[#333] bg-[#141414]">
          <div className="px-4 py-2 font-semibold text-[11px] tracking-wider text-gray-400 uppercase border-b border-[#333] flex justify-between items-center bg-[#1a1a1a]">
            <span>Timeline</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
            {commits.length === 0 ? (
              <div className="text-gray-500 text-xs text-center mt-4">No changes yet</div>
            ) : (
              commits.map((c, i) => (
                <div key={c.id} className="relative pl-4 border-l border-[#333] last:border-transparent">
                  <div className="absolute w-2 h-2 bg-blue-500 rounded-full -left-[4.5px] top-1 ring-4 ring-[#141414]"></div>
                  <div className="mb-1 flex items-baseline justify-between overflow-hidden">
                    <span className="font-semibold text-blue-400 text-sm">v{i + 1}.0</span>
                    <span className="text-[10px] text-gray-500 ml-2 whitespace-nowrap">{new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="text-gray-300 text-xs italic mb-2 line-clamp-2">"{c.prompt}"</div>
                  <div className="p-2 rounded bg-[#1e1e1e] border border-[#2d2d2d] text-xs">
                    <div className="text-green-400 font-mono mb-1 flex items-center"><Clock className="w-3 h-3 mr-1" />Saved {c.estimatedTimeSaved}</div>
                    <div className="text-gray-400 line-clamp-3 leading-relaxed">{c.changelog}</div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="border-t border-[#333] p-2 bg-[#1a1a1a]">
            <button 
              onClick={() => setShowSettings(true)}
              className="w-full flex items-center justify-center space-x-2 p-2 rounded hover:bg-[#252525] text-gray-400 hover:text-gray-200 transition-colors text-sm"
            >
              <Settings className="w-4 h-4" />
              <span>AI Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm px-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 border-b border-[#333] bg-[#1a1a1a]">
                <h3 className="font-semibold text-lg flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-blue-400" />
                  AI Provider Settings
                </h3>
                <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Provider</label>
                  <select 
                    value={aiConfig.provider}
                    onChange={(e) => setAiConfig({...aiConfig, provider: e.target.value})}
                    className="w-full bg-[#141414] border border-[#333] rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="gemini">Default (Gemini API)</option>
                    <option value="openai_compatible">Custom / Local (OpenAI Compatible)</option>
                  </select>
                </div>

                {aiConfig.provider === 'openai_compatible' && (
                  <>
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300">
                      Use this to connect to Groq, Together, OpenAI, or local models. 
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Base URL</label>
                      <input 
                        type="url" 
                        placeholder="e.g. https://api.groq.com/openai/v1"
                        value={aiConfig.baseUrl}
                        onChange={(e) => setAiConfig({...aiConfig, baseUrl: e.target.value})}
                        className="w-full bg-[#141414] border border-[#333] rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">API Key</label>
                      <input 
                        type="password" 
                        placeholder="sk-..."
                        value={aiConfig.apiKey}
                        onChange={(e) => setAiConfig({...aiConfig, apiKey: e.target.value})}
                        className="w-full bg-[#141414] border border-[#333] rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Model Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. llama3-8b-8192"
                        value={aiConfig.model}
                        onChange={(e) => setAiConfig({...aiConfig, model: e.target.value})}
                        className="w-full bg-[#141414] border border-[#333] rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="p-4 border-t border-[#333] bg-[#1a1a1a] flex justify-end">
                <Button onClick={() => setShowSettings(false)} className="bg-blue-600 hover:bg-blue-500 text-white px-6">
                  Save & Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative min-w-0 pt-12 md:pt-0">
        
        {commits.length === 0 ? (
          renderWelcomeState()
        ) : (
          <>
            {/* Top Header / Actions */}
            <div className="h-12 border-b border-[#333] bg-[#1a1a1a] flex items-center justify-between px-4 z-10 shadow-sm">
              <div className="flex items-center space-x-3">
                <span className="text-xs font-medium px-2 py-1 bg-[#252525] rounded text-gray-300 border border-[#333] hidden sm:inline-block">
                  {currentFiles.length} files
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Button onClick={handleDownload} variant="secondary" size="sm" className="hidden sm:flex h-8 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border-none">
                  <Download className="w-4 h-4 mr-2" /> Export ZIP
                </Button>
                <Button onClick={handleDownload} variant="secondary" size="icon" className="sm:hidden h-8 w-8 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border-none">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 bg-[#1e1e1e] flex flex-col relative overflow-hidden">
               {/* File Tabs */}
               {openFiles.length > 0 && (
                <div className="flex overflow-x-auto bg-[#141414] custom-scrollbar border-b border-[#2d2d2d]">
                  {openFiles.map(path => {
                    const isSelected = path === selectedFilePath;
                    const filename = path.split('/').pop() || path;
                    return (
                      <div 
                        key={path}
                        onClick={() => setSelectedFilePath(path)}
                        className={`flex items-center px-4 py-2 text-sm cursor-pointer border-r border-[#2d2d2d] group min-w-0 max-w-[200px] ${isSelected ? 'bg-[#1e1e1e] text-blue-400 border-t-2 border-t-blue-500' : 'text-gray-400 hover:bg-[#1a1a1a] border-t-2 border-t-transparent'}`}
                      >
                        <span className="truncate pr-2 select-none">{filename}</span>
                        <button 
                          onClick={(e) => handleCloseFile(e, path)}
                          className={`p-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? 'opacity-100 hover:bg-[#2d2d2d]' : 'hover:bg-[#333]'}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
               )}
              
              {openFiles.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Code2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Select a file to view code</p>
                  </div>
                </div>
              ) : (
                <CodeViewer file={selectedFile} />
              )}

              <AnimatePresence>
                {isGenerating && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-[#00000099] backdrop-blur-md flex flex-col items-center justify-center z-50 p-6 text-center"
                  >
                    <div className="w-20 h-20 relative flex items-center justify-center mb-6">
                      <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                      <Wand2 className="w-8 h-8 text-blue-400 animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-semibold mb-3 tracking-tight text-white drop-shadow-md">
                      {isAutoImproving ? "Automated Forging Loop..." : "Forging Architecture..."}
                    </h2>
                    <p className="text-blue-200 text-sm animate-pulse max-w-sm">Generating cross-platform modules, wiring logic, and rendering asset placeholders.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        {/* Input Bar */}
        <div className="p-4 bg-[#141414] border-t border-[#333] shrink-0">
          <div className="max-w-4xl mx-auto relative">
            <div className="relative flex items-center bg-[#1e1e1e] rounded-xl border border-[#333] focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all shadow-inner">
              <textarea
                className="w-full bg-transparent pl-4 pr-32 py-3.5 focus:outline-none text-white placeholder-gray-500 resize-none max-h-32 min-h-[52px] custom-scrollbar overflow-y-auto"
                placeholder={commits.length === 0 ? "What should we build today?" : "What would you like to improve or change?"}
                value={currentPrompt}
                onChange={(e) => {
                  setCurrentPrompt(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (currentPrompt.trim()) {
                      handleGenerate(false);
                    }
                  }
                }}
                rows={1}
                disabled={isAutoImproving}
              />
              <div className="absolute right-2 bottom-2 flex items-center space-x-2">
                {isAutoImproving ? (
                   <Button 
                     onClick={handleStopAutoImprove} 
                     className="h-9 bg-red-600 hover:bg-red-500 text-white rounded-lg px-3 flex items-center shadow-lg shadow-red-500/20"
                   >
                     <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Stop Loop
                   </Button>
                ) : (
                  <>
                    {commits.length > 0 && (
                      <Button 
                        onClick={() => handleGenerate(true)} 
                        disabled={isGenerating}
                        className="h-9 px-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-white disabled:opacity-50 transition-all shadow-lg shadow-purple-500/20 text-xs flex items-center"
                        title="Auto-improve until perfection"
                      >
                         <Wand2 className="w-3.5 h-3.5 mr-1.5" /> Auto-Perfect
                      </Button>
                    )}
                    <Button 
                      onClick={() => handleGenerate(false)} 
                      disabled={isGenerating || !currentPrompt.trim()}
                      size="icon"
                      className="h-9 w-9 bg-blue-600 hover:bg-blue-500 rounded-lg text-white disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20"
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="mt-2 flex justify-between items-center text-[10px] text-gray-500">
              <span>Press <kbd className="font-mono bg-[#252525] px-1 rounded mx-0.5 text-gray-400">Enter</kbd> to send, <kbd className="font-mono bg-[#252525] px-1 rounded mx-0.5 text-gray-400">Shift</kbd> + <kbd className="font-mono bg-[#252525] px-1 rounded mx-0.5 text-gray-400">Enter</kbd> for new line.</span>
              <span className="hidden sm:inline">Powered by Gemini 2.5 Flash</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
