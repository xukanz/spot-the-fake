# Spot the Fake

A live drawing and deduction game for 3–8 players on phones or computers. One Express service hosts the page and Socket.IO rooms. No account or database is needed.

## Play

One person creates a room and shares the invite URL. Each player receives a secret word; one player has a similar but different word and does not know they are undercover. Take turns drawing one continuous stroke each in two rounds (20 seconds per turn). You can undo your stroke and redraw it until you tap Done; an unconfirmed stroke is sent automatically when time runs out. Discuss for 60 seconds, then each player has 30 seconds to vote for someone else. A tie or an incorrect accusation gives the undercover the win. If caught, the undercover gets 20 seconds to guess the civilians’ word; a correct guess wins, otherwise the civilians win.

## Run locally

Requires Node.js 20 or later.

```sh
npm install
npm start
```

Open http://localhost:3000. For multiple devices on the same network, open the computer's LAN address and allow incoming traffic to port 3000. For internet play, deploy the server.

## Deploy on Render

1. Push this folder to a GitHub repository.
2. On Render, create a **Web Service** from the repository. Set root directory to `spot-the-fake` if this folder is within a larger repository.
3. Build command: `npm install`. Start command: `npm start`. Use Node 20 or later and one service instance.
4. Open the public HTTPS URL Render gives you. Create a room and share its invite URL. Test with a second device on another network.

The service listens on `process.env.PORT || 3000`, and Socket.IO uses the same origin. Free instances may sleep after inactivity, causing an initial loading delay. Room state is in memory: a restart loses active rooms; use one instance unless shared state is added.

## Test

Run `npm test` for rule checks. For a manual check, open three separate browser contexts, start a room, draw from each device, let timers expire, chat, vote, and play again. Refresh a player mid-game to verify seat recovery. Use a phone to check touch drawing and layout.
