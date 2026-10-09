/*
    Rank Page
    Author: Mukovhe Ranwashe (RNWMUK001)
    September 2026
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "./Rank.css";

import {
    createOrUpdateLeaderboardEntry,
    restoreLeaderboardEntry,
    deleteLeaderboardEntry,
    friendlyError,
    getLeaderboard,
    getMetrics,
    getMetricsBulk,
    getSavedLeaderboardEntry,
    getOptions,
    getScoring,
    getTokenizerInfo,
} from "../api/client";

import { useAppState } from "../context/useAppState";

import LeaderboardTable from "../components/LeaderboardTable";

import LanguageHeatmap from "../components/LanguageHeatmap";

import StatusMessage from "../components/StatusMessage";

import StatusLine from "../components/StatusLine";

import { INITIAL_TOKENIZERS } from "./rankPlaceholders";

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
    A language with no NCHLT segmentations is not a failure - it is a
    language the dataset does not cover. Told apart by the backend's own
    wording, which mbi_router keeps stable for exactly this reason.
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

/*
    Pure - read only their own parameters - so there is no reason to
    redeclare either one on every render. Used by initialiseDefaultLeaderboard
    and handleAdd below.
*/
function hasCompleteLeaderboardMetrics(saved) {
    if (!saved) {
        return false;
    }

    return (

        saved.token_count !== null &&
        saved.token_count !== undefined &&
        Number.isFinite(Number(saved.token_count)) &&

        saved.fertility !== null &&
        saved.fertility !== undefined &&
        Number.isFinite(Number(saved.fertility)) &&

        saved.compression !== null &&
        saved.compression !== undefined &&
        Number.isFinite(Number(saved.compression)) &&

        saved.token_premium !== null &&
        saved.token_premium !== undefined &&
        Number.isFinite(Number(saved.token_premium)) &&

        saved.f1 !== null &&
        saved.f1 !== undefined &&
        Number.isFinite(Number(saved.f1)) &&

        saved.precision !== null &&
        saved.precision !== undefined &&
        Number.isFinite(Number(saved.precision)) &&

        saved.recall !== null &&
        saved.recall !== undefined &&
        Number.isFinite(Number(saved.recall))
    );
}

/* "restored 3" / "restored 2 and measured 1" */
function describeDefaults(restored, measured) {

    const parts = [];

    if (restored) {
        parts.push(`restored ${restored}`);
    }

    if (measured) {
        parts.push(`measured ${measured}`);
    }

    if (parts.length === 0) {
        return "Leaderboard ready.";
    }

    return `Leaderboard ready \u2014 ${parts.join(" and ")}.`;
}

