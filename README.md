# Annotation Renderer

A web-based genome annotation visualization tool built with IGV (Integrative Genomics Viewer) utilities. This project provides a simple and efficient way to render genomic annotations and features in a web browser.

## Features

- Genome annotation visualization
- Support for multiple genome builds (currently configured for hg19)
- Interactive feature rendering
- Efficient data loading and rendering
- Built with modern web technologies

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/annotationRenderer.git
cd annotationRenderer
```

2. Install dependencies:
```bash
npm install
```

## Development

To start the development server:

```bash
npm run dev
```

This will start the Vite development server, typically at `http://localhost:5173`.

## Building for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

- `src/` - Source code directory
  - `main.js` - Main application entry point
  - `annotationRenderService.js` - Core annotation rendering service
  - `annotationRenderServiceFactory.js` - Factory for creating render services
  - `igvCore/` - IGV utilities and core functionality

## Usage

The annotation renderer can be used to visualize genomic features by providing:
- Chromosome
- Start position
- End position
- Feature data

Example usage:
```javascript
const renderService = createAnnotationRenderService(container, genome);
const features = await renderService.getFeatures('chr16', 26716013, 29371136);
renderService.render({ 
    chr: 'chr16', 
    bpStart: 26716013, 
    bpEnd: 29371136, 
    features 
});
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the terms of the license included in the [LICENSE](LICENSE) file.

## Acknowledgments

- Built with [IGV-utils](https://github.com/igvteam/igv-utils)
- Powered by [Vite](https://vitejs.dev/)

