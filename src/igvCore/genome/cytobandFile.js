import {buildOptions, isDataURL} from "../util/igvUtils.js"
import {BGZip, igvxhr, StringUtils} from "igv-utils"
import {Cytoband} from "./cytoband.js"
import Chromosome from "./chromosome.js"

class CytobandFile {

    cytobands = new Map()

    constructor(url, config) {
        this.url = url;
        this.config = config;
    }

    async getCytobands(chr) {
        if(this.cytobands.size === 0) {
            await this.#loadCytobands()
        }
        return this.cytobands.get(chr)
    }


    /**
     * Load a UCSC bigbed cytoband file. Features are in bed+4 format.
     * {
     *   "chr": "chr1",
     *   "start": 0,
     *   "end": 1735965,
     *   "name": "p36.33",
     *   "gieStain": "gneg"
     * }
     * @returns {Promise<*[]>}
     */
    async #loadCytobands() {

        let data
        if (isDataURL(this.url)) {
            const plain = BGZip.decodeDataURI(this.url)
            data = ""
            const len = plain.length
            for (let i = 0; i < len; i++) {
                data += String.fromCharCode(plain[i])
            }
        } else {
            data = await igvxhr.loadString(this.url, buildOptions(this.config))
        }

        let lastChr
        let bands = []
        const lines = StringUtils.splitLines(data)
        for (let line of lines) {

            const tokens = line.split("\t")
            const chrName = tokens[0]
            if (!lastChr) lastChr = chrName

            if (chrName !== lastChr) {
                this.cytobands.set(lastChr, bands)
                bands = []
                lastChr = chrName
            }

            if (tokens.length === 5) {
                //10	0	3000000	p15.3	gneg
                const start = parseInt(tokens[1])
                const end = parseInt(tokens[2])
                const name = tokens[3]
                const stain = tokens[4]
                bands.push(new Cytoband(start, end, name, stain))
            }
        }
        if(bands.length > 0) {
            this.cytobands.set(lastChr, bands)
        }

    }

}

export default CytobandFile

