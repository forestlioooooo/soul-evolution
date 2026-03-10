# soul-evolution

[![CI](https://github.com/forestlioooooo/soul-evolution/actions/workflows/ci.yml/badge.svg)](https://github.com/forestlioooooo/soul-evolution/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@openclaw/soul-evolution)](https://www.npmjs.com/package/@openclaw/soul-evolution)

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

## Publishing

Releases are published to npm automatically via GitHub Actions.

To publish a new version:

1. Update the version in `package.json` (e.g. `npm version patch`)
2. Push the version commit and tag (`git push --follow-tags`)
3. Create a [GitHub Release](https://github.com/forestlioooooo/soul-evolution/releases/new) from the tag

The **Publish to npm** workflow will run tests, build the package, and publish it to npm with provenance.

> **Setup**: The repository needs an `NPM_TOKEN` secret configured in **Settings → Secrets and variables → Actions**. Generate a token from [npmjs.com](https://www.npmjs.com/) with *Automation* type.

## License

MIT
