import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { VirtualFile } from '../types';

export const downloadProjectAsZip = async (projectFiles: VirtualFile[], projectName: string = 'forge-app') => {
  const zip = new JSZip();

  for (const file of projectFiles) {
    // Remove leading slash if present to avoid absolute path issues in ZIP
    const filePath = file.path.startsWith('/') ? file.path.substring(1) : file.path;
    zip.file(filePath, file.content);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `${projectName}.zip`);
};
