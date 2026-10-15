/*
    Rank.test.jsx
    Author: Mukovhe Ranwashe

    Rank.jsx is 1400+ lines of async orchestration (restore-or-measure
    the four starter tokenizers, reload the board, fetch the leader's
    per-language breakdown, fetch the whole-board heatmap) around one
    real backend. None of that had a test before this file - this
    covers the paths most likely to break silently: the initial load
    (success and failure), adding a tokenizer (new, restored, partial,
    and failed), removing one, and the sort/filter controls.

    Every row name on this page is rendered in up to three places at
    once - the leaderboard table, the "Close at the top" spotlight
    list, and the per-language heatmap - so a plain screen.getByText
    on a tokenizer name is ambiguous the moment there is more than one
    row. Assertions about what the TABLE shows go through
    leaderboardRows(), scoped to the ".rank-board" section; assertions
    about the leader go through the ".rank-leader-name" heading.

    The whole api/client module is mocked - every function Rank.jsx
    imports from it - except friendlyError and ApiError, which are
    kept real so the error-message assertions exercise the actual
    error-formatting logic rather than a stub standing in for it.

    Rank reads and writes its board, weights and sort/filter controls
    through AppStateContext now, not local state - the same place
    Compare already keeps its selections - so it is rendered inside the
    real AppStateProvider here too. Those values persist to localStorage
    (so a refresh does not cost a remeasure of everything either), which
    is cleared before every test for the same reason Compare's test does.
*/

import { StrictMode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

import Rank from "../Rank";
import { AppStateProvider } from "../../context/AppStateContext";

vi.mock("../../api/client", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getOptions: vi.fn(),
        getScoring: vi.fn(),
        getTokenizerInfo: vi.fn(),
        getSavedLeaderboardEntry: vi.fn(),
        createOrUpdateLeaderboardEntry: vi.fn(),
        restoreLeaderboardEntry: vi.fn(),
        deleteLeaderboardEntry: vi.fn(),
        fillLeaderboardVocabulary: vi.fn(),
        getLeaderboard: vi.fn(),
        getMetrics: vi.fn(),
        getMetricsBulk: vi.fn(),
    };
});

import {
    ApiError,
    getOptions,
    getScoring,
    getTokenizerInfo,
    getSavedLeaderboardEntry,
    createOrUpdateLeaderboardEntry,
    restoreLeaderboardEntry,
    deleteLeaderboardEntry,
    fillLeaderboardVocabulary,
    getLeaderboard,
    getMetrics,
    getMetricsBulk,
} from "../../api/client";

function renderRank() {
    return render(
        <AppStateProvider>
            <Rank />
        </AppStateProvider>
    );
}

/*
    A fully-measured saved entry, for the restore path. Every field
    hasCompleteLeaderboardMetrics checks for, present and finite.
*/
function makeSavedEntry(overrides = {}) {
    return {
        token_count: 12000,
        fertility: 1.2,
        compression: 0.6,
        token_premium: 1.3,
        f1: 0.6,
        precision: 0.55,
        recall: 0.5,
        ...overrides,
    };
}

function makeRow(overrides = {}) {
    return {
        id: 1,
        name: "openai/gpt-4o",
        overall_score: 80,
        token_count: 12000,
        compression: 0.6,
        fertility: 1.2,
        token_premium: 1.3,
        f1: 0.6,
        precision: 0.55,
        recall: 0.5,
        /* Measured with the vocabulary columns, like any entry saved
           today - the fill-in tests below override these with null. */
        renyi_efficiency: 0.7,
        productivity: 3.1,
        idiosyncrasy: 9.2,
        ...overrides,
    };
}

/* Only the leaderboard table itself - not the spotlight's "Close at
   the top" list or the per-language heatmap, which repeat the same
   row names and would otherwise make every text query ambiguous. */
function leaderboardRows() {
    return within(document.querySelector(".rank-board"));
}

function leaderName() {
    return document.querySelector(".rank-leader-name")?.textContent;
}

/*
    Lets a test control what the NEXT getLeaderboard() call returns,
    without having to know how many times Rank has already called it
    (once on mount, again after every add/remove).
*/
let board = [];

