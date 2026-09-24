---
title: Portfolio Drawing Canvas
kind: project
summary: An interactive drawing canvas where visitors can submit artwork and have it become part of the website design. Approved drawings are literally the home page.
stack: [Astro, React, Supabase, TailwindCSS, sharp, potrace]
github: https://github.com/ykabusalah/personal
live: /info
role: "Solo: product, design, and code"
timeline: Jun 2025 to now
outcome: Live. Every visit to the home page shows a random visitor's drawing, and I review every submission by hand.
order: 1
cover: ./drawing-canvas/home_page.jpg
coverAlt: "Home page, where a random visitor's drawing fills the whole screen"
---

## Problem Statement

Personal portfolio sites are passive. Visitors scroll, maybe read a project description, and leave. There's no reason to interact, no way to leave a mark, and no mechanism for the portfolio owner to understand who's visiting or how they're engaging. Standard analytics tools like Google Analytics provide page views and bounce rates, but nothing specific to what actually matters for a portfolio.

This project adds an interactive drawing canvas to a personal portfolio where visitors can draw, save, and submit artwork. Approved submissions become the portfolio itself: every visit to the home page shows a random visitor drawing, full screen, turning a static site into something that accumulates community contributions over time. A custom analytics system replaces Google Analytics with metrics that actually matter: full conversion funnels from portfolio visit to drawing submission, tool usage patterns, and drop-off analysis at every stage.

## Goals

| Goal | Success Metric |
| --- | --- |
| Visitors engage with the portfolio beyond passive scrolling | Click-through rate from home page to drawing app |
| Users who start drawing complete and submit artwork | Drawing completion rate (started drawing vs. submitted), modal abandonment rate |
| The drawing tool is intuitive enough that users don't need instructions | Undo/redo frequency (high usage suggests experimentation, not confusion), average time on draw page |
| Full visibility into user behavior across the entire funnel | Complete conversion funnel: Home > Draw Click > Info > Draw > Submit, with step-by-step conversion rates |

## Target Users

**Portfolio visitors** (recruiters, peers, friends) who land on the site and encounter an unexpected interactive element. The drawing feature works as a conversation starter and a memorable differentiator.

**The portfolio owner (me)** who needs to understand visitor behavior, moderate submissions, and track engagement patterns over time.

## Key Features

### 1. The Drawing Is the Home Page

The first version put visitor drawings in a side panel with a museum-style label, and it felt like an exhibit instead of part of the site. So now the drawing is the whole page. Every visit picks a random approved drawing, skipping the last few you've already seen, and draws it in stroke by stroke with a handwritten "drawn by" credit. My intro sits on a color sticker in the corner, with a "Sorry, I'm in the way" button that tips it off the screen when you want to see the full drawing.

Drawings are made on a laptop-sized canvas and shown full screen, which means blowing them up about 3x. Upscaled PNGs looked blurry at that size, so every approved drawing is traced into a vector (SVG) when the site builds. The lines stay sharp at any size.

### 2. Draw Intro Page

A short page explaining the concept, with a live count of featured drawings and one button to start drawing. It's plain HTML so it shows up instantly, and it quietly preloads the canvas in the background so "Let's Draw!" opens fast.

![Draw intro page with the live count of featured drawings](./drawing-canvas/draw_intro.jpg)

*Draw intro page with the live count of featured drawings*

### 3. Full-Viewport Drawing Canvas

A React component rendering a full-viewport canvas element that spans edge-to-edge with no overflow under the toolbar. Dynamic resizing logic preserves existing strokes when the window resizes. Minimum window size enforced at 800x600px with a user-friendly message. Mobile visitors get a prompt to switch to desktop.

![Responsive, edge-to-edge drawing canvas](./drawing-canvas/drawing_screen.jpg)

*Responsive, edge-to-edge drawing canvas*

![Automatic detection of smaller canvases (half-screen on desktop specifically)](./drawing-canvas/drawing_alert.jpg)

*Automatic detection of smaller canvases (half-screen on desktop specifically)*

### 4. Vertical Toolbar

Right-aligned, sticky vertical toolbar with Lucide React icons for brush, eraser, undo, redo, clear, save, and exit. Buttons invert on press, and active tools stay highlighted. Brush size is adjusted via a custom triangle-shaped slider.

Tool details:

- **Brush:** Adjustable size from 1 to 20px.
- **Eraser:** True eraser using canvas `globalCompositeOperation: 'destination-out'`, not a white brush workaround. This was a deliberate UX improvement since the white-brush approach breaks on non-white backgrounds.
- **Undo/Redo:** Each stroke (pointer down to pointer up) is captured as an independent state snapshot. Separate stacks for undo and redo allow full history navigation.

![Sleek vertical toolbar with tool icons in drawing canvas](./drawing-canvas/toolbar.jpg)

