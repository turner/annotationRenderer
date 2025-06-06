import {StringUtils} from 'igv-utils'
import {prettyBasePairNumber, validateGenomicExtent} from "./util/igvUtils.js"
import GenomeUtils from "./genome/genomeUtils.js"

// Reference frame classes.  Converts domain coordinates (usually genomic) to pixel coordinates

class ReferenceFrame {

    constructor(genome, chr, start, end, bpPerPixel) {
        this.genome = genome
        this.chr = chr // this.genome.getChromosomeName(chr)
        this.start = start
        this.end = end
        this.bpPerPixel = bpPerPixel
    }

    get center() {
        return (this.start + this.end) / 2
    }

    get locusSearchString() {
        return `${this.chr}:${this.start + 1}-${this.end}`
    }

    /**
     * Extend this frame to accomodate the given locus.  Used th CircularView methods to merge 2 frames.
     * @param locus
     */
    extend(locus) {
        const newStart = Math.min(locus.start, this.start)
        const newEnd = Math.max(locus.end, this.end)
        const ratio = (newEnd - newStart) / (this.end - this.start)
        this.start = newStart
        this.end = newEnd
        this.bpPerPixel *= ratio
    }

    calculateEnd(pixels) {
        return this.start + this.bpPerPixel * pixels
    }

    calculateCenter(pixels) {
        return this.start + this.bpPerPixel * pixels / 2
    }

    calculateBPP(end, pixels) {
        return (end - this.start) / pixels
    }

    set(json) {
        this.chr = json.chr
        this.start = json.start
        this.bpPerPixel = json.bpPerPixel
    }

    toPixels(bp) {
        return bp / this.bpPerPixel
    }

    toBP(pixels) {
        return this.bpPerPixel * pixels
    }

    /**
     * Shift frame by delta in base pairs
     * @param delta
     */
    shift(delta) {
        this.start += delta
        this.end += delta
    }

    /**
     * Shift frame by stated pixels.  Return true if view changed, false if not.
     *
     * @param pixels
     * @param clamp -- if true "clamp" shift to prevent panning off edge of chromosome.  This is disabled if "show soft clipping" is on
     * @param viewportWidth
     */
    shiftPixels(pixels, viewportWidth, clamp) {

        const currentStart = this.start
        const deltaBP = pixels * this.bpPerPixel

        this.start += deltaBP

        if (clamp) {
            this.clampStart(viewportWidth)
        }

        this.end = this.start + viewportWidth * this.bpPerPixel

        return currentStart !== this.start
    }

    clampStart(viewportWidth) {
        // clamp left
        const min = (this.genome.getChromosome(this.chr).bpStart || 0)
        this.start = Math.max(min, this.start)

        // clamp right
        if (viewportWidth) {

            const {bpLength} = this.genome.getChromosome(this.chr)
            const maxStart = bpLength - (viewportWidth * this.bpPerPixel)

            if (this.start > maxStart) {
                this.start = maxStart
            }
        }
    }

    async zoomWithScaleFactor(browser, scaleFactor, viewportWidth, centerBPOrUndefined) {

        const centerBP = undefined === centerBPOrUndefined ? (this.start + this.toBP(viewportWidth / 2.0)) : centerBPOrUndefined

        // save initial start and bpp
        const initialStart = this.start
        const initialBpPerPixel = this.bpPerPixel
        const bpLength = this.getChromosome().bpLength
        const bppThreshold = scaleFactor < 1.0 ? browser.minimumBases() / viewportWidth : bpLength / viewportWidth

        // update bpp
        if (scaleFactor < 1.0) {
            this.bpPerPixel = Math.max(this.bpPerPixel * scaleFactor, bppThreshold)
        } else {
            this.bpPerPixel = Math.min(this.bpPerPixel * scaleFactor, bppThreshold)
        }

        // update start and end
        const widthBP = this.bpPerPixel * viewportWidth
        this.start = centerBP - 0.5 * widthBP
        this.clampStart(viewportWidth)

        this.end = this.start + widthBP

        const viewChanged = initialStart !== this.start || initialBpPerPixel !== this.bpPerPixel
        if (viewChanged) {
            await browser.updateViews(true)
        }

    }

