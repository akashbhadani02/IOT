# ESP8266 IoT

React/Vite frontend + Express/Mongoose backend for ESP8266 relay control.

## Backend local setup

1. `cd backend`
2. `npm install`
3. Create `.env`:

```env
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_long_random_secret
PORT=5000
```

4. `npm start`
5. Test: `http://localhost:5000/` and `http://localhost:5000/api/health`

## Frontend local setup

1. `cd frontend`
2. `npm install`
3. Create `.env`:

```env
VITE_API_URL=http://localhost:5000
```

4. `npm run dev`

## Vercel

### Backend project
- Root Directory: `backend`
- Build/Framework: Node.js / Vercel Node
- The included `backend/vercel.json` routes requests to `api/index.js`.
- Environment variables: `MONGO_URI`, `JWT_SECRET`

### Frontend project
- Root Directory: `frontend`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment variable: `VITE_API_URL=https://iot-flame-chi.vercel.app`

Do not upload or commit `backend/.env`.
