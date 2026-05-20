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
  if (filename.match(/\.(png|jpe?g|gif|svg)$/i)) return <FileImage className="w-4 h-4 text-blue-400" />;
  if (filename.match(/\.(json)$/i)) return <FileJson className="w-4 h-4 text-yellow-400" />;
  if (filename.match(/\.(tsx?|jsx?)$/i)) return <FileCode className="w-4 h-4 text-blue-500" />;
  return <FileText className="w-4 h-4 text-gray-400" />;
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
          className={`cursor-pointer flex items-center py-1 hover:bg-gray-800 transition-colors ${isSelected ? 'bg-gray-800 text-white' : 'text-gray-300'}`}
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          {getFileIcon(node.name)}
          <span className="ml-2 text-sm select-none truncate pr-2">{node.name}</span>
        </div>
      );
    }

    return (
      <div>
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="cursor-pointer flex items-center py-1 hover:bg-gray-800 transition-colors text-gray-300"
          style={{ paddingLeft: `${paddingLeft - 4}px` }}
        >
          {isOpen ? <ChevronDown className="w-4 h-4 mr-1 opacity-70" /> : <ChevronRight className="w-4 h-4 mr-1 opacity-70" />}
          {isOpen ? <FolderOpen className="w-4 h-4 text-yellow-500" /> : <Folder className="w-4 h-4 text-yellow-500" />}
          <span className="ml-2 text-sm select-none truncate pr-2">{node.name}</span>
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
    <div className="w-full h-full overflow-y-auto overflow-x-hidden bg-[#1e1e1e] border-r border-[#333] pt-4 custom-scrollbar">
      {Object.values(root.children).length === 0 ? (
        <div className="text-gray-500 p-4 text-sm text-center">No files generated yet.</div>
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
