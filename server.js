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

// Search API
app.get('/search', async (req, res) => {
  const { q, actor, action, asset } = req.query;
  const query = [];

  // Full-text keyword search
  if (q) {
    query.push({
      $or: [
        { "summary": { $regex: q, $options: "i" } },
        { "incident_id": { $regex: q, $options: "i" } },
        { "victim.name": { $regex: q, $options: "i" } },
        { "victim.industry": { $regex: q, $options: "i" } },
        { "victim.country": { $regex: q, $options: "i" } },
        { "victim.state": { $regex: q, $options: "i" } },
        { "reference": { $regex: q, $options: "i" } },
        { "confidence": { $regex: q, $options: "i" } },
        { "targeted": { $regex: q, $options: "i" } },
        { "security_incident": { $regex: q, $options: "i" } }
      ]
    });
  }

  // Dropdown filters
  if (actor) {
    query.push({ "actor.external.variety": { $regex: actor, $options: "i" } });
  }
  if (action) {
    query.push({ "action.hacking.variety": { $regex: action, $options: "i" } });
  }
  if (asset) {
    query.push({ "asset.assets.variety": { $regex: asset, $options: "i" } });
  }

  try {
    const results = await Incident.find(query.length ? { $and: query } : {}).limit(50);
    res.json(results);
  } catch (err) {
    console.error("❌ Search error:", err.message);
    res.status(500).json({ error: "Search failed", details: err.message });
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
