# Mizu documentation site

[![Built with Starlight](https://astro.badg.es/v2/built-with-starlight/tiny.svg)](https://starlight.astro.build)

This is the Astro Starlight documentation site for Mizu.

## 🚀 Project Structure

Inside of your Astro + Starlight project, you'll see the following folders and files:

```
.
├── public/
├── src/
│   ├── assets/
│   ├── content/
│   │   └── docs/
│   └── content.config.ts
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

Starlight looks for `.md` or `.mdx` files in the `src/content/docs/` directory. Each file is exposed as a route based on its file name.

Images can be added to `src/assets/` and embedded in Markdown with a relative link.

Static assets, like favicons, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `pnpm install`               | Install all workspace dependencies              |
| `pnpm --dir docs/site dev`   | Start the local docs server                     |
| `pnpm --dir docs/site build` | Build the static site                           |
| `pnpm --dir docs/site preview` | Preview the production build                  |
| `pnpm --dir docs/site astro` | Run the Astro CLI                               |

## 👀 Want to learn more?

Documentation content lives in `src/content/docs/`. Check out [Starlight’s docs](https://starlight.astro.build/) or [the Astro documentation](https://docs.astro.build/) for framework details.
