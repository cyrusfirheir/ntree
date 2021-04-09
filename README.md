# Narrative Tree (NTree)

Narrative Tree (NTree) library for SugarCube 2. This repository contains only the TypeScript source.

Documentation and more information can be found [here] (link coming soon.)

---

*This project was built on [SugarCube 2 + TypeScript project template](https://github.com/cyrusfirheir/sc2-ts-template).*

---

## Installation

- Clone this repository, or use it as a [template](https://docs.github.com/en/github/creating-cloning-and-archiving-repositories/creating-a-repository-from-a-template) to create your own.

- Run `npm i` (requires [Node](https://nodejs.org/en/)) to install all dependencies.

---

## Usage


- `npm run dev` to run in development mode. Starts Tweego and Webpack in watch mode, and launches a local web server with hot reload capabilities.

- `npm run build` to build the html in production mode. Compiles all TS to minified JS and builds with Tweego.

- The build commands are set to make Tweego include these directories/files:

	- `src/modules/`: (From the Tweego documentation)
		> Module sources (repeatable); may consist of supported files and/or directories to recursively search for such files. Each file will be wrapped within the appropriate markup and bundled into the `<head>` element of the compiled HTML. Supported files: `.css`, `.js`, `.otf`, `.ttf`, `.woff`, `.woff2`.

	- `src/head.html`: (From the Tweego documentation)
		> Name of the file whose contents will be appended as-is to the `<head>` element of the compiled HTML.

	- `src/__compiled/`: Compiled TypeScript ends up in here. Left upto webpack to manage. DO NOT put extra files in here, as this directory is cleaned out each time build commands are run.

	- `src/styles/`: All stylesheets go in here.

	- `src/twee/`: All Twee files go in here.

- The build commands are set to make Tweego export the generated html to `dist/index.html`. Thus, all assets go in `dist/`.

---

## Notes

- This project comes with example TypeScript and Twee code to showcase the toolchain working.

- The entry point for Webpack is set as `src/scripts/index.ts`, and the out directory as `src/__compiled`. To modify, look into [`webpack.config.js`](https://webpack.js.org/configuration/).

- TypeScript is set to transpile down to **ES2015** code. To modify, look into [`tsconfig.json`](https://www.typescriptlang.org/tsconfig).

---