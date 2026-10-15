/*
    leaderboardColumns.js
    Author: Mukovhe Ranwashe (RNWMUK001)

    Every leaderboard column in one place: the key it reads, how it is
    labelled, what the label means, and whether a bigger number is better.
    The header arrow and the default sort direction both come from
    `lowerIsBetter`, so the table cannot say one thing and sort the other
    way.

    Kept out of LeaderboardTable.jsx so Rank's Columns panel and the saved
    "which columns are hidden" setting can read the same list without
    importing a component file for its data.
*/

export const COLUMNS = [
    {
        key: "name",
        label: "Tokenizer",
        title: "The Hugging Face model id",
        align: "left",
        lowerIsBetter: true,
        alwaysShown: true,
    },
    {
        key: "overall_score",
        label: "Score",
        title: "Out of 100, computed by the backend from the four measures",
        align: "right",
        lowerIsBetter: false,
        alwaysShown: true,
    },
    {
        key: "token_count",
        label: "Tokens",
        title:
            "Total tokens spent on the South African languages in the " +
            "corpus. The raw bill, before any of it is averaged",
        align: "right",
        lowerIsBetter: true,
        hiddenByDefault: true,
    },
    {
        key: "compression",
        label: "Compression",
        title: "Bytes per token - how much text each token carries",
        align: "right",
        lowerIsBetter: false,
    },
    {
        key: "fertility",
        label: "Fertility",
        title: "Tokens per word, averaged over the languages measured",
        align: "right",
        lowerIsBetter: true,
    },
    {
        key: "token_premium",
        label: "Premium",
        title: "Tokens used against the same text in English. 1.0 is parity",
        align: "right",
        lowerIsBetter: true,
    },
    {
        key: "f1",
        label: "MBI F1",
        title: "How often the splits land on a real morpheme boundary",
        align: "right",
        lowerIsBetter: false,
    },
    {
        key: "precision",
        label: "Precision",
        title:
            "Of the boundaries this tokenizer predicted, how many were " +
            "real morpheme boundaries",
        align: "right",
        lowerIsBetter: false,
        hiddenByDefault: true,
    },
    {
        key: "recall",
        label: "Recall",
        title:
            "Of the real morpheme boundaries, how many this tokenizer " +
            "found",
        align: "right",
        lowerIsBetter: false,
        hiddenByDefault: true,
    },

    /*
        The three vocabulary metrics. Shown for reference beside the scored
        ones and never part of the score - `scored: false` is what the
        Columns panel uses to say so. None of them has an agreed "better"
        direction, so the first header click simply puts the largest on top.
    */
    {
        key: "renyi_efficiency",
        label: "Rényi",
        title:
            "Rényi efficiency (α = 2.5): how evenly the tokens are used, " +
            "from 0 to 1. For reference - not part of the score",
        align: "right",
        lowerIsBetter: false,
        scored: false,
    },
    {
        key: "productivity",
        label: "Productivity",
        title:
            "How many different words each subword turns up in, on " +
            "average. For reference - not part of the score",
        align: "right",
        lowerIsBetter: false,
        scored: false,
    },
    {
        key: "idiosyncrasy",
        label: "Idiosyncrasy",
        title:
            "How common the words behind each subword are, on average. " +
            "For reference - not part of the score",
        align: "right",
        lowerIsBetter: false,
        scored: false,
    },
];

/* The ones the Columns panel can switch off. Tokenizer and Score always
   stay: without them the board has nothing to rank or name. */
export const TOGGLEABLE_COLUMNS = COLUMNS.filter((column) => !column.alwaysShown);

/* What a first visit hides: the same three the board has always folded
   away, because nine numeric columns on one row is a table people scan
   past rather than read. */
export const DEFAULT_HIDDEN_COLUMNS = COLUMNS
    .filter((column) => column.hiddenByDefault)
    .map((column) => column.key);

/* The columns shown for reference and never scored. Read by the table (to
   explain an empty one) and by Rank (to fill empty ones in). */
export const UNSCORED_COLUMN_KEYS = COLUMNS
    .filter((column) => column.scored === false)
    .map((column) => column.key);
