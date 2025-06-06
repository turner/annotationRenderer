/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2014-2015 Broad Institute
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import {FeatureCache} from 'igv-utils'
import {computeWGFeatures, findFeatureAfterCenter, packFeatures} from "./featureUtils.js"
import BaseFeatureSource from "./baseFeatureSource.js"

/**
 * feature source for features supplied directly, as opposed to reading and parsing from a file or webservice
 *
 * @param config
 * @constructor
 */
class StaticFeatureSource extends BaseFeatureSource {

    constructor(config, genome) {

        super(genome)
        this.config = config
        this.genome = genome
        this.queryable = false
        this.searchable = config.searchable !== false  // searchable by default
        this.updateFeatures(config.features)
    }

    updateFeatures(features) {
        features = fixFeatures(features, this.genome)
        packFeatures(features)
        if (this.config.mappings) {
            mapProperties(features, this.config.mappings)
        }
        this.featureCache = new FeatureCache(features, this.genome)

        if (this.searchable || this.config.searchableFields) {
            this.addFeaturesToDB(features, this.config)
        }
    }

    /**
     * Required function for all data source objects.  Fetches features for the
     * range requested.
     *
     * This function is complex due to the variety of reader types backing it, some indexed, some queryable,
     * some not.
     *
     * @param chr
     * @param start
     * @param end
     * @param bpPerPixel
     */
    async getFeatures({chr, start, end, bpPerPixel, visibilityWindow}) {

        const genome = this.genome
        const queryChr = genome ? genome.getChromosomeName(chr) : chr
        const isWholeGenome = ("all" === queryChr.toLowerCase())

        // Various conditions that can require a feature load
        //   * view is "whole genome" but no features are loaded
        //   * cache is disabled
        //   * cache does not contain requested range
        if (isWholeGenome) {
            return computeWGFeatures(this.featureCache.getAllFeatures(), this.genome, this.maxWGCount)
        } else {
            return this.featureCache.queryFeatures(queryChr, start, end)
        }
    }

    //
    // supportsWholeGenome() {
    //    return true
    // }

    getAllFeatures() {
        return this.featureCache.getAllFeatures()
    }

    supportsWholeGenome() {
        return true
    }

    addFeaturesToDB(featureList, config) {
        if (!this.featureMap) {
            this.featureMap = new Map()
        }
        const searchableFields = config.searchableFields || ["name"]
        for (let feature of featureList) {
            for (let field of searchableFields) {
                let key

                if (typeof feature.getAttributeValue === 'function') {
                    key = feature.getAttributeValue(field)
                }
                if (!key) {
                    key = feature[field]
                }
                if (key) {
                    key = key.replaceAll(' ', '+')
                    const current = this.featureMap.get(key.toUpperCase())
                    if (current && ((current.end - current.start) > (feature.end - feature.start))) continue
                    this.featureMap.set(key.toUpperCase(), feature)
                }
            }
        }
    }

    search(term) {
        if (this.featureMap) {
            return this.featureMap.get(term.toUpperCase())
        }
    }
}


/**
 * This function is used to apply properties normally added during parsing to  features supplied directly in the
 * config as an array of objects.   At the moment the only application is bedpe type features.
 * @param features
 */
function fixFeatures(features, genome) {

    if (genome) {
        for (let feature of features) {
            feature.chr = genome.getChromosomeName(feature.chr)
        }
    }

    return features
}


function mapProperties(features, mappings) {
    let mappingKeys = Object.keys(mappings)
    features.forEach(function (f) {
        mappingKeys.forEach(function (key) {
            f[key] = f[mappings[key]]
        })
    })
}

/**
 * This function is used to apply properties normally added during parsing to  features supplied directly in the
 * config as an array of objects.   At the moment the only application is bedpe type features.
 * @param features
 */
// function fixFeatures(features, genome) {
//
//     if (!features || features.length === 0) return []
//
//     const isBedPE = features[0].chr === undefined && features[0].chr1 !== undefined
//     if (isBedPE) {
//         const interChrFeatures = []
//         for (let feature of features) {
//
//             if (genome) {
//                 feature.chr1 = genome.getChromosomeName(feature.chr1)
//                 feature.chr2 = genome.getChromosomeName(feature.chr2)
//             }
//
//             // Set total extent of feature
//             if (feature.chr1 === feature.chr2) {
//                 feature.chr = feature.chr1
//                 feature.start = Math.min(feature.start1, feature.start2)
//                 feature.end = Math.max(feature.end1, feature.end2)
//             } else {
//                 interChrFeatures.push(feature)
//             }
//         }
//
//         // Make copies of inter-chr features, one for each chromosome
//         for (let f1 of interChrFeatures) {
//             const f2 = Object.assign({dup: true}, f1)
//             features.push(f2)
//
//             f1.chr = f1.chr1
//             f1.start = f1.start1
//             f1.end = f1.end1
//
//             f2.chr = f2.chr2
//             f2.start = f2.start2
//             f2.end = f2.end2
//         }
//     } else if (genome) {
//         for (let feature of features) {
//             feature.chr = genome.getChromosomeName(feature.chr)
//         }
//     }
//
//
//     return features
// }

export default StaticFeatureSource