function setBoard(rows) {
    board = rows;
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    board = [];

    getOptions.mockResolvedValue({ languages: ["English", "isiZulu"] });
    getScoring.mockResolvedValue({ weights: null });

    /* Every INITIAL_TOKENIZERS name counts as already measured by
       default, so a plain render restores instead of measuring - the
       cheap, common case, and it means getTokenizerInfo only has to
       be mocked by tests that actually exercise the "new tokenizer"
       path through handleAdd. */
    getSavedLeaderboardEntry.mockImplementation(async () => makeSavedEntry());
    getTokenizerInfo.mockResolvedValue({});
    createOrUpdateLeaderboardEntry.mockResolvedValue({
        metrics: {
            languages_measured: 8,
            morphology_measured: 7,
            failed_languages: [],
        },
    });
    restoreLeaderboardEntry.mockResolvedValue({});
    deleteLeaderboardEntry.mockResolvedValue({});
    fillLeaderboardVocabulary.mockResolvedValue({});

    getLeaderboard.mockImplementation(async () => board);

    getMetrics.mockResolvedValue({});
    getMetricsBulk.mockResolvedValue({ metrics: {}, errors: {} });
});

describe("Rank - initial load", () => {

    it("shows an already-persisted board immediately, without re-running the starter bootstrap", async () => {

        /*
            The database already has a real board on the very first
            read - the common case for every restart after the first
            one. The starter bootstrap (checking and restoring/measuring
            the four defaults) exists only to seed an empty board, so it
            must not run at all here - not even to quietly restore
            tokenizers that aren't even among the four defaults.
        */
        setBoard([
            makeRow({ id: 1, name: "openai/gpt-4o", overall_score: 91.2 }),
            makeRow({ id: 2, name: "google/byt5-small", overall_score: 71.2 }),
        ]);

        renderRank();

        expect(await screen.findByText("Current leader")).toBeInTheDocument();

        /* The leader is whichever row scores highest, not whichever the
           backend listed first - gpt-4o here, not byt5-small. */
        expect(leaderName()).toBe("gpt-4o");

        expect(
            document.querySelector(".rank-board-count").textContent
        ).toMatch(/02\s*tokenizers.*sorted by/i);

        /* No "Leaderboard ready - restored ..." line, because nothing
           needed restoring - the board shown is exactly what the
           database already had, nothing added underneath it. */
        expect(
            screen.queryByText(/Leaderboard ready/i)
        ).not.toBeInTheDocument();

        /* The four defaults are looked up (a cheap database read, to
           catch a setup that was cut short), but every one of them
           already has a saved record here, so nothing is restored or
           measured. */
        expect(getTokenizerInfo).not.toHaveBeenCalled();
        expect(restoreLeaderboardEntry).not.toHaveBeenCalled();
        expect(createOrUpdateLeaderboardEntry).not.toHaveBeenCalled();
    });

    it("finishes a setup that was cut short, without touching the defaults already saved", async () => {

        /*
            Leaving Rank while the four defaults are still being measured
            stops the loop. Here two got measured before that happened:
            the board has them, and the other two have no saved record
            at all. The board is not empty, so it used to stay two short
            for good.
        */
        setBoard([
            makeRow({ id: 1, name: "gpt2", overall_score: 60 }),
            makeRow({ id: 2, name: "xlm-roberta-base", overall_score: 67 }),
        ]);

        getSavedLeaderboardEntry.mockImplementation(async (name) => {
            if (name === "gpt2" || name === "xlm-roberta-base") {
                return makeSavedEntry();
            }
            throw new ApiError("Not found", 404, null);
        });

        renderRank();

        expect(
            await screen.findByText("Leaderboard ready — measured 2.")
        ).toBeInTheDocument();

        /* Only the two that were never measured... */
        expect(createOrUpdateLeaderboardEntry).toHaveBeenCalledTimes(2);
        expect(createOrUpdateLeaderboardEntry).toHaveBeenCalledWith(
            "Davlan/afro-xlmr-base", expect.anything()
        );
        expect(createOrUpdateLeaderboardEntry).toHaveBeenCalledWith(
            "facebook/nllb-200-distilled-600M", expect.anything()
        );

        /* ...and nothing already saved is restored or re-measured. */
        expect(restoreLeaderboardEntry).not.toHaveBeenCalled();
    });

    it("leaves a default the user removed off the board", async () => {

        /* nllb was removed on purpose: it has a saved record, it is just
           not on the board. That is the user's choice, not a setup that
           was cut short, so it must not come back on its own. */
        setBoard([
            makeRow({ id: 1, name: "gpt2" }),
            makeRow({ id: 2, name: "xlm-roberta-base" }),
            makeRow({ id: 3, name: "Davlan/afro-xlmr-base" }),
        ]);

        renderRank();
        await screen.findByText("Current leader");

        await vi.waitFor(() => {
            expect(getSavedLeaderboardEntry).toHaveBeenCalledTimes(4);
        });

        expect(restoreLeaderboardEntry).not.toHaveBeenCalled();
        expect(createOrUpdateLeaderboardEntry).not.toHaveBeenCalled();
        expect(screen.queryByText(/Leaderboard ready/)).not.toBeInTheDocument();
    });

    it("seeds the four starter tokenizers only when the database leaderboard is genuinely empty", async () => {

        /* board stays at its beforeEach default of [] - a first-ever
           run, nothing saved anywhere yet. gpt2 has never been
           measured; the other three starters already have a complete
           saved entry (the default getSavedLeaderboardEntry mock). */
        getSavedLeaderboardEntry.mockImplementation(async (name) => {
            if (name === "gpt2") {
                throw new ApiError("Not found", 404, null);
            }
            return makeSavedEntry();
        });

        renderRank();

        expect(
            await screen.findByText("Leaderboard ready — restored 3 and measured 1.")
        ).toBeInTheDocument();

        /* The three already-measured starters must be restored - a
           cheap reactivation - never sent through the expensive
           measure-from-scratch call. */
        expect(restoreLeaderboardEntry).toHaveBeenCalledTimes(3);

        /* gpt2 is the one starter with no saved entry, so it is the
           only one that should have gone through the slow, real
           tokenizer-info check and the one call that actually
           measures rather than restores. */
        expect(getTokenizerInfo).toHaveBeenCalledTimes(1);
        expect(getTokenizerInfo).toHaveBeenCalledWith(
            "gpt2",
            expect.anything()
        );
        expect(createOrUpdateLeaderboardEntry).toHaveBeenCalledTimes(1);
        expect(createOrUpdateLeaderboardEntry).toHaveBeenCalledWith(
            "gpt2",
            expect.anything()
        );
    });

    it("reports a starter that would not load with the same sentence every other page shows", async () => {

        const reason =
            "Model 'gpt2' not found on Hugging Face. Names are case-sensitive " +
            "and include the owner: https://huggingface.co/models";

        getSavedLeaderboardEntry.mockImplementation(async (name) => {
            if (name === "gpt2") {
                throw new ApiError("Not found", 404, null);
            }
            return makeSavedEntry();
        });

        getTokenizerInfo.mockRejectedValue(new ApiError(reason, 400, null));

        renderRank();

        /* The backend's own sentence, after the summary - not wrapped in
           "1 did not load: gpt2 (...)", which named gpt2 twice. */
        const status = await screen.findByText(/Leaderboard ready — restored 3\./);

        expect(status.closest(".selection-status").textContent).toContain(
            "Leaderboard ready — restored 3. Model 'gpt2' not found on Hugging Face."
        );
        expect(screen.queryByText(/did not load/)).not.toBeInTheDocument();
    });

    it("still seeds the starters under StrictMode, where the first mount is aborted straight away", async () => {

        /*
            main.jsx renders the app inside <StrictMode>, which in
            development mounts every page, unmounts it and mounts it
            again. The first run's requests are aborted almost at once.
            Rank used to let that aborted run carry on, mark the seeding
            check as done, and die - so the real second run skipped
            seeding and the page sat on "Checking for saved
            measurements..." forever with an empty board.

            The mocks here honour the abort signal the way a real fetch
            does - after a tick, not synchronously - because a mock that
            ignores the signal lets the aborted run finish its work and
            hides the bug completely.
        */
        const abortable = (result) => async (...args) => {
            const signal = args[args.length - 1];
            await Promise.resolve();
            if (signal?.aborted) {
                throw new DOMException("The operation was aborted.", "AbortError");
            }
            return result(...args);
        };

        getLeaderboard.mockImplementation(abortable(() => board));

        getSavedLeaderboardEntry.mockImplementation(abortable((name) => {
            if (name === "gpt2") {
                throw new ApiError("Not found", 404, null);
            }
            return makeSavedEntry();
        }));

        render(
            <StrictMode>
                <AppStateProvider>
                    <Rank />
                </AppStateProvider>
            </StrictMode>
        );

        /* Nothing can be added until the defaults are done... */
        expect(screen.getByLabelText("Find a tokenizer")).toBeDisabled();

        expect(
            await screen.findByText("Leaderboard ready — restored 3 and measured 1.")
        ).toBeInTheDocument();

        /* ...and the lock lifts once they are. */
        expect(screen.getByLabelText("Find a tokenizer")).toBeEnabled();

        /* Exactly once each - the aborted first run must not have done
           any of this work, and the real run must not have done it twice. */
        expect(restoreLeaderboardEntry).toHaveBeenCalledTimes(3);
        expect(createOrUpdateLeaderboardEntry).toHaveBeenCalledTimes(1);
    });

    it("shows a failed initial load as an error, without crashing the page", async () => {

        getOptions.mockRejectedValue(new Error("Failed to fetch"));

        renderRank();

        const alert = await screen.findByRole("alert");

        expect(alert).toHaveTextContent(/cannot reach the backend/i);

        /* errorMessage is for a board that could not load at all - the
           table underneath renders nothing of its own (same contract
           LeaderboardTable.test.jsx checks in isolation), and the
           spotlight is hidden with it. */
        expect(
            document.querySelector(".rank-board").querySelector("table")
        ).not.toBeInTheDocument();
        expect(screen.queryByText("Current leader")).not.toBeInTheDocument();
    });

});

