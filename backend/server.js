const express = require("express");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = 3000;

app.use(express.json());

// Serve static files from the project root
// Example: http://localhost:3000/Sprint2Alberto/CustomerSingInPage.html
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

    res.json({
      message: "Login successful",
      userId: user.UserID ?? user.id ?? null,
      username: user.UserName ?? username,
    });
  });
});

/* User registration */
app.post("/customer/register", (req, res) => {
  const { firstName, lastName, password, userName, zipCode, birthdate } = req.body;

  if (!firstName || !lastName || !password || !userName || !zipCode || !birthdate) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const checkSql = "SELECT * FROM `User` WHERE UserName = ?";
  db.query(checkSql, [userName], (checkErr, checkResults) => {
    if (checkErr) {
      console.error(checkErr);
      return res.status(500).json({ error: "Database error" });
    }

    if (checkResults.length > 0) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const insertSql = "INSERT INTO `User` (FirstName, LastName, Password, UserName, ZipCode, Birthdate) VALUES (?, ?, ?, ?, ?, ?)";
    db.query(insertSql, [firstName, lastName, password, userName, zipCode, birthdate], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error creating account" });
      }

      res.json({
        message: "Account created successfully",
        userId: result.insertId,
        username: userName,
      });
    });
  });
});

/* Get customer by ID (for dashboard) */
app.get("/customer/:id", (req, res) => {
  const userId = req.params.id;

  const sql = "SELECT UserID, UserName FROM `User` WHERE UserID = ?";

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(results[0]);
  });
});

/* Start server */
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});