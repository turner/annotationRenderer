class AnnotationRenderService {
    constructor(container, featureSource, featureRenderer) {

        this.featureSource = featureSource;
        this.featureRenderer = featureRenderer;

        this.boundResizeHandler = this.resizeCanvas.bind(this, container);
        window.addEventListener('resize', this.boundResizeHandler);

        // Initial resize
        this.resizeCanvas(container);
    }

    resizeCanvas(container) {
        const dpr = window.devicePixelRatio || 1;
        const { width, height } = container.getBoundingClientRect();

        // Set the canvas size in pixels
        const canvas = container.querySelector('canvas')
        canvas.width = width * dpr;
        canvas.height = height * dpr;

        // Scale the canvas context to match the device pixel ratio
        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr);

        // Set the canvas CSS size to match the container
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`

        if (this.drawConfig) {
            this.render(this.drawConfig);
        } else {
            ctx.clearRect(0, 0, width, height);
        }

    }

    async getFeatures(chr, start, end) {
        return await this.featureSource.getFeatures({chr, start, end})
    }   

    render(renderConfig) {

        const { container, bpStart, bpEnd } = renderConfig

        const canvas = container.querySelector('canvas')
        const { width:pixelWidth, height:pixelHeight } = canvas.getBoundingClientRect()

        const bpPerPixel = (bpEnd - bpStart) / pixelWidth
        const viewportWidth = pixelWidth
        
        const context = canvas.getContext('2d')
        this.drawConfig = { ...renderConfig, context, bpPerPixel, viewportWidth, pixelWidth, pixelHeight }
        this.featureRenderer.draw(this.drawConfig)
    }
}

export default AnnotationRenderService;
