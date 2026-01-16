# Personal Website

My personal website hosted using ReactJS, Supabase, & Super.so that utilizes a minimalist, full-screen web canvas where visitors can draw, save, and submit artwork. Built as an interactive engagement feature for my personal portfolio, complete with a custom analytics system and admin dashboard for tracking engagement and moderating submissions.

**Home Page:** [ykabusalah.me](https://ykabusalah.me)

**Drawing Canvas:** [draw.ykabusalah.me](https://draw.ykabusalah.me)

---

## Architecture Overview

The project uses a hybrid architecture that combines a no-code platform with custom React development:

- **Main Portfolio (ykabusalah.me):** Hosted on Super.so, a Notion-based website builder. This allows for easy content updates and management without redeploying code.
- **Drawing App (draw.ykabusalah.me):** A separate React application deployed on its own subdomain, handling all the interactive canvas functionality, submissions, and admin features.
- **Cross-Domain Connection:** A lightweight JavaScript snippet embedded in Super.so's custom code footer tracks visitor activity and passes a unique visitor ID to the React app via URL parameters, enabling unified analytics across both platforms.

This approach keeps content management simple while allowing full control over the interactive drawing experience and custom analytics.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [File Structure](#file-structure)
- [Routes](#routes)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Admin Features](#admin-features)
- [Custom Analytics System](#custom-analytics-system)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [License](#license)

---

## Features

### Drawing Canvas
- Full-viewport, edge-to-edge drawing area
- Dynamic resizing that preserves existing strokes on window resize
- Adjustable brush size (1-20px) via custom triangle-shaped slider
- True eraser using canvas `globalCompositeOperation: 'destination-out'`
- Complete undo/redo history with full state snapshots
- Clear canvas functionality with history reset
- Mobile device detection with desktop guidance
- Minimum window size enforcement (800x600px)

### User Interface
- Clean, minimalist landing page with live counter of featured drawings
- Right-aligned sticky vertical toolbar with Lucide React icons
- Press-state feedback with button inversion and active tool highlighting
- Animated call-to-action button with pencil icon rotation on hover
- Pulsing indicator on the featured count badge

### Submission Flow
- Save modal with name entry and terms agreement
- Image upload to Supabase storage with RLS-protected insert policy
- Confetti celebration feedback on successful submission
- Real-time status tracking (pending, approved, rejected)

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | React 18, TailwindCSS, Lucide React |
| Effects | canvas-confetti |
| Backend/Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage (drawing-bucket) |
| Authentication | Supabase Auth |
| Analytics | Custom-built tracking system |
| Hosting | Custom subdomain (draw.ykabusalah.me) |
| Version Control | Git/GitHub |

---

## File Structure

```
src/
├── index.js             # Route setup (React Router)
├── index.css            # Global styles + custom slider CSS
├── analytics.js         # Custom analytics tracking
├── App.jsx              # Main drawing canvas
├── Info.jsx             # Landing/intro page
├── ThankYou.jsx         # Post-submission confirmation
├── ModerationPanel.jsx  # Admin panel for approving drawings
├── Statistics.jsx       # Analytics dashboard (admin only)
```

---

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | Redirect | Redirects to `/info` |
| `/info` | Info | Welcome page explaining the concept |
| `/draw` | App | Main drawing canvas |
| `/thank-you` | ThankYou | Shown after successful submission |
| `/moderate` | ModerationPanel | Admin login + approval interface |
| `/stats` | Statistics | Analytics dashboard (requires auth) |

---

## Database Schema

### Table: `drawings`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Submitter's name (optional) |
| image_url | text | Public URL to stored image |
| status | text | 'pending', 'approved', or 'rejected' |
| created_at | timestamp | Submission time |

### Table: `analytics`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| session_id | text | Unique per browser session |
| event_name | text | Event type (page_view, tool_change, etc.) |
| event_data | jsonb | Event-specific data + visitor_id |
| device_type | text | 'desktop', 'mobile', or 'tablet' |
| screen_width | int | Browser width |
| screen_height | int | Browser height |
| created_at | timestamp | Event time |

---

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account and project

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/drawing-canvas.git
   cd drawing-canvas
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory:
   ```env
   REACT_APP_SUPABASE_URL=your_supabase_url
   REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Set up Supabase:
   - Create a `drawings` table with the schema above
   - Create an `analytics` table with the schema above
   - Create a storage bucket named `drawing-bucket`
   - Configure RLS policies (anonymous inserts for analytics, authenticated reads)

5. Start the development server:
   ```bash
   npm start
   ```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `P` | Switch to Pencil |
| `E` | Switch to Eraser |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `[` | Decrease brush size |
| `]` | Increase brush size |
| `Ctrl+S` | Open save modal |
| `Delete` / `Backspace` | Clear canvas |
| `Escape` | Close modals |

---

## Admin Features

### Moderation Panel (`/moderate`)

- Supabase Auth login required
- Card-based grid layout for pending submissions
- Click-to-enlarge image preview in modal overlay
- One-click approve/reject actions with real-time updates
- Stats cards showing pending, approved, and rejected counts
- Navigation link to Statistics dashboard

---

## Custom Analytics System

Built a custom analytics system from scratch to replace Google Analytics, providing more relevant metrics for tracking user behavior through the drawing funnel.

### Architecture

The system consists of three main components:

**1. analytics.js - Event Tracking Utility**

A lightweight tracking module that sends events directly to a Supabase `analytics` table. Each event includes:
- `session_id`: Generated using timestamp + random string, stored in `sessionStorage` (unique per browser tab)
- `visitor_id`: Generated similarly but stored in `localStorage` (persists across sessions for returning visitor tracking)
- `event_name`: The type of action being tracked
- `event_data`: JSON object with event-specific details
- `device_type`: Detected via user agent parsing (desktop/mobile/tablet)
- `screen_width` / `screen_height`: Viewport dimensions at time of event

Exported tracking functions:
```javascript
trackPageView(page)
trackDrawingStart(tool, brushSize)
trackToolChange(tool, previousTool)
trackBrushSize(size)
trackUndo()
trackRedo()
trackClear()
trackSubmitStart()
trackSubmitSuccess(hasName)
trackSubmitError(error)
trackExit(confirmed)
trackModalClose()
```

**2. Cross-Domain Tracking (Super.so Integration)**

Since the main portfolio (ykabusalah.me) is hosted on Super.so and the drawing app (draw.ykabusalah.me) is a separate React app, a lightweight tracking snippet is embedded in Super.so's custom code footer:

- Tracks `page_view` events on the home page
- Tracks `draw_link_click` when visitors click the draw button
- Passes the `visitor_id` to the drawing app via URL parameter (`?vid=...`)
- The drawing app reads the `vid` parameter, stores it in localStorage, and cleans the URL using `window.history.replaceState()`

This enables tracking the complete user journey from portfolio visit through drawing submission.

**3. Statistics.jsx - Analytics Dashboard**

An authenticated admin dashboard that queries the `analytics` table and calculates metrics using time-range filters (7/30/90/365 days or all-time).

### Metrics Tracked

**Traffic and Conversion:**
- Full conversion funnel: Home -> Draw Click -> Info -> Draw -> Submit
- Step-by-step conversion rates between each stage
- Direct vs referred visitor breakdown (from home page vs direct URL)
- Click-through rate from home page to drawing app
- Full funnel completion rate

**Drop-off Analysis:**
- Home page bounce rate
- Info page drop-off (clicked draw but left on info)
- Info page bounce rate
- Modal abandonment rate (opened save modal but didn't submit)

**Drawing Behavior:**
- Undo/redo frequency and average per session
- Most popular brush sizes
- Brush size change frequency
- Average time on draw page before submitting
- Canvas clear frequency
- Drawing completion rate

**Visitor Analytics:**
- Unique sessions and page views
- Returning visitor rate (tracked via persistent visitor_id in localStorage)
- Total visitor count over time

**Activity Patterns:**
- Activity heatmap by hour of day
- Activity breakdown by day of week
- Monthly activity trends

**Submission Stats:**
- Approval rate percentage
- Approved/rejected/pending counts
- Exit button behavior (confirmed vs cancelled)

### Why Custom Over Google Analytics

- More granular control over exactly what events are tracked
- Direct access to raw data in Supabase for custom queries
- No third-party dependencies or cookie consent requirements
- Metrics tailored specifically to the drawing app funnel
- Cross-domain tracking without complex GA configuration

---

## Environment Variables

```env
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
```

### Supabase RLS Policies

- `analytics`: Anonymous inserts allowed, authenticated reads only
- `drawings`: Configure based on your needs (public read for approved, authenticated for all)

---

## Deployment

Currently deployed at `draw.ykabusalah.me` as a subdomain connected to the main portfolio site hosted on Super.so.

```bash
npm run build
```

---

## License

This project is open source and available under the MIT License.

---

Created by Yousef Abu-Salah
