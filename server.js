const path = require("path");
const fs = require("fs");
const { randomUUID } = require("crypto");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const port = process.env.PORT || 3000;

const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "lostandfound.sqlite");

fs.mkdirSync(dataDir, { recursive: true });
const indexHtml = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      brand TEXT DEFAULT '',
      color TEXT DEFAULT '',
      size TEXT DEFAULT '',
      location TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      photo TEXT DEFAULT '',
      claimed INTEGER DEFAULT 0,
      claimed_by TEXT DEFAULT '',
      claimed_class TEXT DEFAULT '',
      added INTEGER NOT NULL
    )
  `);
});

app.use(express.json({ limit: "10mb" }));
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "js")));

app.get("/", (req, res) => {
  res.type("html").send(indexHtml);
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function mapRow(row) {
  return {
    id: row.id,
    type: row.type,
    brand: row.brand,
    color: row.color,
    size: row.size,
    location: row.location,
    notes: row.notes,
    photo: row.photo,
    claimed: Boolean(row.claimed),
    claimedBy: row.claimed_by,
    claimedClass: row.claimed_class,
    added: row.added
  };
}

app.get("/api/items", async (req, res) => {
  try {
    const rows = await all("SELECT * FROM items ORDER BY added DESC");
    res.json(rows.map(mapRow));
  } catch (err) {
    res.status(500).json({ error: "Failed to load items." });
  }
});

app.post("/api/items", async (req, res) => {
  const body = req.body || {};
  if (!body.type) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  const itemId = randomUUID();
  const addedAt = Date.now();
  try {
    await run(
      `INSERT INTO items (
        id, type, brand, color, size, location, notes, photo,
        claimed, claimed_by, claimed_class, added
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        body.type,
        body.brand || "",
        body.color || "",
        body.size || "",
        body.location || "",
        body.notes || "",
        body.photo || "",
        0,
        "",
        "",
        addedAt
      ]
    );
    const item = await get("SELECT * FROM items WHERE id = ?", [itemId]);
    return res.status(201).json(mapRow(item));
  } catch (err) {
    return res.status(500).json({ error: "Failed to save item." });
  }
});

app.patch("/api/items/:id/claim", async (req, res) => {
  const { id } = req.params;
  const { claimedBy = "", claimedClass = "" } = req.body || {};
  if (!claimedBy || !claimedClass) {
    return res.status(400).json({ error: "Missing claim details." });
  }
  try {
    const result = await run(
      "UPDATE items SET claimed = 1, claimed_by = ?, claimed_class = ? WHERE id = ?",
      [claimedBy, claimedClass, id]
    );
    if (!result.changes) {
      return res.status(404).json({ error: "Item not found." });
    }
    const item = await get("SELECT * FROM items WHERE id = ?", [id]);
    return res.json(mapRow(item));
  } catch (err) {
    return res.status(500).json({ error: "Failed to claim item." });
  }
});

app.patch("/api/items/:id/unclaim", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await run(
      "UPDATE items SET claimed = 0, claimed_by = '', claimed_class = '' WHERE id = ?",
      [id]
    );
    if (!result.changes) {
      return res.status(404).json({ error: "Item not found." });
    }
    const item = await get("SELECT * FROM items WHERE id = ?", [id]);
    return res.json(mapRow(item));
  } catch (err) {
    return res.status(500).json({ error: "Failed to update item." });
  }
});

app.delete("/api/items/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await run("DELETE FROM items WHERE id = ?", [id]);
    if (!result.changes) {
      return res.status(404).json({ error: "Item not found." });
    }
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete item." });
  }
});

app.listen(port, () => {
  console.log(`Lost & Found app running at http://localhost:${port}`);
});
