import GenomeLibrary from './igvCore/genome/genomeLibrary.js'
import AnnotationRenderService from './annotationRenderService.js'

let annotationRenderService
let genomeLibrary
document.addEventListener('DOMContentLoaded', async () => {

    const genomeId = 'hg19'   

    genomeLibrary = new GenomeLibrary()
    const {genome, geneFeatureSource, geneRenderer} = await genomeLibrary.getGenomePayload(genomeId)

    const container = document.querySelector('#dat-gene-render-container')
    annotationRenderService = new AnnotationRenderService(container, geneFeatureSource, geneRenderer)

    // random locus
    const chr = 'chr16'
    const bpStart = 26716013
    const bpEnd = 29371136

    const features = await annotationRenderService.getFeatures(chr, bpStart, bpEnd)

    annotationRenderService.render({ container, chr, bpStart, bpEnd, features })
});
