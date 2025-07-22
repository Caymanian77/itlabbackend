const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve index.html

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Use a flexible schema
const Incident = mongoose.model('Incident', new mongoose.Schema({}, { strict: false }));

// Search route
app.get('/search', async (req, res) => {
  const { q, actor, action, asset } = req.query;

  const query = [];

  // Free-text keyword search across common fields
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

  // Optional dropdown filters (if you want to keep these)
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
    res.status(500).json({ error: "Search failed", details: err.message });
  }
});