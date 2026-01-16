import { z } from "zod";

export const deviceCreateSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["hub", "switch", "router", "ap", "server"]),
  ip: z.string().optional(),
  status: z.enum(["up", "warn", "down"]).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
});

export const deviceUpdateSchema = deviceCreateSchema.partial();

export const devicePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const linkCreateSchema = z.object({
  fromId: z.string().uuid(),
  toId: z.string().uuid(),
  status: z.enum(["up", "warn", "down"]).optional(),
  label: z.string().optional(),
  fromHandle: z.string().optional(),
  toHandle: z.string().optional(),
});

export const linkUpdateSchema = z.object({
  status: z.enum(["up", "warn", "down"]).optional(),
  label: z.string().optional(),
  fromHandle: z.string().optional(),
  toHandle: z.string().optional(),
}).partial();
