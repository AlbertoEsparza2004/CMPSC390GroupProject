const mysql = require("mysql2");
require("dotenv").config();

const db = mysql.createConnection({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,//put your MySQL root password here if you set one
  database: process.env.DATABASE
});

db.connect((err) => {
  if (err) {
    console.log("DB connection failed:", err);
    return;
  }
  console.log("Connected to MySQL database.");
});

module.exports = db;