# Atrium — Svelte/Tailwind Conventions

> Include this file in every Qwen/local model task prompt for Atrium component work.

## Stack
- Svelte 4 (NOT Svelte 5 runes)
- TypeScript (`<script lang="ts">`)
- Tailwind CSS (JIT mode)
- Material Symbols Outlined for icons

## Critical Rules

### 1. `class` is a reserved word in JavaScript
```svelte
// ❌ WRONG
export let class: string;

// ✅ CORRECT
let className = '';
export { className as class };
```

### 2. No dynamic values in Svelte `<style>` blocks
Svelte scoped styles are compiled at build time. You CANNOT use JS variables, template literals, or props inside `<style>`.

```svelte
// ❌ WRONG — will not work
<style>
  .panel {
    backdrop-filter: blur(var(--blur));
    @apply ${className};
    border-radius: $rounded;
  }
</style>

// ✅ CORRECT — use inline styles for dynamic values
<div
  class="rounded-2xl {className}"
  style="backdrop-filter: blur({blur}px); background: rgba(20, 20, 35, {opacity});"
>
  <slot />
</div>
```

### 3. Tailwind purge: no dynamic class construction
Tailwind JIT scans source files for complete class strings. Dynamic construction is invisible to the scanner.

```svelte
// ❌ WRONG — Tailwind won't generate these classes
<div class="bg-{color}-500 text-{color}-400">

// ✅ CORRECT — use a lookup map with full class strings
const colorMap: Record<string, string> = {
  green:  'bg-green-500/10 text-green-400 border-green-500/20',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  red:    'bg-red-500/10 text-red-400 border-red-500/20',
};
$: classes = colorMap[color] ?? colorMap.green;
```

### 4. Use `$$restProps` for wrapper components
```svelte
<div class="glass-panel {className}" {...$$restProps}>
  <slot />
</div>
```

### 5. Props use `export let`, not runes
```svelte
// ❌ WRONG (Svelte 5 runes)
let { label, icon } = $props();

// ✅ CORRECT (Svelte 4)
export let label: string;
export let icon: string;
```

### 6. Reactive statements use `$:`
```svelte
$: isActive = currentPath.startsWith(href);
$: sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
```

### 7. Events use `on:` directive
```svelte
// ❌ WRONG
<button onclick={handler}>

// ✅ CORRECT
<button on:click={handler}>
```

### 8. Navigation
```svelte
import { goto } from '$app/navigation';
// Use goto(href) for programmatic nav, <a href=""> for links
```

## Design System

### Colors (from DesignTokens.ts)
- Background: `#0f0f13`
- Surface: `#1c1c21`
- Primary: `#6961ff` (purple)
- Accent: `#20B2AA` (teal)
- Glass border: `rgba(255, 255, 255, 0.08)`
- Glass bg: `rgba(28, 28, 33, 0.7)`

### Glass Panel Pattern
Always use the shared `GlassPanel.svelte` component or inline styles:
```svelte
<div
  class="rounded-2xl p-4"
  style="background: rgba(20, 20, 35, 0.65); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.08);"
>
```

### Icons
Use `MaterialIcon.svelte` or directly:
```svelte
<span class="material-symbols-outlined" style="font-size: 24px;">icon_name</span>
```

## Reference Components

### GlassPanel.svelte (shared wrapper)
```svelte
<script lang="ts">
  export let blur = 20;
  export let opacity = 0.65;
  export let borderOpacity = 0.08;
  export let rounded = 'rounded-2xl';
  let className = '';
  export { className as class };
</script>

<div
  class="{rounded} {className}"
  style="background: rgba(20, 20, 35, {opacity}); backdrop-filter: blur({blur}px); -webkit-backdrop-filter: blur({blur}px); border: 1px solid rgba(255, 255, 255, {borderOpacity});"
  {...$$restProps}
>
  <slot />
</div>
```

### StatusBadge.svelte (color map pattern)
```svelte
<script lang="ts">
  export let label: string;
  export let color = 'green';
  export let size: 'sm' | 'md' = 'sm';
  let className = '';
  export { className as class };

  const colorMap: Record<string, string> = {
    green:  'bg-green-500/10 text-green-400 border-green-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    red:    'bg-red-500/10 text-red-400 border-red-500/20',
  };
  $: colorClasses = colorMap[color] ?? colorMap.green;
  $: sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
</script>

<span
  class="inline-flex items-center rounded-md font-medium border {colorClasses} {sizeClasses} {className}"
  {...$$restProps}
>
  {label}
</span>
```

## File Structure
```
src/lib/components/atrium/
├── shared/
│   ├── AgencyNav.svelte        # Sidebar navigation
│   ├── AppIcon.svelte          # Home grid icon
│   ├── DesignTokens.ts         # Colors, nav items
│   ├── GlassPanel.svelte       # Glass container
│   ├── MaterialIcon.svelte     # Icon wrapper
│   └── StatusBadge.svelte      # Colored pill
├── onboarding/                 # Onboarding step components
├── Home.svelte
├── Chat.svelte
├── VoiceMode.svelte
├── ...                         # Other page components
src/lib/stores/
└── atrium.ts                 # Central stores
src/routes/(app)/atrium/
├── +layout.svelte              # Layout with AgencyNav
├── +page.svelte                # Home
├── chat/+page.svelte
├── voice/+page.svelte
└── ...                         # Other routes
```

### class: Directive Restrictions
- **NEVER** use `class:` directive with Tailwind classes containing `/` (e.g., `class:bg-white/10={cond}`)
- Svelte's parser interprets `/` as a syntax token and throws "Expected token"
- **Use ternary in class string instead:** `class="{cond ? 'bg-white/10' : 'hover:bg-white/10'}"`
- Same applies to `class:` with `[` bracket notation (e.g., `class:bg-[#6961ff]/10={cond}`)
