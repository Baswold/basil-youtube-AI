This is a [Next.js](https://nextjs.org) project for the Three-Way Voice Studio frontend.

## ✨ Key Features

### 🎨 Professional Studio UI
- **Broadcast-quality interface** with glassmorphism and dark theme
- **Animated orbs** for real-time speaker visualization
- **Live captions** with smooth transitions and speaker color coding
- **Connection indicators** with pulsing status dots
- **Responsive controls** with tactile feedback
- **Background particles** with ambient glow effects

### 🎭 ElevenLabs Orb Integration
This project uses the **official ElevenLabs Orb component** for visualizing agent states.

To reinstall the orb component:
```bash
pnpm dlx @elevenlabs/agents-cli@latest components add orb
```

See `ORBUS_NOTE.md` for orb details and `UI_GUIDE.md` for complete design documentation.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
