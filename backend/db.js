const mysql = require("mysql2");
require("dotenv").config();

const db = mysql.createConnection({
<<<<<<< ariDev
  host: "localhost",
  user: "root",
  password: "TopSecret2300!",//put your MySQL root password here if you set one
  database: "legautocustDB"
=======
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE
>>>>>>> main
});

db.connect((err) => {
  if (err) {
    console.log("DB connection failed:", err);
    return;
  }
  console.log("Connected to MySQL database.");
});

module.exports = db;