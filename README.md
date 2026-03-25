# soul-evolution

[![CI](https://github.com/forestlioooooo/soul-evolution/actions/workflows/ci.yml/badge.svg)](https://github.com/forestlioooooo/soul-evolution/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/soul-evolution)](https://www.npmjs.com/package/soul-evolution)

Automaton-style SOUL.md self-evolution plugin for OpenClaw 🦞🔮

## What It Does

The **soul-evolution** plugin lets an OpenClaw agent automatically evolve its `SOUL.md` file through self-reflection. Hidden signal markers (`<!-- SOUL_SIGNAL:… -->`) are embedded in assistant replies and collected over multiple conversations. When enough meaningful interactions accumulate, the plugin appends an evolution log entry to `SOUL.md`.

## Prerequisites

This plugin requires [OpenClaw](https://github.com/anthropics/openclaw) to be installed and configured.

### Install OpenClaw

```bash
npm install openclaw
```

After installation, initialize your OpenClaw project:

```bash
npx openclaw init
```

This creates the basic project structure including `openclaw.config.json`.

### Install the Plugin

```bash
npm install soul-evolution
```

## Configuration

Add the plugin to your OpenClaw project's configuration (e.g. `openclaw.config.json`):

```jsonc
{
  "plugins": [
    {
      "id": "soul-evolution",
      "package": "soul-evolution",
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

## License

MIT
