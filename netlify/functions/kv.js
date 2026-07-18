
import { getDatabase } from "@netlify/database";

export default async (req) => {
  const db = getDatabase();
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  if (!key) {
    return new Response(JSON.stringify({ error: "key parametresi gerekli" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    if (req.method === "GET") {
      const rows = await db.sql`SELECT value FROM kv_store WHERE key = ${key}`;
      if (rows.length === 0) {
        return new Response(JSON.stringify({ value: null }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ value: rows[0].value }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (req.method === "PUT" || req.method === "POST") {
      const body = await req.json();
      if (typeof body.value !== "string") {
        return new Response(JSON.stringify({ error: "value alanı (metin) gerekli" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      await db.sql`
        INSERT INTO kv_store (key, value, updated_at)
        VALUES (${key}, ${body.value}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${body.value}, updated_at = NOW()
      `;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Desteklenmeyen metod" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Sunucu hatası: " + e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = { path: "/api/kv" };
