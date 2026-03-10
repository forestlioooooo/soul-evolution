# soul-evolution

Automaton-style SOUL.md self-evolution plugin for OpenClaw 🦞🔮

## What It Does

The **soul-evolution** plugin lets an OpenClaw agent automatically evolve its `SOUL.md` file through self-reflection. Hidden signal markers (`<!-- SOUL_SIGNAL:… -->`) are embedded in assistant replies and collected over multiple conversations. When enough meaningful interactions accumulate, the plugin appends an evolution log entry to `SOUL.md`.

## Installation

```bash
npm install @openclaw/soul-evolution
```

## Configuration

Add the plugin to your OpenClaw project's configuration (e.g. `openclaw.config.json`):

```jsonc
{
  "plugins": [
    {
      "id": "soul-evolution",
      "package": "@openclaw/soul-evolution",
      "config": {
        "enabled": true,
        "maxSoulChars": 2000,
        "evolutionThreshold": 5,
        "autoReflectOnSessionEnd": true
      }
    }
  ]
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable / disable the plugin |
| `maxSoulChars` | `number` | `2000` | Maximum character count for SOUL.md before truncation |
| `evolutionThreshold` | `number` | `5` | Number of meaningful interactions before triggering an evolution log entry |
| `autoReflectOnSessionEnd` | `boolean` | `true` | Automatically write evolution entries when a session ends |

## Publishing (for contributors)

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Build**

   ```bash
   npm run build
   ```

3. **Run tests**

   ```bash
   npm test
   ```

4. **Publish to npm**

   ```bash
   npm publish --access public
   ```

   > The `prepublishOnly` script runs the build automatically before publishing.

## License

MIT
