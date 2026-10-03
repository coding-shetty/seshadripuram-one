---
name: skiper-ui
description: >-
  Expert guide for Skiper UI components, shadcn registry integration, and micro-interactions,
  specifically featuring @skiper-ui/skiper40 (CssLink) and creative animated UI primitives
  using Tailwind CSS, Framer Motion, and CSS pseudo-elements.
---

# Skiper UI & Skiper40 Interaction Design Skill

This skill provides comprehensive instructions, patterns, and code implementations for **Skiper UI** components, with direct focus on **`@skiper-ui/skiper40`** (`CssLink` animated link primitives) and integrating Skiper UI registries into shadcn/ui projects.

---

## 1. Skiper UI Overview & Registry Architecture

Skiper UI (`https://skiper-ui.com`) provides design-forward, "uncommon" interactive UI components built for Next.js, React, Tailwind CSS, Framer Motion, and shadcn/ui.

### shadcn Registry Configuration

To configure the Skiper UI registry in a shadcn-compatible Next.js/React project, add `@skiper-ui` to `components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "registries": {
    "@skiper-ui": {
      "url": "https://skiper-ui.com/r/{name}.json",
      "headers": {
        "Authorization": "Bearer ${SKIPER_LICENSE_KEY}"
      }
    }
  }
}
```

### Installation via CLI
```bash
# Add skiper40 component
npx shadcn add @skiper-ui/skiper40
```

---

## 2. `@skiper-ui/skiper40` (CssLink) Deep Dive

**skiper40** provides 6 distinct high-polish animated link variants inspired by modern software aesthetics (such as Cursor.com). It leverages CSS pseudo-elements (`::before`), cubic-bezier easing (`cubic-bezier(0.4, 0, 0.2, 1)`), SVG arrow micro-transitions, and blend-mode highlights (`mix-blend-difference`).

### Variant Characteristics

| Variant | Animation Type | Visual Effect |
| :--- | :--- | :--- |
| **`Link000`** | Underline Slide | Origin right $\to$ hover origin left scaleX(1) |
| **`Link001`** | Underline + Arrow Reveal | Origin right underline + diagonal arrow translateY(0) & opacity(1) |
| **`Link002`** | Directional Underline | Origin left $\to$ origin right sweep |
| **`Link003`** | Center Origin Underline | Origin center $\to$ expand outwards evenly |
| **`Link004`** | Difference Pill (Vertical) | Background white block height expands vertically with `mix-blend-difference` + 45° arrow rotate |
| **`Link005`** | Difference Pill (Horizontal)| Background white block slides horizontally with `mix-blend-difference` + arrow translate |

---

## 3. Complete Source Code Implementation (`skiper40.tsx`)

