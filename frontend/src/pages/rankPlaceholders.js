/*
    rankPlaceholders.js
    Author: Mukovhe Ranwashe (RNWMUK001)
    Date: 18 September 2026
*/

export const PLACEHOLDER_ROWS = [
    {
        id: "sample-1",
        name: "Davlan/afro-xlmr-base",
        token_count: 245300,
        overall_score: 69.55,
        fertility: 2.30,
        compression: 3.35,
        token_premium: 1.48,
        f1: 0.66,
        precision: 0.64,
        recall: 0.68,
        languages: 7,
    },
    {
        id: "sample-2",
        name: "xlm-roberta-base",
        token_count: 266400,
        overall_score: 65.00,
        fertility: 2.50,
        compression: 3.20,
        token_premium: 1.60,
        f1: 0.62,
        precision: 0.6,
        recall: 0.64,
        languages: 7,
    },
    {
        id: "sample-3",
        name: "google/mt5-base",
        token_count: 302600,
        overall_score: 59.20,
        fertility: 2.84,
        compression: 3.02,
        token_premium: 1.78,
        f1: 0.60,
        precision: 0.58,
        recall: 0.62,
        languages: 7,
    },
    {
        id: "sample-4",
        name: "bert-base-multilingual-cased",
        token_count: 330100,
        overall_score: 53.75,
        fertility: 3.10,
        compression: 2.80,
        token_premium: 1.95,
        f1: 0.58,
        precision: 0.56,
        recall: 0.6,
        languages: 7,
    },
    {
        id: "sample-5",
        name: "openai-community/gpt2-large",
        token_count: 431400,
        overall_score: 39.35,
        fertility: 4.05,
        compression: 2.31,
        token_premium: 2.38,
        f1: 0.55,
        precision: 0.53,
        recall: 0.57,
        languages: 7,
    },
    {
        id: "sample-6",
        name: "gpt2",
        token_count: 453800,
        overall_score: 36.00,
        fertility: 4.26,
        compression: 2.21,
        token_premium: 2.50,
        f1: 0.55,
        precision: 0.52,
        recall: 0.58,
        languages: 7,
    },
];

/*
    The eight bars in the corpus-run card. Tokens the leader spends on each
    language, English first - the shape of the problem in one glance: the
    baseline is short and everything else is two to three times taller.

    Replaced by real token counts the moment there is a measured leader, so
    this only ever shows on an empty board.
*/
export const PLACEHOLDER_RUN = [
    { language: "English", token_count: 25741 },
    { language: "Sepedi", token_count: 52104 },
    { language: "Sesotho", token_count: 53880 },
    { language: "Setswana", token_count: 54620 },
    { language: "siSwati", token_count: 61200 },
    { language: "Xitsonga", token_count: 57340 },
    { language: "isiXhosa", token_count: 63410 },
    { language: "isiZulu", token_count: 61665 },
];

/*
    The leader's per-language premiums, for the breakdown panel on an empty
    board. Same rule as the rows above: plausible for Davlan/afro-xlmr-base
    on these languages, NOT measured, and gone the moment one real tokenizer
    is on the board. Their mean is the 1.48 the sample leader reports, so
    the panel and the row agree with each other.
*/
export const PLACEHOLDER_BREAKDOWN = [
    { language: "isiZulu", premium: 1.74 },
    { language: "isiXhosa", premium: 1.69 },
    { language: "siSwati", premium: 1.61 },
    { language: "Sepedi", premium: 1.42 },
    { language: "Xitsonga", premium: 1.36 },
    { language: "Sesotho", premium: 1.29 },
    { language: "Setswana", premium: 1.25 },
];