    getChromosome() {
        return this.genome.getChromosome(this.chr)
    }

    /**
     * Update reference frame based on new viewport width
     * @param {number} viewportWidth - The calculated viewport width
     */
    updateForViewportWidth(viewportWidth) {
        const {chr} = this
        const {bpLength} = this.getChromosome()
        const viewportWidthBP = this.toBP(viewportWidth)

        // viewportWidthBP > bpLength occurs when locus is full chromosome and user widens browser
        if (GenomeUtils.isWholeGenomeView(chr) || viewportWidthBP > bpLength) {
            this.bpPerPixel = bpLength / viewportWidth
        } else {
            this.end = this.start + this.toBP(viewportWidth)
        }
    }

    getMultiLocusLabelBPLengthOnly(pixels) {
        const margin = '&nbsp'
        const space = '&nbsp &nbsp'
        const ss = Math.floor(this.start) + 1
        const ee = Math.round(this.start + this.bpPerPixel * pixels)
        return `${margin}${this.chr}${margin}${prettyBasePairNumber(ee - ss)}${margin}`
    }

    getMultiLocusLabelLocusOnly(pixels) {
        const margin = '&nbsp'
        const {chr, start, end} = this.getPresentationLocusComponents(pixels)
        return `${margin}${chr}:${start}-${end}${margin}`
    }

    getMultiLocusLabel(pixels) {
        const margin = '&nbsp'
        const space = '&nbsp &nbsp'
        const {chr, start, end} = this.getPresentationLocusComponents(pixels)
        const ss = Math.floor(this.start) + 1
        const ee = Math.round(this.start + this.bpPerPixel * pixels)
        return `${margin}${chr}:${start}-${end}${margin}${margin}(${prettyBasePairNumber(ee - ss)})${margin}`
    }

    getPresentationLocusComponents(pixels) {

        if ('all' === this.chr) {
            return {chr: this.chr}
        } else {
            const ss = StringUtils.numberFormatter(Math.floor(this.start) + 1)
            const ee = StringUtils.numberFormatter(Math.round(this.start + this.bpPerPixel * pixels))

            return {chr: this.chr, start: ss, end: ee}
        }

    }

    getLocusString() {
        if ('all' === this.chr) {
            return 'all'
        } else {
            const chrDisplayName = this.genome.getChromosomeDisplayName(this.chr)
            const ss = StringUtils.numberFormatter(Math.floor(this.start) + 1)
            const ee = StringUtils.numberFormatter(Math.round(this.end))
            return `${chrDisplayName}:${ss}-${ee}`
        }
    }

    description(blurb) {
        console.log(` ${blurb || ''} referenceFrame - ${this.chr} bpp ${this.bpPerPixel.toFixed(3)} start ${StringUtils.numberFormatter(Math.round(this.start))} end ${StringUtils.numberFormatter(Math.round(this.end))} `)
    }

    overlaps(interval) {
        return this.chr === interval.chr && this.end >= interval.start && interval.end >= this.start
    }

}

function createReferenceFrameList(loci, genome, browserFlanking, minimumBases, viewportWidth, isSoftclipped) {

    return loci.map(l => {

        const locus = Object.assign({}, l)  // Copy as we might mutate this object

        // If a flanking region is defined, and the search object is a feature (has a name) type, adjust start and end
        if (browserFlanking && locus.name) {
            locus.start = Math.max(0, locus.start - browserFlanking)
            locus.end += browserFlanking
        }

        // Validate the range.  This potentionally modifies start & end of locus.
        if (!isSoftclipped) {
            const chromosome = genome.getChromosome(locus.chr)
            validateGenomicExtent(chromosome.bpLength, locus, minimumBases)
        }

        const referenceFrame = new ReferenceFrame(
            genome,
            locus.chr,
            locus.start,
            locus.end,
            (locus.end - locus.start) / viewportWidth
        )

        return referenceFrame
    })
}


export {createReferenceFrameList}
export default ReferenceFrame