describe("Rank - adding a tokenizer", () => {

    it("measures a brand-new tokenizer and reports what it found", async () => {

        setBoard([makeRow({ id: 1, name: "openai/gpt-4o" })]);

        renderRank();
        await screen.findByText("Current leader");

        getSavedLeaderboardEntry.mockImplementation(async (name) => {
            if (name === "facebook/new-tokenizer") {
                throw new ApiError("Not found", 404, null);
            }
            return makeSavedEntry();
        });

        createOrUpdateLeaderboardEntry.mockResolvedValue({
            metrics: {
                languages_measured: 8,
                morphology_measured: 7,
                failed_languages: [],
            },
        });

        setBoard([
            makeRow({ id: 1, name: "openai/gpt-4o" }),
            makeRow({ id: 2, name: "facebook/new-tokenizer", overall_score: 60 }),
        ]);

        const user = userEvent.setup();

        await user.type(
            screen.getByLabelText("Find a tokenizer"),
            "facebook/new-tokenizer"
        );

        await user.click(screen.getByRole("button", { name: /add tokenizer/i }));

        expect(
            await screen.findByText(
                "facebook/new-tokenizer scored on 8 languages, morphology on 7."
            )
        ).toBeInTheDocument();

        expect(
            await leaderboardRows().findByText("new-tokenizer")
        ).toBeInTheDocument();
    });

    it("marks a partial measurement when morphology fails on some languages", async () => {

        setBoard([makeRow({ id: 1 })]);

        renderRank();
        await screen.findByText("Current leader");

        getSavedLeaderboardEntry.mockImplementation(async (name) => {
            if (name === "some/model") {
                throw new ApiError("Not found", 404, null);
            }
            return makeSavedEntry();
        });

        createOrUpdateLeaderboardEntry.mockResolvedValue({
            metrics: {
                languages_measured: 8,
                morphology_measured: 6,
                failed_languages: [
                    { language: "isiZulu", detail: "no gold segmentations" },
                ],
            },
        });

        const user = userEvent.setup();

        await user.type(screen.getByLabelText("Find a tokenizer"), "some/model");
        await user.click(screen.getByRole("button", { name: /add tokenizer/i }));

        const status = await screen.findByText(
            /some\/model scored on 8 languages, morphology on 6\./
        );

        expect(status).toBeInTheDocument();
        expect(status.textContent).toMatch(
            /Morphology failed on isiZulu: no gold segmentations/
        );

        expect(
            document.querySelector(".selection-status.is-partial")
        ).toBeTruthy();
    });

    it("reports a failed add without wiping the existing board", async () => {

        setBoard([makeRow({ id: 1, name: "openai/gpt-4o" })]);

        renderRank();
        await screen.findByText("Current leader");

        getTokenizerInfo.mockRejectedValue(
            new ApiError(
                "Model 'bad/name' not found on Hugging Face. Check the model " +
                    "name at https://huggingface.co/models",
                400,
                null
            )
        );

        const user = userEvent.setup();

        const findInput = screen.getByLabelText("Find a tokenizer");

        await user.type(findInput, "bad/name");
        await user.click(screen.getByRole("button", { name: /add tokenizer/i }));

        expect(
            await screen.findByText(/model 'bad\/name' not found/i)
        ).toBeInTheDocument();

        expect(
            document.querySelector(".selection-status.is-error")
        ).toBeTruthy();

        /* The box is emptied after a failure, so the user retypes the
           name - and it no longer filters the table down to nothing. */
        expect(findInput).toHaveValue("");

        /* The board itself never heard about this failure - still
           showing the one row it had before the failed add. */
        expect(leaderName()).toBe("gpt-4o");
        expect(
            await leaderboardRows().findByText("gpt-4o")
        ).toBeInTheDocument();
    });

    it("restores a tokenizer that already has a saved measurement, instead of re-measuring it", async () => {

        setBoard([makeRow({ id: 1, name: "openai/gpt-4o" })]);

        renderRank();
        await screen.findByText("Current leader");

        /* Everything up to here (mount) has already called
           createOrUpdateLeaderboardEntry once per starter tokenizer -
           clear that history so the assertions below describe only
           the add this test is actually about. */
        vi.clearAllMocks();
        getLeaderboard.mockImplementation(async () => board);
        getSavedLeaderboardEntry.mockResolvedValue(makeSavedEntry());
        restoreLeaderboardEntry.mockResolvedValue({});

        setBoard([
            makeRow({ id: 1, name: "openai/gpt-4o" }),
            makeRow({ id: 2, name: "google/byt5-small" }),
        ]);

        const user = userEvent.setup();

        await user.type(screen.getByLabelText("Find a tokenizer"), "google/byt5-small");
        await user.click(screen.getByRole("button", { name: /add tokenizer/i }));

        expect(
            await screen.findByText(
                "google/byt5-small restored using its previous measurement."
            )
        ).toBeInTheDocument();

        /* The slow path - a real measurement - must not have run. */
        expect(createOrUpdateLeaderboardEntry).not.toHaveBeenCalled();
        expect(restoreLeaderboardEntry).toHaveBeenCalledWith(
            "google/byt5-small",
            expect.anything()
        );
    });

});

