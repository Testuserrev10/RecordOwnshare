import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

export const settingsSchema = z.object({
  provider: z.enum(["local", "google_drive"]),
  storageLabel: z.string().min(1).max(160),
  storagePath: z.string().min(1).max(320),
});

export const recordingSchema = z.object({
  title: z.string().trim().min(1).max(120),
  durationSeconds: z.number().int().min(0).max(86400),
  recordedAt: z.string().datetime(),
  fileName: z.string().min(1).max(255),
  storageLabel: z.string().min(1).max(160),
  storagePath: z.string().min(1).max(320),
  provider: z.enum(["local", "google_drive"]),
  externalFileId: z.string().max(200).nullable().optional(),
  externalUrl: z.string().url().max(500).nullable().optional(),
  thumbnail: z.string().max(200_000).nullable().optional(),
});
