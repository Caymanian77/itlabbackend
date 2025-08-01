
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;


const COLLECTION = process.env.MONGO_COLLECTION || "veris_incidents";

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve index.html if you have one

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1); // Exit if DB fails to connect
  });

// Flexible schema for VERIS incidents
const Incident = mongoose.model(
  "Incident",
  new mongoose.Schema({}, { strict: false }),
  COLLECTION
);

app.get('/search', async (req, res) => {
  const { q, actor, action, asset } = req.query;
  const query = [];

  // Text query - broad match across key fields
  if (q) {
    query.push({
      $or: [
        { summary: { $regex: q, $options: "i" } },
        { incident_id: { $regex: q, $options: "i" } },
        { "victim.name": { $regex: q, $options: "i" } },
        { "victim.country": { $regex: q, $options: "i" } },
        { "victim.industry": { $regex: q, $options: "i" } },
        { reference: { $regex: q, $options: "i" } },
        { confidence: { $regex: q, $options: "i" } },
        { targeted: { $regex: q, $options: "i" } }
      ]
    });
  }

  // Match actor value across all known actor paths
  if (actor) {
    query.push({
      $or: [
        { "actor.external.variety": actor },
        { "actor.internal.variety": actor },
        { "actor.partner.variety": actor }
      ]
    });
  }

  // Match action value across all action types
  if (action) {
    query.push({
      $or: [
        { "action.hacking.variety": action },
        { "action.misuse.variety": action },
        { "action.social.variety": action },
        { "action.physical.variety": action },
        { "action.malware.variety": action }
      ]
    });
  }

  // Match asset value from asset.assets[].variety
  if (asset) {
    query.push({
      "asset.assets": {
        $elemMatch: {
          variety: asset
        }
      }
    });
  }

  try {
    const results = await Incident.find(query.length ? { $and: query } : {}).limit(50);
    res.json(results);
  } catch (err) {
    console.error("Search failed:", err);
    res.status(500).json({ error: "Search failed", details: err.message });
  }
});


app.get('/filters', async (req, res) => {
  try {
    const actors = await Promise.all([
      Incident.distinct("actor.external.variety"),
      Incident.distinct("actor.internal.variety"),
      Incident.distinct("actor.partner.variety")
    ]);
    const actions = await Promise.all([
      Incident.distinct("action.misuse.variety"),
      Incident.distinct("action.malware.variety"),
      Incident.distinct("action.hacking.variety"),
      Incident.distinct("action.social.variety"),
      Incident.distinct("action.physical.variety")
    ]);
    const assets = await Incident.distinct("asset.assets.variety");

    res.json({
      actors: [...new Set(actors.flat().filter(Boolean))],
      actions: [...new Set(actions.flat().filter(Boolean))],
      assets: [...new Set(assets.filter(Boolean))]
    });
  } catch (err) {
    console.error("Filter load error:", err.message);
    res.status(500).json({ error: "Failed to load filters" });
  }
});

// Default root route (optional)
app.get("/", (req, res) => {
  res.send("✅ VERIS Search Backend is running!");
});

// ✅ Diagnostic health check
app.get('/healthz', (req, res) => {
  res.json({
    status: 'ok',
    mongoState: mongoose.connection.readyState, // 1 = connected
    db: mongoose.connection.name,
    collection: Incident.collection.name
  });
});

// ✅ List your available collections + sample doc
app.get('/__debug', async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const names = collections.map(c => c.name).sort();
    const count = await Incident.estimatedDocumentCount();
    const sample = await Incident.findOne({}, { _id: 0 }).lean();

    res.json({
      modelCollection: Incident.collection.name,
      allCollections: names,
      modelCount: count,
      sampleKeys: sample ? Object.keys(sample) : null,
      sampleSummary: sample?.summary || null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ✅ Pull real filter values from data
app.get('/__distinct', async (req, res) => {
  try {
    const actors = await Promise.all([
      Incident.distinct("actor.external.variety"),
      Incident.distinct("actor.internal.variety"),
      Incident.distinct("actor.partner.variety")
    ]);
    const actions = await Promise.all([
      Incident.distinct("action.hacking.variety"),
      Incident.distinct("action.misuse.variety"),
      Incident.distinct("action.social.variety"),
      Incident.distinct("action.physical.variety"),
      Incident.distinct("action.malware.variety")
    ]);
    const assets = await Incident.distinct("asset.assets.variety");

    res.json({
      actors: [...new Set(actors.flat().filter(Boolean))].sort(),
      actions: [...new Set(actions.flat().filter(Boolean))].sort(),
      assets: [...new Set(assets.filter(Boolean))].sort()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is listening on port ${PORT}`);
});