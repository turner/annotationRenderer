import {StringUtils} from 'igv-utils'
import Chromosome from "./chromosome.js"
import {loadSequence} from "./loadSequence.js"
import ChromAliasBB from "./chromAliasBB.js"
import ChromAliasFile from "./chromAliasFile.js"
import CytobandFileBB from "./cytobandFileBB.js"
import CytobandFile from "./cytobandFile.js"

import {loadChromSizes} from "./chromSizes.js"
import ChromAliasDefaults from "./chromAliasDefaults.js"

const ucsdIDMap = new Map([
    ["1kg_ref", "hg18"],
    ["1kg_v37", "hg19"],
    ["b37", "hg19"]
])

/**
 * The Genome class represents an assembly and consists of the following elements
 *   sequence - Object representing the DNA sequence
 *   chromosomes - Objects with chromosome meta data including name, length, and alternate names (aliases)
 *   aliases - table of chromosome name aliases (optional)
 *   cytobands - cytoband data for drawing an ideogram (optional)
 */

class Genome {

    #wgChromosomeNames
    #aliasRecordCache = new Map()

    static async createGenome(options) {

        const genome = new Genome(options)
        await genome.init()
        return genome
    }

    constructor(config) {
        this.config = config
        this.id = config.id || generateGenomeID(config)
        this.ucscID = config.ucscID || ucsdIDMap.get(this.id) || this.id
        this.blatDB = config.blatDB || this.ucscID
        this.name = config.name
        this.nameSet = config.nameSet || 'ucsc'
    }


