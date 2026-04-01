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