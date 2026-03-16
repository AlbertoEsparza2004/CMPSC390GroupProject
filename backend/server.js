const express = require("express");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = 3000;

app.use(express.json());

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

/* Code for trade listings */
app.get("/trades", (req, res) => {

  const sql = `SELECT Trades.*, User.UserName FROM Trades JOIN User ON Trades.OwnerUserID = User.UserID WHERE Trades.Status = 'OPEN'`;

  db.query(sql, (err, results) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json(results);

  });

});

/* code that allows you to post a trade offer */
app.post("/createTrade", (req, res) => {

  const { OwnerUserID, OfferedPartID, DesiredMinPrice, DesiredMaxPrice, ConditionDescription, ImageURL } = req.body;

  const sql = `
    INSERT INTO Trades
    (OwnerUserID, OfferedPartID, DesiredMinPrice, DesiredMaxPrice, ConditionDescription, ImageURL)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [OwnerUserID, OfferedPartID, DesiredMinPrice, DesiredMaxPrice, ConditionDescription, ImageURL], (err, results) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json({ message: "Trade created successfully" });

  });

});

/* code that lets you accept a trade */
app.post("/acceptTrade/:id", (req, res) => {

  const tradeId = req.params.id;

  const sql = "UPDATE Trades SET Status = 'ACCEPTED' WHERE TradeID = ?";

  db.query(sql, [tradeId], (err, results) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json({ message: "Trade accepted successfully" });

  });

});

/* code that allows you to create a trade offer */
app.post("/createOffer", (req, res) => {

  const { TradeID, OfferingUserID, OfferedPartDescription } = req.body;

  const sql = `
  INSERT INTO TradeOffers (TradeID, OfferingUserID, OfferedPartDescription)
  VALUES (?, ?, ?)
  `;

  db.query(sql, [TradeID, OfferingUserID, OfferedPartDescription], (err) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json({ message: "Trade offer submitted!" });

  });

});

/* code that lets you view offers for your trade */
app.get("/offers/:tradeId", (req, res) => {

  const sql = `SELECT TradeOffers.*, User.UserName FROM TradeOffers JOIN User ON TradeOffers.OfferingUserID = User.UserID WHERE TradeOffers.TradeID = ?`;

  db.query(sql, [req.params.tradeId], (err, results) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json(results);

  });

});

/* code that allows you to decline a trade offer*/
app.post("/declineOffer/:id", (req, res) => {

  const offerId = req.params.id;

  const sql = "DELETE FROM TradeOffers WHERE OfferID = ?";

  db.query(sql, [offerId], (err) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json({ message: "Offer declined." });

  });

});

/* ========================= */
/* Alberto Employee System   */
/* ========================= */

/*Schedule*/
app.get("/getSchedule", (req, res) => {
    const employeeID = req.query.EmployeeID;
    const sql = `
    SELECT Employees.EmployeeID, Employees.FirstName, Employees.LastName, Schedule.MonthNum, Schedule.WeekNum, Schedule.Mon, Schedule.Tue, Schedule.Wed, Schedule.Thu, Schedule.Fri, Schedule.Sat, Schedule.Sun 
    FROM Schedule 
    JOIN Employees ON Schedule.EmployeeID = Employees.EmployeeID 
    WHERE Schedule.EmployeeID = ?`;
    db.query(sql, [employeeID], (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).send("Database error");
        }
        res.json(results);
    });
});

/*Attendance*/
app.get("/getPoints", (req, res) => {
    const employeeID = req.query.EmployeeID;
    const sql = `SELECT Points FROM EmployeePerformance WHERE EmployeeID = ?`;
    db.query(sql, [employeeID], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Database error");
        }
        if (result.length === 0) {
            return res.json({ Points: 0 });
        }
        res.json(result[0]);
    });
});

app.post("/request-dayoff", (req, res) => {
    const { EmployeeID, MonthNum, WeekNum, DayOfWeek, Reason } = req.body;
    const sql = `INSERT INTO TimeOffRequests (EmployeeID, MonthNum, WeekNum, DayOfWeek, Reason) VALUES (?, ?, ?, ?, ?)`;
    db.query(sql, [EmployeeID, MonthNum, WeekNum, DayOfWeek, Reason], (err) => {
        if (err){
            console.error(err);
            return res.status(500).send("Request failed");
        }
        res.send("Request submitted!");
    });
});

/*Tax Info.*/
app.get("/getEmployeePay", (req,res)=>{
    const employeeID = req.query.EmployeeID;
    const sql = `SELECT HourlyPay FROM Employees WHERE EmployeeID = ?`;
    db.query(sql,[employeeID],(err,results)=>{
        if(err){
            console.log(err);
            return res.status(500).send("Database error");
        }
        res.json(results[0]);
    });
});

/*Contact Info*/
app.get("/contactInfo", (req, res)=>{
  const employeeID = req.query.EmployeeID;
  const sql = `SELECT PhoneNumber, EmergencyPhoneNumber, Address, PersonalEmail, WorkEmail FROM EmployeeContactInfo WHERE EmployeeID = ?`;
  db.query(sql,[employeeID],(err,results)=>{
  if(err){
    console.log(err);
    return res.status(500).send("Database error");
  }
  res.json(results[0]);
  });
});

/* Start server */
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});