/*
    rankPlaceholders.js
    Author: Mukovhe Ranwashe (RNWMUK001)
    Date: 18 September 2026
*/

/*
    Initial tokenizer candidates for the Rank page.

    These are model names only. Their metrics must always come from the
    real MzansiToken measurement pipeline.

    gpt2 is a plain English baseline. xlm-roberta-base and
    Davlan/afro-xlmr-base are the same architecture before and after
    adaptation to African languages, so the two sit next to each
    other on purpose - the gap between them is what that adaptation
    buys. castorini/afriberta_base is a second, independently-built
    African model, so the board is not just one adapted/unadapted
    pair plus unrelated noise.
*/
export const INITIAL_TOKENIZERS = [
    "gpt2",
    "xlm-roberta-base",
    "Davlan/afro-xlmr-base",
    "castorini/afriberta_base",
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