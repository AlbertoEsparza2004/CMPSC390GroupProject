require("dotenv").config();
const express = require("express");
const path = require("path");
const db = require("./db");
const PORT = process.env.PORT || 3000;
const app = express();
//const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../Sprint2Alberto")));

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

/*Employee Login*/ 
app.post("/Employeelogin", (req, res) => {
   const { EmployeeID, password } = req.body;
  /* see if they are management and or employed */
  const sql =  "SELECT * FROM Employees JOIN EmployeePerformance ON Employees.EmployeeID = EmployeePerformance.EmployeeID WHERE Employees.EmployeeID = ? AND EmployeePerformance.ActivelyEmployed = TRUE";
  db.query(sql, [EmployeeID], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: "Login failed" });
    }

    const employee = results[0];

    if (employee.Password !== password) {
      return res.status(401).json({ message: "Login failed" });
    }

    //res.json({message: "Login successful"});
     if (employee.Management) {
      return res.redirect(`/ManagerDashboardPage.html?name=${employee.FirstName}%20${employee.LastName}&EmployeeID=${employee.EmployeeID}&manager=${employee.Management}`)
    } else{
      return res.redirect(`/EmployeeDashboardPage.html?name=${employee.FirstName}%20${employee.LastName}&EmployeeID=${employee.EmployeeID}&manager=${employee.Management}`)
    }
  });
});

