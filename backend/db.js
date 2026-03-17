const mysql = require("mysql2");
require("dotenv").config();

const db = mysql.createConnection({
<<<<<<< HEAD
  host: "localhost",
  user: "root",
  password: "zoof",//put your MySQL root password here if you set one
  database: "legautocustDB"
=======
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,//put your MySQL root password here if you set one
  database: process.env.DATABASE
>>>>>>> c1dcc553348a59f278862fac6cd761be4c56dadf
});

db.connect((err) => {
  if (err) {
    console.log("DB connection failed:", err);
    return;
  }
  console.log("Connected to MySQL database.");
});

module.exports = db;