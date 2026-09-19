/*
    Rank Page
    Author: Mukovhe Ranwashe (RNWMUK001)
    September 2026
*/

import { useEffect, useMemo, useRef, useState } from "react";

import {
    createOrUpdateLeaderboardEntry,
    deleteLeaderboardEntry,
    friendlyError,
    getLeaderboard,
    getMBI,
    getMetrics,
    getMorphologyLanguages,
    getOptions,
    getScoring,
    getTokenizerInfo,
} from "../api/client";

import LeaderboardTable from "../components/LeaderboardTable";

import StatusMessage from "../components/StatusMessage";

import {
    PLACEHOLDER_BREAKDOWN,
    PLACEHOLDER_ROWS,
    PLACEHOLDER_RUN,
} from "./rankPlaceholders";

/*
    English is the baseline the token premium is measured against, so it is
    not one of the languages a tokenizer is scored on. Averaging it in would
    add a guaranteed 1.0 premium to every tokenizer alike and flatter all of
    them by exactly the same amount.
*/
const BASELINE_LANGUAGE = "English";

/* How the four parts of the score read in a sentence. */
const COMPONENT_LABELS = {
    token_premium: "cost against English",
    fertility: "tokens per word",
    f1: "morpheme boundaries",
    compression: "bytes per token",
};

/*
    The premium bars are drawn against this, not against the worst language
    on the board. A fixed ceiling means the same language looks the same
    length whichever tokenizer is leading, so the chart can be read across
    two screenshots. 3.0x is three times the English bill, which is about
    where an English-trained BPE lands on isiZulu.
*/
const BREAKDOWN_CEILING = 3.0;

/* What the "rank by" control offers, and which way is good. */
const SORT_OPTIONS = [
    { key: "overall_score", label: "Overall score", lowerIsBetter: false },
    { key: "fertility", label: "Fertility", lowerIsBetter: true },
    { key: "compression", label: "Compression", lowerIsBetter: false },
    { key: "token_premium", label: "Token premium", lowerIsBetter: true },
    { key: "f1", label: "Morphology F1", lowerIsBetter: false },
    { key: "precision", label: "Precision", lowerIsBetter: false },
    { key: "recall", label: "Recall", lowerIsBetter: false },
    { key: "token_count", label: "Total tokens", lowerIsBetter: true },
    { key: "name", label: "Name", lowerIsBetter: true },
];

/*
    A tokenizer's colour is derived from its NAME, not from where it is
    standing. Colouring by rank would repaint every bar the moment somebody
    added a model, so the eye would have to re-learn the chart after a
    change that had nothing to do with the rows it repainted.

    Three colours, not six. The flag's own green, blue and red were run
    through a contrast and colour-blindness check against this page's white
    surface: the flag blue (#001489) is too dark to sit in a categorical
    set and the flag gold is too light to hold 3:1 contrast, and gold beside
    red is indistinguishable to a deuteranope. These three are the flag's
    hues moved just far enough to pass, and gold is kept for the one place
    it works - marking the English baseline bar, where it is the only thing
    of its kind rather than one category among several.

    Even so, colour is never the only thing carrying identity here: every
    bar sits beside the name and the number it belongs to, and the chip
    shows the tokenizer's initials. A reader who cannot separate the hues
    loses nothing.
*/
const IDENTITY_COLOURS = [
    "#007749",   /* the flag's green, unchanged - it already passes */
    "#2A46B8",   /* flag blue, lightened out of the too-dark band */
    "#D2342B",   /* flag red, a step down for contrast on white */
];

function identityColour(name) {

    const text = String(name || "");

    let hash = 0;

    for (let index = 0; index < text.length; index += 1) {
        hash = (hash * 31 + text.charCodeAt(index)) % 100000;
    }

    return IDENTITY_COLOURS[hash % IDENTITY_COLOURS.length];
}

/* The two capitals in the round chip beside a name, as in the mock-up. */
function initials(name) {

    const bare = String(name || "").split("/").pop();

    return bare.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "??";
}

