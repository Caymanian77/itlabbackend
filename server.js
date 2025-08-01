
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

  // Free-text search across multiple fields
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

  // Actor filter (array fields)
  if (actor) {
    query.push({
      $or: [
        { "actor.external.variety": { $in: [actor] } },
        { "actor.internal.variety": { $in: [actor] } },
        { "actor.partner.variety": { $in: [actor] } }
      ]
    });
  }

  // Action filter (from multiple action types)
  if (action) {
    query.push({
      $or: [
        { "action.hacking.variety": { $in: [action] } },
        { "action.misuse.variety": { $in: [action] } },
        { "action.social.variety": { $in: [action] } },
        { "action.physical.variety": { $in: [action] } },
        { "action.malware.variety": { $in: [action] } }
      ]
    });
  }

  // Asset filter (from array of objects)
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
    const mongoQuery = query.length ? { $and: query } : {};
    const results = await Incident.find(mongoQuery).limit(50).lean();
    res.json(results);
  } catch (err) {
    console.error("Search error:", err.message);
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