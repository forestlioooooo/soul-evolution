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

### How to Get an NPM_TOKEN

Follow these steps to generate an npm access token and add it to the repository:

#### Step 1 — Create an npm account (skip if you already have one)

1. Go to [https://www.npmjs.com/signup](https://www.npmjs.com/signup)
2. Fill in your username, email address, and password
3. Verify your email address

#### Step 2 — Log in to npm

Go to [https://www.npmjs.com/login](https://www.npmjs.com/login) and sign in with your account.

#### Step 3 — Generate an Access Token

1. Click your **profile avatar** (top-right corner) → **Access Tokens**
   - Or go directly to [https://www.npmjs.com/settings/YOUR_USERNAME/tokens](https://www.npmjs.com/settings/)
2. Click **Generate New Token**
3. Choose **Granular Access Token** (recommended) or **Classic Token**
   - **Granular Access Token** (recommended):
     - **Token name**: give it a descriptive name, e.g. `soul-evolution-github-actions`
     - **Expiration**: choose an appropriate duration
     - **Packages and scopes → Permissions**: select **Read and write**
     - **Select packages**: choose **Only select packages and scopes**, then add `@openclaw/soul-evolution`
     - Click **Generate Token**
   - **Classic Token**:
     - Select the **Automation** type (this bypasses 2FA for CI/CD use)
     - Click **Generate Token**
4. **Copy the token immediately** — it will only be shown once

#### Step 4 — Add the token to GitHub repository secrets

1. Go to the repository: [https://github.com/forestlioooooo/soul-evolution](https://github.com/forestlioooooo/soul-evolution)
2. Click **Settings** (top navigation bar)
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Fill in:
   - **Name**: `NPM_TOKEN`
   - **Secret**: paste the token you copied from npm
6. Click **Add secret**

Once configured, the **Publish to npm** workflow will use this token automatically whenever you create a GitHub Release.

## License

MIT
