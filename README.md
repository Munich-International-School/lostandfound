# Lost & Found

Simple Lost & Found web app backed by MongoDB.

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure the database connection:
   ```bash
   cp .env.example .env
   ```
   Then set `MONGODB_URI` in `.env` to your connection string. If you use MongoDB Atlas, also add your machine's IP address under **Network Access**, or the app can't reach the cluster.
3. Start the app:
   ```bash
   npm start
   ```
4. Open `http://localhost:3000`.

If the database is unreachable when the app starts, the server still runs. API requests return a 503 error until the connection succeeds.
