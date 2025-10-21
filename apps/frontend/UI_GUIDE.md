# UI Design Guide - Three-Way Voice Studio

## 🎨 Design Philosophy

The UI is built with a **professional broadcast studio aesthetic** featuring:
- **Deep space background** with subtle animated gradients
- **Glassmorphism** effects with backdrop blur
- **Smooth animations** for state transitions
- **Color-coded speakers** for instant visual identification
- **Responsive feedback** for all interactive elements

## 🎭 Visual Hierarchy

### 1. **Header** (Top Priority)
- **Title**: Gradient text from white → blue → purple
- **Connection Indicator**: Live pulsing status dot
- **Controls**: Prominent autopilot toggle with animated states

### 2. **Orb Visualization** (Main Focus)
Three animated orbs representing each participant:

| Speaker | Position | Colors | Border Glow |
|---------|----------|--------|-------------|
| **Basil (You)** | Left | Cyan → Aqua | Cyan glow when active |
| **Claude** | Center (elevated) | Blue → Purple | Blue glow when active |
| **Guest** | Right | Orange → Amber | Orange glow when active |

**States**:
- `idle` - Subtle animation, dim borders
- `listening` - Increased brightness, blue badge
- `speaking` - Full glow, scale up, green badge
- `thinking` - Purple tint, purple badge

### 3. **Shared Screen** (Content Area)
Large glassmorphic container with:
- **Idle State**: Welcome message with speaker legend
- **Active State**: Live captions with timestamp
- **Previous Captions**: Scrolling history (3 items)

### 4. **Controls Panel** (Footer)
Toggleable control cards showing:
- 🎙️ **Microphone** status
- 🎧 **Audio Mix** monitoring
- ⏺️ **Recording** state
- System status badges

## 🎬 Animations

### Entrance Animations
```css
- Orbs: Staggered fade-in (100ms delay each)
- Captions: Slide up from bottom
- Controls: Fade in with slide
```

### Interactive Animations
```css
- Buttons: Scale down on click (0.98x)
- Orbs: Scale up when speaking (1.05x)
- Hover states: Smooth brightness transitions
- Status indicators: Continuous pulse
```

### Background Effects
```css
- Particle orbs: Slow pulse (2s duration)
- Connection indicator: Fast pulse (connected)
- Active orb glow: Smooth fade in/out
```

## 🎨 Color Palette

### Base Colors
```css
--background-dark: #050717
--background-mid: #0f1729
--background-darker: #020312
--foreground: #e5e7eb
--text-muted: #94a3b8
```

### Speaker Colors
```css
Basil (You):
  Primary: #0EA5E9 (cyan)
  Secondary: #22D3EE (aqua)
  
Claude:
  Primary: #3B82F6 (blue)
  Secondary: #8B5CF6 (purple)
  
Guest:
  Primary: #F59E0B (amber)
  Secondary: #F97316 (orange)
```

### Status Colors
```css
Success/Active: #10b981 (emerald)
Warning: #f59e0b (amber)
Error: #ef4444 (red)
Info: #3b82f6 (blue)
```

## 📐 Layout Structure

```
┌─────────────────────────────────────────────────┐
│  Header (Gradient Title + Connection + Controls) │
├─────────────────────────────────────────────────┤
│                                                  │
│         ◯ Basil    ◯★ Claude    ◯ Guest         │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │                                          │  │
│  │        Shared Screen / Captions          │  │
│  │                                          │  │
│  │  • Live caption with timestamp           │  │
│  │  • Previous 3 captions                   │  │
│  │                                          │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
├─────────────────────────────────────────────────┤
│  Controls Panel (Mic | Audio | Recording)       │
│  Status Bar (Phase | Adapters | Services)       │
└─────────────────────────────────────────────────┘
```

## 🔄 State Management

### Connection States
- **idle** → Grey dot, "Disconnected"
- **connecting** → Amber dot (pulsing), "Connecting"
- **connected** → Green dot (pulsing), "Connected"
- **error** → Red dot, "Error"

### Orb States
- **idle** → Default animation, dim glow
- **listening** → Blue badge, subtle pulse
- **speaking** → Full glow, scale 1.05x, green badge
- **thinking** → Purple badge, dim non-thinking orbs

### Autopilot States
- **Off** → Grey button, "Standby"
- **On** → Gradient purple → indigo, "Active", scale 1.05x

## 🎯 Interactive Elements

### Buttons
All buttons feature:
- **Hover**: Brightness increase
- **Active**: Scale down (0.98x)
- **Transition**: 200-300ms ease
- **Border**: Subtle glow on focus

### Control Cards
- **Inactive**: Grey border, dim background
- **Active**: Emerald glow, animated bottom bar
- **Hover**: Slight brightness increase, icon scale 1.1x

### Caption Display
- **Main Caption**: Large card with gradient glow
- **Speaker Badge**: Gradient text matching speaker color
- **Timestamp**: Monospace font, muted
- **Previous**: Dimmed (60% opacity), hover to 100%

## 📱 Responsive Design

The UI adapts gracefully:
- **Desktop (>1280px)**: Full 3-column layout
- **Tablet (768-1280px)**: Compressed spacing
- **Mobile (<768px)**: Stacked layout (future enhancement)

## ⚡ Performance Optimizations

- **CSS transforms** for animations (GPU-accelerated)
- **useMemo** for expensive caption rendering
- **Backdrop blur** only on necessary elements
- **Smooth transitions** capped at 60fps

## 🎛️ Customization Points

To customize the UI:

1. **Speaker Colors**: Edit `speakerDisplay` in `studio-page.tsx`
2. **Animation Speeds**: Modify `duration-*` classes
3. **Blur Effects**: Adjust `backdrop-blur-*` values
4. **Spacing**: Update `gap-*` and padding values
5. **Orb Size**: Change `h-44 w-44` classes

## 🔮 Future Enhancements

Planned UI improvements:
- [ ] Thinking mode visuals (fractals, particles)
- [ ] Waveform visualization for audio levels
- [ ] Keyboard shortcuts overlay
- [ ] Settings panel with theme customization
- [ ] Full-screen shared screen mode
- [ ] Recording timeline scrubber
- [ ] Episode selector sidebar

## 🎬 Best Practices

When extending the UI:

1. **Maintain Consistency**: Use existing color variables
2. **Smooth Transitions**: Always add transition classes
3. **Accessibility**: Ensure proper ARIA labels
4. **Performance**: Use CSS transforms over margin/padding
5. **Dark Theme**: All elements optimized for dark background
6. **Glassmorphism**: Use backdrop-blur with low opacity backgrounds

## 🛠️ Development Tips

### Testing States
Toggle between states in DevTools:
```javascript
// In browser console
window.__studioStore = useStudioStore.getState();
window.__studioStore.toggleAutopilot();
```

### Debugging Animations
Add to any element:
```jsx
className="... ring-2 ring-red-500" // Visualize boundaries
```

### Performance Monitoring
```javascript
// Enable React DevTools Profiler
// Check animation frame rate in browser performance tools
```

---

**Built with**: Next.js 15, Tailwind CSS 4, React Three Fiber, ElevenLabs Orb

**Font Stack**: Geist Sans (primary), Geist Mono (code/timestamps)
