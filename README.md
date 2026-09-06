# ESP8266 IoT Platform — GitHub + Vercel Ready

Full-stack starter:
- Frontend: React + Vite
- Backend: Express API, Vercel serverless compatible
- Database: MongoDB Atlas
- Auth: JWT + bcrypt
- ESP8266 pins: D0, D1, D2, D5, D6, D7

## GitHub / Vercel deployment

### Backend
Deploy the `backend` directory as a Vercel project.
Set these Environment Variables in Vercel:
- `MONGO_URI`
- `JWT_SECRET`

The API URL will look like:
`https://your-backend.vercel.app`

### Frontend
Deploy the `frontend` directory as a separate Vercel project.
Set:
- `VITE_API_URL=https://your-backend.vercel.app`

Build command: `npm run build`
Output directory: `dist`

## Local development

Backend:
```bash
cd backend
npm install
npm run dev
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

Do not commit `.env` files or secrets.
