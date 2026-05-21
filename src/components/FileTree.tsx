import React, { useState } from 'react';
import { FileCode, FileImage, FileJson, FileText, Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';
import { VirtualFile } from '../types';

interface FileTreeProps {
  files: VirtualFile[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}

type Node = {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children: Record<string, Node>;
};

function getFileIcon(filename: string) {
  if (filename.match(/\.(png|jpe?g|gif|svg)$/i)) return <FileImage className="w-4 h-4 text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]" />;
  if (filename.match(/\.(json)$/i)) return <FileJson className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />;
  if (filename.match(/\.(tsx?|jsx?)$/i)) return <FileCode className="w-4 h-4 text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />;
  return <FileText className="w-4 h-4 text-gray-500" />;
}

export function FileTree({ files, selectedPath, onSelectFile }: FileTreeProps) {
  // Build a tree from flat paths
  const root: Node = { name: 'root', type: 'folder', path: '', children: {} };

  files.forEach(file => {
    const parts = file.path.split('/').filter(Boolean);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const pathSoFar = '/' + parts.slice(0, i + 1).join('/');

      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          type: isFile ? 'file' : 'folder',
          path: pathSoFar,
          children: {}
        };
      }
      current = current.children[part];
    }
  });

  const FileTreeNode = ({ node, level = 0 }: { node: Node, level?: number }) => {
    const [isOpen, setIsOpen] = useState(true);
    const isSelected = selectedPath === node.path;
    const paddingLeft = level * 16 + 8;

    if (node.type === 'file') {
      return (
        <div
          onClick={() => onSelectFile(node.path)}
          className={`cursor-pointer flex items-center py-1.5 px-3 mx-2 my-0.5 rounded-lg hover:bg-white/5 transition-all outline-none ${isSelected ? 'bg-gradient-to-r from-pink-500/15 to-indigo-500/5 text-pink-100 shadow-[inset_0_1px_10px_rgba(236,72,153,0.1),0_0_10px_rgba(236,72,153,0.1)] border border-pink-500/20' : 'text-gray-400 hover:text-white border border-transparent'}`}
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          {getFileIcon(node.name)}
          <span className="ml-2.5 text-[12.5px] select-none truncate pr-2 tracking-wide font-mono mt-0.5">{node.name}</span>
        </div>
      );
    }

    return (
      <div>
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="cursor-pointer flex items-center py-1.5 px-3 mx-2 my-0.5 rounded-lg hover:bg-white/5 transition-all outline-none text-gray-300 font-bold tracking-wide group"
          style={{ paddingLeft: `${paddingLeft - 8}px` }}
        >
          {isOpen ? <ChevronDown className="w-4 h-4 mr-1 opacity-50 group-hover:opacity-100 transition-opacity" /> : <ChevronRight className="w-4 h-4 mr-1 opacity-50 group-hover:opacity-100 transition-opacity" />}
          {isOpen ? <FolderOpen className="w-4 h-4 text-indigo-400 drop-shadow-[0_0_5px_rgba(99,102,241,0.5)]" /> : <Folder className="w-4 h-4 text-indigo-400/80 group-hover:text-indigo-400 transition-colors" />}
          <span className="ml-2.5 text-[11px] select-none truncate pr-2 uppercase tracking-[0.1em] text-gray-400 group-hover:text-white transition-colors">{node.name}</span>
        </div>
        {isOpen && (
          <div className="flex flex-col">
            {Object.values(node.children)
              .sort((a, b) => {
                // folders first
                if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                return a.name.localeCompare(b.name);
              })
              .map(child => <FileTreeNode key={child.path} node={child} level={level + 1} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full overflow-y-auto overflow-x-hidden bg-transparent pt-4 custom-scrollbar">
      {Object.values(root.children).length === 0 ? (
        <div className="text-gray-600 p-6 text-[11px] text-center font-mono tracking-[0.2em] uppercase opacity-70">
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 mx-auto mb-4 flex items-center justify-center animate-pulse-slow">
             <FileCode className="w-5 h-5 text-gray-500" />
          </div>
          Awaiting Initial Synthesis...
        </div>
      ) : (
        <div className="pb-4">
          {Object.values(root.children)
            .sort((a, b) => {
              if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
              return a.name.localeCompare(b.name);
            })
            .map(node => <FileTreeNode key={node.path} node={node} />)}
        </div>
      )}
    </div>
  );
}
