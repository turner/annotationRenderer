import { knownGenomes } from './knownGenomes.js';
import Genome from './genome.js';
import TextFeatureSource from '../feature/textFeatureSource.js';
import QTLSelections from '../qtl/qtlSelections.js';
import FeatureRenderer from '../feature/featureRenderer.js';

class GenomeLibrary {
    constructor() {
    }

    async getGenomePayload(genomeId) {
        const config = knownGenomes[genomeId] || undefined;
        if (!config) {
            throw new Error(`Genome ${genomeId} not found`);
        }

        const genome = await Genome.createGenome(config)

        const [ refseqSelectTrackConfig ] = genome.config.tracks
        const geneFeatureSource = new TextFeatureSource({ ...refseqSelectTrackConfig, type: "annotation" })
    
        const browser = { genome, qtlSelections: new QTLSelections() }
        const geneRendererConfig = { format: "refgene", type: "annotation", displayMode: "COLLAPSED", browser }
    
        const geneRenderer = new FeatureRenderer(geneRendererConfig)
    
        return { genome, geneFeatureSource, geneRenderer }
    }
}

export default GenomeLibrary; 