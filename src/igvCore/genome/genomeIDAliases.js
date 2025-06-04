/**
 * Map of version identifiers to their genome IDs
 * @type {Map<string, string>}
 */
const genomeIDAliases = new Map([
    ['GRCh38', 'hg38'],
    ['GRCh37', 'hg19'],
    ['GRCm39', 'mm39'],
    ['GRCm38', 'mm10'],
    ['NCBI37', 'mm9'],
    ['Kamilah_GGO_v0', 'gorGor6'],
    ['gorGor4.1', 'gorGor4'],
    ['UU_Cfam_GSD_1.0', 'canFam4'],
    ['ARS-UCD1.2', 'bosTau9'],
    ['UMD_3.1.1', 'bosTau8'],
    ['GRCZ11', 'danRer11'],
    ['GRCZ10', 'danRer10']
]); 

export { genomeIDAliases };