/*Schedule*/
app.get("/getSchedule", (req, res) => {
    const employeeID = req.query.EmployeeID;
    const sql = `SELECT Employees.EmployeeID, Employees.FirstName, Employees.LastName, Schedule.MonthNum, Schedule.WeekNum, Schedule.Mon, Schedule.Tue, Schedule.Wed, Schedule.Thu, Schedule.Fri, Schedule.Sat, Schedule.Sun FROM Schedule JOIN Employees ON Schedule.EmployeeID = Employees.EmployeeID WHERE Schedule.EmployeeID = ?`;
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

/*Employee Options*/
    /*Aprove/deny days off*/
        app.get("/getTimeOffRequests",(req,res)=>{
            const sql = `SELECT TimeOffRequests.*, Employees.FirstName, Employees.LastName FROM TimeOffRequests JOIN Employees ON TimeOffRequests.EmployeeID = Employees.EmployeeID WHERE Status = 'Pending'`;
            db.query(sql,(err,results)=>{
              if(err){
                    console.error(err);
                    return res.status(500).send("Database error");
                }  
              res.json(results);
            });
        });

        app.post("/approveRequest",(req,res)=>{
            const {RequestID} = req.body;
            const getRequest = `SELECT EmployeeID, MonthNum, WeekNum, DayOfWeek FROM TimeOffRequests WHERE RequestID = ?`;
            db.query(getRequest,[RequestID],(err,results)=>{
                if(err){
                    console.error(err);
                    return res.send("Database error");
                }
                const request = results[0];
                console.log("Request info:", request);

                let dayColumn = request.DayOfWeek;

        if(dayColumn === "Monday") dayColumn = "Mon";
        if(dayColumn === "Tuesday") dayColumn = "Tue";
        if(dayColumn === "Wednesday") dayColumn = "Wed";
        if(dayColumn === "Thursday") dayColumn = "Thu";
        if(dayColumn === "Friday") dayColumn = "Fri";
        if(dayColumn === "Saturday") dayColumn = "Sat";
        if(dayColumn === "Sunday") dayColumn = "Sun";

        const updateSchedule = `UPDATE Schedule SET ${dayColumn} = 0 WHERE EmployeeID = ? AND MonthNum = ? AND WeekNum = ?`;
                db.query(updateSchedule,
                [request.EmployeeID, request.MonthNum, request.WeekNum],
                (err)=>{
                    if(err){
                        console.error(err);
                        return res.send("Schedule update error");
                    }
                    const updateStatus = `UPDATE TimeOffRequests SET Status = 'Approved' WHERE RequestID = ?`;
                    db.query(updateStatus,[RequestID]);
                    res.send("Approved");
                });

            });

        });

        app.post("/denyRequest",(req,res)=>{
            const {RequestID} = req.body;
            const sql = `UPDATE TimeOffRequests SET Status = 'Denied' WHERE RequestID = ?`;
            db.query(sql,[RequestID],(err,results)=>{
              if(err){
                    console.error(err);
                    return res.status(500).send("Database error");
                }
              res.send("Denied");});
        });

    /*Employment stats*/
        app.get("/getEmployeeStats",(req,res)=>{
            const {EmployeeID} = req.query;
            const sql = `SELECT Employees.EmployeeID, FirstName, LastName, HourlyPay, Points, Comments, ActivelyEmployed FROM Employees JOIN EmployeePerformance ON Employees.EmployeeID = EmployeePerformance.EmployeeID WHERE Employees.EmployeeID = ?`;
            db.query(sql,[EmployeeID],(err,results)=>{
                if(err){
                    console.error(err);
                    return res.status(500).send("Database error");
                }
                if(results.length === 0){
                    return res.status(404).send("Employee not found");
                }
                res.json(results[0]);
            });
        });

        app.get("/getEmployees", (req, res) => {
            const sql = `SELECT EmployeeID, FirstName, LastName FROM Employees`;
            db.query(sql, (err, results) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send("Database error");
                }
                res.json(results);
            });
        });

    /*Employee Diciplinary*/
        app.post("/addPoints",(req,res)=>{
            const {EmployeeID, points} = req.body;
            const sql = `UPDATE EmployeePerformance SET Points = Points + ? WHERE EmployeeID = ?`;
            db.query(sql,[points,EmployeeID],(err)=>{
                if(err){
                    console.error(err);
                    return res.status(500).send("Database error");
                }
                res.send("Points added");
            });
        });

        app.post("/terminateEmployee",(req,res)=>{
            const {EmployeeID} = req.body;
            const sql = `UPDATE EmployeePerformance SET ActivelyEmployed = FALSE WHERE EmployeeID = ?`;
            db.query(sql,[EmployeeID],(err,results)=>{
                if(err){
                      console.error(err);
                      return res.status(500).send("Database error");
                  }
                res.send("Employee terminated");
            });
        });

        app.post("/giveRaise",(req,res)=>{
            const {EmployeeID, raise} = req.body;
            const sql = `UPDATE Employees SET HourlyPay = HourlyPay + ? WHERE EmployeeID = ?`;
            db.query(sql,[raise,EmployeeID],(err,results)=>{
                if(err){
                    console.error(err);
                    return res.status(500).send("Database error");
                }
                res.send("Raise applied");
            });
        });

    /*Employee Recognition*/
        app.post("/recognitionComment",(req,res)=>{
                    const {EmployeeID, comment} = req.body;
                    const sql = `UPDATE EmployeePerformance SET Comments = ? WHERE EmployeeID = ?`;
                    db.query(sql,[comment,EmployeeID],(err, results)=>{
                        if(err){
                            console.error(err);
                            return res.status(500).send("Database error");
                        }
                        res.send("Comment saved");
                    });
                });

        app.post("/promoteManager",(req,res)=>{
            const {EmployeeID} = req.body;
            const sql = `UPDATE Employees SET Management = TRUE WHERE EmployeeID = ?`;
            db.query(sql,[EmployeeID],(err)=>{
                if(err){
                    console.error(err);
                    return res.status(500).send("Database error");
                }
                res.send("Employee promoted");
            });
        });

/*Password Change*/
app.post("/changePassword", (req, res) => {
  const {EmployeeID, oldPassword, newPassword} = req.body;
  const checkSQL = "SELECT Password FROM Employees WHERE EmployeeID = ?";

  db.query(checkSQL, [EmployeeID], (err, results) => {
    if(results.length === 0){
        return res.send("Employee Dosen't Exist");
    }
    if(results[0].Password !== oldPassword){
        return res.send("Wrong Password");
    }

    const updateSQL = "UPDATE Employees SET Password = ? WHERE EmployeeID = ?";
    db.query(updateSQL,[newPassword,EmployeeID],(err)=>{
        if(err){
            return res.send("Password Change Failed");
        }
        res.send("Password Change Succesful");
    });
  });
});

/* Start server */
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});