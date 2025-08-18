# 🧪 DarkroomPro - Professional Film Development Calculator

A precision calculator for film photographers and darkroom enthusiasts. Calculate exact development times, dilution ratios, and temperature compensations for any film stock and developer combination.

## Features

- **35+ Film Stocks**: Complete database of B&W and color films
- **20+ Developers**: Popular developers with precise dilution ratios
- **Temperature Compensation**: Automatic time adjustments for any temperature
- **Push/Pull Processing**: Accurate calculations for exposure compensation
- **Dilution Calculator**: Optimal developer-to-water ratios
- **Timer Integration**: Built-in development timer with alerts
- **Cross-Platform**: Desktop app for Windows, macOS, and Linux

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Desktop**: Tauri (Rust + Web Technologies)
- **Data**: JSON databases for film stocks and developers
- **Calculations**: Precise temperature and time compensation algorithms

## Development

### Web Version
```bash
npm run web:dev
# Opens at http://localhost:8000
```

### Desktop App
```bash
# Install dependencies
npm install

# Development mode
npm run tauri:dev

# Build for production
npm run tauri:build
```

## Quick Start

1. Select your film stock
2. Choose your developer
3. Set your temperature
4. Get precise development time and dilution ratio
5. Start developing with confidence!

*Perfect companion to FilmGrainPro for the complete analog workflow.*

## Building

### Prerequisites
- Node.js 18+
- Rust (for Tauri builds)
- Platform-specific build tools

### Commands
- `npm run dev` - Web development server
- `npm run tauri:dev` - Desktop development
- `npm run tauri:build` - Build desktop installers