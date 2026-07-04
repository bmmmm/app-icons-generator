# App Icons Generator

Generate every iOS, macOS & watchOS app icon size from a single 1024×1024 PNG — in your browser or from the command line.

![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)
![Live Demo](https://img.shields.io/badge/demo-live-success.svg)
![Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen.svg)
![Made with Canva](https://img.shields.io/badge/example%20icon-Canva-8B3DFF.svg)

<img src="example/app-icon-1024.png" width="180" alt="Example app icon: a nested-tiles size grid motif">

## Two ways to use it

### 1. Browser tool (any OS)

**[Open the live demo →](https://bmmmm.github.io/app-icons-generator/)**

A 100% client-side generator. Drop a PNG, and it renders all 32 icon sizes in-page using progressive high-quality Canvas downscaling, then packs a `.zip` you download — containing every size plus a ready-to-drag Xcode `AppIcon.appiconset`. Nothing is uploaded: the image never leaves your browser, and the ZIP itself is written by hand in JavaScript with no external libraries.

### 2. CLI (macOS)

`ios-icon-generator.sh` does the same job from the terminal using the built-in macOS `sips` command — no dependencies beyond macOS itself.

## Usage (CLI)

```bash
git clone https://github.com/bmmmm/app-icons-generator.git
cd app-icons-generator

./ios-icon-generator.sh example/app-icon-1024.png ./out

# -> ./out now holds Icon-16.png … Icon-1024.png (32 sizes)
```

```
USAGE: ios-icon-generator.sh [OPTIONS] srcfile dstpath

  srcfile - The source PNG image. Preferably above 1024x1024
  dstpath - The destination path where the icons are generated to
```

## What you get

Both the CLI and the browser tool generate the same 32 files, covering iOS, macOS and watchOS icon slots:

| Name | Size (px) | Name | Size (px) |
|---|---|---|---|
| Icon-16 | 16 | Icon-40@3x | 120 |
| Icon-16@2x | 32 | Icon-60@2x | 120 |
| Icon-20 | 20 | Icon-60@3x | 180 |
| Icon-20@2x | 40 | Icon-76 | 76 |
| Icon-20@3x | 60 | Icon-76@2x | 152 |
| Icon-24@2x | 48 | Icon-83.5@2x | 167 |
| Icon-27.5@2x | 55 | Icon-86@2x | 172 |
| Icon-29 | 29 | Icon-98@2x | 196 |
| Icon-29@2x | 58 | Icon-108@2x | 216 |
| Icon-29@3x | 87 | Icon-128 | 128 |
| Icon-32 | 32 | Icon-128@2x | 256 |
| Icon-32@2x | 64 | Icon-256 | 256 |
| Icon-40 | 40 | Icon-256@2x | 256 |
| Icon-40@2x | 80 | Icon-512 | 512 |
| Icon-44@2x | 88 | Icon-512@2x | 1024 |
| Icon-50@2x | 100 | Icon-1024 | 1024 |

The browser tool's `.zip` additionally bundles a valid `AppIcon.appiconset/Contents.json`, so the icon set drops straight into Xcode.

## Xcode drop-in

1. Unzip the download.
2. Drag the `AppIcon.appiconset` folder into your target's `Assets.xcassets`.
3. Set it as the app icon under **Target → General → App Icons and Launch Screen**.

The `all-icons/` folder in the same ZIP additionally contains every raw size, matching the shell script's output exactly.

## How it works

- **Browser tool** (`docs/app.js`): loads the source image as an `ImageBitmap`, downscales it via repeated Canvas halving for crisp results at small sizes (a single big downscale would look mushy), then forces each result to the target square — matching the behavior of `sips -z`. The `.zip` is assembled by hand (store/no-compression method, since PNGs are already compressed) with no external JS dependencies.
- **CLI script** (`ios-icon-generator.sh`): loops over the same name/size table and calls `sips -z <size> <size>` once per icon, matching to the system sRGB color profile when available.
- The size table is kept in lockstep between the two: `docs/app.js`'s `SIZES` array mirrors the script's `sizes_mapper` exactly.

## Repository layout

```
ios-icon-generator.sh     CLI script (bash + sips)
docs/                      GitHub Pages site (the browser tool)
  index.html
  app.js                   generation, preview grid, ZIP writer
  style.css
example/
  app-icon-1024.png        example source icon
  out/                     the 32 icons generated from it
LICENSE                    Apache License 2.0
NOTICE                     third-party attribution
```

## Requirements

- **CLI:** macOS with `sips` (ships with the OS — no install needed).
- **Browser tool:** any modern browser (Canvas API, `createImageBitmap`, `Blob`). Nothing to install, nothing to build.

## License

This repository is licensed under the **Apache License 2.0** (see [`LICENSE`](LICENSE)).

The exception is `ios-icon-generator.sh`, which is bundled from its original author under the **MIT License** (Copyright (c) 2018 smallmuou) — the original license header is retained verbatim in the file. See [`NOTICE`](NOTICE) for the full attribution.

## Credits

`ios-icon-generator.sh` is derived from [smallmuou/ios-icon-generator](https://github.com/smallmuou/ios-icon-generator) (MIT). The browser tool in `docs/` mirrors its size table and behavior, rebuilt from scratch for the browser.
