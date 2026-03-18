"use client";

import { useAuth } from "@clerk/nextjs";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  status: "UPLOADING" | "ACTIVE" | "DELETED";
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  uploadedBy?: string;
};

export type DriveFolder = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  _count?: { files: number; children: number };
};

export type StorageQuota = {
  quotaBytes: string;
  usedBytes: string;
  fileCount: number;
};

export type DriveShare = {
  id: string;
  token: string;
  fileId: string;
  createdAt: string;
  expiresAt: string | null;
  maxAccesses: number | null;
  accessCount: number;
  isRevoked: boolean;
  file?: { id: string; name: string; mimeType: string; size: string };
};

export class DriveApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "DriveApiError";
    this.status = status;
    this.payload = payload;
  }
}

type TokenProvider = () => Promise<string | null>;

function toQuery(params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") search.set(key, value);
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function formatBytes(value: number | bigint | string) {
  const bytes = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const num = bytes / 1024 ** exp;
  return `${num.toFixed(num >= 10 || exp === 0 ? 0 : 1)} ${units[exp]}`;
}

export function driveClient(getToken: TokenProvider) {
  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const token = await getToken();
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(path, {
      ...init,
      headers,
      cache: "no-store",
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (payload as { error?: string }).error ?? "Drive request failed";
      throw new DriveApiError(msg, res.status, payload);
    }

    return payload as T;
  };

  return {
    listFiles: (folderId?: string | null) =>
      request<{ files: DriveFile[] }>(`/api/drive/files${toQuery({ folderId })}`),

    listFolders: (parentId?: string | null) =>
      request<{ folders: DriveFolder[]; breadcrumbs: DriveFolder[] }>(
        `/api/drive/folders${toQuery({ parentId })}`,
      ),

    createFolder: (name: string, parentId?: string | null) =>
      request<{ folder: DriveFolder }>("/api/drive/folders", {
        method: "POST",
        body: JSON.stringify({ name, parentId: parentId ?? null }),
      }),

    getQuota: () => request<{ quota: StorageQuota }>("/api/drive/quota"),

    beginUpload: (input: { name: string; mimeType: string; size: number; folderId?: string | null }) =>
      request<{ fileId: string; uploadUrl: string; expiresIn: number }>("/api/drive/upload", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    confirmUpload: (fileId: string) =>
      request<{ file: DriveFile }>(`/api/drive/files/${fileId}`, {
        method: "POST",
      }),

    getFile: (fileId: string) => request<{ file: DriveFile }>(`/api/drive/files/${fileId}`),

    deleteFile: (fileId: string) =>
      request<{ success: boolean }>(`/api/drive/files/${fileId}`, {
        method: "DELETE",
      }),

    getDownloadUrl: (fileId: string) =>
      request<{ downloadUrl: string }>(`/api/drive/files/${fileId}/download`),

    shareFile: (fileId: string, input: { expiresInHours?: number; maxAccesses?: number }) =>
      request<{ shareId: string; token: string; expiresAt: string | null; maxAccesses: number | null }>(
        `/api/drive/files/${fileId}/share`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),

    listShares: () => request<{ shares: DriveShare[] }>("/api/drive/shares"),

    revokeShare: (shareId: string) =>
      request<{ success: boolean }>(`/api/drive/shares/${shareId}`, {
        method: "DELETE",
      }),
  };
}

export function useDriveClient() {
  const { getToken } = useAuth();
  return driveClient(async () => getToken());
}
