# ElevenLabs Orb Component

## Installation

The official ElevenLabs orb component is installed using:

```bash
pnpm dlx @elevenlabs/agents-cli@latest components add orb
```

**This has been installed twice to ensure it's properly integrated!**

## Component Location

- **Path**: `src/components/ui/orb.tsx`
- **Source**: ElevenLabs UI Registry (https://ui.elevenlabs.io/r/orb.json)

## Features

The orb component supports:
- ✅ Agent states: `thinking`, `listening`, `talking`, `null`
- ✅ Custom colors for each speaker
- ✅ Volume-based animation (auto or manual modes)
- ✅ Three.js/React Three Fiber rendering
- ✅ Smooth transitions and animations

## Usage in Studio

Currently used in `src/components/studio-page.tsx`:

```tsx
<Orb
  colors={meta.colors}
  className="relative h-full w-full"
  agentState={orbStateToAgentState(orbStates[speaker])}
/>
```

## Speaker Color Schemes

- **Basil (You)**: `["#0EA5E9", "#22D3EE"]` (Cyan to Aqua)
- **Claude**: `["#3B82F6", "#8B5CF6"]` (Blue to Purple)
- **Guest**: `["#F59E0B", "#F97316"]` (Amber to Orange)

## Dependencies

Automatically installed with the orb component:
- `@react-three/drei`
- `@react-three/fiber`
- `three`
- `@types/three`

These are already present in `package.json`.

## Official Documentation

For more details on the orb component and its API, visit:
https://elevenlabs.io/docs/conversational-ai/components/orb