function Rank() {

    /*
        The board, the heatmap grid, the scoring weights and the sort/
        filter controls all used to live in local state here, so leaving
        Rank for another page unmounted the component and took all of it
        with it - coming back meant remounting from zero and running the
        whole restore-or-measure flow again, even though nothing about
        the board had actually changed. These now live in AppStateContext,
        the same way Inspect and Compare's selections already do, so they
        survive navigating away and a page refresh - only the transient,
        in-progress-right-now state below (loading flags, add/remove
        status lines) stays local, because those are fine to reset.
    */
    const {
        rankInitialised,
        setRankInitialised,
        rankRows: rows,
        setRankRows: setRows,
        rankWeights: weights,
        setRankWeights: setWeights,
        rankSortKey: sortKey,
        setRankSortKey: setSortKey,
        rankBestFirst: bestFirst,
        setRankBestFirst: setBestFirst,
        rankFilter: filter,
        setRankFilter: setFilter,
        rankShowAllMetrics: showAllMetrics,
        setRankShowAllMetrics: setShowAllMetrics,
        rankFloresLanguages: floresLanguages,
        setRankFloresLanguages: setFloresLanguages,
        rankMatrix: matrix,
        setRankMatrix: setMatrix,
    } = useAppState();

    /* True only on a genuinely first load - a remount with the board
       already restored from context should show it immediately rather
       than flashing the loading state it does not need. */
    const [isLoading, setIsLoading] = useState(() => !rankInitialised);
    const [errorMessage, setErrorMessage] = useState("");

    const [adding, setAdding] = useState(false);
    const [addStatus, setAddStatus] = useState("");
    const [addFailed, setAddFailed] = useState(false);
    const [addPartial, setAddPartial] = useState(false);
    const [addedName, setAddedName] = useState("");

    const [removingId, setRemovingId] = useState(null);

    /* Per-tokenizer reasons the heatmap grid below could not read a row's
       metrics - keyed by tokenizer name, same key `matrix` uses. Local
       and not persisted: it is a live reflection of the most recent
       fetch, and a stale error surviving a reload after the real problem
       is fixed would be worse than no error at all. */
    const [matrixErrors, setMatrixErrors] = useState({});

    /* Per-language premiums for whoever is top of the board. Left local
       rather than lifted with the rest: it is keyed off the leader's name
       and re-reads a cached, near-instant endpoint, so it is cheap to
       refetch on every mount and that keeps it honestly fresh rather than
       trusting a stale copy. */
    const [breakdown, setBreakdown] = useState([]);

    /* Which leaderName `breakdown` currently reflects - not the same
       thing as `leaderName` itself while a fetch for a new leader is
       still in flight. breakdownLoading is derived from comparing the
       two instead of being its own toggled flag - see the effect. */
    const [breakdownFor, setBreakdownFor] = useState(null);

    /*
        Adding a tokenizer is a long chain of requests. If the user leaves
        the page halfway through, every one of them should stop, and none
        of them should write state into a component that is gone.
    */
    const addControllerRef = useRef(null);

    useEffect(() => {

        return () => addControllerRef.current?.abort();

    }, []);

    /* useCallback so initialiseDefaultLeaderboard below can list it as
       a dependency without that dependency changing identity every
       render - setRows is the only reactive thing this closes over,
       and setState setters are stable for the life of the component. */
    const loadLeaderboard = useCallback(async function loadLeaderboard(signal) {

        const data = await getLeaderboard(
            {
                sortBy: "overall_score",
                descending: true,
            },
            signal
        );

        const list = Array.isArray(data) ? data : [];

        setRows(list);

        /*
            Returned as well as stored: the mount effect below needs to
            know whether the board came back empty the moment this
            resolves, and reading the `rows` state right after calling
            this would still see the value from before the update -
            React batches it instead of applying it synchronously.
        */
        return list;
    }, [setRows]);

    /* Same reasoning as loadLeaderboard above - wrapped so the mount
       effect further down can depend on it honestly instead of lying
       with an empty array. hasCompleteLeaderboardMetrics and
       describeDefaults are not listed: they moved to module scope
       above, so their identity never changes at all. */
    const initialiseDefaultLeaderboard = useCallback(async function initialiseDefaultLeaderboard(signal) {
        /*
            These are the three tokenizers that make up the default Rank board.
            If a tokenizer was measured before, restore its saved measurement.
            Otherwise, measure it through the normal real-data pipeline.
        */
        const total = INITIAL_TOKENIZERS.length;

        /*
            The saved-entry lookups are cheap database reads, so they go out
            together and three sequential round trips become one wait. The
            measurements below stay one at a time: each one tokenizes the
            whole corpus in eight languages, and firing them at once would
            hold the API open for everything else - the same reason the
            per-language grid reads one tokenizer at a time.
        */
        setAddStatus("Checking for saved measurements...");

        const savedEntries = await Promise.all(
            INITIAL_TOKENIZERS.map(async (name) => {

                try {
                    return await getSavedLeaderboardEntry(name, signal);
                }
                catch (error) {

                    /* No saved measurement is an ordinary answer, not a
                       failure: it just means this one has to be measured. */
                    if (error.status !== 404) {
                        throw error;
                    }

                    return null;
                }
            })
        );

        let restored = 0;
        let measured = 0;

        for (let index = 0; index < total; index += 1) {

            const name = INITIAL_TOKENIZERS[index];
            const saved = savedEntries[index];
            const position = `${index + 1} of ${total}`;

            /*
                The tokenizer already has a measurement in the database.
                Reactivate it without running the expensive measurement
                again - restoreLeaderboardEntry (POST .../restore) just
                flips the row back to active, the same call handleAdd
                below already uses for the identical situation.
                createOrUpdateLeaderboardEntry was being called here
                instead, which re-runs the full FLORES + NCHLT
                measurement regardless of there being a saved result
                already sitting in the database - "Restoring" was
                claiming to skip the expensive path while actually
                paying for it every time.
            */
            if (hasCompleteLeaderboardMetrics(saved)) {

                setAddStatus(
                    `Restoring ${name} (${position})...`
                );

                await restoreLeaderboardEntry(
                    name,
                    signal
                );

                restored += 1;

                continue;
            }

            /*
                This tokenizer has never been measured, so use the real
                Hugging Face tokenizer and MzansiToken measurement pipeline.
                Worth naming as measuring rather than saving: it is the slow
                path, and a user who knows which one they are on knows why
                it is taking as long as it is.
            */
            setAddStatus(
                `Measuring ${name} for the first time (${position})...`
            );

            await getTokenizerInfo(name, signal);

            await createOrUpdateLeaderboardEntry(
                name,
                signal
            );

            measured += 1;
        }

        /*
            Now that all three defaults have been created/restored,
            fetch the real active leaderboard and put it into React state.
        */
        setAddStatus("Loading the leaderboard...");

        await loadLeaderboard(signal);

        /*
            The loop used to leave its last "Restoring..." line on screen
            for good, so the page went on claiming to be busy long after it
            had finished. Say what happened instead.
        */
        setAddStatus(describeDefaults(restored, measured));
    }, [loadLeaderboard]);

    useEffect(() => {

        const controller = new AbortController();

        async function initialiseRank() {

            setErrorMessage("");

            /*
                One cheap database read, first, on every mount - restored
                or not. This is what makes closing the site and reopening
                it show the previous board right away: a read straight
                from the database that was already sitting there, not a
                guess about whether this particular browser remembers
                finishing setup before. A revisit that already has the
                board in context (rankInitialised already true) still
                gets this same read, quietly replacing it with whatever
                is current rather than trusting a copy that could be
                stale - the one case that is worth the extra round trip
                is someone editing the same leaderboard from a second
                tab or machine.
            */
            let currentRows = [];

            try {

                currentRows = await loadLeaderboard(controller.signal);

            }
            catch (error) {

                if (error.name !== "AbortError") {

                    setErrorMessage(
                        friendlyError(error) ||
                        "Could not load the leaderboard."
                    );

                }

            }

            /* Whatever the database had to say, say it now - a revisit
               already showing the board from context never needed the
               spinner in the first place, and a genuine first load has
               real rows (or a real error) to show instead of one. */
            if (!controller.signal.aborted) {
                setIsLoading(false);
            }

            /*
                The one-time setup below - checking and seeding the four
                default tokenizers - has already run on this browser
                before. The read above is the whole story this time.
            */
            if (rankInitialised) {
                return;
            }

            try {

                const options = await getOptions(controller.signal);

                const optionsLanguages = options.languages || [];

                setFloresLanguages(optionsLanguages);

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

                /*
                    Only ever seed the defaults onto a board that is
                    genuinely empty in the database - never just because
                    this browser has not finished its one-time setup yet.
                    Checking currentRows (what the database just said)
                    rather than rankInitialised (what this browser
                    remembers) means a user who removed every tokenizer
                    on purpose gets the empty board they chose back, not
                    the defaults reappearing underneath them - and means
                    the same check is correct the very first time this
                    ever runs in any browser, not just this one.
                */
                if (currentRows.length === 0) {
                    await initialiseDefaultLeaderboard(controller.signal);
                }

                if (!controller.signal.aborted) {
                    setRankInitialised(true);
                }

            }
            catch (error) {

                if (error.name !== "AbortError") {

                    setErrorMessage(
                        friendlyError(error) ||
                        "Could not load the leaderboard."
                    );
                    setAddStatus("");
                }

            }

        }

        initialiseRank();

        return () => controller.abort();

    }, [initialiseDefaultLeaderboard, loadLeaderboard, rankInitialised, setFloresLanguages, setWeights, setRankInitialised]);

    async function handleAdd(requested) {
        const name = String(requested ?? filter).trim();

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
                Check first so a typo or a gated model comes back as the
                backend's own sentence - with its Hugging Face link - before
                the user waits through a full measurement run.
            */
            await getTokenizerInfo(name, controller.signal);

            /*
                Check whether this tokenizer was measured before.

                If it was previously removed from the leaderboard, its
                measurements are still stored in the database. Restoring
                those measurements avoids running the expensive efficiency
                and morphology calculations again.
            */
            setAddStatus(`Checking saved results for ${name}...`);

            let saved = null;

            try {
                saved = await getSavedLeaderboardEntry(
                    name,
                    controller.signal
                );
            }
            catch (error) {
                /*
                    A 404 simply means this tokenizer has never been measured.
                    Any other error should still be reported normally.
                */
                if (error.status !== 404) {
                    throw error;
                }
            }

            if (hasCompleteLeaderboardMetrics(saved)) {
                setAddStatus(`Restoring saved results for ${name}...`);

                await restoreLeaderboardEntry(
                    name,
                    controller.signal
                );

                await loadLeaderboard(controller.signal);

                setAddStatus(
                    `${name} restored using its previous measurement.`
                );

                setFilter("");
                return;
            }

            /*
                No saved measurement exists, so this is a new tokenizer.
                This is the only path that performs the expensive measurement.
            */
            setAddStatus(`Saving ${name}...`);

            const savedResult = await createOrUpdateLeaderboardEntry(
                name,
                controller.signal
            );

            const measured = savedResult.metrics;

            await loadLeaderboard(controller.signal);

            const morphologyNote = measured.morphology_measured
                ? `, morphology on ${measured.morphology_measured}`
                : ", no morphology data";

            const failures = measured.failed_languages || [];

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
                    `${name} scored on ${measured.languages_measured} ` +
                    `languages${morphologyNote}. Morphology failed on ` +
                    `${failures.map((item) => item.language).join(", ")}: ` +
                    `${failures[0].detail}`
                );
            }
            else {
                setAddStatus(
                    `${name} scored on ${measured.languages_measured} ` +
                    `languages${morphologyNote}.`
                );
            }

            setFilter("");
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

    const board = rows;

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

    /* A plain string, so the grid's effect only reruns when the board's
       membership actually changes. Newline-joined because a model name can
       contain a slash but never a line break. */
    const boardNames = useMemo(
        () => ranked.map((row) => row.name).join("\n"),
        [ranked]
    );

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
            /* Not cleared here on purpose: the section below only
               renders when `leader` is truthy, so a stale breakdown
               sitting in state while there is no leader is never
               seen. Resetting it was a synchronous setState with
               nothing behind it. */
            return;
        }

        const controller = new AbortController();

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
                setBreakdownFor(leaderName);
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
                    setBreakdownFor(leaderName);
                }
            });

        return () => controller.abort();

    }, [leaderName]);

    /* True from the render where leaderName changes until the
       matching fetch above resolves - no separate flag to drift
       out of sync with what actually happened. */
    const breakdownLoading = Boolean(leaderName) && breakdownFor !== leaderName;

    /*
        The same per-language read, for every tokenizer on the board -
        now one request for the whole board instead of one per row.

        Keyed on the joined names rather than on `ranked`: the array is
        rebuilt on every reload, so depending on it would refetch forever.

        This used to call getMetrics once per tokenizer, one at a time,
        specifically to avoid firing several uncached tokenizations at
        the backend concurrently - a cold tokenizer makes it tokenize the
        whole corpus in eight languages, and ten of those at once would
        have held the API open for everything else. getMetricsBulk keeps
        that same one-at-a-time behaviour, just inside one request on the
        server rather than N requests from the browser - for a board
        that is already measured (the common case: reloading Rank with
        tokenizers already on it), every one of those is a cache hit, so
        collapsing N round trips into one is a real, measurable win and
        costs nothing for a board that genuinely is still being measured
        for the first time.

        The one trade-off worth knowing: the grid used to fill in row by
        row as each read landed. One request means one update instead -
        for the common cached case that is strictly faster to look at
        (everything appears almost immediately, rather than ten rows
        trickling in), but a genuinely unmeasured board now shows
        "Measuring..." and then fills in all at once, rather than
        row by row.
    */
    useEffect(() => {

        const names = boardNames ? boardNames.split("\n") : [];

        /* Nothing to read. What is already stored can stay: the grid only
           ever draws the rows the board currently has, and keeping a
           measurement means a tokenizer added back is instant. */
        if (names.length === 0) {
            return;
        }

        const controller = new AbortController();

        async function readEveryTokenizer() {

            try {

                const { metrics: perTokenizer, errors } = await getMetricsBulk(
                    names,
                    controller.signal
                );

                const nextEntries = {};
                const nextErrors = {};

                for (const name of names) {

                    const perLanguage = perTokenizer?.[name];

                    if (!perLanguage) {
                        /* Reported in `errors` by the backend, or simply
                           missing - either way this row failed, not the
                           whole grid. Keep the reason so the grid can
                           show it instead of a blank row with no
                           explanation. */
                        nextEntries[name] = { cells: {}, mean: NaN };

                        if (errors?.[name]) {
                            nextErrors[name] = errors[name];
                        }

                        continue;
                    }

                    const cells = {};
                    let total = 0;
                    let counted = 0;

                    Object.keys(perLanguage).forEach((language) => {

                        const premium = Number(
                            perLanguage[language]?.token_premium
                        );

                        if (!Number.isFinite(premium)) {
                            return;
                        }

                        cells[language] = premium;

                        /* English is the yardstick, so averaging it in
                           would flatter every tokenizer by the same 1.0. */
                        if (language !== BASELINE_LANGUAGE) {
                            total += premium;
                            counted += 1;
                        }
                    });

                    nextEntries[name] = {
                        cells: cells,
                        mean: counted ? total / counted : NaN,
                    };
                }

                setMatrix((previous) => ({
                    ...previous,
                    ...nextEntries,
                }));

                /* Clear this round's names first, then apply this round's
                   errors - so a tokenizer that failed last time and loads
                   fine now drops its old reason instead of carrying it
                   forever. Still logged too, for anyone with the console
                   open mid-development. */
                setMatrixErrors((previous) => {

                    const updated = { ...previous };

                    for (const name of names) {
                        delete updated[name];
                    }

                    return { ...updated, ...nextErrors };

                });

                if (errors && Object.keys(errors).length > 0) {
                    /* One tokenizer failing costs one row, not the grid. */
                    console.warn(
                        "Could not read per-language metrics for",
                        errors
                    );
                }

            }
            catch (error) {

                /* Leaving the page aborts the request in flight. Chrome
                   reports that as a plain TypeError rather than an
                   AbortError, so check the signal too - otherwise every
                   navigation away logs a warning about nothing. */
                if (error.name === "AbortError" || controller.signal.aborted) {
                    return;
                }

                console.warn(
                    "Could not read per-language metrics",
                    error
                );
            }
        }

        readEveryTokenizer();

        return () => controller.abort();

    }, [boardNames, setMatrix]);

    /* The grid's rows, in the board's own order - two different orders on
       one page would only invite the reader to reconcile them. */
    /* Follows whatever the board is showing. Searching the table and
       leaving the grid on all ten rows reads as the grid ignoring you. */
    const matrixRows = useMemo(() => (
        visible.map((row) => ({
            id: row.name,
            name: String(row.name).split("/").pop(),
            cells: matrix[row.name]?.cells || null,
            mean: matrix[row.name]?.mean,
            error: matrixErrors[row.name] || null,
        }))
    ), [visible, matrix, matrixErrors]);

    const matrixLoaded = useMemo(() => (
        visible.filter((row) => matrix[row.name]).length
    ), [visible, matrix]);

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
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    handleAdd();
                                }
                            }}
                            placeholder="Find a tokenizer..."
                            aria-label="Find a tokenizer"
                            disabled={adding}
                        />

                    </div>

                    <button
                        type="button"
                        className="rank-add-cta"
                        onClick={() => handleAdd()}
                        disabled={
                            busy ||
                            isLoading ||
                            !filter.trim()
                        }
                    >
                        <span aria-hidden="true">+</span>
                        {adding ? "Adding..." : "Add tokenizer"}
                    </button>

                </div>

                {addStatus && (
                    <div
                        className={`selection-status ${
                            addFailed
                                ? "is-error"
                                : (busy || isLoading)
                                    ? "is-loading"
                                    : addPartial
                                        ? "is-partial"
                                        : "is-ready"
                        }`}
                    >
                        {/*
                            isLoading belongs here as much as busy does.
                            Without it the first load drew a green dot and
                            no spinner beside "Restoring...", so the line
                            looked finished the whole time it was working.
                        */}
                        {(busy || isLoading)
                            ? <span className="spinner"></span>
                            : <span className="status-dot"></span>}
                        <StatusMessage
                            text={addStatus}
                            failed={addFailed}
                            modelName={addedName}
                        />
                    </div>
                )}

                {/*
                    The board failed to load entirely - under "rank by
                    Overall score" with everything else this bar
                    reports, not down where the (now empty) board
                    itself sits.
                */}
                {errorMessage && (
                    <StatusLine state="error" text={errorMessage} />
                )}

            </section>

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
                    onRemove={handleRemove}
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

            {/* The whole board at once, not just the leader. */}

            {!errorMessage && (
                <LanguageHeatmap
                    languages={floresLanguages}
                    rows={matrixRows}
                    loadedCount={matrixLoaded}
                    total={matrixRows.length}
                />
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