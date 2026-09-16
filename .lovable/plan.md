
## PWA Implementation Plan

### What's being built
Transform the existing app into an installable Progressive Web App with:
- App shell caching (instant loads)
- Read-only offline access for: Dashboard, Timetable, Classroom materials, Student list
- Online-only writes (grading, attendance, assignments)
- Offline status banner
- Install prompt UI

### Branding extracted from codebase
- App name: **ReflectED** (from `src/index.css` comment: "ReflectED Design System")
- Primary color: `hsl(213, 75%, 14%)` → `#071f3b` (Reflect Blue)
- Background: `hsl(216, 33%, 97%)` → `#f3f5f9` (Mist White)

---

### Files to create / modify

**1. Install `vite-plugin-pwa`** (new devDependency)

**2. `vite.config.ts`** — add VitePWA plugin config:
```text
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'robots.txt'],
  manifest: {
    name: 'ReflectED',
    short_name: 'ReflectED',
    description: 'School Management System',
    theme_color: '#071f3b',
    background_color: '#f3f5f9',
    display: 'standalone',
    scope: '/',
    start_url: '/dashboard',
    icons: [192px, 512px, maskable]
  },
  workbox: {
    // App shell: cache-first
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    // Network-first for read-only routes
    runtimeCaching: [
      { urlPattern: /\/dashboard/, handler: 'NetworkFirst' },
      { urlPattern: /\/timetable/, handler: 'NetworkFirst' },
      { urlPattern: /\/classroom/, handler: 'NetworkFirst' },
      { urlPattern: /\/students/, handler: 'NetworkFirst' },
      // Supabase API: NetworkOnly (never cache writes)
      { urlPattern: /supabase\.co/, handler: 'NetworkOnly' }
    ]
  }
})
```

**3. `public/pwa-192.png` + `public/pwa-512.png`** — generate SVG-based icons using the ReflectED brand colors (dark blue background, gold "R" monogram)

**4. `index.html`** — add PWA meta tags:
```html
<title>ReflectED</title>
<meta name="theme-color" content="#071f3b" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="ReflectED" />
<link rel="apple-touch-icon" href="/pwa-192.png" />
<link rel="manifest" href="/manifest.webmanifest" />
```

**5. `src/hooks/useOnlineStatus.ts`** — new hook:
```ts
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
    return () => { /* cleanup */ };
  }, []);
  return isOnline;
}
```

**6. `src/components/layout/OfflineBanner.tsx`** — new component:
- Yellow banner at top: "You're offline. Some features are unavailable."
- Uses `useOnlineStatus` hook
- Only renders when `!isOnline`

**7. `src/hooks/useInstallPrompt.ts`** — new hook:
- Captures `beforeinstallprompt` event
- Exposes `canInstall`, `install()`, `isDismissed`

**8. `src/components/layout/InstallPromptBanner.tsx`** — new component:
- Dismissable card: "Install ReflectED for quick access from your home screen"
- "Install" button triggers the prompt
- Shown only when `canInstall && !isDismissed`

**9. `src/components/layout/DashboardLayout.tsx`** — add `<OfflineBanner />` and `<InstallPromptBanner />` above the main content area

**10. `src/pages/Offline.tsx`** — simple offline fallback page (shown by service worker when a non-cached route is requested):
```text
"You're offline. Please reconnect to access this page."
With a link back to /dashboard
```

---

### Caching strategy summary

```text
Asset Type              | Strategy       | Rationale
------------------------|----------------|---------------------------
JS/CSS/HTML bundles     | Cache-First    | Static, versioned by Vite
Images/fonts            | Cache-First    | Static assets
/dashboard, /timetable  | Network-First  | Fresh data preferred
/students, /classroom   | Network-First  | Fresh data preferred
Supabase API calls      | Network-Only   | Never cache write endpoints
Auth endpoints          | Network-Only   | Security requirement
```

---

### Technical notes
- `vite-plugin-pwa` generates the service worker automatically via Workbox — no manual SW file needed
- `registerType: 'autoUpdate'` means SW updates silently without user intervention
- Icons will be generated as inline SVG → PNG equivalents using a canvas-based approach in a small script, or created as SVG files that browsers/PWA accept
- The Supabase `NetworkOnly` rule covers both reads and writes at the API level — this is intentional and safe
