const path = require("path");
const fs = require("fs");
const { randomUUID } = require("crypto");
const express = require("express");
const { MongoClient, MongoNetworkError, MongoServerSelectionError } = require("mongodb");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is not set. Copy .env.example to .env and add your connection string.");
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;
const dbName = process.env.MONGODB_DB || "lostandfound";

const indexHtml = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

async function connect() {
  // Fail after 5s (driver default is 30s) when the cluster is unreachable.
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const items = client.db(dbName).collection("items");
    await items.createIndex({ added: -1 });
    console.log(`Connected to MongoDB database "${dbName}"`);
    return items;
  } catch (err) {
    client.close().catch(() => {});
    throw err;
  }
}

function connectHint(err) {
  // Checked by name: the driver's URL parser throws its own MongoParseError class.
  if (err.name === "MongoParseError") {
    return "MONGODB_URI is not a valid connection string. URL-encode special characters in the password (e.g. @ becomes %40).";
  }
  if (/auth/i.test(err.message)) {
    return "Check the username and password in MONGODB_URI.";
  }
  return "Check MONGODB_URI, and on Atlas make sure this machine's IP is allowed under Network Access.";
}

let connecting = null;

// A client whose first connect fails is closed for good, so on failure we drop it
// and let the next request retry with a fresh one. Once connected, the driver
// handles reconnects itself.
function getItems() {
  if (!connecting) {
    connecting = connect().catch(err => {
      connecting = null;
      console.error(`Could not connect to MongoDB: ${err.message}`);
      console.error(connectHint(err));
      throw err;
    });
  }
  return connecting;
}

app.use(express.json({ limit: "10mb" }));
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "js")));

app.get("/", (req, res) => {
  res.type("html").send(indexHtml);
});

function text(value) {
  return typeof value === "string" ? value : "";
}

function mapDoc(doc) {
  return {
    id: doc._id,
    type: doc.type,
    brand: doc.brand,
    color: doc.color,
    size: doc.size,
    location: doc.location,
    notes: doc.notes,
    photo: doc.photo,
    claimed: doc.claimed,
    claimedBy: doc.claimedBy,
    claimedClass: doc.claimedClass,
    added: doc.added
  };
}

function sendError(res, err, message) {
  console.error(err);
  if (err instanceof MongoNetworkError || err instanceof MongoServerSelectionError) {
    return res.status(503).json({ error: "Database is unavailable. Please try again shortly." });
  }
  return res.status(500).json({ error: message });
}

app.get("/api/items", async (req, res) => {
  try {
    const items = await getItems();
    const docs = await items.find().sort({ added: -1 }).toArray();
    res.json(docs.map(mapDoc));
  } catch (err) {
    sendError(res, err, "Failed to load items.");
  }
});

app.post("/api/items", async (req, res) => {
  const body = req.body || {};
  const type = text(body.type);
  if (!type) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  const item = {
    _id: randomUUID(),
    type,
    brand: text(body.brand),
    color: text(body.color),
    size: text(body.size),
    location: text(body.location),
    notes: text(body.notes),
    photo: text(body.photo),
    claimed: false,
    claimedBy: "",
    claimedClass: "",
    added: Date.now()
  };
  try {
    const items = await getItems();
    await items.insertOne(item);
    return res.status(201).json(mapDoc(item));
  } catch (err) {
    return sendError(res, err, "Failed to save item.");
  }
});

app.patch("/api/items/:id/claim", async (req, res) => {
  const { id } = req.params;
  const claimedBy = text(req.body?.claimedBy);
  const claimedClass = text(req.body?.claimedClass);
  if (!claimedBy || !claimedClass) {
    return res.status(400).json({ error: "Missing claim details." });
  }
  try {
    const items = await getItems();
    // Matching on claimed: false makes the claim atomic, so two students can't claim the same item.
    const item = await items.findOneAndUpdate(
      { _id: id, claimed: false },
      { $set: { claimed: true, claimedBy, claimedClass } },
      { returnDocument: "after" }
    );
    if (!item) {
      const exists = await items.countDocuments({ _id: id }, { limit: 1 });
      if (!exists) {
        return res.status(404).json({ error: "Item not found." });
      }
      return res.status(409).json({ error: "Item has already been claimed." });
    }
    return res.json(mapDoc(item));
  } catch (err) {
    return sendError(res, err, "Failed to claim item.");
  }
});

app.patch("/api/items/:id/unclaim", async (req, res) => {
  const { id } = req.params;
  try {
    const items = await getItems();
    const item = await items.findOneAndUpdate(
      { _id: id },
      { $set: { claimed: false, claimedBy: "", claimedClass: "" } },
      { returnDocument: "after" }
    );
    if (!item) {
      return res.status(404).json({ error: "Item not found." });
    }
    return res.json(mapDoc(item));
  } catch (err) {
    return sendError(res, err, "Failed to update item.");
  }
});

app.delete("/api/items/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const items = await getItems();
    const result = await items.deleteOne({ _id: id });
    if (!result.deletedCount) {
      return res.status(404).json({ error: "Item not found." });
    }
    return res.status(204).end();
  } catch (err) {
    return sendError(res, err, "Failed to delete item.");
  }
});

app.listen(port, () => {
  console.log(`Lost & Found app running at http://localhost:${port}`);
});

// Connect eagerly so problems show up at startup, but keep serving if it fails.
getItems().catch(() => {});
