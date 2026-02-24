Backend (Node.js + Express + MySQL)

This folder contains the backend API for the CMPSC390 group project
Legacy Auto Customization.

Requirements

Install Node.js (LTS version)

Install MySQL Server

Ensure MySQL Server is running

(Recommended) Install MySQL Workbench

1️⃣ Database Setup (Run First)

Open MySQL Workbench

Connect to your local MySQL instance

Open and run the schema file located at:

/sprint1/Databaseschema.txt

Confirm the following exist:

Database: legautocustDB

Tables:

User

Parts

Customized_car

Quick Database Verification

Run the following queries inside MySQL:

USE legautocustDB;
SELECT * FROM User;
SELECT * FROM Parts;
SELECT * FROM Customized_car;

2️⃣ Backend Setup

Open a terminal

Navigate into the backend folder

Install dependencies by running:

npm install

If dependencies are missing, run:

npm install express mysql2 body-parser

3️⃣ Configure Database Credentials (IMPORTANT)

Open the file:

backend/db.js

Update the following fields to match your local MySQL setup:

host: "localhost"

user: "root"

password: "YOUR_MYSQL_PASSWORD"

database: "legautocustDB"

Replace YOUR_MYSQL_PASSWORD with your actual local MySQL password

Do NOT commit real passwords to GitHub

4️⃣ Start the Server

From inside the backend folder, run:

npm start

The server will run at:

http://localhost:3000

5️⃣ Test Routes (Sprint 1)
Base Route

Method: GET

URL: http://localhost:3000/

Expected: API running confirmation message

Test Route

Method: GET

URL: http://localhost:3000/test

Expected: Backend test message

Get Parts

Method: GET

URL: http://localhost:3000/parts

Expected: JSON list of all rows from the Parts table

6️⃣ Login Route (POST Request)

Must be tested using Thunder Client or Postman

Method: POST

URL: http://localhost:3000/login

JSON Body Example

username: Goodman

password: Manpas303

Expected Responses

Success: Login successful

Failure: Login failed

7️⃣ Testing with Thunder Client (VS Code)

Open Thunder Client

Click New Request

Set Method → POST

Enter URL → http://localhost:3000/login

Select Body → JSON

Enter the login credentials

Click Send

Important Notes

Visiting /login in a browser will show Cannot GET /login
This is correct because login is a POST route.

Every team member must configure their own MySQL password in db.js.

Never push real passwords to GitHub.