describe("Rank - removing a tokenizer", () => {

    it("removes a row and reloads the board", async () => {

        setBoard([
            makeRow({ id: 1, name: "openai/gpt-4o" }),
            makeRow({ id: 2, name: "google/byt5-small", overall_score: 50 }),
        ]);

        renderRank();
        await screen.findByText("Current leader");

        expect(
            await leaderboardRows().findByText("byt5-small")
        ).toBeInTheDocument();

        setBoard([makeRow({ id: 1, name: "openai/gpt-4o" })]);

        const user = userEvent.setup();

        await user.click(
            screen.getByRole("button", {
                name: "Remove google/byt5-small from the leaderboard",
            })
        );

        expect(
            await screen.findByText("google/byt5-small removed.")
        ).toBeInTheDocument();

        expect(
            leaderboardRows().queryByText("byt5-small")
        ).not.toBeInTheDocument();
        expect(deleteLeaderboardEntry).toHaveBeenCalledWith(2);
    });

    it("reports a failed remove and leaves the row in place", async () => {

        setBoard([makeRow({ id: 1, name: "openai/gpt-4o" })]);

        renderRank();
        await screen.findByText("Current leader");

        deleteLeaderboardEntry.mockRejectedValue(
            new ApiError("Could not reach the database.", 500, null)
        );

        const user = userEvent.setup();

        await user.click(
            screen.getByRole("button", {
                name: "Remove openai/gpt-4o from the leaderboard",
            })
        );

        expect(
            await screen.findByText(/could not reach the database/i)
        ).toBeInTheDocument();

        /* Still there - the delete never went through. */
        expect(leaderName()).toBe("gpt-4o");
    });

});