```tsx
"use client";

import Link from "next/link";
import React from "react";
import { cn } from "@/lib/utils";

export interface LinkProps {
  children: React.ReactNode;
  href: string;
  className?: string;
}

/**
 * Link000: Underline expansion from right to left
 */
export const Link000: React.FC<LinkProps> = ({ children, href, className }) => {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center",
        className,
        "before:pointer-events-none before:absolute before:bottom-0 before:left-0 before:h-[0.05em] before:w-full before:bg-current before:content-['']",
        "before:origin-right before:scale-x-0 before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)]",
        "hover:before:origin-left hover:before:scale-x-100",
      )}
    >
      {children}
    </Link>
  );
};

/**
 * Link001: Underline with upward translating diagonal arrow
 */
export const Link001: React.FC<LinkProps> = ({ children, href, className }) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group relative flex items-center",
        "before:pointer-events-none before:absolute before:left-0 before:top-[1.5em] before:h-[0.05em] before:w-full before:bg-current before:content-['']",
        "before:origin-right before:scale-x-0 before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)]",
        "hover:before:origin-left hover:before:scale-x-100",
        className,
      )}
    >
      {children}
      <svg
        className="ml-[0.3em] mt-[0em] size-[0.55em] translate-y-1 opacity-0 transition-all duration-300 [motion-reduce:transition-none] group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none"
        fill="none"
        viewBox="0 0 10 10"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M1.004 9.166 9.337.833m0 0v8.333m0-8.333H1.004"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
};

/**
 * Link002: Left-origin sweep underline
 */
export const Link002: React.FC<LinkProps> = ({ children, href, className }) => {
  return (
    <a
      href={href}
      className={cn(
        "group relative flex items-center",
        className,
        "before:pointer-events-none before:absolute before:left-0 before:top-[1.5em] before:h-[0.05em] before:w-full before:bg-current before:content-['']",
        "before:origin-right before:scale-x-0 before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)]",
        "before:origin-left",
        "hover:before:origin-right hover:before:scale-x-100",
      )}
    >
      {children}
      <svg
        className="ml-[0.3em] mt-[0em] size-[0.55em] translate-y-1 opacity-0 transition-all duration-300 [motion-reduce:transition-none] group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none"
        fill="none"
        viewBox="0 0 10 10"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M1.004 9.166 9.337.833m0 0v8.333m0-8.333H1.004"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
};

/**
 * Link003: Center-outwards expanding underline
 */
export const Link003: React.FC<LinkProps> = ({ children, href, className }) => {
  return (
    <a
      href={href}
      className={cn(
        "group relative flex items-center",
        className,
        "before:pointer-events-none before:absolute before:left-0 before:top-[1.5em] before:h-[0.05em] before:w-full before:bg-current before:content-['']",
        "before:origin-right before:scale-x-0 before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)]",
        "before:origin-center",
        "hover:before:scale-x-100",
      )}
    >
      {children}
      <svg
        className="ml-[0.3em] mt-[0em] size-[0.55em] translate-y-1 opacity-0 transition-all duration-300 [motion-reduce:transition-none] group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none"
        fill="none"
        viewBox="0 0 10 10"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M1.004 9.166 9.337.833m0 0v8.333m0-8.333H1.004"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
};

/**
 * Link004: Difference pill (vertical height expand with mix-blend-difference)
 */
export const Link004: React.FC<LinkProps> = ({ children, href, className }) => {
  return (
    <a
      href={href}
      className={cn(
        "group relative flex items-center",
        className,
        "before:pointer-events-none before:absolute before:left-0 before:w-full before:bg-white before:content-['']",
        "before:origin-right before:scale-x-0 before:transition-all before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)]",
        "before:origin-center md:before:bottom-0",
        "before:z-1 px-2 before:h-0 before:scale-x-100 before:mix-blend-difference hover:before:h-[1.4em]",
      )}
    >
      {children}
      <svg
        className="z-0 ml-[0.6em] mt-[0em] size-[0.55em] translate-y-1 opacity-0 transition-all duration-300 [motion-reduce:transition-none] group-hover:translate-y-0 group-hover:rotate-45 group-hover:opacity-100 motion-reduce:transition-none"
        fill="none"
        viewBox="0 0 10 10"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M1.004 9.166 9.337.833m0 0v8.333m0-8.333H1.004"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
};

/**
 * Link005: Difference pill (horizontal slide with mix-blend-difference)
 */
export const Link005: React.FC<LinkProps> = ({ children, href, className }) => {
  return (
    <a
      href={href}
      className={cn(
        className,
        "group relative flex items-center",
        "before:pointer-events-none before:absolute before:left-0 before:w-full before:bg-white before:content-['']",
        "before:scale-x-1 before:transition-all before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)]",
        "before:origin-left md:before:top-0",
        "before:z-1 px-2 before:h-full before:scale-x-0 before:mix-blend-difference hover:before:scale-x-100",
      )}
    >
      {children}
      <svg
        className="z-0 ml-[0.6em] mt-[0em] size-[0.55em] -translate-x-1 rotate-45 opacity-0 transition-all duration-300 [motion-reduce:transition-none] group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:transition-none"
        fill="none"
        viewBox="0 0 10 10"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M1.004 9.166 9.337.833m0 0v8.333m0-8.333H1.004"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
};

/**
 * Showcase component demonstrating all Skiper40 links
 */
export const Skiper40: React.FC = () => {
  return (
    <section className="h-full snap-y snap-mandatory overflow-y-scroll p-8">
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-6 font-mono text-lg text-neutral-800 dark:text-neutral-100">
        <Link000 href="mailto:hi@skiper-ui.com">Link 000 (Subtle Underline)</Link000>
        <Link001 href="mailto:hi@skiper-ui.com">Link 001 (Arrow Slide)</Link001>
        <Link002 href="mailto:hi@skiper-ui.com">Link 002 (Sweep Underline)</Link002>
        <Link003 href="mailto:hi@skiper-ui.com">Link 003 (Center Spread)</Link003>
        <Link004 href="mailto:hi@skiper-ui.com">Link 004 (Difference Pill Vertical)</Link004>
        <Link005 href="mailto:hi@skiper-ui.com">Link 005 (Difference Pill Horizontal)</Link005>
      </div>
    </section>
  );
};

export default Skiper40;
```

---

## 4. Adapting Skiper40 Micro-Interactions to Other Stacks

### Vanilla CSS Equivalent
```css
.skiper-link {
  position: relative;
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  color: inherit;
}

.skiper-link::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 1.5px;
  background-color: currentColor;
  transform-origin: right;
  transform: scaleX(0);
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.skiper-link:hover::before {
  transform-origin: left;
  transform: scaleX(1);
}
```

### Flutter Equivalent Pattern
```dart
class SkiperAnimatedLink extends StatefulWidget {
  final String text;
  final VoidCallback onTap;
  const SkiperAnimatedLink({super.key, required this.text, required this.onTap});

  @override
  State<SkiperAnimatedLink> createState() => _SkiperAnimatedLinkState();
}

class _SkiperAnimatedLinkState extends State<SkiperAnimatedLink> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: widget.onTap,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(widget.text, style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(width: 4),
                AnimatedSlide(
                  offset: _isHovered ? Offset.zero : const Offset(0, 0.3),
                  duration: const Duration(milliseconds: 250),
                  curve: Curves.easeOutCubic,
                  child: AnimatedOpacity(
                    opacity: _isHovered ? 1.0 : 0.0,
                    duration: const Duration(milliseconds: 250),
                    child: const Icon(Icons.north_east, size: 14),
                  ),
                ),
              ],
            ),
            AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              curve: const Cubic(0.4, 0.0, 0.2, 1.0),
              height: 1.5,
              width: _isHovered ? 120.0 : 0.0,
              color: Theme.of(context).colorScheme.primary,
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## 5. Accessibility & Motion Guidelines

1. **`motion-reduce` Safety**: Always include `motion-reduce:transition-none` on micro-animations for users who prefer reduced motion.
2. **Accessible Icons**: Decorative external link icons must include `aria-hidden="true"`.
3. **Screen Readers**: External links should indicate target behavior using visual or visually hidden text when navigating outside the application.