    async init() {

        const config = this.config

        // Load sequence
        this.sequence = await loadSequence(config)

        // Load cytobands.  This is optional but required to support the ideogram.  Only needed for whole genome view
        if(false !== config.showIdeogram && false !== config.wholeGenomeView) {
            if (config.cytobandURL) {
                this.cytobandSource = new CytobandFile(config.cytobandURL, Object.assign({}, config))
            } else if (config.cytobandBbURL) {
                this.cytobandSource = new CytobandFileBB(config.cytobandBbURL, Object.assign({}, config), this)
            }
        }

            // Search for chromosomes, that is an array of chromosome objects containing name and length.  This is
            // optional but required to support whole genome view.
        if (this.sequence.chromosomes) {
            this.chromosomes = this.sequence.chromosomes
        } else if (config.chromSizesURL) {
            this.chromosomes = await loadChromSizes(config.chromSizesURL)
        } else {
            this.chromosomes = new Map()   // Cache, chromosome are added as they are loaded
        }

        // Search for chromosome names.  This is optional but required to support the chromosome pulldown
        if (this.sequence.chromosomeNames) {
            this.chromosomeNames = this.sequence.chromosomeNames    // Twobit files can supply chromosome names unless they use an external index
        } else if (this.chromosomes.size > 0) {
            this.chromosomeNames = Array.from(this.chromosomes.keys())
        }

        // Chromosome alias
        if (config.chromAliasBbURL) {
            this.chromAlias = new ChromAliasBB(config.chromAliasBbURL, Object.assign({}, config), this)
        } else if (config.aliasURL) {
            this.chromAlias = new ChromAliasFile(config.aliasURL, Object.assign({}, config), this)
        } else if (this.chromosomeNames) {
            this.chromAlias = new ChromAliasDefaults(this.id, this.chromosomeNames)
        }

        if (false !== config.wholeGenomeView && this.chromosomes.size > 0) {
            // Set chromosome order for WG view and chromosome pulldown.  If chromosome order is not specified sort
            if (config.chromosomeOrder) {
                if (Array.isArray(config.chromosomeOrder)) {
                    this.#wgChromosomeNames = config.chromosomeOrder
                } else {
                    this.#wgChromosomeNames = config.chromosomeOrder.split(',').map(nm => nm.trim())
                }
                // Trim to remove non-existent chromosomes
                await this.chromAlias.preload(this.#wgChromosomeNames)
                this.#wgChromosomeNames =
                    this.#wgChromosomeNames.map(c =>  this.getChromosomeName(c)).filter(c => this.chromosomes.has(c))
            } else {
                this.#wgChromosomeNames = trimSmallChromosomes(this.chromosomes)
                await this.chromAlias.preload(this.#wgChromosomeNames)
            }
        }

        // Optionally create the psuedo chromosome "all" to support whole genome view
        this.wholeGenomeView = config.wholeGenomeView !== false && this.#wgChromosomeNames && this.chromosomes.size > 1
        if (this.wholeGenomeView) {
            const l = this.#wgChromosomeNames.reduce((accumulator, currentValue) => accumulator += this.chromosomes.get(currentValue).bpLength, 0)
            this.chromosomes.set("all", new Chromosome("all", 0, l))
        }
    }

    get description() {
        return this.config.description || `${this.id}\n${this.name}`
    }

    get infoURL() {
        return this.config.infoURL
    }

    showWholeGenomeView() {
        return this.wholeGenomeView
    }

    /**
     * Return a json like object representing the current state.  The tracks collection is nullified
     * as tracks are transferred to the browser object on loading.
     *
     * @returns {any}
     */
    toJSON() {
        return Object.assign({}, this.config, {tracks: undefined})
    }

    get initialLocus() {
        return this.config.locus ? this.config.locus : this.getHomeChromosomeName()
    }

    getHomeChromosomeName() {
        if (this.showWholeGenomeView() && this.chromosomes.has("all")) {
            return "all"
        } else if (this.chromosomeNames) {
            return this.chromosomeNames[0]
        } else {

        }
    }

    getChromosomeName(chr) {
        return this.chromAlias ? this.chromAlias.getChromosomeName(chr, this.chromosomes.keys()) : chr
    }

    getChromosomeDisplayName(str) {
        if (this.nameSet && this.chromAlias) {
            return this.chromAlias.getChromosomeAlias(str, this.nameSet) || str
        } else {
            return str
        }
    }

    getChromosome(chr) {
        if (this.chromAlias) {
            chr = this.chromAlias.getChromosomeName(chr)
        }
        return this.chromosomes.get(chr)
    }

    async loadChromosome(chr) {

        const chromAliasRecord = await this.getAliasRecord(chr)
        if (chromAliasRecord) {
            chr = chromAliasRecord.chr
        }

        if (!this.chromosomes.has(chr)) {
            let chromosome
            const sequenceRecord = await this.sequence.getSequenceRecord(chr)
            if (sequenceRecord) {
                chromosome = new Chromosome(chr, 0, sequenceRecord.bpLength)
            }

            this.chromosomes.set(chr, chromosome)  // <= chromosome might be undefined, setting it prevents future attempts
        }

        return this.chromosomes.get(chr)
    }

    async getAliasRecord(chr) {
        if (this.#aliasRecordCache.has(chr)) {
            return this.#aliasRecordCache.get(chr)
        }
        if (this.chromAlias) {
            let aliasRecord = await this.chromAlias.search(chr)
            if (!aliasRecord && chr !== chr.toLowerCase()) {
                aliasRecord = await this.chromAlias.search(chr.toLowerCase())
            }
            if (aliasRecord) {
                // Add some aliases for case insensitivy
                const upper = aliasRecord.chr.toUpperCase()
                const lower = aliasRecord.chr.toLowerCase()
                const cap = aliasRecord.chr.charAt(0).toUpperCase() + aliasRecord.chr.slice(1)
                if (aliasRecord.chr !== upper) {
                    aliasRecord["_uppercase"] = upper
                }
                if (aliasRecord.chr !== lower) {
                    aliasRecord["_lowercase"] = lower
                }
                if (aliasRecord.chr !== cap) {
                    aliasRecord["_cap"] = cap
                }
            }
            this.#aliasRecordCache.set(chr, aliasRecord)  // Set even if undefined to prevent recurrent searches
            return aliasRecord
        }
    }

    async getCytobands(chr) {
        if (this.cytobandSource) {
            const chrName = this.getChromosomeName(chr)
            const cytos = await this.cytobandSource.getCytobands(chrName)
            return cytos
        }
    }

    getChromosomes() {
        return this.chromosomes
    }

    get wgChromosomeNames() {
        return this.#wgChromosomeNames ? this.#wgChromosomeNames.slice() : undefined
    }

    get showChromosomeWidget() {
        return this.config.showChromosomeWidget
    }

    /**
     * Return the genome coordinate in kb for the give chromosome and position.
     * NOTE: This might return undefined if the chr is filtered from whole genome view.
     */
    getGenomeCoordinate(chr, bp) {

        var offset = this.getCumulativeOffset(chr)
        if (offset === undefined) return undefined

        return offset + bp
    }

    /**
     * Return the chromosome and coordinate in bp for the given genome coordinate
     */
    getChromosomeCoordinate(genomeCoordinate) {

        if (this.cumulativeOffsets === undefined) {
            this.cumulativeOffsets = computeCumulativeOffsets.call(this)
        }

        let lastChr = undefined
        let lastCoord = 0
        for (let name of this.#wgChromosomeNames) {

            const cumulativeOffset = this.cumulativeOffsets[name]
            if (cumulativeOffset > genomeCoordinate) {
                const position = genomeCoordinate - lastCoord
                return {chr: lastChr, position: position}
            }
            lastChr = name
            lastCoord = cumulativeOffset
        }

        // If we get here off the end
        return {chr: this.#wgChromosomeNames[this.#wgChromosomeNames.length - 1], position: 0}

    };


    /**
     * Return the offset in genome coordinates (kb) of the start of the given chromosome
     * NOTE:  This might return undefined if the chromosome is filtered from whole genome view.
     */
    getCumulativeOffset(chr) {

        if (this.cumulativeOffsets === undefined) {
            this.cumulativeOffsets = computeCumulativeOffsets.call(this)
        }

        const queryChr = this.getChromosomeName(chr)
        return this.cumulativeOffsets[queryChr]

        function computeCumulativeOffsets() {

            let acc = {}
            let offset = 0
            for (let name of this.#wgChromosomeNames) {
                acc[name] = Math.floor(offset)
                const chromosome = this.getChromosome(name)
                offset += chromosome.bpLength
            }

            return acc
        }
    }

    /**
     * Return the nominal genome length, this is the length of the main chromosomes (no scaffolds, etc).
     */
    getGenomeLength() {

        if (!this.bpLength) {
            let bpLength = 0
            for (let cname of this.#wgChromosomeNames) {
                let c = this.chromosomes.get(cname)
                bpLength += c.bpLength
            }
            this.bpLength = bpLength
        }
        return this.bpLength
    }

    async getSequence(chr, start, end) {
        chr = this.getChromosomeName(chr)
        return this.sequence.getSequence(chr, start, end)
    }

    /**
     * Return loaded sequence (i.e. cached or otherwise loaded) spanning the given region.  If no sequence has been
     * loaded returns undefined.
     *
     * @param chr
     * @param start
     * @param end
     */
    getSequenceInterval(chr, start, end) {
        if (typeof this.sequence.getSequenceInterval === 'function') {
            return this.sequence.getSequenceInterval(chr, start, end)
        } else {
            return undefined
        }
    }

    getHubURLs() {
        return this.config.hubs
    }
}

/**
 * Trim small sequences (chromosomes) and return the list of trimmed chromosome names.
 * The results are used to construct the whole genome view and optionally chromosome pulldown
 * *
 * @param config - the "reference" configuration object
 * @returns {string|*|*[]|string[]}
 */
function trimSmallChromosomes(chromosomes) {

    const wgChromosomeNames = []
    let runningAverage
    let i = 1
    for (let c of chromosomes.values()) {
        if (!runningAverage) {
            runningAverage = c.bpLength
            wgChromosomeNames.push(c.name)
        } else {
            if (c.bpLength < runningAverage / 100) {
                continue
            }
            runningAverage = ((i - 1) * runningAverage + c.bpLength) / i
            wgChromosomeNames.push(c.name)
        }
        i++
    }
    return wgChromosomeNames
}

function isDigit(val) {
    return /^\d+$/.test(val)
}

function generateGenomeID(config) {
    if (config.id !== undefined) {
        return config.id
    } else if (config.fastaURL && StringUtils.isString(config.fastaURL) && !config.fastaURL.startsWith("data:")) {
        return config.fastaURL
    } else if (config.fastaURL && config.fastaURL.name) {
        return config.fastaURL.name
    } else {
        return ""
    }
}

export default Genome
