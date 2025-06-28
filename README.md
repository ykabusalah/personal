# ✏️ Drawing Canvas Web App

A minimalist fullscreen web canvas where users can draw and submit their artwork to potentially be featured on a personal portfolio site.

## 🌟 Features

- **Fullscreen Canvas**: Users draw directly on a responsive, edge-to-edge canvas.
- **Vertical Toolbar**: Tools are presented in a sleek vertical layout on the right.
- **Tools Included**:
  - Brush (with size slider)
  - Eraser
  - Undo (per-stroke)
  - Clear (trash)
  - Save (submits drawing with name)
  - Exit (goes to custom homepage)
- **Undo Support**: Each stroke (from press to release) is recorded and can be undone step-by-step.
- **Responsive**: Canvas resizes dynamically while preserving drawing and tool settings.
- **Submission Flow**:
  - Prompts user for name + terms agreement
  - Stores drawings in Supabase bucket
  - Metadata saved to Supabase `drawings` table for moderation

## 🧠 Tech Stack

- **Frontend**: React + TailwindCSS
- **Backend/Storage**: Supabase (for image storage + moderation)
- **Icon Library**: Lucide React
- **Confetti**: canvas-confetti for celebratory feedback

## 📂 Folder Structure

```
src/
├── App.jsx              # Main drawing canvas
├── Info.jsx             # Pre-draw explanation screen
├── ThankYou.jsx         # Post-submission confirmation
├── ModerationPanel.jsx  # Admin moderation UI
├── index.js             # Route setup
├── index.css            # Global styles and custom slider
```

## 🛠 Setup

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev
```

## 🔒 Supabase

- Drawing images are stored in `drawing-bucket`.
- Table `drawings` holds:
  - `name`
  - `image_url`
  - `status` (e.g. pending, approved)

Enable public read access for the bucket, and secure writes via RLS or your app logic.

## 📝 Todo

- [ ] Add keyboard shortcuts for undo (`Ctrl+Z`)
- [ ] Prevent drawing under toolbar
- [ ] Mobile drawing restrictions
- [ ] Dark mode toggle (optional)

---

### ✨ Created by [Yousef Abu-Salah](https://ykabusalah.me)
