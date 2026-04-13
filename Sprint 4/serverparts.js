const express = require("express");
const cors = require("cors");
const db = require("./db"); // import database connection

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get("/api/parts", (req, res) => {
  const { category, inStock } = req.query;

  let query = "SELECT * FROM parts WHERE 1=1";
  const params = [];
//category filter
  if (category) {
    query += " AND category = ?";
    params.push(category);
  }
//stock feature
  if (inStock === "true") {
    query += " AND Stock > ?";
    params.push(0);
  }

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("Query error:", err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json(results);
  });
});

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/parts.html");
 //res.sendFile(path.join(__dirname, "../frontend/parts.html"));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

//sprint 4
//get reviews from a part
app.get("/api/partsreviews/:partId", (req, res) => {
  const partId = req.params.partId;

  db.query(
    "SELECT * FROM partsreviews WHERE PartID = ? ORDER BY posted DESC",

    [partId],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json(results);
    }
  );
});
//add a review
app.post("/api/partsreviews", (req, res) => {
  const { PartID, rating, comment } = req.body;

  if (!PartID || !rating) {
    return res.status(400).json({ error: "Missing required fields" });
  }
//adding the creted review
  db.query(
    "INSERT INTO partsreviews (PartID, PartRating, comment) VALUES (?, ?, ?)",

    [PartID, rating, comment],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json({ success: true });
    }
  );
});