describe("Rank - sorting and filtering the board", () => {

    it("re-sorts the board when the rank-by control changes", async () => {

        setBoard([
            makeRow({ id: 1, name: "openai/gpt-4o", overall_score: 80, compression: 0.9 }),
            makeRow({ id: 2, name: "google/byt5-small", overall_score: 60, compression: 0.2 }),
        ]);

        renderRank();
        await screen.findByText("Current leader");

        function namesInOrder() {
            return leaderboardRows()
                .getAllByText(/^(gpt-4o|byt5-small)$/)
                .map((node) => node.textContent);
        }

        /* Default: ranked by overall score, best first - gpt-4o leads. */
        expect(namesInOrder()).toEqual(["gpt-4o", "byt5-small"]);

        const user = userEvent.setup();

        /* Switch "best first" to "worst first" on Compression - lower
           compression value (byt5-small, 0.2) should lead over
           gpt-4o's 0.9. */
        await user.selectOptions(screen.getByDisplayValue("Overall score"), "compression");
        await user.selectOptions(screen.getByDisplayValue("Best first"), "worst");

        expect(namesInOrder()).toEqual(["byt5-small", "gpt-4o"]);
    });

    it("filters the board by name and updates the visible count", async () => {

        setBoard([
            makeRow({ id: 1, name: "openai/gpt-4o" }),
            makeRow({ id: 2, name: "google/byt5-small" }),
        ]);

        renderRank();
        await screen.findByText("Current leader");

        const user = userEvent.setup();

        await user.type(screen.getByLabelText("Find a tokenizer"), "byt5");

        expect(leaderboardRows().queryByText("gpt-4o")).not.toBeInTheDocument();
        expect(leaderboardRows().getByText("byt5-small")).toBeInTheDocument();

        /* "01 of 02", not a bare "01" - hidden rows are not missing rows. */
        expect(
            document.querySelector(".rank-board-count").textContent
        ).toMatch(/01\s*of\s*02\s*tokenizers.*sorted by/i);
    });

    it("opens on the whole board after a refresh, whatever was left in the search box", async () => {

        /*
            Whatever was typed in the search box used to be saved and come
            back after a refresh, filtering the board as it loaded - a
            search with no matches showed "Nothing matches that.", which
            looks exactly like the board was wiped.
        */
        setBoard([
            makeRow({ id: 1, name: "openai/gpt-4o" }),
            makeRow({ id: 2, name: "google/byt5-small" }),
        ]);

        const first = renderRank();
        await screen.findByText("Current leader");

        const user = userEvent.setup();
        await user.type(screen.getByLabelText("Find a tokenizer"), "tiiuae/falcon-7b");

        expect(screen.getByText("Nothing matches that.")).toBeInTheDocument();

        /* A refresh: everything in memory is gone, localStorage is not. */
        first.unmount();
        renderRank();
        await screen.findByText("Current leader");

        expect(screen.getByLabelText("Find a tokenizer")).toHaveValue("");
        expect(
            document.querySelector(".rank-board-count").textContent
        ).toMatch(/^\s*02\s*tokenizers/i);
    });

});

