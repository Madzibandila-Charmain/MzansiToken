/*
    measures.js
    Author: Mukovhe Ranwashe (RNWMUK001)
    Date: 17 September 2026
*/

export const MEASURES = [
    {
        key: "fertility",
        label: "Per word",
        title: "Tokens per written word",

        /* Fewer tokens for the same word is better. */
        lowerIsBetter: true,

        unit: "tokens per word",
        betterWord: "fewer",
        worseWord: "more",
        goodMeans: "Fewer tokens per word is better - the same sentence costs less to process.",

        format: (value) => Number(value).toFixed(2)
    },
    {
        key: "compression",
        label: "Bytes / token",
        title: "Bytes carried per token",

        /* The one that runs the other way: a token carrying MORE bytes is
           doing more work, so higher is better. */
        lowerIsBetter: false,

        unit: "bytes per token",
        betterWord: "more",
        worseWord: "fewer",
        goodMeans: "More bytes per token is better - each token carries more of the text.",

        format: (value) => Number(value).toFixed(2)
    },
    {
        key: "token_count",
        label: "Total tokens",
        title: "Tokens for the whole corpus",

        lowerIsBetter: true,

        unit: "tokens for the corpus",
        betterWord: "fewer",
        worseWord: "more",
        goodMeans: "Fewer tokens for the same corpus is better.",

        format: (value) => Number(value).toLocaleString()
    },
    {
        key: "token_premium",
        label: "Cost vs English",
        title: "Cost relative to English",

        lowerIsBetter: true,

        unit: "relative to English",
        betterWord: "lower",
        worseWord: "higher",
        goodMeans: "Lower is better - it is how many times more this language costs than the same text in English.",

        format: (value) => Number(value).toFixed(2) + "×"
    }
];

/*
    Pick a subset, in the order given.

    The two charts deliberately show different sets. The petal wheel on
    Inspect plots ratios, and a raw corpus total is not a ratio - drawn as a
    petal it would just repeat the doughnut beside it. Compare is a
    difference between two tokenizers, where the total IS worth seeing.
*/
export function measuresFor(keys) {

    return keys
        .map((key) => MEASURES.find((measure) => measure.key === key))
        .filter(Boolean);
}

/* The ratio measures: the ones the Inspect petal wheel can honestly draw. */
export const RATIO_MEASURES = measuresFor([
    "fertility",
    "compression",
    "token_premium"
]);

/* Everything, for the two-tokenizer comparison. */
export const COMPARE_MEASURES = MEASURES;