*Sleek vertical toolbar with tool icons in drawing canvas*

### 5. Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| P | Switch to Pencil |
| E | Switch to Eraser |
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| [ / ] | Decrease / Increase brush size |
| Ctrl+S | Open save modal |
| Delete / Backspace | Clear canvas |
| Escape | Close modals |

### 6. Submission Flow

On save, the canvas is captured as a PNG and a modal opens for name entry and terms agreement. The image uploads to a Supabase storage bucket with RLS-protected insert policy. Metadata (name, image URL, status=pending) is inserted into the drawings table. A confirmation screen with confetti celebrates successful submission. All submission events are tracked for analytics.

![User-facing modal for name entry and terms agreement before upload](./drawing-canvas/thankyou.jpg)

*User-facing modal for name entry and terms agreement before upload*

### 7. Admin Moderation Panel

Secure login via Supabase Auth. Card-based grid layout showing pending submissions with click-to-enlarge preview. One-click approve/reject actions with real-time status updates. Stats overview showing pending, approved, and rejected counts.

![Admin interface for reviewing and managing submitted artwork](./drawing-canvas/mod_panel.jpg)

*Admin interface for reviewing and managing submitted artwork*

### 8. Custom Analytics Dashboard

Built from scratch to replace Google Analytics with metrics that are actually relevant to a drawing submission funnel:

| Category | Metrics Tracked |
| --- | --- |
| Traffic and Conversion | Full funnel (Home > Draw Click > Info > Draw > Submit), step-by-step conversion rates, direct vs. referred visitor breakdown |
| Drop-off Analysis | Home page bounce rate, info page drop-off, info page bounce rate, modal abandonment rate |
| Drawing Behavior | Undo/redo frequency, popular brush sizes, brush size change frequency, average time before submitting, canvas clear frequency |
| Visitors | Unique sessions, page views, returning visitor rate (cross-session tracking) |
| Activity Patterns | Hourly heatmap, day-of-week breakdown, monthly trends |
| Submissions | Approval rate, status counts, exit button behavior (confirmed vs. cancelled) |

Time range filtering supports last 7 days, 30 days, 90 days, or all-time views. The headline numbers are also public in the "By the numbers" box above, pulled live from a database function that only returns totals, never individual visits.

![Statistics page including full funnel visualization from home page to submission](./drawing-canvas/statistics.jpg)

*Statistics page including full funnel visualization from home page to submission*

### 9. One Site, One Funnel

The original version lived in two places: the portfolio on Super.so and the drawing app on a subdomain, stitched together by passing visitor IDs through URLs. Moving the whole portfolio into one Astro site put the entire funnel on one domain, so visitor tracking just works, and there's one less subscription to pay for.

## Technical Architecture

| Layer | Technology |
| --- | --- |
| Site | Astro (static pages), with React only where it's needed: the canvas, moderation panel, and stats dashboard |
| Backend/Storage | Supabase (PostgreSQL + storage bucket) |
| Drawing pipeline | sharp and potrace trace approved drawings into SVGs at build time |
| Analytics | Custom-built tracking system |
| Hosting | ykabusalah.me, one site for the portfolio and the drawing app |

## Results and Lessons

Shipped a fully responsive drawing canvas with end-to-end submission flow, Supabase-powered storage and moderation, and a custom analytics system that provides deeper behavioral insight than Google Analytics could for this use case. Then rebuilt the portfolio around it, so the visitors' drawings are the first thing anyone sees.

Key takeaways:

- **Make the users' work the star.** My first redesign put my intro in a card over the drawing, and it hid the drawing. If visitors are the ones making the art, the art gets the whole page and I get the corner.
- **Upscaling isn't free.** A drawing that looks fine at its original size looks blurry at 3x. Tracing to vectors at build time fixed it without making visitors download anything extra.
- **True eraser beats white-brush workaround.** Using canvas compositing (`destination-out`) for the eraser improved UX meaningfully. The white-brush approach fails the moment you change backgrounds or export with transparency.
- **Snapshot-based undo is simpler than you'd expect.** Recording canvas state as image data on each stroke made undo/redo logic straightforward compared to tracking individual path coordinates.
- **Custom analytics paid for itself.** Generic analytics tools don't know what a "drawing session" is or what "modal abandonment" means in this context. Building purpose-specific tracking surfaced insights that wouldn't have been visible otherwise.
- **Fewer moving parts, fewer problems.** Cross-domain tracking between super.so and a subdomain took more work than expected. Putting everything on one site deleted that problem instead of solving it again.

## Roadmap

- Mobile drawing support with touch-optimized interface
- Color picker for multi-color drawings
- Additional brush types (spray, calligraphy)
- Public gallery of approved drawings
- Geolocation tracking to see which cities submissions come from
- Social sharing for submitted artwork
