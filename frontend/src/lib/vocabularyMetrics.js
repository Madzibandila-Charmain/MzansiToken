/*
    vocabularyMetrics.js
    Author: Mukovhe Ranwashe (RNWMUK001)

    The fields the backend sends beside the four efficiency metrics, copied
    across as they are. Each page used to build its own metrics object one
    field at a time, so a new field had to be added in every one of those
    places or it silently went missing in some of them - this is the one
    place instead.

    Values are copied unchanged on purpose: undefined (an older backend that
    never sent the field) stays undefined, and null (the backend measured
    and there is nothing to report, e.g. no byte premium for an uploaded
    file) stays null.

    token_premium_basis is how the cards know an uploaded file has no
    premium. Rényi, productivity and idiosyncrasy come with every language
    and every uploaded file, so the cards fill in together; byte premium
    only with the built-in corpus.
*/
export function extraMetricFields(metrics) {

    return {
        token_premium_basis: metrics?.token_premium_basis,
        renyi_efficiency: metrics?.renyi_efficiency,
        productivity: metrics?.productivity,
        idiosyncrasy: metrics?.idiosyncrasy,
        byte_premium: metrics?.byte_premium,
    };
}
