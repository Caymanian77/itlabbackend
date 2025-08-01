const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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
const Incident = mongoose.model('Incident', new mongoose.Schema({}, { strict: false }));

app.get('/search', async (req, res) => {
  const { q, actor, action, asset } = req.query;
  const query = [];

  // Full-text search
  if (q) {
    query.push({
      $or: [
        { summary: { $regex: q, $options: "i" } },
        { incident_id: { $regex: q, $options: "i" } },
        { "victim.name": { $regex: q, $options: "i" } },
        { "victim.industry": { $regex: q, $options: "i" } },
        { "victim.country": { $regex: q, $options: "i" } },
        { reference: { $regex: q, $options: "i" } },
        { confidence: { $regex: q, $options: "i" } },
        { targeted: { $regex: q, $options: "i" } },
        { security_incident: { $regex: q, $options: "i" } }
      ]
    });
  }

  // Actor Filter (covers external, internal, partner)
  if (actor) {
    query.push({
      $or: [
        { "actor.external.variety": { $regex: actor, $options: "i" } },
        { "actor.internal.variety": { $regex: actor, $options: "i" } },
        { "actor.partner.variety": { $regex: actor, $options: "i" } }
      ]
    });
  }

  // Action Filter (cover all action types)
  if (action) {
    query.push({
      $or: [
        { "action.hacking.variety": { $regex: action, $options: "i" } },
        { "action.malware.variety": { $regex: action, $options: "i" } },
        { "action.social.variety": { $regex: action, $options: "i" } },
        { "action.misuse.variety": { $regex: action, $options: "i" } },
        { "action.physical.variety": { $regex: action, $options: "i" } }
      ]
    });
  }

  // Asset Filter (correct array structure)
  if (asset) {
    query.push({
      "asset.assets": {
        $elemMatch: {
          variety: { $regex: asset, $options: "i" }
        }
      }
    });
  }

 try {
    const results = await Incident.find(query.length ? { $and: query } : {}).limit(50);
    res.json(results);
  } catch (err) {
    console.error("❌ Search error:", err.message);
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is listening on port ${PORT}`);
});