/* "Davlan/afro-xlmr-base" -> "Davlan". The model's publisher. */
function vendor(name) {

    const parts = String(name || "").split("/");

    return parts.length > 1 ? parts[0] : "Hugging Face";
}

/*
    Mean of the values that are actually numbers.

    Returns null rather than 0 for an empty list. Zero is a measurement;
    "we have none" is not, and the backend drops a null component from the
    score rather than scoring it as the worst possible result.
*/
function mean(values) {

    const numbers = values.filter(
        (value) => typeof value === "number" && Number.isFinite(value)
    );

    if (!numbers.length) {
        return null;
    }

    const total = numbers.reduce((carry, value) => carry + value, 0);

    return Number((total / numbers.length).toFixed(4));
}

function sum(values) {

    const numbers = values.filter(
        (value) => typeof value === "number" && Number.isFinite(value)
    );

    if (!numbers.length) {
        return null;
    }

    return numbers.reduce((carry, value) => carry + value, 0);
}

/* 16 400 000 -> "16.4m". The corpus-run card has no room for the digits. */
function compact(value) {

    if (typeof value !== "number" || !Number.isFinite(value)) {
        return "—";
    }

    if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}m`;
    }

    if (value >= 1000) {
        return `${Math.round(value / 1000)}k`;
    }

    return String(value);
}

/*
    A language with no NCHLT segmentations is not a failure - it is a
    language the dataset does not cover. Told apart by the backend's own
    wording, which mbi_router keeps stable for exactly this reason.
*/
function isUnsupportedLanguage(error) {
    return /unsupported language/i.test(String(error?.message || ""));
}

/* Small line icons, inline so the page needs no icon library. */
const IconEfficiency = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
);

const IconTrophy = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M7 6H4v1a3 3 0 0 0 3 3m10-4h3v1a3 3 0 0 1-3 3" />
        <path d="M9 20h6M12 14v6" />
    </svg>
);

function Rank() {

    const [rows, setRows] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    const [suggestions, setSuggestions] = useState([]);
    const [scoredLanguages, setScoredLanguages] = useState([]);
    const [weights, setWeights] = useState(null);
    const [runBars, setRunBars] = useState(null);

    const [sortKey, setSortKey] = useState("overall_score");
    const [bestFirst, setBestFirst] = useState(true);
    const [filter, setFilter] = useState("");
    const [showAllMetrics, setShowAllMetrics] = useState(false);

    const [addOpen, setAddOpen] = useState(false);
    const [tokenizerInput, setTokenizerInput] = useState("");

    const [adding, setAdding] = useState(false);
    const [addStatus, setAddStatus] = useState("");
    const [addFailed, setAddFailed] = useState(false);
    const [addPartial, setAddPartial] = useState(false);
    const [addedName, setAddedName] = useState("");

    const [removingId, setRemovingId] = useState(null);

    /* Per-language premiums for whoever is top of the board. */
    const [breakdown, setBreakdown] = useState([]);
    const [breakdownLoading, setBreakdownLoading] = useState(false);

    /*
        Adding a tokenizer is a long chain of requests. If the user leaves
        the page halfway through, every one of them should stop, and none
        of them should write state into a component that is gone.
    */
    const addControllerRef = useRef(null);

    useEffect(() => {

        return () => addControllerRef.current?.abort();

    }, []);

    async function loadLeaderboard(signal) {

        const data = await getLeaderboard(
            {
                sortBy: "overall_score",
                descending: true,
            },
            signal
        );

        setRows(Array.isArray(data) ? data : []);
    }

    useEffect(() => {

        const controller = new AbortController();

        async function initialiseRank() {

            setIsLoading(true);
            setErrorMessage("");

            try {

                const options = await getOptions(controller.signal);

                setSuggestions(options.tokenizers || []);

                const floresLanguages = options.languages || [];

                /*
                    The languages a tokenizer can be scored on for both
                    efficiency and morphology: in FLORES, in NCHLT, and not
                    the English baseline. Asked for rather than assumed, so
                    the page follows the datasets on disk.
                */
                try {

                    const morphology = await getMorphologyLanguages(
                        controller.signal
                    );

                    const nchlt = new Set(morphology.languages || []);

                    setScoredLanguages(
                        floresLanguages.filter(
                            (name) =>
                                name !== BASELINE_LANGUAGE &&
                                nchlt.has(name)
                        )
                    );

                }
                catch (error) {

                    /*
                        An older backend without this route is not a reason
                        to break the page. Efficiency still scores on every
                        language; morphology is skipped, and the backend
                        renormalises the weights for rows with no f1.
                    */
                    if (error.name !== "AbortError") {

                        console.warn(
                            "No morphology languages endpoint; " +
                            "scoring on efficiency only.",
                            error
                        );

                        setScoredLanguages([]);
                    }
                }

                try {

                    setWeights(
                        (await getScoring(controller.signal)).weights || null
                    );

                }
                catch (error) {

                    /* The explainer sentence is optional; the board is not. */
                    if (error.name !== "AbortError") {
                        setWeights(null);
                    }
                }

                await loadLeaderboard(controller.signal);

            }
            catch (error) {

                if (error.name !== "AbortError") {

                    setErrorMessage(
                        friendlyError(error) ||
                        "Could not load the leaderboard."
                    );
                }

            }
            finally {
                /* An aborted run (StrictMode mounts twice in dev) must not
                   end the loading state the live run still owns - it made
                   the sample board flash up before the real one. */
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }

        initialiseRank();

        return () => controller.abort();

    }, []);

    /*
        Efficiency across every language, morphology across every language
        NCHLT covers, averaged into the one set of numbers the leaderboard
        stores. The backend turns these into the score.
    */
    async function measure(name, signal) {

        setAddStatus(`Reading ${name} across the corpus...`);

        const metrics = await getMetrics(name, signal);

        const languages = Object.keys(metrics).filter(
            (language) => language !== BASELINE_LANGUAGE
        );

        const perLanguage = languages.map((language) => metrics[language]);

        const morphology = [];

        /*
            Languages that have NCHLT data but could not be read. Kept apart
            from the ones NCHLT simply does not cover: "this language is not
            in the dataset" and "this language is in the dataset and the
            request failed" are different facts and the user is told which.
        */
        const failed = [];

        /*
            One language at a time on purpose. Each call tokenizes every
            word NCHLT has for that language, and firing seven at once only
            queues them in the same backend process while making the
            progress count meaningless. Sequential, so the user is told
            where it has got to.
        */
        for (let index = 0; index < scoredLanguages.length; index += 1) {

            const language = scoredLanguages[index];

            setAddStatus(
                `Checking morpheme boundaries - ${language} ` +
                `(${index + 1} of ${scoredLanguages.length})...`
            );

            try {

                const result = await getMBI(name, language, signal);

                morphology.push(result.metrics || {});

            }
            catch (error) {

                if (error.name === "AbortError") {
                    throw error;
                }

                /* A gap in the dataset, not a failure worth reporting. */
                if (isUnsupportedLanguage(error)) {
                    continue;
                }

                /*
                    A real failure on one language used to throw, which
                    threw away the seven languages of efficiency data that
                    had already been read and left the tokenizer off the
                    board entirely. One language timing out is not a reason
                    to lose the whole measurement - it is a reason to say
                    which language, and score the tokenizer on what was
                    actually read. The backend renormalises the weights.
                */
                failed.push({
                    language,
                    detail: friendlyError(error) || "could not be read",
                });
            }
        }

        /*
            Unless every one of them failed - then something is wrong with
            the backend rather than with one language, and saying so beats
            storing a score built on nothing.
        */
        if (scoredLanguages.length && failed.length === scoredLanguages.length) {

            throw new Error(
                `Morphology failed on all ${failed.length} languages. ` +
                `${failed[0].detail}`
            );
        }

        return {
            bars: Object.keys(metrics).map((language) => ({
                language,
                token_count: metrics[language]?.token_count ?? 0,
            })),
            token_count: sum(perLanguage.map((entry) => entry?.token_count)),
            fertility: mean(perLanguage.map((entry) => entry?.fertility)),
            compression: mean(perLanguage.map((entry) => entry?.compression)),
            token_premium: mean(
                perLanguage.map((entry) => entry?.token_premium)
            ),
            f1: mean(morphology.map((entry) => entry?.f1)),
            precision: mean(morphology.map((entry) => entry?.precision)),
            recall: mean(morphology.map((entry) => entry?.recall)),
            languagesMeasured: languages.length,
            morphologyMeasured: morphology.length,
            failedLanguages: failed,
        };
    }

    async function handleAdd(requested) {

        const name = String(requested ?? tokenizerInput).trim();

        if (!name || adding) {
            return;
        }

        addControllerRef.current?.abort();

        const controller = new AbortController();
        addControllerRef.current = controller;

        setAdding(true);
        setAddFailed(false);
        setAddPartial(false);
        setAddedName(name);
        setAddStatus(`Loading ${name}...`);

        try {

            /*
                Checked first so a typo or a gated model comes back as the
                backend's own sentence - with its Hugging Face link - before
                the user waits through a full measurement run.
            */
            await getTokenizerInfo(name, controller.signal);

            const measured = await measure(name, controller.signal);

            setAddStatus(`Saving ${name}...`);

            await createOrUpdateLeaderboardEntry(
                name,
                {
                    token_count: measured.token_count,
                    fertility: measured.fertility,
                    compression: measured.compression,
                    token_premium: measured.token_premium,
                    f1: measured.f1,
                    precision: measured.precision,
                    recall: measured.recall,
                },
                controller.signal
            );

            await loadLeaderboard(controller.signal);

            setRunBars(measured.bars);

            const morphologyNote = measured.morphologyMeasured
                ? `, morphology on ${measured.morphologyMeasured}`
                : ", no morphology data";

            const failures = measured.failedLanguages || [];

            /*
                A partial result says so. Reporting "scored on 7 languages"
                in the green ready style when two of them failed is the
                same bug as a failure that looks like a success - the user
                would have no way of knowing the score was built on less
                than it says.
            */
            if (failures.length) {

                setAddPartial(true);

                setAddStatus(
                    `${name} scored on ${measured.languagesMeasured} ` +
                    `languages${morphologyNote}. Morphology failed on ` +
                    `${failures.map((item) => item.language).join(", ")}: ` +
                    `${failures[0].detail}`
                );

            }
            else {

                setAddStatus(
                    `${name} scored on ${measured.languagesMeasured} ` +
                    `languages${morphologyNote}.`
                );
            }

            setTokenizerInput("");

        }
        catch (error) {

            if (error.name === "AbortError") {
                return;
            }

            /*
                Reported on the status line only, NOT in errorMessage.
                errorMessage replaces the whole board, so routing a failed
                add through it made one bad model id wipe the leaderboard
                off the screen. errorMessage is for a board that could not
                be loaded; this is an add that did not happen.
            */
            setAddFailed(true);

            setAddStatus(
                friendlyError(error) ||
                `Could not add ${name} to the leaderboard.`
            );

        }
        finally {

            if (addControllerRef.current === controller) {
                addControllerRef.current = null;
                setAdding(false);
            }
        }
    }

    async function handleRemove(row) {

        /* A sample row has nothing behind it to delete. */
        if (!row?.id || typeof row.id !== "number") {
            return;
        }

        if (removingId != null || adding) {
            return;
        }

        setRemovingId(row.id);
        setAddFailed(false);
        setAddPartial(false);
        setAddedName("");
        setAddStatus(`Removing ${row.name}...`);

        try {

            await deleteLeaderboardEntry(row.id);

            await loadLeaderboard();

            setAddStatus(`${row.name} removed.`);

        }
        catch (error) {

            /* Same reason: the row is still there, so the board stays. */
            setAddFailed(true);

            setAddStatus(
                friendlyError(error) ||
                `Could not remove ${row.name}.`
            );

        }
        finally {
            setRemovingId(null);
        }
    }

    const busy = adding || removingId != null;

    /*
        Placeholders stand in for an empty board and nothing else. They are
        never merged with measured rows, so what is on screen is always
        entirely one or entirely the other.
    */
    const showingSample =
        !isLoading && !errorMessage && rows.length === 0;

    const board = showingSample ? PLACEHOLDER_ROWS : rows;

    const onBoard = new Set(rows.map((row) => row.name));

    const sortSpec =
        SORT_OPTIONS.find((option) => option.key === sortKey) ||
        SORT_OPTIONS[0];

    const visible = useMemo(() => {

        const needle = filter.trim().toLowerCase();

        const matched = needle
            ? board.filter((row) =>
                String(row.name).toLowerCase().includes(needle))
            : board;

        /*
            "Best first" has to mean best, not biggest - fertility and token
            premium are better when they are smaller. The direction comes
            from the column, so the control can say "best first" honestly
            whichever measure is chosen.
        */
        const ascending = bestFirst
            ? sortSpec.lowerIsBetter
            : !sortSpec.lowerIsBetter;

        return [...matched].sort((a, b) => {

            const left = a?.[sortKey];
            const right = b?.[sortKey];

            if (left == null && right == null) {
                return 0;
            }

            /* Unmeasured rows sit at the bottom either way round. */
            if (left == null) {
                return 1;
            }

            if (right == null) {
                return -1;
            }

            if (typeof left === "number" && typeof right === "number") {
                return ascending ? left - right : right - left;
            }

            const result = String(left).localeCompare(String(right));

            return ascending ? result : -result;
        });

    }, [board, filter, sortKey, bestFirst, sortSpec]);

    /*
        The spotlight always shows the best OVERALL tokenizer, whatever the
        table happens to be sorted or filtered by. "Current leader" that
        changed when you typed in the search box would not mean anything.
    */
    const ranked = useMemo(() => (
        [...board].sort(
            (a, b) => (b.overall_score ?? -1) - (a.overall_score ?? -1)
        )
    ), [board]);

    const leader = ranked[0] || null;

    const chasing = ranked.slice(0, 4);

    const leaderName = leader?.name || "";

    /*
        The leader's per-language premiums. Fetched rather than derived,
        because the board only stores the average and the interesting part
        is the spread underneath it. GET /metrics/{model} is cached by the
        backend, so the leader changing is a cheap request and usually an
        instant one.

        Depends on the NAME, not on the row object - the row is rebuilt on
        every reload and a dependency on it would refetch forever.
    */
    useEffect(() => {

        if (!leaderName) {
            setBreakdown([]);
            return;
        }

        /* The sample board has no backend behind it. */
        if (showingSample) {
            setBreakdown(PLACEHOLDER_BREAKDOWN);
            return;
        }

        const controller = new AbortController();

        setBreakdownLoading(true);

        getMetrics(leaderName, controller.signal)
            .then((perLanguage) => {

                const rows = Object.keys(perLanguage || {})
                    .filter((language) => language !== BASELINE_LANGUAGE)
                    .map((language) => ({
                        language,
                        premium: Number(
                            perLanguage[language]?.token_premium
                        ),
                    }))
                    .filter((row) => Number.isFinite(row.premium))
                    .sort((a, b) => b.premium - a.premium);

                setBreakdown(rows);
            })
            .catch((error) => {

                /*
                    The board above is already on screen and already correct.
                    A failure here costs one panel, so it removes the panel
                    rather than shouting over a page that is otherwise fine.
                */
                if (error.name !== "AbortError") {
                    console.warn(
                        "Could not read the leader's per-language metrics.",
                        error
                    );

                    setBreakdown([]);
                }
            })
            .finally(() => {

                if (!controller.signal.aborted) {
                    setBreakdownLoading(false);
                }
            });

        return () => controller.abort();

    }, [leaderName, showingSample]);

    const bars = runBars || (showingSample ? PLACEHOLDER_RUN : null);

    const barMax = bars
        ? Math.max(...bars.map((bar) => bar.token_count || 0), 1)
        : 1;

    const totalTokens = sum(board.map((row) => row.token_count));

    const weightSentence = weights
        ? Object.entries(weights)
            .sort((a, b) => b[1] - a[1])
            .map(([key, weight]) => (
                `${COMPONENT_LABELS[key] || key} ` +
                `${Math.round(weight * 100)}%`
            ))
            .join(", ")
        : "";

    return (
        <div className="rank">

            {/* ---------------- HERO ---------------- */}

            <section className="rank-hero">

                <div className="rank-hero-copy">

                    <p className="rank-eyebrow">
                        <span
                            className="rank-eyebrow-rule"
                            aria-hidden="true"
                        ></span>
                        Public benchmark / 08 languages
                    </p>

                    <h1 className="rank-title">
                        Which tokenizer{" "}
                        <span className="rank-title-accent">
                            understands
                        </span>{" "}
                        Mzansi best?
                    </h1>

                    <p className="rank-lede">
                        A scoreboard for the models that sit between{" "}
                        <strong>your words and the machine</strong>. Every
                        tokenizer here is measured on the same FLORES
                        sentences in all eight languages and the same NCHLT
                        segmentations, then scored out of 100 - so the rows
                        can be read against each other.
                    </p>

                </div>

                <aside
                    className="rank-run"
                    aria-label="The corpus behind the scores"
                >

                    <div className="rank-run-head">

                        <span className="rank-run-label">
                            {runBars ? "latest corpus run" : "corpus per run"}
                        </span>

                        <strong className="rank-run-value">
                            {compact(
                                bars
                                    ? sum(
                                        bars.map((bar) => bar.token_count)
                                    )
                                    : totalTokens
                            )}
                        </strong>

                    </div>

                    <div className="rank-run-bars" aria-hidden="true">

                        {(bars || []).map((bar) => (

                            <span
                                key={bar.language}
                                className={
                                    bar.language === BASELINE_LANGUAGE
                                        ? "rank-run-bar is-baseline"
                                        : "rank-run-bar"
                                }
                                title={
                                    `${bar.language}: ` +
                                    `${(bar.token_count || 0)
                                        .toLocaleString()} tokens`
                                }
                                style={{
                                    height: `${Math.max(
                                        8,
                                        ((bar.token_count || 0) / barMax) * 100
                                    )}%`
                                }}
                            ></span>

                        ))}

                    </div>

                    <div className="rank-run-foot">

                        <span>tokens per tokenizer</span>

                        <span className="rank-run-note">
                            997 sentences &times; 8 languages
                        </span>

                    </div>

                </aside>

            </section>

            {/* ---------------- CONTROLS ---------------- */}

            <section className="rank-controls" aria-label="Board controls">

                <label className="rank-control">

                    <span className="rank-control-label">
                        rank by
                    </span>

                    <select
                        value={sortKey}
                        onChange={(event) => setSortKey(event.target.value)}
                    >
                        {SORT_OPTIONS.map((option) => (
                            <option key={option.key} value={option.key}>
                                {option.label}
                            </option>
                        ))}
                    </select>

                </label>

                <label className="rank-control">

                    <span className="visually-hidden">
                        Order
                    </span>

                    <select
                        value={bestFirst ? "best" : "worst"}
                        onChange={(event) =>
                            setBestFirst(event.target.value === "best")
                        }
                    >
                        <option value="best">Best first</option>
                        <option value="worst">Worst first</option>
                    </select>

                </label>

                <div className="rank-controls-right">

                    <div className="rank-find">

                        <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            className="rank-find-icon"
                        >
                            <circle cx="11" cy="11" r="7" />
                            <path d="M16.5 16.5 21 21" />
                        </svg>

                        <input
                            type="text"
                            value={filter}
                            onChange={(event) =>
                                setFilter(event.target.value)
                            }
                            placeholder="Find a tokenizer..."
                            aria-label="Find a tokenizer on the board"
                        />

                    </div>

                    <button
                        type="button"
                        className="rank-add-cta"
                        onClick={() => setAddOpen((open) => !open)}
                        aria-expanded={addOpen}
                    >
                        <span aria-hidden="true">+</span>
                        Add tokenizer
                    </button>

                </div>

            </section>

            {showingSample && (

                <p className="rank-sample-banner">
                    <span className="status-dot"></span>
                    <span>
                        <strong>Sample board.</strong> Nothing has been
                        measured yet, so these are placeholder tokenizers
                        with plausible metrics - the scores beside them are
                        real output of the scoring formula, but the metrics
                        they were computed from are not measurements. Add a
                        tokenizer and the whole board becomes live.
                    </span>
                </p>

            )}

            {/* ---------------- SPOTLIGHT ---------------- */}

            {leader && !errorMessage && (

                <section className="rank-spotlight">

                    <article className="rank-leader">

                        <div className="rank-leader-top">

                            <span className="rank-leader-badge">
                                <span
                                    className="rank-leader-badge-icon"
                                    aria-hidden="true"
                                >
                                    {IconTrophy}
                                </span>
                                Current leader
                            </span>

                            <span className="rank-leader-meta">
                                rank 01 / overall score
                            </span>

                        </div>

                        <h2 className="rank-leader-name">
                            {String(leader.name).split("/").pop()}
                        </h2>

                        <p className="rank-leader-vendor">
                            {vendor(leader.name)}
                        </p>

                        <div className="rank-leader-figures">

                            <div className="rank-leader-score">

                                <span className="rank-leader-score-value">
                                    {typeof leader.overall_score === "number"
                                        ? leader.overall_score.toFixed(1)
                                        : "—"}
                                </span>

                                <span className="rank-leader-score-note">
                                    out of 100
                                </span>

                            </div>

                            <dl className="rank-leader-stats">

                                <div>
                                    <dt>compression</dt>
                                    <dd>
                                        {typeof leader.compression === "number"
                                            ? `${leader.compression.toFixed(2)}×`
                                            : "—"}
                                    </dd>
                                </div>

                                <div>
                                    <dt>fertility</dt>
                                    <dd>
                                        {typeof leader.fertility === "number"
                                            ? leader.fertility.toFixed(2)
                                            : "—"}
                                    </dd>
                                </div>

                                <div>
                                    <dt>premium</dt>
                                    <dd>
                                        {typeof leader.token_premium === "number"
                                            ? `${leader.token_premium.toFixed(2)}×`
                                            : "—"}
                                    </dd>
                                </div>

                            </dl>

                        </div>

                    </article>

                    <article className="rank-close">

                        <div className="rank-close-head">

                            <h2>Close at the top</h2>

                            <span
                                className="rank-close-icon"
                                aria-hidden="true"
                            >
                                {IconEfficiency}
                            </span>

                        </div>

                        <p className="rank-close-sub">
                            Small gaps, meaningful differences. The front
                            {" "}{chasing.length} on this run.
                        </p>

                        <ul className="rank-close-list">

                            {chasing.map((row) => (

                                <li key={row.id}>

                                    <span className="rank-close-name">
                                        {String(row.name).split("/").pop()}
                                    </span>

                                    <span className="rank-close-track">
                                        <span
                                            className="rank-close-fill"
                                            style={{
                                                width: `${Math.max(
                                                    0,
                                                    Math.min(
                                                        100,
                                                        row.overall_score || 0
                                                    )
                                                )}%`,
                                                background:
                                                    identityColour(row.name)
                                            }}
                                        ></span>
                                    </span>

                                    <span className="rank-close-value">
                                        {typeof row.overall_score === "number"
                                            ? row.overall_score.toFixed(1)
                                            : "—"}
                                    </span>

                                </li>

                            ))}

                        </ul>

                        <p className="rank-close-foot">
                            <span className="status-dot"></span>
                            Bars run from 0 to 100, not from the leader, so
                            a close board looks close.
                        </p>

                    </article>

                </section>

            )}

            {/* ---------------- THE BOARD ---------------- */}

            <section
                className={"rank-board" + (adding ? " is-busy" : "")}
                aria-busy={adding}
            >

                {adding && (
                    <div className="block-overlay">
                        <span className="spinner is-big"></span>
                        <span className="block-overlay-text">
                            {addStatus}
                        </span>
                    </div>
                )}

                <header className="rank-board-head">

                    <div>
                        <h2>The leaderboard</h2>

                        <p>
                            Measured on the same corpus, with the same
                            formula, every time. Click any column to rank
                            by it; click it again to flip, and a third time
                            to hand the order back to the control above.
                        </p>
                    </div>

                    <div className="rank-board-tools">

                        <p className="rank-board-count">
                            <strong>
                                {String(visible.length).padStart(2, "0")}
                            </strong>
                            {" "}tokenizers &middot; sorted by{" "}
                            {sortSpec.label.toLowerCase()}
                        </p>

                        {/* Every column sorts on click. These three are
                            folded away by default only because nine numeric
                            columns on one row is a table people scan past
                            rather than read. */}
                        <button
                            type="button"
                            className="rank-metrics-toggle"
                            onClick={() =>
                                setShowAllMetrics((open) => !open)
                            }
                            aria-pressed={showAllMetrics}
                        >
                            {showAllMetrics
                                ? "Key metrics"
                                : "All metrics"}
                        </button>

                    </div>

                </header>

                <LeaderboardTable
                    rows={visible}
                    isLoading={isLoading}
                    errorMessage={errorMessage}
                    onRemove={showingSample ? null : handleRemove}
                    removingId={removingId}
                    disabled={adding}
                    showAllMetrics={showAllMetrics}
                    colourFor={identityColour}
                    initialsFor={initials}
                    vendorFor={vendor}
                    emptyBecauseFiltered={
                        Boolean(filter.trim()) && board.length > 0
                    }
                />

            </section>

            {/* ---------------- THE LEADER, LANGUAGE BY LANGUAGE ---- */}

            {leader && breakdown.length > 0 && (

                <section className="rank-breakdown">

                    <header className="rank-breakdown-head">

                        <div>
                            <h2>
                                Where{" "}
                                {String(leader.name).split("/").pop()}
                                {" "}struggles
                            </h2>

                            <p>
                                What each language costs next to the same
                                sentence in English. 1.00&times; would be
                                parity; longer is worse.
                            </p>
                        </div>

                        <p className="rank-breakdown-count">
                            {breakdownLoading
                                ? <span className="spinner"></span>
                                : `${breakdown.length} languages`}
                        </p>

                    </header>

                    <ul className="rank-breakdown-list">

                        {breakdown.map((row) => (

                            <li key={row.language}>

                                <span className="rank-breakdown-name">
                                    {row.language}
                                </span>

                                <span className="rank-breakdown-track">
                                    <span
                                        className="rank-breakdown-fill"
                                        style={{
                                            width: `${Math.max(
                                                2,
                                                Math.min(
                                                    100,
                                                    (row.premium /
                                                        BREAKDOWN_CEILING) * 100
                                                )
                                            )}%`
                                        }}
                                    ></span>
                                </span>

                                <span className="rank-breakdown-value">
                                    {row.premium.toFixed(2)}&times;
                                </span>

                            </li>

                        ))}

                    </ul>

                    <p className="rank-breakdown-foot">
                        <span className="status-dot"></span>

                        <span>
                            Every bar is measured on the same FLORES
                            sentences, so the differences are the language
                            and the tokenizer, not the text.
                        </span>
                    </p>

                </section>

            )}

            <footer className="rank-footer">

                <span>
                    MzansiToken &middot; built for curious language people
                </span>

                {weightSentence && (
                    <span className="rank-footer-note">
                        Score weighted {weightSentence}, each part against a
                        fixed scale
                    </span>
                )}

            </footer>

        </div>
    );
}

export default Rank;