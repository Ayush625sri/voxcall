# VoxCall - Voice & Video Calling App

WebRTC-based peer-to-peer calling application built with Next.js and Firebase.

## Features

- Voice calls
- Video calls
- Contact management with request system
- Real-time speaking indicators
- Call duration tracking
- Mute/unmute audio
- Toggle video on/off

## Tech Stack

- Next.js 15.1.0
- React 19
- TypeScript
- Firebase (Auth, Firestore, Realtime Database)
- WebRTC
- Tailwind CSS

## Setup

1. Clone the repository
2. Install dependencies:
```bash
   npm install
```

3. Create `.env.local` from `.env.example` and add your Firebase config

4. Set up Firebase:
   - Create a Firebase project
   - Enable Authentication (Email/Password)
   - Create Firestore database
   - Create Realtime Database
   - Copy config to `.env.local`

5. Configure Firestore rules:
```javascript
// See firestore.rules in project
```

6. Configure Realtime Database rules:
```json
   {
     "rules": {
       "signaling": {
         "$userId": {
           ".read": "auth != null && auth.uid == $userId",
           ".write": "auth != null"
         }
       }
     }
   }
```

7. Run development server:
```bash
   npm run dev
```

8. Open [http://localhost:3000](http://localhost:3000)

## Usage

1. Sign up / Login
2. Add contacts by email
3. Accept contact requests
4. Start voice or video calls with contacts
5. Use controls during calls (mute, video toggle, end call)

## Deployment

Deploy to Vercel:
```bash
vercel --prod
```
