# AGENTS.md

## Cursor Cloud specific instructions

This is a React + Vite static personal/academic website. No backend, no database, no external APIs at runtime.

**Single service:** Vite dev server on port 5173 via `npm run dev`.

**Standard commands** (see `package.json` scripts):
- Lint: `npm run lint`
- Build: `npm run build`
- Dev server: `npm run dev`

**Notes:**
- The build script copies `cv/cv.pdf` into `public/cv/` before running Vite build; this gracefully skips if the PDF is missing (LaTeX toolchain not required for dev).
- The headshot theme cycles on click (forest → desert → snow). The cart-pole simulation at page bottom runs a PPO policy in-browser from a bundled JSON weights file.
- The Python RL training script (`scripts/train_cartpole_ppo.py`) and LaTeX CV build (`cv/Makefile`) are offline tooling and not needed for normal website development.