describe("Rank - choosing which columns show", () => {

    function boardHeader(name) {
        return leaderboardRows().queryByRole("columnheader", { name });
    }

    async function openColumns(user) {
        await user.click(
            leaderboardRows().getByRole("button", { name: /columns/i })
        );
    }

    it("hides a column from the Columns panel and keeps it hidden after a refresh", async () => {

        const user = userEvent.setup();

        setBoard([
            makeRow({ renyi_efficiency: 0.61, productivity: 3.44, idiosyncrasy: 12.26 }),
        ]);

        const { unmount } = renderRank();
        await screen.findByText("Current leader");

        /* The three new ones are on by default. */
        expect(boardHeader(/productivity/i)).toBeInTheDocument();
        expect(boardHeader(/rényi/i)).toBeInTheDocument();
        expect(leaderboardRows().getByText("3.4")).toBeInTheDocument();

        await openColumns(user);
        await user.click(screen.getByRole("checkbox", { name: /productivity/i }));

        expect(boardHeader(/productivity/i)).not.toBeInTheDocument();
        expect(leaderboardRows().queryByText("3.4")).not.toBeInTheDocument();

        /* Display only: nothing was sent to the backend. */
        expect(createOrUpdateLeaderboardEntry).not.toHaveBeenCalled();
        expect(deleteLeaderboardEntry).not.toHaveBeenCalled();

        unmount();
        renderRank();
        await screen.findByText("Current leader");

        expect(boardHeader(/productivity/i)).not.toBeInTheDocument();
        expect(boardHeader(/rényi/i)).toBeInTheDocument();
    });

    it("can bring a folded-away column in, and Reset puts the defaults back", async () => {

        const user = userEvent.setup();

        setBoard([makeRow()]);
        renderRank();
        await screen.findByText("Current leader");

        expect(boardHeader(/^tokens/i)).not.toBeInTheDocument();

        await openColumns(user);
        await user.click(screen.getByRole("checkbox", { name: /^tokens/i }));
        await user.click(screen.getByRole("checkbox", { name: /rényi/i }));

        expect(boardHeader(/^tokens/i)).toBeInTheDocument();
        expect(boardHeader(/rényi/i)).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Reset" }));

        expect(boardHeader(/^tokens/i)).not.toBeInTheDocument();
        expect(boardHeader(/rényi/i)).toBeInTheDocument();
    });

    it("never offers to hide the tokenizer name or the score", async () => {

        const user = userEvent.setup();

        setBoard([makeRow()]);
        renderRank();
        await screen.findByText("Current leader");

        await openColumns(user);

        /* Exact names - "not scored" on the reference columns would match
           a looser /score/. */
        expect(screen.queryByRole("checkbox", { name: "Score" })).not.toBeInTheDocument();
        expect(screen.queryByRole("checkbox", { name: "Tokenizer" })).not.toBeInTheDocument();
        expect(screen.getAllByRole("checkbox")).toHaveLength(10);

        /* The not-scored ones say so in the panel. */
        expect(
            screen.getByRole("checkbox", { name: /idiosyncrasy/i }).closest("label")
        ).toHaveTextContent(/not scored/i);
    });

    it("closes on Escape and hands focus back to the button", async () => {

        const user = userEvent.setup();

        setBoard([makeRow()]);
        renderRank();
        await screen.findByText("Current leader");

        await openColumns(user);
        expect(screen.getByRole("group", { name: /columns shown/i })).toBeInTheDocument();

        await user.keyboard("{Escape}");

        expect(screen.queryByRole("group", { name: /columns shown/i })).not.toBeInTheDocument();
        expect(
            leaderboardRows().getByRole("button", { name: /columns/i })
        ).toHaveFocus();
    });

    it("closes when you click somewhere else on the page", async () => {

        const user = userEvent.setup();

        setBoard([makeRow()]);
        renderRank();
        await screen.findByText("Current leader");

        await openColumns(user);
        await user.click(screen.getByText("The leaderboard"));

        expect(screen.queryByRole("group", { name: /columns shown/i })).not.toBeInTheDocument();
    });

    it("keeps an older All metrics choice when it first opens", async () => {

        localStorage.setItem("rankShowAllMetrics", "true");

        setBoard([makeRow()]);
        renderRank();
        await screen.findByText("Current leader");

        expect(boardHeader(/^tokens/i)).toBeInTheDocument();
        expect(boardHeader(/precision/i)).toBeInTheDocument();
    });

    it("ignores a damaged saved setting and opens on the defaults", async () => {

        localStorage.setItem("rankHiddenColumns", "{not json");

        setBoard([makeRow()]);
        renderRank();
        await screen.findByText("Current leader");

        expect(boardHeader(/fertility/i)).toBeInTheDocument();
        expect(boardHeader(/^tokens/i)).not.toBeInTheDocument();
    });
});

