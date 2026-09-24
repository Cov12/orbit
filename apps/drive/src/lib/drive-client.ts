// Orbit Drive API Client — typed fetch wrapper

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size: string; // BigInt serialized as string
  status: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DriveFolder = {
  id: string;
  name: string;
  parentId: string | null;
  orgId: string;
  createdAt: string;
  updatedAt: string;
};

export type DriveQuota = {
  quotaBytes: string;
  usedBytes: string;
  fileCount: number;
};

export type DriveShareInfo = {
  id: string;
  token: string;
  fileId: string;
  expiresAt: string | null;
  maxAccesses: number | null;
  accessCount: number;
  isRevoked: boolean;
  createdAt: string;
};

export type UploadInitResponse = {
  fileId: string;
  uploadUrl: string;
};

export type SubAccount = {
  id: string;
  name: string;
  slug: string;
};

class DriveApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new DriveApiError(body.error || res.statusText, res.status);
  }
  return res.json();
}

export const driveClient = {
  // Files
  listFiles(folderId?: string | null) {
    const params = folderId ? `?folderId=${folderId}` : '';
    return apiFetch<{ files: DriveFile[] }>(`/api/drive/files${params}`);
  },

  getFile(fileId: string) {
    return apiFetch<{ file: DriveFile }>(`/api/drive/files/${fileId}`);
  },

  deleteFile(fileId: string) {
    return apiFetch<{ success: boolean }>(`/api/drive/files/${fileId}`, { method: 'DELETE' });
  },

  // Confirm upload (flip status UPLOADING → ACTIVE)
  confirmUpload(fileId: string) {
    return apiFetch<{ file: DriveFile }>(`/api/drive/files/${fileId}`, { method: 'POST' });
  },

  // Upload: 3-step (get presigned URL, PUT to R2, confirm)
  initUpload(name: string, mimeType: string, size: number, folderId?: string | null) {
    return apiFetch<UploadInitResponse>('/api/drive/upload', {
      method: 'POST',
      body: JSON.stringify({ name, mimeType, size, folderId }),
    });
  },

  async uploadToR2(uploadUrl: string, file: File, onProgress?: (pct: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
      xhr.onerror = () => reject(new Error('Upload network error'));
      xhr.send(file);
    });
  },

  // Download
  getDownloadUrl(fileId: string) {
    return apiFetch<{ downloadUrl: string }>(`/api/drive/files/${fileId}/download`);
  },

  // Folders
  listFolders(parentId?: string | null) {
    const params = parentId ? `?parentId=${parentId}` : '';
    return apiFetch<{ folders: DriveFolder[] }>(`/api/drive/folders${params}`);
  },

  createFolder(name: string, parentId?: string | null) {
    return apiFetch<{ folder: DriveFolder }>('/api/drive/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parentId }),
    });
  },

  // Share
  shareFile(fileId: string, expiresInHours?: number, maxAccesses?: number) {
    return apiFetch<{ share: DriveShareInfo }>(`/api/drive/files/${fileId}/share`, {
      method: 'POST',
      body: JSON.stringify({ expiresInHours, maxAccesses }),
    });
  },

  // Quota
  getQuota() {
    return apiFetch<{ quota: DriveQuota }>('/api/drive/quota');
  },

  // Sub-accounts
  listSubAccounts() {
    return apiFetch<{ subAccounts: SubAccount[]; activeSubAccountId: string | null }>(
      '/api/drive/subaccounts',
    );
  },

  // Pass null to switch to business (org-level) scope.
  selectSubAccount(subAccountId: string | null) {
    return apiFetch<{ selected: string | null }>('/api/drive/subaccounts/select', {
      method: 'POST',
      body: JSON.stringify({ subAccountId }),
    });
  },
};

// Helpers
export function formatFileSize(bytes: string | number): string {
  const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (b === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'movie';
  if (mimeType.startsWith('audio/')) return 'audio_file';
  if (mimeType.includes('pdf')) return 'picture_as_pdf';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'table_chart';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'slideshow';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'description';
  if (mimeType.includes('zip') || mimeType.includes('archive')) return 'folder_zip';
  if (mimeType.includes('text')) return 'article';
  return 'draft';
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
