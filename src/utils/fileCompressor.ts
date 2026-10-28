/**
 * Client-side file optimization and compression utility
 * Automatically downscales oversized photos/screenshots so multi-file uploads
 * remain well below Vercel's 4.5MB serverless payload limit.
 */

export interface ProcessedFile {
  id: string;
  name: string;
  mimeType: string;
  base64: string;
  size: number;
  sizeFormatted: string;
  rawText?: string;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export async function processUploadFile(file: File): Promise<ProcessedFile> {
  const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const isImage = file.type.startsWith('image/');
  const isText =
    file.type.startsWith('text/') ||
    file.name.endsWith('.txt') ||
    file.name.endsWith('.md') ||
    file.name.endsWith('.markdown') ||
    file.name.endsWith('.csv') ||
    file.name.endsWith('.tsv') ||
    file.name.endsWith('.json');

  // 1. Text files: read as string directly
  if (isText) {
    const textContent = await file.text();
    // Encode to base64 safely supporting UTF-8 characters
    const encoder = new TextEncoder();
    const data = encoder.encode(textContent);
    let binary = '';
    const len = data.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(data[i]);
    }
    const base64 = btoa(binary);

    return {
      id: fileId,
      name: file.name,
      mimeType: file.type || 'text/plain',
      base64,
      size: file.size,
      sizeFormatted: formatBytes(file.size),
      rawText: textContent,
    };
  }

  // 2. Images: compress if larger than 800KB or dimensions > 1600px
  if (isImage) {
    try {
      const compressed = await compressImageFile(file);
      return {
        id: fileId,
        name: compressed.name,
        mimeType: compressed.mimeType,
        base64: compressed.base64,
        size: compressed.size,
        sizeFormatted: formatBytes(compressed.size),
      };
    } catch (e) {
      console.warn('Canvas compression failed, falling back to standard read:', e);
    }
  }

  // 3. Binary files (PDF, DOCX, etc.): read as DataURL base64
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      resolve({
        id: fileId,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64,
        size: file.size,
        sizeFormatted: formatBytes(file.size),
      });
    };
    reader.onerror = () => reject(new Error(`Failed to read file "${file.name}"`));
    reader.readAsDataURL(file);
  });
}

function compressImageFile(
  file: File,
  maxDimension = 1600,
  quality = 0.82
): Promise<{ base64: string; mimeType: string; name: string; size: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // Only resize if exceeds max dimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }

      // Fill white background for transparent PNGs converted to JPEG
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG for optimal compression ratio
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64 = dataUrl.split(',')[1] || '';
      const approxBytes = Math.round((base64.length * 3) / 4);

      const cleanBaseName = file.name.replace(/\.[^/.]+$/, '');
      resolve({
        base64,
        mimeType: 'image/jpeg',
        name: `${cleanBaseName}.jpg`,
        size: approxBytes,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image into canvas'));
    };

    img.src = url;
  });
}
