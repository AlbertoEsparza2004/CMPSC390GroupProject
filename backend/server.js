require('dotenv').config();
const express = require("express");
const db = require("./db");
const app = express();
//const PORT = 3000;
const path = require("path");
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "../Sprint2Alberto")));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));


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
  const { EmployeeID, password } = req.body;
  const sql =  "SELECT *FROM Employees JOIN EmployeePerformance ON Employees.EmployeeID = EmployeePerformance.EmployeeID WHERE Employees.EmployeeID = ? AND EmployeePerformance.ActivelyEmployed = TRUE";
  db.query(sql, [EmployeeID], (err, results) => {
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
    //res.json({ message: "Login successful" });
    if (user.Management) {
      return res.redirect(`/ManagerDashboardPage.html?name=${user.FirstName}%20${user.LastName}&EmployeeID=${user.EmployeeID}&manager=${user.Management}`)
    } else{ 
      return res.redirect(`/EmployeeDashboardPage.html?name=${user.FirstName}%20${user.LastName}&EmployeeID=${user.EmployeeID}&manager=${user.Management}`)
    }
  });
});


                /*Routes for the manager and employee dashboard*/
/*Schedule*/
app.get("/getSchedule", (req, res) => {
    const employeeID = req.query.EmployeeID;
    const sql = `
    SELECT Employees.EmployeeID, Employees.FirstName, Employees.LastName, Schedule.MonthNum, Schedule.WeekNum, Schedule.Mon, Schedule.Tue, Schedule.Wed, Schedule.Thu, Schedule.Fri, Schedule.Sat, Schedule.Sun FROM Schedule JOIN Employees ON Schedule.EmployeeID = Employees.EmployeeID WHERE Schedule.EmployeeID = ?`;
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
    db.query(sql, [EmployeeID, MonthNum, WeekNum, DayOfWeek, Reason], (err, result) => {
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

/*Employee Options*/
app.get("/getTimeOffRequests",(req,res)=>{

    const sql = `
    SELECT TimeOffRequests.*, Employees.FirstName, Employees.LastName
    FROM TimeOffRequests
    JOIN Employees
    ON TimeOffRequests.EmployeeID = Employees.EmployeeID
    WHERE Status = 'Pending'
    `;

    db.query(sql,(err,results)=>{
        res.json(results);
    });

});

app.post("/approveRequest",(req,res)=>{

    const {RequestID} = req.body;

    const getRequest = `
    SELECT EmployeeID, MonthNum, WeekNum, DayOfWeek
    FROM TimeOffRequests
    WHERE RequestID = ?
    `;

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

const updateSchedule = `
UPDATE Schedule
SET ${dayColumn} = 0
WHERE EmployeeID = ?
AND MonthNum = ?
AND WeekNum = ?
`;

        db.query(updateSchedule,
        [request.EmployeeID, request.MonthNum, request.WeekNum],
        (err)=>{
            if(err){
                console.error(err);
                return res.send("Schedule update error");
            }

            const updateStatus = `
            UPDATE TimeOffRequests
            SET Status = 'Approved'
            WHERE RequestID = ?
            `;

            db.query(updateStatus,[RequestID]);

            res.send("Approved");
        });

    });

});

app.post("/denyRequest",(req,res)=>{

    const {RequestID} = req.body;

    const sql = `
    UPDATE TimeOffRequests
    SET Status = 'Denied'
    WHERE RequestID = ?
    `;

    db.query(sql,[RequestID],()=>{res.send("Denied");});

});

app.get("/getEmployeeStats",(req,res)=>{

    const {EmployeeID} = req.query;

    const sql = `
    SELECT Employees.EmployeeID, FirstName, LastName, HourlyPay,
           Points, Comments
    FROM Employees
    JOIN EmployeePerformance
    ON Employees.EmployeeID = EmployeePerformance.EmployeeID
    WHERE Employees.EmployeeID = ?
    `;

    db.query(sql,[EmployeeID],(err,results)=>{
        res.json(results[0]);
    });

});

app.get("/getEmployees", (req, res) => {

    const sql = `
    SELECT EmployeeID, FirstName, LastName
    FROM Employees
    `;

    db.query(sql, (err, results) => {

        if (err) {
            console.error(err);
            return res.status(500).send("Database error");
        }

        res.json(results);

    });

});

/*Disciplinary Action*/
app.post("/addPoints",(req,res)=>{
    const {EmployeeID, points} = req.body;
    const sql = `UPDATE EmployeePerformance SET Points = Points + ? WHERE EmployeeID = ?`;
    db.query(sql,[points,EmployeeID],()=>{
        res.send("Points added");
    });
});

app.post("/terminateEmployee",(req,res)=>{
    const {EmployeeID} = req.body;
    const sql = `UPDATE EmployeePerformance SET ActivelyEmployed = FALSE WHERE EmployeeID = ?`;
    db.query(sql,[EmployeeID],()=>{
        res.send("Employee terminated");
    });
});

/*Recognition*/
app.post("/giveRaise",(req,res)=>{
    const {EmployeeID, raise} = req.body;
    const sql = `UPDATE Employees SET HourlyPay = HourlyPay + ? WHERE EmployeeID = ?`;
    db.query(sql,[raise,EmployeeID],()=>{
        res.send("Raise applied");
    });
});

app.post("/recognitionComment",(req,res)=>{
    const {EmployeeID, comment} = req.body;
    const sql = `UPDATE EmployeePerformance SET Comments = ? WHERE EmployeeID = ?`;
    db.query(sql,[comment,EmployeeID],()=>{
        res.send("Comment saved");
    });
});

app.post("/promoteManager",(req,res)=>{
    const {EmployeeID} = req.body;
    const sql = `UPDATE Employees SET Management = TRUE WHERE EmployeeID = ?`;
    db.query(sql,[EmployeeID],()=>{
        res.send("Employee promoted");
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