describe("Rank - byte premium in the leader's breakdown", () => {

    it("marks the byte premium beside each language's token premium", async () => {

        setBoard([makeRow()]);

        getMetrics.mockResolvedValue({
            English: { token_premium: 1, byte_premium: 1 },
            isiZulu: { token_premium: 2.4, byte_premium: 1.124 },
            Setswana: { token_premium: 1.6, byte_premium: 1.05 },
        });

        renderRank();

        expect(await screen.findByText("bytes 1.12×")).toBeInTheDocument();
        expect(screen.getByText("bytes 1.05×")).toBeInTheDocument();

        /* English is the baseline and stays off the list, as before. */
        expect(screen.queryByText("bytes 1.00×")).not.toBeInTheDocument();

        expect(document.querySelectorAll(".rank-breakdown-bytes-mark")).toHaveLength(2);
        expect(screen.getByText(/thin mark on each bar/i)).toBeInTheDocument();
    });

    it("draws no marks when the backend sent no byte premium", async () => {

        setBoard([makeRow()]);

        getMetrics.mockResolvedValue({
            English: { token_premium: 1 },
            isiZulu: { token_premium: 2.4, byte_premium: null },
        });

        renderRank();

        expect(await screen.findByText("2.40×")).toBeInTheDocument();
        expect(document.querySelector(".rank-breakdown-bytes-mark")).toBeNull();
        expect(screen.queryByText(/thin mark on each bar/i)).not.toBeInTheDocument();
    });
});

