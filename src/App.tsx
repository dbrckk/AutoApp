import React, { useState, useEffect, useRef } from 'react';
import { Download, Loader2, Send, Wand2, Play, Plus, Clock, Terminal, X, Code2, Smartphone, LayoutTemplate, Trash2, Menu, Settings, ChevronDown } from 'lucide-react';
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
        "Build a massive, hyper-complex Enterprise SaaS Global Dashboard. Include real-time animated data grids (simulated) using D3.js/Recharts, deeply nested multi-step onboarding, beautiful Framer Motion page transitions, massive nested routing, deep Context/Zustand state management, a rich-text template editor, and a stunning dark-glassmorphism neon-accented UI. Leave nothing to the imagination.",
        "Build a completely immersive, next-generation Music DAWs and DJ production studio in the browser. Include real-time Web Audio API synthesizers, complex interactive timeline mixing boards, beautifully animated dynamic frequency analyzers, drag-and-drop tracks, and an ultra-premium futuristic dark-mode studio interface. Over-engineer everything. Fully automatic mode.",
        "Build a world-class Web3 / Crypto Portfolio tracker OS at a $100B startup scale. Implement live mock WebSockets for fake ticker data flowing constantly, hyper-complex candlestick financial charts, a full-screen trading terminal view with draggable/resizable widget windows, multi-wallet sync simulation, and razor-sharp minimalist brutalist dark design. Build it entirely autonomously.",
        "Build a full-blown collaborative canvas whiteboarding app like Miro/Figma. Include infinite panning, a massive suite of vector drawing tools (simulated with HTML5 Canvas or SVG), real-time mock collaboration cursors flying around, an extensive tools palette, layered object management, undo/redo history, and breathtaking fluid micro-interactions. Max out the features.",
        "Generate a hyper-advanced 3D-feeling Space Exploration Encyclopedia. Use incredible parallax scrolling, deeply nested route hierarchies for galaxies/planets, complex physical data simulations, interactive orbital paths, 3D CSS transforms, and awe-inspiring, jaw-dropping high-contrast cinematic web design. Make it massive. Full automatique mode.",
        "Generate an absolute god-tier AI-powered Operating System interface in React. A full simulated desktop with draggable windows, complex file system navigation, interactive terminal emulator connected to an AI agent, beautiful glassmorphic taskbar, layered z-indexing for active windows, and breathtaking animations. Implement it completely and thoroughly."
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
      let loopPrompt = (startAutoImprove && finalPrompt) 
        ? `CRITICAL: THE USER REQUEST IS: "${finalPrompt}". YOU MUST BUILD THIS IN FULL AUTOMATIQUE GOD-MODE. Over-engineer this to the absolute max. Deliver an impossibly massive, visually stunning masterpiece.`
        : finalPrompt || 'CRITICAL: AUTONOMOUS FORGE GOD-MODE ACTIVE. You must over-engineer the application to an absolute maximum. Add massive new features, extreme visual complexity, deeply nested states, and absolute god-tier CSS/animations. Break existing files into multiple components. Implement $1B startup features automatically. DO NOT wait for confirmation. Deliver an epic masterpiece.';
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
            loopPrompt = `CRITICAL: FULL AUTOMATIQUE GOD-MODE ACTIVE. The user originally requested: "${finalPrompt}". The user wants you to over-engineer this to the absolute max. Improve everything infinitely. Implement the next phase of massive structural, architectural, and breathtaking visual improvements. Build entirely new pages, massively complex dashboards, 3D interactive graphics (simulated), deep global state engines, gorgeous fluid animations, and real-world scale logic. Break components down into dozens of files if necessary. Do not wait for permission. You are generating a complete $10B startup. Evolve the app towards absolute god-tier perfection.`;
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
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#050505] overflow-hidden relative">
      {/* Intense atmospheric background for welcome state */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPPHBhdGggZD0iTTAgMGg0MHYxbC00MCAuMXpNMCAwdi4xbC4xIDQwSDB6IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIi8+PC9zdmc+')] mix-blend-screen opacity-70"></div>
        <div className="w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-pink-900/20 via-[#050505] to-[#050505] animate-pulse-slow"></div>
        <div className="absolute w-[800px] h-[800px] bg-[conic-gradient(from_0deg_at_50%_50%,_var(--tw-gradient-stops))] from-transparent via-pink-500/10 to-transparent animate-spin-slow rounded-full mix-blend-screen" style={{ animationDuration: '8s' }} />
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-pink-600/20 rounded-full mix-blend-screen filter blur-[150px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/20 rounded-full mix-blend-screen filter blur-[150px]" style={{ animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
      </div>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-4xl w-full z-10 overflow-y-auto custom-scrollbar pr-2 max-h-[85vh] flex flex-col items-center"
      >
        <div className="w-32 h-32 bg-gradient-to-tr from-pink-500/20 via-purple-500/20 to-indigo-500/20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 border border-white/10 shadow-[0_0_100px_rgba(236,72,153,0.4)] backdrop-blur-2xl relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-pink-500/30 to-indigo-500/30 rounded-[2.5rem] blur-2xl group-hover:blur-3xl transition-all opacity-70 animate-pulse"></div>
          <div className="absolute inset-[2px] bg-[#0a0a0a] rounded-[2.3rem] z-0"></div>
          <Terminal className="w-16 h-16 text-pink-400 drop-shadow-[0_0_30px_rgba(236,72,153,1)] relative z-10 animate-pulse-slow" />
        </div>
        <h1 className="text-6xl md:text-8xl font-display font-black bg-clip-text text-transparent bg-gradient-to-b from-white via-gray-200 to-gray-500 mb-8 tracking-tighter drop-shadow-2xl text-center leading-[1.1]">
          Forge AI <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400">Workspace</span> <sup className="text-sm md:text-lg text-pink-400 font-mono tracking-[0.2em] ml-2 bg-pink-500/10 px-4 py-1.5 rounded-full border border-pink-500/40 uppercase animate-pulse shadow-[0_0_20px_rgba(236,72,153,0.3)] align-top relative -top-8 md:-top-12">God Mode</sup>
        </h1>
        <p className="text-gray-400 text-xl md:text-2xl mb-14 leading-relaxed max-w-3xl mx-auto font-light text-center drop-shadow-md">
          Experience the absolute pinnacle of autonomic software generation. Describe your billion-dollar vision, or unleash <strong className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-indigo-400 drop-shadow-[0_0_15px_rgba(236,72,153,0.8)] font-black tracking-wide">FULL AUTOMATIQUE GOD MODE</strong> and watch a production-grade massive masterpiece build itself out of the void.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full text-left perspective-1000">
          <button onClick={() => handleTemplateClick("Build an incredibly advanced, fully-styled Instagram clone in React Native/Expo. Include a gorgeous premium dark theme, massive state management, fluid animations with React Native Reanimated, simulated complex fetching logic, and ultra-polished UI/UX. Leave absolutely nothing to the imagination.")} className="p-6 rounded-[1.5rem] bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/5 hover:border-pink-500/50 hover:bg-[#111] transition-all duration-500 group flex items-start space-x-6 shadow-2xl hover:shadow-[0_0_40px_rgba(236,72,153,0.15)] hover:-translate-y-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="p-4 bg-gradient-to-br from-pink-500/10 to-pink-500/5 rounded-2xl group-hover:bg-pink-500/20 group-hover:scale-110 transition-all duration-500 shadow-[inset_0_0_20px_rgba(236,72,153,0.1)] border border-pink-500/20 relative z-10">
              <Smartphone className="w-8 h-8 text-pink-400 drop-shadow-[0_0_15px_rgba(236,72,153,0.6)]" />
            </div>
            <div className="relative z-10 flex-1">
              <h3 className="text-gray-100 font-extrabold mb-2 text-xl group-hover:text-pink-300 transition-colors tracking-tight">Premium Social UI</h3>
              <p className="text-[13px] text-gray-500 font-medium leading-relaxed">Native-grade layout synthesis</p>
            </div>
          </button>
          
          <button onClick={() => handleTemplateClick("Create an enterprise-grade Agile Kanban Tracker. Must feature extensive multi-layered state, incredibly smooth framer-motion drag-and-drop, completely deep nested routing structures (simulated), interactive dashboards with Recharts, and absolute styling perfection.")} className="p-6 rounded-[1.5rem] bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/5 hover:border-indigo-500/50 hover:bg-[#111] transition-all duration-500 group flex items-start space-x-6 shadow-2xl hover:shadow-[0_0_40px_rgba(99,102,241,0.15)] hover:-translate-y-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="p-4 bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 rounded-2xl group-hover:bg-indigo-500/20 group-hover:scale-110 transition-all duration-500 shadow-[inset_0_0_20px_rgba(99,102,241,0.1)] border border-indigo-500/20 relative z-10">
              <LayoutTemplate className="w-8 h-8 text-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,0.6)]" />
            </div>
            <div className="relative z-10 flex-1">
              <h3 className="text-gray-100 font-extrabold mb-2 text-xl group-hover:text-indigo-300 transition-colors tracking-tight">Enterprise Kanban</h3>
              <p className="text-[13px] text-gray-500 font-medium leading-relaxed">Massive state orchestration</p>
            </div>
          </button>
          
          <button onClick={() => handleTemplateClick("Build an extremely complex immersive WebGL or Canvas-based game. Include a fully architected game loop, particle systems, beautiful futuristic neon retro-arcade shaders, multi-level logic, and completely maxed-out visuals.")} className="p-6 rounded-[1.5rem] bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/5 hover:border-emerald-500/50 hover:bg-[#111] transition-all duration-500 group flex items-start space-x-6 shadow-2xl hover:shadow-[0_0_40px_rgba(16,185,129,0.15)] hover:-translate-y-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-2xl group-hover:bg-emerald-500/20 group-hover:scale-110 transition-all duration-500 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)] border border-emerald-500/20 relative z-10">
              <Play className="w-8 h-8 text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.6)] ml-1" />
            </div>
            <div className="relative z-10 flex-1">
              <h3 className="text-gray-100 font-extrabold mb-2 text-xl group-hover:text-emerald-300 transition-colors tracking-tight">Advanced Game Engine</h3>
              <p className="text-[13px] text-gray-500 font-medium leading-relaxed">HTML5 Canvas render topology</p>
            </div>
          </button>
          
          <button onClick={() => handleTemplateClick("Generate a god-tier Developer OS/Desktop interface in the browser. It windowing system with draggable windows, a start menu, a working terminal emulation, file system architecture, and immaculate glassmorphism aesthetics.")} className="p-6 rounded-[1.5rem] bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/5 hover:border-purple-500/50 hover:bg-[#111] transition-all duration-500 group flex items-start space-x-6 shadow-2xl hover:shadow-[0_0_40px_rgba(168,85,247,0.15)] hover:-translate-y-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-2xl group-hover:bg-purple-500/20 group-hover:scale-110 transition-all duration-500 shadow-[inset_0_0_20px_rgba(168,85,247,0.1)] border border-purple-500/20 relative z-10">
              <Code2 className="w-8 h-8 text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.6)]" />
            </div>
            <div className="relative z-10 flex-1">
              <h3 className="text-gray-100 font-extrabold mb-2 text-xl group-hover:text-purple-300 transition-colors tracking-tight">Web OS Architecture</h3>
              <p className="text-[13px] text-gray-500 font-medium leading-relaxed">Desktop hyper-simulation</p>
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
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative flex flex-col w-72 md:w-80 border-r border-[#222] bg-[#0a0a0a]/95 backdrop-blur-3xl z-40 h-full md:h-full top-0 md:top-0 left-0 pt-12 md:pt-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`}>
        <div className="hidden md:flex flex-col border-b border-[#222] bg-[#111]/80 backdrop-blur-md shrink-0 relative z-10">
          <div className="h-14 flex items-center px-5 font-black text-white tracking-[0.2em] text-sm bg-gradient-to-b from-[#151515] to-transparent font-display shadow-inner">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-pink-500/20 to-indigo-500/20 flex items-center justify-center mr-3 border border-pink-500/30 shadow-[inset_0_0_10px_rgba(236,72,153,0.2)] pb-0.5">
              <Terminal className="w-4 h-4 text-pink-400" />
            </div>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">FORGE SYSTEM</span>
          </div>
          <div className="px-5 pb-5 pt-3">
            <div className="flex items-center justify-between mb-3 text-white/50">
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">Workspaces</span>
              <button onClick={handleCreateProject} className="text-pink-400 hover:text-white transition-all bg-pink-500/10 hover:bg-pink-500/30 p-1.5 rounded-md border border-pink-500/20 hover:shadow-[0_0_10px_rgba(236,72,153,0.3)]" title="New Project">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="relative group/select">
              <select 
                value={currentProjectId || ''} 
                onChange={(e) => {
                  setCurrentProjectId(e.target.value);
                  setOpenFiles([]);
                  setSelectedFilePath(null);
                  setCurrentPrompt('');
                }}
                className="w-full bg-[#050505] border border-[#333] group-hover/select:border-pink-500/50 rounded-xl text-sm text-gray-200 py-2.5 pl-4 pr-10 appearance-none focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500/50 transition-all shadow-inner font-medium truncate cursor-pointer"
              >
                {projects.length === 0 ? (
                  <option value="" disabled>No projects yet...</option>
                ) : (
                  projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))
                )}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                <ChevronDown className="w-4 h-4 text-gray-500 group-hover/select:text-pink-400 transition-colors" />
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden flex flex-col bg-transparent relative z-10">
          <div className="px-5 py-3 font-bold text-[10px] tracking-[0.2em] text-pink-500/80 uppercase border-b border-[#222] bg-[#050505]/80 flex justify-between items-center shadow-inner">
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
        <div className="h-[45%] flex flex-col border-t border-white/5 bg-gradient-to-b from-[#111] to-[#0a0a0a] relative z-10 shadow-[0_-15px_40px_rgba(0,0,0,0.6)]">
          <div className="px-5 py-3.5 font-bold text-[10px] tracking-[0.2em] text-gray-400 uppercase border-b border-white/5 flex justify-between items-center bg-[#050505]/50 backdrop-blur-md">
            <span className="flex items-center drop-shadow-md"><Clock className="w-3.5 h-3.5 mr-2 text-indigo-400" /> FORGE TIMELINE</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
            {commits.length === 0 ? (
              <div className="text-gray-600 text-[10px] text-center mt-10 font-mono tracking-[0.3em] uppercase opacity-50 relative">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                No stages forged yet
              </div>
            ) : (
              commits.map((c, i) => (
                <div key={c.id} className="relative pl-6 border-l border-white/10 last:border-transparent group pt-1 pb-1">
                  <div className="absolute w-3.5 h-3.5 bg-[#0a0a0a] rounded-full -left-[8px] top-2 z-0 border border-white/10"></div>
                  <div className="absolute w-2 h-2 bg-gradient-to-r from-pink-500 to-indigo-500 rounded-full -left-[4px] top-[11px] group-hover:scale-[1.8] group-hover:blur-[1px] transition-all duration-300 shadow-[0_0_15px_rgba(236,72,153,1)] z-10"></div>
                  <div className="mb-3 flex items-baseline justify-between overflow-hidden">
                    <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-indigo-400 text-[15px] tracking-[0.25em] uppercase items-center flex drop-shadow-lg font-display">
                      STAGE {i + 1}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono ml-2 whitespace-nowrap bg-white/5 px-2.5 py-1 rounded-md border border-white/5 shadow-inner">{new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                  <div className="text-indigo-200/90 text-sm italic mb-4 line-clamp-2 border-l-2 border-indigo-500/30 pl-3 leading-relaxed drop-shadow-md font-light">"{c.prompt}"</div>
                  <div className="p-5 rounded-2xl bg-[#111]/80 backdrop-blur-md border border-white/5 text-xs shadow-xl hover:shadow-[0_0_30px_rgba(236,72,153,0.1)] hover:border-pink-500/40 transition-all duration-300 relative overflow-hidden group/card text-gray-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-indigo-500/5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                    <div className="absolute inset-[1px] bg-[#0f0f0f] rounded-[15px] z-0 opacity-80 pointer-events-none"></div>
                    <div className="text-emerald-400 font-mono font-bold mb-4 flex items-center bg-emerald-500/10 w-fit px-3 py-1.5 rounded-lg border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)] relative z-10"><Clock className="w-3.5 h-3.5 mr-2" />SYS_SAVED: {(c.estimatedTimeSaved || '0 MINS').toUpperCase()}</div>
                    <div className="text-gray-300 whitespace-pre-wrap leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-li:my-1 prose-strong:text-pink-300 prose-strong:drop-shadow-[0_0_5px_rgba(236,72,153,0.3)] relative z-10 font-[13px]">
                      <Markdown>{c.changelog}</Markdown>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="border-t border-[#222] p-3 bg-[#050505]">
            <button 
              onClick={() => setShowSettings(true)}
              className="w-full flex items-center justify-center space-x-2 p-3 rounded-xl bg-white/5 hover:bg-gradient-to-r hover:from-pink-500/20 hover:to-indigo-500/20 text-gray-400 hover:text-white transition-all text-[11px] font-black tracking-[0.2em] uppercase border border-white/5 hover:border-pink-500/30 hover:shadow-[0_0_15px_rgba(236,72,153,0.15)] group"
            >
              <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
              <span>Copilot Configuration</span>
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-md px-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0f0f0f]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] shadow-[0_0_100px_rgba(236,72,153,0.2)] w-full max-w-lg overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 shadow-[0_0_15px_rgba(236,72,153,0.8)]"></div>
              <div className="flex justify-between items-center p-6 border-b border-white/5 bg-white/5">
                <h3 className="font-black text-2xl flex items-center tracking-tight text-white font-display">
                  <div className="p-2 bg-pink-500/10 rounded-lg mr-4 border border-pink-500/20 shadow-[inset_0_0_15px_rgba(236,72,153,0.1)]">
                    <Settings className="w-5 h-5 text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
                  </div>
                  Copilot Matrix
                </h3>
                <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-pink-400 transition-colors bg-[#222] hover:bg-pink-500/10 p-2 rounded-full border border-transparent hover:border-pink-500/30">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8 space-y-8 bg-[#050505]/80">
                <div className="group/field">
                  <label className="block text-[11px] font-black font-mono tracking-[0.2em] uppercase text-gray-400 mb-3 group-hover/field:text-pink-400 transition-colors">Language Core Provider</label>
                  <select 
                    value={aiConfig.provider}
                    onChange={(e) => setAiConfig({...aiConfig, provider: e.target.value})}
                    className="w-full bg-[#111] border border-[#333] hover:border-pink-500/50 rounded-xl px-5 py-4 text-gray-200 focus:outline-none focus:border-pink-500 transition-all shadow-inner focus:shadow-[0_0_20px_rgba(236,72,153,0.15)] font-medium appearance-none"
                  >
                    <option value="gemini">Google Gemini AI Core (Default)</option>
                    <option value="openai_compatible">Custom API Registry</option>
                  </select>
                </div>

                <AnimatePresence mode="popLayout">
                  {aiConfig.provider === 'openai_compatible' && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0, filter: "blur(10px)" }}
                        animate={{ opacity: 1, height: 'auto', filter: "blur(0px)" }}
                        exit={{ opacity: 0, height: 0, filter: "blur(10px)" }}
                        transition={{ duration: 0.4 }}
                        className="space-y-6 overflow-hidden"
                    >
                      <div className="p-5 bg-gradient-to-r from-pink-500/10 to-transparent border-l-4 border-l-pink-500 rounded-r-xl border-y border-r border-[#333] text-sm text-pink-100/90 leading-relaxed shadow-lg">
                        <strong className="text-pink-400 font-bold block mb-1">Architecture Override:</strong> 
                        Bind to custom neural networks like Ollama, Groq, Together AI, or standard OpenAI conformant endpoints.
                      </div>
                      <div className="group/field">
                        <label className="block text-[11px] font-black font-mono tracking-[0.2em] uppercase text-gray-400 mb-3 group-hover/field:text-pink-400 transition-colors">Endpoint Matrix URL</label>
                        <input 
                          type="url" 
                          placeholder="https://api.groq.com/openai/v1"
                          value={aiConfig.baseUrl}
                          onChange={(e) => setAiConfig({...aiConfig, baseUrl: e.target.value})}
                          className="w-full bg-[#111] border border-[#333] rounded-xl px-5 py-4 text-gray-200 focus:outline-none focus:border-pink-500 hover:border-pink-500/50 transition-all font-mono text-sm placeholder-gray-600 focus:shadow-[0_0_20px_rgba(236,72,153,0.15)]"
                        />
                      </div>
                      <div className="group/field">
                        <label className="block text-[11px] font-black font-mono tracking-[0.2em] uppercase text-gray-400 mb-3 group-hover/field:text-pink-400 transition-colors">Access Token</label>
                        <input 
                          type="password" 
                          placeholder="sk-..."
                          value={aiConfig.apiKey}
                          onChange={(e) => setAiConfig({...aiConfig, apiKey: e.target.value})}
                          className="w-full bg-[#111] border border-[#333] rounded-xl px-5 py-4 text-gray-200 focus:outline-none focus:border-pink-500 hover:border-pink-500/50 transition-all font-mono text-sm placeholder-gray-600 focus:shadow-[0_0_20px_rgba(236,72,153,0.15)]"
                        />
                      </div>
                      <div className="group/field">
                        <label className="block text-[11px] font-black font-mono tracking-[0.2em] uppercase text-gray-400 mb-3 group-hover/field:text-pink-400 transition-colors">Target Node / Model</label>
                        <input 
                          type="text" 
                          placeholder="llama3-70b-8192"
                          value={aiConfig.model}
                          onChange={(e) => setAiConfig({...aiConfig, model: e.target.value})}
                          className="w-full bg-[#111] border border-[#333] rounded-xl px-5 py-4 text-gray-200 focus:outline-none focus:border-pink-500 hover:border-pink-500/50 transition-all font-mono text-sm placeholder-gray-600 focus:shadow-[0_0_20px_rgba(236,72,153,0.15)] bg-gradient-to-r focus:from-[#151515] focus:to-[#111]"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="p-6 border-t border-white/5 bg-white/5 flex justify-end">
                <Button onClick={() => setShowSettings(false)} className="bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white px-10 rounded-xl h-12 font-black tracking-widest uppercase text-xs shadow-[0_0_20px_rgba(236,72,153,0.4)] hover:shadow-[0_0_40px_rgba(236,72,153,0.7)] transition-all hover:scale-105 active:scale-95 border border-pink-500/30">
                  Initialize Settings
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
                        className={`flex items-center px-5 py-2.5 text-[13px] font-mono cursor-pointer border-r border-[#1a1a1a] group min-w-0 max-w-[220px] transition-all duration-300 relative overflow-hidden ${isSelected ? 'bg-[#0a0a0a] text-pink-400 shadow-[inset_0_2px_20px_rgba(236,72,153,0.1)]' : 'text-gray-500 hover:bg-[#111] hover:text-gray-300'}`}
                      >
                        {isSelected && <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-pink-500 to-indigo-500 shadow-[0_0_10px_rgba(236,72,153,0.8)]"></div>}
                        {isSelected && <div className="absolute inset-0 bg-gradient-to-t from-transparent to-pink-500/5 opacity-50"></div>}
                        <span className="truncate pr-3 select-none relative z-10">{filename}</span>
                        <button 
                          onClick={(e) => handleCloseFile(e, path)}
                          className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all relative z-10 ${isSelected ? 'opacity-100 hover:bg-pink-500/20 hover:text-pink-300 text-pink-500/50' : 'hover:bg-[#333] text-gray-500'}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
               )}
              
              {openFiles.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-600 bg-[#050505] relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(236,72,153,0.05),transparent)] pointer-events-none group-hover:bg-[radial-gradient(ellipse_at_center,rgba(236,72,153,0.08),transparent)] transition-all duration-700"></div>
                  <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                  <div className="text-center relative z-10">
                    <Code2 className="w-16 h-16 mx-auto mb-6 opacity-[0.15] text-pink-400 group-hover:opacity-30 group-hover:scale-110 transition-all duration-700 drop-shadow-[0_0_15px_rgba(236,72,153,0.2)]" />
                    <p className="font-mono text-xs tracking-[0.3em] uppercase text-gray-600 group-hover:text-pink-500/50 transition-colors duration-700">System Awaiting Architecture Module</p>
                  </div>
                </div>
              ) : (
                <CodeViewer file={selectedFile} />
              )}

              <AnimatePresence>
                {isGenerating && (
                  <motion.div 
                    initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                    animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
                    exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 p-6 text-center overflow-hidden"
                  >
                    {isAutoImproving ? (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden mix-blend-screen">
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPPHBhdGggZD0iTTAgMGg0MHYxbC00MCAuMXpNMCAwdi4xbC4xIDQwSDB6IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9zdmc+')] mix-blend-screen opacity-50 scanline"></div>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-pink-600/30 via-purple-900/40 to-transparent animate-pulse-slow"></div>
                        <div className="w-[200%] h-[200%] bg-[conic-gradient(from_0deg_at_50%_50%,_var(--tw-gradient-stops))] from-transparent via-pink-400/20 to-transparent animate-spin-slow rounded-full mix-blend-screen" style={{ animationDuration: '3s' }} />
                        <div className="w-[150%] h-[150%] bg-[conic-gradient(from_180deg_at_50%_50%,_var(--tw-gradient-stops))] from-transparent via-indigo-400/20 to-transparent animate-spin-slow rounded-full mix-blend-screen" style={{ animationDuration: '5s', animationDirection: 'reverse' }} />
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 mix-blend-overlay"></div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden mix-blend-screen">
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPPHBhdGggZD0iTTAgMGg0MHYxbC00MCAuMXpNMCAwdi4xbC4xIDQwSDB6IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9zdmc+')] mix-blend-screen opacity-30 scanline"></div>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/30 via-[#0a0a0a] to-transparent animate-pulse-slow"></div>
                      </div>
                    )}
                    <motion.div 
                      initial={{ scale: 0.8, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      transition={{ type: "spring", bounce: 0.5 }}
                      className="w-32 h-32 md:w-40 md:h-40 relative flex items-center justify-center mb-10 z-10"
                    >
                      <div className={`absolute inset-0 border-[8px] rounded-full ${isAutoImproving ? 'border-pink-500/20 shadow-[0_0_80px_rgba(236,72,153,0.3)]' : 'border-indigo-500/20 shadow-[0_0_50px_rgba(99,102,241,0.2)]'}`}></div>
                      <div className={`absolute inset-0 border-[8px] rounded-full border-t-transparent border-l-transparent animate-spin ${isAutoImproving ? 'border-pink-500 shadow-[0_0_40px_rgba(236,72,153,1)]' : 'border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.5)]'}`} style={{ animationDuration: '1s' }}></div>
                      <div className={`absolute inset-3 md:inset-4 border-[4px] rounded-full border-b-transparent border-r-transparent animate-spin ${isAutoImproving ? 'border-purple-400 opacity-90' : 'border-cyan-400 opacity-60'}`} style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
                      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 mix-blend-overlay pointer-events-none rounded-full"></div>
                      <Wand2 className={`w-14 h-14 md:w-16 md:h-16 relative z-10 ${isAutoImproving ? 'text-pink-300 animate-pulse drop-shadow-[0_0_20px_rgba(236,72,153,1)]' : 'text-indigo-300 animate-pulse drop-shadow-[0_0_15px_rgba(99,102,241,0.8)]'}`} />
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ delay: 0.2 }}
                      className="z-10 bg-black/60 p-10 md:p-14 md:max-w-4xl mx-auto rounded-[3rem] border border-white/10 backdrop-blur-3xl shadow-[0_0_100px_rgba(0,0,0,1)] relative overflow-hidden group"
                    >
                      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
                        <div className="w-full text-[10px] md:text-sm font-mono text-pink-500 whitespace-pre leading-none animate-pulse-slow font-black opacity-30">
                          {Array(30).fill(0).map(() => Math.random().toString(16).substring(2, 100)).join('\n')}
                        </div>
                      </div>
                      <div className={`absolute inset-0 opacity-30 ${isAutoImproving ? 'bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500' : 'bg-gradient-to-br from-indigo-500 to-cyan-500'} blur-3xl transition-all duration-1000`}></div>
                      <h2 className="text-5xl md:text-7xl lg:text-8xl font-display font-black mb-6 tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 drop-shadow-2xl relative z-10 uppercase leading-[0.9]">
                        {isAutoImproving ? (
                          <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 relative inline-block">
                             <span className="absolute inset-0 blur-sm bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 opacity-50">God-Mode<br/>Active</span>
                             God-Mode<br/>Active
                          </span>
                        ) : (
                          "Forging<br/>System"
                        )}
                      </h2>
                      <div className="h-1.5 w-32 mx-auto mb-8 rounded-full bg-gradient-to-r from-transparent via-white/50 to-transparent shadow-[0_0_15px_rgba(255,255,255,0.5)] relative overflow-hidden">
                         <div className="absolute right-[100%] top-0 bottom-0 w-[50%] bg-white blur-[2px] animate-slide-right"></div>
                      </div>
                      <p className={`text-xl md:text-3xl font-light max-w-3xl mx-auto z-10 relative drop-shadow-xl leading-relaxed ${isAutoImproving ? 'text-pink-100/90' : 'text-indigo-100/90'}`}>
                        {isAutoImproving 
                          ? "AI is continuously weaving massive architectural logic, deep state matrices, and hyper-polished UI elements. It will not halt until absolute perfection is achieved."
                          : "Constructing core modules, computing visual hierarchies, and establishing logic foundations."}
                      </p>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        {/* Input Bar */}
        <div className="p-6 lg:p-8 bg-gradient-to-t from-[#000] to-[#050505] border-t border-white/5 shrink-0 relative z-10 shadow-[0_-30px_60px_rgba(0,0,0,0.9)]">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
          {isAutoImproving && (
            <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-indigo-500/10 pointer-events-none animate-pulse-slow"></div>
          )}
          <div className="max-w-5xl mx-auto relative z-10">
            <div className={`relative flex flex-col md:flex-row items-end md:items-center bg-[#0a0a0a]/80 backdrop-blur-3xl rounded-[2rem] border focus-within:shadow-[0_0_80px_rgba(236,72,153,0.25)] transition-all overflow-visible group shadow-2xl ${isAutoImproving ? 'border-pink-500/50 shadow-[0_0_50px_rgba(236,72,153,0.2)]' : 'border-white/10 hover:border-pink-500/50 focus-within:border-pink-500/80'}`}>
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-[2rem]"></div>
              {isAutoImproving && (
                 <div className="absolute inset-0 bg-[length:200%_200%] animate-gradient-xy bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-indigo-500/20 rounded-[2rem] pointer-events-none blur-md"></div>
              )}
              <textarea
                className="w-full bg-transparent pl-8 pr-6 md:pr-[380px] py-6 focus:outline-none text-white placeholder-gray-600 resize-none max-h-56 min-h-[72px] custom-scrollbar overflow-y-auto font-sans leading-relaxed text-sm lg:text-base z-10 relative font-medium group-focus-within:drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                placeholder={commits.length === 0 ? "Describe visionary software, or press Ignite God Mode for automatic synthesis..." : "Command structural mutations, or re-engage Automatique..."}
                value={currentPrompt}
                onChange={(e) => {
                  setCurrentPrompt(e.target.value);
                  e.target.style.height = 'auto';
                  if (currentPrompt.length === 0) e.target.style.height = '72px';
                  else e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
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
              <div className="absolute right-3 bottom-0 top-0 flex items-center space-x-3 md:space-x-4 pointer-events-auto z-20 pr-4">
                {isAutoImproving ? (
                   <Button 
                     onClick={handleStopAutoImprove} 
                     className="h-12 bg-red-600/90 hover:bg-red-500 text-white rounded-xl px-8 flex items-center shadow-[0_0_40px_rgba(239,68,68,0.6)] font-black tracking-widest uppercase border border-red-400 backdrop-blur-md transition-all hover:scale-105 active:scale-95 z-20 text-[11px]"
                   >
                     <X className="w-5 h-5 mr-3 animate-pulse" /> HALT GOD MODE
                   </Button>
                ) : (
                  <>
                      <Button 
                        onClick={() => handleGenerate(true)} 
                        disabled={isGenerating}
                        className={`h-12 px-6 rounded-xl text-white disabled:opacity-50 transition-all duration-500 text-[11px] uppercase font-black tracking-[0.2em] flex items-center shadow-[0_0_30px_rgba(236,72,153,0.4)] hover:shadow-[0_0_50px_rgba(236,72,153,0.8)] hover:scale-105 active:scale-95 z-20 ${commits.length === 0 ? "bg-[length:250%_250%] animate-gradient-xy bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 outline outline-2 outline-offset-2 outline-pink-500/60" : "bg-gradient-to-r from-pink-600 to-indigo-600 outline outline-1 outline-pink-500/40"}`}
                        title="Autonomous Full App Generator Loop"
                      >
                         <Wand2 className={`w-4 h-4 md:mr-3 ${commits.length === 0 ? "animate-spin-slow drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : ""}`} /> 
                         <span className="hidden md:inline">{commits.length > 0 ? "Engage God Mode" : "Ignite God Mode"}</span>
                      </Button>
                    <Button 
                      onClick={() => handleGenerate(false)} 
                      disabled={isGenerating || !currentPrompt.trim()}
                      size="icon"
                      className="h-12 w-12 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 backdrop-blur-md rounded-xl text-white disabled:opacity-30 transition-all shadow-inner hover:scale-105 active:scale-95 z-20 group"
                    >
                      {isGenerating ? <Loader2 className="w-5 h-5 animate-spin text-pink-400" /> : <Send className="w-5 h-5 ml-1 text-gray-300 drop-shadow-md group-hover:text-white" />}
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-between items-center text-[10px] text-gray-500 tracking-wide font-medium">
              <span>PRESS <kbd className="font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded mx-1 text-gray-400 shadow-inner">ENTER</kbd> TO SEND &bull; <kbd className="font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded mx-1 text-gray-400 shadow-inner">SHIFT + ENTER</kbd> FOR NEW LINE</span>
              <span className="hidden sm:inline text-pink-500/70 font-mono tracking-widest"><kbd className="mr-2">⚡</kbd>POWERED BY {aiConfig.provider === 'gemini' ? 'GEMINI' : (aiConfig.model || 'CUSTOM MODEL').toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
