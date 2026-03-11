const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Window142026",
  database: "legautocustDB"
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
  } else {
    console.log("Connected to MySQL");
  }
});

app.get("/api/parts", (req, res) => {
  const { category, inStock } = req.query;

  let query = "SELECT * FROM parts WHERE 1=1";
  const params = [];

  // Safe category filtering
  if (category) {
    query += " AND category = ?";
    params.push(category);
  }

  // Safe stock filtering
  if (inStock === "true") {
    query += " AND stock_quantity > ?";
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
});
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});