describe("Rank - filling in entries saved before the vocabulary columns", () => {

    const GAPS = { renyi_efficiency: null, productivity: null, idiosyncrasy: null };

    it("fills them in the background and shows the numbers", async () => {

        setBoard([
            makeRow({ id: 1, name: "gpt2", ...GAPS }),
            makeRow({ id: 2, name: "xlm-roberta-base", overall_score: 70 }),
        ]);

        fillLeaderboardVocabulary.mockImplementation(async (name) => {
            /* The backend saves them; the next board read has them. */
            board = board.map((row) =>
                row.name === name
                    ? { ...row, renyi_efficiency: 0.66, productivity: 5.55, idiosyncrasy: 7.77 }
                    : row
            );
            return {};
        });

        renderRank();

        expect(await leaderboardRows().findByText("5.5")).toBeInTheDocument();

        /* Only the entry with gaps, and nothing that changes the board. */
        expect(fillLeaderboardVocabulary).toHaveBeenCalledTimes(1);
        expect(fillLeaderboardVocabulary).toHaveBeenCalledWith("gpt2", expect.anything());
        expect(restoreLeaderboardEntry).not.toHaveBeenCalled();
        expect(createOrUpdateLeaderboardEntry).not.toHaveBeenCalled();
    });

    it("tries each entry once, and keeps the dashes if it cannot be filled", async () => {

        setBoard([makeRow({ id: 1, name: "gpt2", ...GAPS })]);

        fillLeaderboardVocabulary.mockRejectedValue(
            new ApiError("Could not reach Hugging Face", 503, null)
        );

        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        renderRank();
        await screen.findByText("Current leader");

        await vi.waitFor(() => {
            expect(fillLeaderboardVocabulary).toHaveBeenCalledTimes(1);
        });

        /* Give any repeat a chance to happen - it must not. */
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(fillLeaderboardVocabulary).toHaveBeenCalledTimes(1);

        /* No error on the page for this: the board is right, it just
           has dashes, each explaining itself on hover. */
        expect(screen.queryByText(/Could not reach Hugging Face/)).not.toBeInTheDocument();
        expect(
            leaderboardRows().getAllByText("—").filter((cell) =>
                /saved before this column existed/i.test(cell.title)
            )
        ).toHaveLength(3);

        warn.mockRestore();
    });

    it("does nothing when every entry already has them", async () => {

        setBoard([makeRow({ id: 1, name: "gpt2" })]);

        renderRank();
        await screen.findByText("Current leader");

        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(fillLeaderboardVocabulary).not.toHaveBeenCalled();
    });

    it("waits until the four defaults have been set up", async () => {

        /* A first-ever run: gpt2 has never been measured, the other three
           are restored. Their rows come back without the new columns, and
           only once all four are in are they filled - never alongside the
           setup. */
        getSavedLeaderboardEntry.mockImplementation(async (name) => {
            if (name === "gpt2") {
                throw new ApiError("Not found", 404, null);
            }
            return makeSavedEntry();
        });

        function addToBoard(name) {
            board = [
                ...board,
                makeRow({ id: board.length + 1, name, ...GAPS }),
            ];
        }

        restoreLeaderboardEntry.mockImplementation(async (name) => {
            addToBoard(name);
            return {};
        });

        createOrUpdateLeaderboardEntry.mockImplementation(async (name) => {
            addToBoard(name);
            return {
                metrics: {
                    languages_measured: 8,
                    morphology_measured: 7,
                    failed_languages: [],
                },
            };
        });

        let setupCallsBeforeFirstFill = null;

        fillLeaderboardVocabulary.mockImplementation(async () => {
            if (setupCallsBeforeFirstFill === null) {
                setupCallsBeforeFirstFill =
                    restoreLeaderboardEntry.mock.calls.length +
                    createOrUpdateLeaderboardEntry.mock.calls.length;
            }
            return {};
        });

        renderRank();

        expect(
            await screen.findByText("Leaderboard ready — restored 3 and measured 1.")
        ).toBeInTheDocument();

        await vi.waitFor(() => {
            expect(fillLeaderboardVocabulary).toHaveBeenCalledTimes(4);
        });

        expect(setupCallsBeforeFirstFill).toBe(4);
    });
});
