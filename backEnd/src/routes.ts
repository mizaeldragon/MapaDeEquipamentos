import { Router } from "express";
import { z } from "zod";
import { pool } from "./db.js";
import {
  deviceCreateSchema,
  deviceUpdateSchema,
  devicePositionSchema,
  linkCreateSchema,
  linkUpdateSchema,
} from "./validators.js";

export const routes = Router();

routes.get("/health", async (_req, res) => {
  const r = await pool.query("SELECT 1 as ok");
  res.json({ ok: true, db: r.rows[0]?.ok === 1 });
});

/**
 * Topology pronto pro React Flow:
 * { nodes: [{id,type,position,data}], edges: [{id,source,target,label,data,...}] }
 */
routes.get("/topology", async (_req, res) => {
  const devices = await pool.query(`
    SELECT id, name, type, ip, status, x, y
    FROM devices
    ORDER BY created_at ASC
  `);

  const links = await pool.query(`
    SELECT id, from_id, to_id, status, label, from_handle, to_handle
    FROM links
    ORDER BY created_at ASC
  `);

  const nodes = devices.rows.map((d) => ({
    id: d.id,
    type: "device",
    position: { x: Number(d.x), y: Number(d.y) },
    data: { name: d.name, type: d.type, ip: d.ip ?? undefined, status: d.status },
  }));

  const edges = links.rows.map((l) => ({
    id: l.id,
    source: l.from_id,
    target: l.to_id,
    label: l.label ?? undefined,
    data: { status: l.status },
    sourceHandle: l.from_handle ?? undefined,
    targetHandle: l.to_handle ?? undefined,
  }));

  res.json({ nodes, edges });
});

// -------- Devices --------

routes.get("/devices", async (_req, res) => {
  const r = await pool.query(`SELECT * FROM devices ORDER BY created_at ASC`);
  res.json(r.rows);
});

routes.get("/devices/:id", async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "Invalid id" });

  const r = await pool.query(`SELECT * FROM devices WHERE id=$1`, [id.data]);
  if (!r.rows[0]) return res.status(404).json({ message: "Device not found" });
  res.json(r.rows[0]);
});

routes.post("/devices", async (req, res) => {
  const parsed = deviceCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { name, type, ip, status, x, y } = parsed.data;

  const r = await pool.query(
    `
    INSERT INTO devices (name, type, ip, status, x, y)
    VALUES (
      $1,
      $2::device_type,
      $3,
      COALESCE($4::device_status, 'up'::device_status),
      COALESCE($5::double precision, 0::double precision),
      COALESCE($6::double precision, 0::double precision)
    )
    RETURNING *
    `,
    [name, type, ip ?? null, status ?? null, x ?? null, y ?? null]
  );

  res.status(201).json(r.rows[0]);
});

routes.patch("/devices/:id", async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "Invalid id" });

  const parsed = deviceUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const fields = parsed.data;

  // monta update dinâmico
  const allowed = ["name", "type", "ip", "status", "x", "y"] as const;
  const entries = Object.entries(fields).filter(([k]) => (allowed as readonly string[]).includes(k));
  if (entries.length === 0) return res.status(400).json({ message: "No fields to update" });

  const setParts: string[] = [];
  const values: any[] = [id.data];
  let idx = 2;

  for (const [k, v] of entries) {
    const cast = k === "status" ? "::device_status" : k === "type" ? "::device_type" : "";
    setParts.push(`${k}=$${idx}${cast}`);
    values.push(v ?? null);
    idx++;
  }

  const sql = `UPDATE devices SET ${setParts.join(", ")} WHERE id=$1 RETURNING *`;
  const r = await pool.query(sql, values);

  if (!r.rows[0]) return res.status(404).json({ message: "Device not found" });
  res.json(r.rows[0]);
});

routes.patch("/devices/:id/position", async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "Invalid id" });

  const parsed = devicePositionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { x, y } = parsed.data;

  const r = await pool.query(
    `UPDATE devices SET x=$2, y=$3 WHERE id=$1 RETURNING *`,
    [id.data, x, y]
  );

  if (!r.rows[0]) return res.status(404).json({ message: "Device not found" });
  res.json(r.rows[0]);
});

routes.delete("/devices/:id", async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "Invalid id" });

  const r = await pool.query(`DELETE FROM devices WHERE id=$1 RETURNING id`, [id.data]);
  if (!r.rows[0]) return res.status(404).json({ message: "Device not found" });

  res.status(204).send();
});

// -------- Links --------

routes.get("/links", async (_req, res) => {
  const r = await pool.query(`SELECT * FROM links ORDER BY created_at ASC`);
  res.json(r.rows);
});

routes.post("/links", async (req, res) => {
  const parsed = linkCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { fromId, toId, status, label, fromHandle, toHandle } = parsed.data;

  try {
    const r = await pool.query(
      `
      INSERT INTO links (from_id, to_id, status, label, from_handle, to_handle)
      VALUES ($1, $2, COALESCE($3::link_status, 'up'::link_status), $4, $5, $6)
      RETURNING *
      `,
      [fromId, toId, status ?? null, label ?? null, fromHandle ?? null, toHandle ?? null]
    );

    res.status(201).json(r.rows[0]);
  } catch (e: any) {
    // unique violation
    if (e?.code === "23505") {
      return res.status(409).json({ message: "Link already exists" });
    }
    // foreign key violation
    if (e?.code === "23503") {
      return res.status(400).json({ message: "fromId/toId invalid (device not found)" });
    }
    throw e;
  }
});

routes.patch("/links/:id", async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "Invalid id" });

  const parsed = linkUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const fields = parsed.data;
  const allowed = ["status", "label", "from_handle", "to_handle"] as const;

  // map para nomes de coluna
  const mapKey = (k: string) => {
    if (k === "fromHandle") return "from_handle";
    if (k === "toHandle") return "to_handle";
    return k;
  };

  const entries = Object.entries(fields).map(([k, v]) => [mapKey(k), v] as const)
    .filter(([k]) => (allowed as readonly string[]).includes(k));

  if (entries.length === 0) return res.status(400).json({ message: "No fields to update" });

  const setParts: string[] = [];
  const values: any[] = [id.data];
  let idx = 2;

  for (const [k, v] of entries) {
    const cast = k === "status" ? "::link_status" : "";
    setParts.push(`${k}=$${idx}${cast}`);
    values.push(v ?? null);
    idx++;
  }

  const sql = `UPDATE links SET ${setParts.join(", ")} WHERE id=$1 RETURNING *`;
  const r = await pool.query(sql, values);

  if (!r.rows[0]) return res.status(404).json({ message: "Link not found" });
  res.json(r.rows[0]);
});

routes.delete("/links/:id", async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "Invalid id" });

  const r = await pool.query(`DELETE FROM links WHERE id=$1 RETURNING id`, [id.data]);
  if (!r.rows[0]) return res.status(404).json({ message: "Link not found" });

  res.status(204).send();
});
