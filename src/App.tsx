import React, { useState, useEffect, useRef } from 'react';
import { Download, Loader2, Send, Wand2, Play, Plus, Clock, Terminal, X, Code2, Smartphone, LayoutTemplate, Trash2, Menu, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
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
    let finalPrompt = currentPrompt.trim();
    
    // If auto-generating from scratch with no prompt, pick a cool app idea
    if (!finalPrompt && startAutoImprove && commits.length === 0) {
      const ideas = [
        "Build a multi-tenant Enterprise SaaS CRM dashboard with incredible depth. Include animated financial data grids with D3.js/Recharts, complex multi-step user onboarding flows, a fully functioning rich-text email template editor, deep relational state management, and a stunning dark-glassmorphism neon-accented UI.",
        "Build a completely immersive, next-generation Music and DJ production studio app in the browser. Include real-time Web Audio API synthesizers, interactive timeline mixing boards, beautifully animated dynamic frequency analyzers, and an ultra-premium futuristic studio interface.",
        "Build a world-class Web3 / Crypto Portfolio tracker OS. Implement live mock WebSockets for fake ticker data flowing constantly, super-complex candlestuck financial charts, a full-screen trading terminal view with draggable widget windows, and razor-sharp minimalist brutalist design.",
        "Build a full-blown collaborative canvas whiteboarding app. Include infinite panning, a suite of vector drawing tools (simulated with HTML5 Canvas or SVG), real-time mock collaboration cursors flying around, an extensive tools palette, and breathtaking micro-interactions using Framer Motion.",
        "Generate a hyper-advanced 3D-feeling Space Exploration Encyclopedia. Use incredible parallax scrolling, deeply nested route hierarchies for galaxies/planets, complex physical data simulations, interactive orbital paths, and awe-inspiring, jaw-dropping high-contrast cinematic web design."
      ];
      finalPrompt = ideas[Math.floor(Math.random() * ideas.length)];
      setCurrentPrompt(finalPrompt);
    }
    
    if (!finalPrompt && !startAutoImprove) return;
    if (isGenerating) return;

    let targetProjectId = currentProjectId;
    if (!targetProjectId) {
      const title = finalPrompt.substring(0, 24) || "New Project";
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
      let loopPrompt = finalPrompt || 'CRITICAL: AUTONOMOUS FORGE MODE ACTIVE. Analyze the current build and autonomously design and implement the next massive wave of features and visual polish. Do not wait for user input.';
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
            loopPrompt = "CRITICAL: FULL AUTOMATIQUE GOD-MODE ACTIVE. The user wants you to over-engineer this to the absolute max. Improve everything infinitely. Implement the next phase of massive structural, architectural, and breathtaking visual improvements. Build entirely new pages, massively complex dashboards, 3D interactive graphics (simulated), deep global state engines, gorgeous fluid animations, and real-world scale logic. Break components down into hundreds of micro-files if necessary. Do not wait for permission. You are generating a complete $10B startup from scratch. Evolve the app towards absolute god-tier perfection.";
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
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#1e1e1e] overflow-hidden relative">
      {/* Intense animated background for welcome state */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-pink-900/10 rounded-full mix-blend-screen filter blur-[120px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-900/10 rounded-full mix-blend-screen filter blur-[120px] animate-pulse"></div>
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-emerald-900/10 rounded-full mix-blend-screen filter blur-[100px] animate-bounce"></div>
      </div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl w-full z-10 overflow-y-auto custom-scrollbar pr-4 max-h-[85vh]"
      >
        <div className="w-24 h-24 bg-gradient-to-br from-pink-500/10 to-indigo-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-purple-500/30 shadow-2xl shadow-purple-500/20 backdrop-blur-md">
          <Terminal className="w-12 h-12 text-pink-400 drop-shadow-[0_0_15px_rgba(236,72,153,0.5)]" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 mb-6 tracking-tight drop-shadow-lg">
          Forge AI Copilot <sup className="text-sm text-pink-400 font-mono tracking-widest ml-1 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">GOD MODE</sup>
        </h1>
        <p className="text-gray-400 text-lg mb-10 leading-relaxed max-w-xl mx-auto">
          Describe absolutely anything you want to build. Forge will design the architecture, complex state loops, real-world data simulations, and incredibly gorgeous UI. Or click <strong className="text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]">Full Automatique God Mode</strong> to unleash autonomous god-mode generation!
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <button onClick={() => handleTemplateClick("Build an incredibly advanced, fully-styled Instagram clone in React Native/Expo. Include a gorgeous premium dark theme, massive state management, fluid animations with React Native Reanimated, simulated complex fetching logic, and ultra-polished UI/UX. Leave absolutely nothing to the imagination.")} className="p-4 rounded-xl bg-[#252525] border border-[#333] hover:border-pink-500/50 hover:bg-[#2a2a2a] transition-all group flex items-start space-x-4">
            <div className="p-3 bg-pink-500/10 rounded-lg group-hover:bg-pink-500/20 transition-colors">
              <Smartphone className="w-6 h-6 text-pink-400" />
            </div>
            <div>
              <h3 className="text-gray-200 font-semibold mb-1">Premium Social UI</h3>
              <p className="text-xs text-gray-500">React Native / Expo mock app</p>
            </div>
          </button>
          
          <button onClick={() => handleTemplateClick("Create an enterprise-grade Agile Kanban Tracker. Must feature extensive multi-layered state, incredibly smooth framer-motion drag-and-drop, completely deep nested routing structures (simulated), interactive dashboards with Recharts, and absolute styling perfection.")} className="p-4 rounded-xl bg-[#252525] border border-[#333] hover:border-indigo-500/50 hover:bg-[#2a2a2a] transition-all group flex items-start space-x-4">
            <div className="p-3 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
              <LayoutTemplate className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-gray-200 font-semibold mb-1">Enterprise Kanban</h3>
              <p className="text-xs text-gray-500">Massive React web app task manager</p>
            </div>
          </button>
          
          <button onClick={() => handleTemplateClick("Build an extremely complex immersive WebGL or Canvas-based game. Include a fully architected game loop, particle systems, beautiful futuristic neon retro-arcade shaders, multi-level logic, and completely maxed-out visuals.")} className="p-4 rounded-xl bg-[#252525] border border-[#333] hover:border-green-500/50 hover:bg-[#2a2a2a] transition-all group flex items-start space-x-4">
            <div className="p-3 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
              <Play className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="text-gray-200 font-semibold mb-1">Advanced Game Engine</h3>
              <p className="text-xs text-gray-500">HTML5 Canvas / React Game</p>
            </div>
          </button>
          
          <button onClick={() => handleTemplateClick("Generate a god-tier Developer OS/Desktop interface in the browser. It should simulate a full operating system with draggable windows, a start menu, a working terminal emulation, file system architecture, and immaculate glassmorphism aesthetics.")} className="p-4 rounded-xl bg-[#252525] border border-[#333] hover:border-purple-500/50 hover:bg-[#2a2a2a] transition-all group flex items-start space-x-4">
            <div className="p-3 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
              <Code2 className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-gray-200 font-semibold mb-1">Web OS Experience</h3>
              <p className="text-xs text-gray-500">React Desktop Environment</p>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-[#050505] text-gray-200 overflow-hidden font-sans relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(236,72,153,0.15),rgba(255,255,255,0))] pointer-events-none z-0"></div>
      
      {/* Mobile Sidebar Toggle Header */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-12 bg-[#1a1a1a] border-b border-[#333] z-40 flex items-center px-4 justify-between">
        <div className="flex items-center font-semibold tracking-wide text-white">
          <Terminal className="w-5 h-5 mr-2 text-pink-500" /> FORGE
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
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative flex flex-col w-72 md:w-72 border-r border-[#222] bg-[#0a0a0a]/90 backdrop-blur-xl z-40 h-full md:h-full top-0 md:top-0 left-0 pt-12 md:pt-0 transition-transform duration-300 ease-in-out`}>
        <div className="hidden md:flex flex-col border-b border-[#222] bg-[#0a0a0a]/80 backdrop-blur-md shrink-0 relative z-10">
          <div className="h-12 flex items-center px-4 font-bold text-white tracking-widest text-[13px] bg-gradient-to-r from-transparent to-[#111]">
            <Terminal className="w-5 h-5 mr-3 text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-indigo-400">FORGE SYSTEM</span>
          </div>
          <div className="px-3 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Projects</span>
              <button onClick={handleCreateProject} className="text-pink-400 hover:text-pink-300 transition-colors p-1" title="New Project">
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
                className="w-full bg-[#252525] border border-[#333] rounded-md text-sm text-gray-200 py-1.5 pl-2 pr-8 appearance-none focus:outline-none focus:border-pink-500"
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
        
        <div className="flex-1 overflow-hidden flex flex-col bg-transparent relative z-10">
          <div className="px-4 py-2.5 font-bold text-[10px] tracking-widest text-pink-500/80 uppercase border-b border-[#222] bg-[#0f0f0f] flex justify-between items-center shadow-inner">
            <span>Explorer</span>
            {currentProjectId && (
              <div className="flex items-center space-x-2">
                <button onClick={() => downloadProjectAsZip(currentFiles, currentProject?.name)} className="text-pink-400 hover:text-pink-300 transition-colors" title="Download Project as ZIP">
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button onClick={(e) => handleDeleteProject(e, currentProjectId)} className="text-red-400 hover:text-red-300 transition-colors" title="Delete Project">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <FileTree 
            files={currentFiles} 
            selectedPath={selectedFilePath} 
            onSelectFile={handleSelectFile} 
          />
        </div>
        
        {/* Version History Area */}
        <div className="h-[45%] flex flex-col border-t border-[#222] bg-gradient-to-b from-[#0a0a0a] to-[#050505] relative z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
          <div className="px-4 py-2.5 font-bold text-[10px] tracking-widest text-indigo-400/80 uppercase border-b border-[#222] flex justify-between items-center bg-[#0a0a0a]">
            <span>Timeline</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
            {commits.length === 0 ? (
              <div className="text-gray-500 text-xs text-center mt-4">No changes yet</div>
            ) : (
              commits.map((c, i) => (
                <div key={c.id} className="relative pl-5 border-l border-[#222] last:border-transparent group">
                  <div className="absolute w-2 h-2 bg-pink-500 rounded-full -left-[4.5px] top-1.5 ring-4 ring-[#0a0a0a] group-hover:scale-125 transition-transform shadow-[0_0_8px_rgba(236,72,153,0.8)]"></div>
                  <div className="mb-1 flex items-baseline justify-between overflow-hidden">
                    <span className="font-bold text-pink-400 text-[13px] tracking-wide">STAGE {i + 1}</span>
                    <span className="text-[10px] text-gray-600 font-mono ml-2 whitespace-nowrap">{new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                  <div className="text-indigo-200/70 text-xs italic mb-2.5 line-clamp-2 border-l-2 border-indigo-500/30 pl-2">"{c.prompt}"</div>
                  <div className="p-3 rounded-lg bg-[#111] border border-[#222] text-xs shadow-inner hover:border-pink-500/30 transition-colors">
                    <div className="text-emerald-400 font-mono mb-2 flex items-center bg-emerald-500/10 w-fit px-2 py-0.5 rounded border border-emerald-500/20"><Clock className="w-3 h-3 mr-1.5" />SAVED {(c.estimatedTimeSaved || '0 MINS').toUpperCase()}</div>
                    <div className="text-gray-400 whitespace-pre-wrap leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5">
                      <Markdown>{c.changelog}</Markdown>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="border-t border-[#222] p-2 bg-[#050505]">
            <button 
              onClick={() => setShowSettings(true)}
              className="w-full flex items-center justify-center space-x-2 p-2.5 rounded-lg hover:bg-pink-500/10 text-gray-500 hover:text-pink-400 transition-all text-xs font-bold tracking-widest uppercase border border-transparent hover:border-pink-500/30"
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
          <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm px-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 border-b border-[#333] bg-[#1a1a1a]">
                <h3 className="font-semibold text-lg flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-pink-400" />
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
                    <div className="p-3 bg-pink-500/10 border border-pink-500/20 rounded-lg text-xs text-pink-300">
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
                <Button onClick={() => setShowSettings(false)} className="bg-pink-600 hover:bg-pink-500 text-white px-6">
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
            <div className="h-12 border-b border-[#222] bg-[#050505]/80 backdrop-blur flex items-center justify-between px-4 z-10 shadow-sm relative">
              <div className="flex items-center space-x-3">
                <span className="text-[10px] font-bold tracking-widest px-2.5 py-1 bg-pink-500/10 rounded-full text-pink-400 border border-pink-500/20 hidden sm:inline-block shadow-[inset_0_0_8px_rgba(236,72,153,0.1)]">
                  {currentFiles.length} FILES LOADED
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Button onClick={handleDownload} variant="secondary" size="sm" className="hidden sm:flex h-8 bg-pink-600/10 hover:bg-pink-600/20 text-pink-400 border-none transition-colors">
                  <Download className="w-4 h-4 mr-2" /> Export ZIP
                </Button>
                <Button onClick={handleDownload} variant="secondary" size="icon" className="sm:hidden h-8 w-8 bg-pink-600/10 hover:bg-pink-600/20 text-pink-400 border-none transition-colors">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 bg-[#0a0a0a] flex flex-col relative overflow-hidden">
               {/* File Tabs */}
               {openFiles.length > 0 && (
                <div className="flex overflow-x-auto bg-[#050505] custom-scrollbar border-b border-[#222]">
                  {openFiles.map(path => {
                    const isSelected = path === selectedFilePath;
                    const filename = path.split('/').pop() || path;
                    return (
                      <div 
                        key={path}
                        onClick={() => setSelectedFilePath(path)}
                        className={`flex items-center px-4 py-2 text-[13px] font-mono cursor-pointer border-r border-[#222] group min-w-0 max-w-[200px] transition-all duration-200 ${isSelected ? 'bg-[#0a0a0a] text-emerald-400 border-t-2 border-t-emerald-500 shadow-[inset_0_2px_20px_rgba(16,185,129,0.1)]' : 'text-gray-500 hover:bg-[#111] hover:text-gray-300 border-t-2 border-t-transparent'}`}
                      >
                        <span className="truncate pr-2 select-none">{filename}</span>
                        <button 
                          onClick={(e) => handleCloseFile(e, path)}
                          className={`p-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? 'opacity-100 hover:bg-emerald-500/20 hover:text-emerald-300' : 'hover:bg-[#333]'}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
               )}
              
              {openFiles.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-600 bg-[#0a0a0a] relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.05),transparent)] pointer-events-none"></div>
                  <div className="text-center relative z-10">
                    <Code2 className="w-16 h-16 mx-auto mb-4 opacity-10 text-emerald-500" />
                    <p className="font-mono text-xs tracking-widest uppercase">System Awaiting Input / Select Module</p>
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
                    {isAutoImproving && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden mix-blend-screen">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-pink-900/40 via-purple-900/20 to-transparent animate-pulse-slow"></div>
                        <div className="w-[150%] h-[150%] bg-[conic-gradient(from_0deg_at_50%_50%,_var(--tw-gradient-stops))] from-transparent via-pink-500/10 to-transparent animate-spin-slow rounded-full mix-blend-screen" style={{ animationDuration: '4s' }} />
                        <div className="w-[200%] h-[200%] bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-pink-900/30 via-purple-900/20 to-transparent animate-pulse-slow rounded-full" />
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 mix-blend-overlay"></div>
                      </div>
                    )}
                    <div className="w-20 h-20 relative flex items-center justify-center mb-6 z-10">
                      <div className={`absolute inset-0 border-4 rounded-full ${isAutoImproving ? 'border-pink-500/20' : 'border-blue-500/20'}`}></div>
                      <div className={`absolute inset-0 border-4 rounded-full border-t-transparent animate-spin ${isAutoImproving ? 'border-pink-500' : 'border-blue-500'}`}></div>
                      <Wand2 className={`w-8 h-8 ${isAutoImproving ? 'text-pink-400 animate-bounce' : 'text-indigo-400 animate-pulse'}`} />
                    </div>
                    <h2 className="text-3xl font-bold mb-3 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-indigo-400 drop-shadow-md z-10 relative uppercase">
                      {isAutoImproving ? "Automatique God-Mode Active" : "Forging Architecture..."}
                    </h2>
                    <p className="text-pink-100 text-base animate-pulse max-w-md z-10 relative drop-shadow">
                      {isAutoImproving 
                        ? "AI is continuously writing incredibly complex logic, deep state management, beautiful UIs, and robust architectures automatically. It will NOT stop until it deems the app an absolute production-grade masterpiece."
                        : "Generating cross-platform modules, wiring logic, and rendering asset placeholders."}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        {/* Input Bar */}
        <div className="p-4 bg-gradient-to-r from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] border-t border-[#222] shrink-0 relative z-10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">
          <div className="max-w-4xl mx-auto relative">
            <div className="relative flex items-center bg-[#050505] rounded-xl border border-[#333] focus-within:border-pink-500/50 focus-within:ring-1 focus-within:ring-pink-500/50 transition-all shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
              <textarea
                className="w-full bg-transparent pl-4 pr-32 py-3.5 focus:outline-none text-white placeholder-gray-600 resize-none max-h-32 min-h-[52px] custom-scrollbar overflow-y-auto font-sans leading-relaxed"
                placeholder={commits.length === 0 ? "Leave blank & click 'Full Automatique God Mode' for a massive app, or type a prompt..." : "What to change next? ... or leave blank & click Engage Automatique God Mode!"}
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
                     className="h-10 bg-red-600 hover:bg-red-500 text-white rounded-lg px-6 flex items-center shadow-lg shadow-red-500/50 font-bold border border-red-400"
                   >
                     <X className="w-5 h-5 mr-2" /> INTERRUPT GOD MODE
                   </Button>
                ) : (
                  <>
                      <Button 
                        onClick={() => handleGenerate(true)} 
                        disabled={isGenerating}
                        className={`h-10 px-4 rounded-xl text-white disabled:opacity-50 transition-all duration-300 text-xs font-bold tracking-widest flex items-center shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.6)] hover:scale-105 active:scale-95 ${commits.length === 0 ? "bg-[length:200%_200%] animate-gradient-xy bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 outline outline-2 outline-offset-2 outline-pink-500/50" : "bg-gradient-to-r from-pink-600 to-indigo-600 outline outline-1 outline-pink-500/30"}`}
                        title="Autonomous Full App Generator Loop"
                      >
                         <Wand2 className={`w-3.5 h-3.5 mr-1.5 ${commits.length === 0 ? "animate-spin-slow" : ""}`} /> {commits.length > 0 ? "Engage Automatique God Mode" : "Full Automatique God Mode"}
                      </Button>
                    <Button 
                      onClick={() => handleGenerate(false)} 
                      disabled={isGenerating || !currentPrompt.trim()}
                      size="icon"
                      className="h-9 w-9 bg-pink-600 hover:bg-pink-500 rounded-lg text-white disabled:opacity-50 transition-all shadow-lg shadow-pink-500/20"
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="mt-2 flex justify-between items-center text-[10px] text-gray-500">
              <span>Press <kbd className="font-mono bg-[#252525] px-1 rounded mx-0.5 text-gray-400">Enter</kbd> to send, <kbd className="font-mono bg-[#252525] px-1 rounded mx-0.5 text-gray-400">Shift</kbd> + <kbd className="font-mono bg-[#252525] px-1 rounded mx-0.5 text-gray-400">Enter</kbd> for new line.</span>
              <span className="hidden sm:inline">Powered by {aiConfig.provider === 'gemini' ? 'Gemini Models' : (aiConfig.model || 'Custom Model')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
