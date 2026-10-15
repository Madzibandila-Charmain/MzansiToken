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
    },
    {
        key: "byte_premium",
        name: "the byte premium",
        source: "Arnett et al. 2024",
        label: "Bytes vs English",
        title: "Bytes relative to English",

        /* A property of the language, not the tokenizer: every tokenizer
           sees the same bytes. Shown on the wheel only. */
        lowerIsBetter: true,

        unit: "bytes relative to English",
        betterWord: "fewer",
        worseWord: "more",
        goodMeans: "How many more bytes the same sentences take than in English (Arnett et al. 2024).",
        petalNote: "Longer petal means more bytes for the same sentences - the language, not the tokenizer.",
        ownNote: true,

        format: (value) => Number(value).toFixed(2) + "×"
    },

    /*
        The three vocabulary measures. None has an agreed "better"
        direction, so they are `neutral`: Compare says which tokenizer is
        higher or lower, never which one wins. productivity and
        idiosyncrasy come from /vocabulary rather than /metrics
        (`fromVocabulary`), because they take a moment to compute.
    */
    {
        key: "renyi_efficiency",
        name: "Rényi efficiency",
        source: "Zouhar et al. 2023",
        petalNote: "Longer petal means the tokens are used more evenly. Neither end is better or worse.",
        ownNote: true,
        label: "Rényi",
        title: "Rényi efficiency (how evenly the tokens are used)",
        neutral: true,
        lowerIsBetter: false,

        unit: "Rényi efficiency",
        betterWord: "higher",
        worseWord: "lower",
        goodMeans: "Rényi efficiency, α = 2.5 (Zouhar et al. 2023): how evenly the tokens are used, from 0 to 1. The papers disagree on whether higher is better, so this one is described, not judged.",

        format: (value) => Number(value).toFixed(2)
    },
    {
        key: "productivity",
        name: "productivity",
        source: "Gutierrez-Vasques et al. 2023",
        petalNote: "Longer petal means each subword turns up in more different words. Neither end is better or worse.",
        ownNote: true,
        label: "Productivity",
        title: "Productivity (different words per subword)",
        neutral: true,
        fromVocabulary: true,
        lowerIsBetter: false,

        unit: "words per subword",
        betterWord: "higher",
        worseWord: "lower",
        goodMeans: "Productivity (Gutierrez-Vasques et al. 2023): how many different words each subword turns up in, on average. It describes how subwords are reused - neither direction is better on its own.",

        format: (value) => Number(value).toFixed(1)
    },
    {
        key: "idiosyncrasy",
        name: "idiosyncrasy",
        source: "Gutierrez-Vasques et al. 2023",
        petalNote: "Longer petal means the words behind each subword are more common. Neither end is better or worse.",
        ownNote: true,
        label: "Idiosyncrasy",
        title: "Idiosyncrasy (how common the words behind each subword are)",
        neutral: true,
        fromVocabulary: true,
        lowerIsBetter: false,

        unit: "average word frequency",
        betterWord: "higher",
        worseWord: "lower",
        goodMeans: "Idiosyncrasy (Gutierrez-Vasques et al. 2023): how often the words behind each subword occur, on average. It describes how subwords are used - neither direction is better on its own.",

        format: (value) => Number(value).toFixed(1)
    }
];

/*
    Pick a subset, in the order given.

    The two charts deliberately show different sets. The petal wheel on
    Inspect plots ratios and averages, and a raw corpus total is not one -
    drawn as a petal it would just repeat the doughnut beside it. Compare
    is a difference between two tokenizers, where the total IS worth
    seeing, and the byte premium is not (it is the same for both).
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
    "token_premium",
    "byte_premium",
    "renyi_efficiency",
    "productivity",
    "idiosyncrasy"
]);

/*
    For the two-tokenizer comparison: everything except the byte premium,
    which is the language's and so identical for both tokenizers - every
    pair of dots would sit on top of each other.
*/
export const COMPARE_MEASURES = measuresFor([
    "fertility",
    "compression",
    "token_count",
    "token_premium",
    "renyi_efficiency",
    "productivity",
    "idiosyncrasy"
]);

/*
    The measures taken from the research papers - the ones with a
    `source`. Home lists them from here, so adding one to MEASURES is all it
    takes for the front page to mention it too.
*/
export const RESEARCH_MEASURES = MEASURES.filter((measure) => measure.source);
