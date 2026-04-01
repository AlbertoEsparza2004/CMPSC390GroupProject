# Backend Setup Guide (Node.js + Express + MySQL)

This folder contains the backend API for the Legacy Auto Customization project.

## Requirements

- Node.js LTS
- MySQL Server (running locally)
- MySQL Workbench (recommended)

## 1. Database Setup (Run First)

1. Open MySQL Workbench and connect to your local server.
2. Open and run:

	 `backend/setup_database.sql`

This script creates the full `legautocustDB` database, including customer, parts, vehicle, trade, and employee tables, then seeds sample data.

## 2. Install Backend Dependencies

From the `backend` folder:

```bash
npm install
```

## 3. Configure Local DB Credentials

Open:

`backend/db.js`

Update these values for your local MySQL instance:

- `host`
- `user`
- `password`
- `database` (should remain `legautocustDB`)

Do not commit real credentials.

## 4. Start the Backend

From the `backend` folder:

```bash
node server.js
```

Backend runs at:

`http://localhost:3000`

## 5. Quick Smoke Test

Use browser, Postman, or Thunder Client:

- `GET /test`
- `GET /parts`
- `POST /login`
- `GET /trades`
- `GET /customer/1`

Example login request body:

```json
{
	"username": "Goodman",
	"password": "Manpas303"
}
```

## 6. Common Notes

- `GET /login` in a browser is expected to fail because `/login` is a `POST` route.
- Static frontend files are served from the project root by `server.js`.
- If the backend fails to start, first verify MySQL is running and the credentials in `backend/db.js` are correct.
