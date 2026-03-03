const express = require("express");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = 3000;

app.use(express.json());
//Serve static files from the project root:
//http://localhost:3000/Sprint1Alberto/CustomerSignInPage.html
app.use(express.static(path.join(__dirname, "..")));

/* Root route */
app.get("/", (req, res) => {
  res.send("CMPSC390 Backend API is running (Charles - Backend).");
});

/* Test route */
app.get("/test", (req, res) => {
  res.send("Backend server is running successfully (charlesDev).");
});

/* GET all parts */
app.get("/parts", (req, res) => {
  const sql = "SELECT * FROM Parts";
  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

/* User login */
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Basic validation
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password required" });
  }

  const sql = "SELECT * FROM `User` WHERE UserName = ?";
  db.query(sql, [username], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: "Login failed" });
    }

    const user = results[0];

    if (user.Password !== password) {
      return res.status(401).json({ message: "Login failed" });
    }

    // Return something useful for your dashboard flow
    res.json({
      message: "Login successful",
      userId: user.UserID ?? user.id ?? null,
      username: user.UserName ?? username,
    });
  });
});

/* Start server */
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});