/*
    Compare.test.jsx
    Author: Mukovhe Ranwashe

    Compare.jsx had no tests before this file, despite code having been
    added to and removed from it twice in one session (the MBI boundary
    preview that came in, then came back out). This covers its most
    load-bearing paths: the initial options + default-corpus load (success
    and failure), changing the corpus language, and the two ways the MBI
    comparison effect can come back empty - "Unsupported language" (the
    wording mbi_router.py and Rank.jsx both also key off of) and any other
    failure - plus swapping one tokenizer through the search box.

    Compare reads its selections (language, the two tokenizers) from
    AppStateContext rather than its own state, so it is rendered inside
    the real AppStateProvider - a hand-built stand-in would just be a
    second copy of that context's rules to keep in sync. Its defaults
    persist to localStorage, so that is cleared before every test.
*/

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

import Compare from "../Compare";
/* AppStateContext.jsx, the provider - not appStateContext.js, which only
   holds the bare context object. Importing the provider from that one
   gave `undefined` and failed every test in this file. */
import { AppStateProvider } from "../../context/AppStateContext";

vi.mock("../../api/client", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getOptions: vi.fn(),
        getDefaultCorpus: vi.fn(),
        uploadCorpus: vi.fn(),
        tokenizeText: vi.fn(),
        compareMBI: vi.fn(),
        getTokenizerInfo: vi.fn(),
    };
});

import {
    ApiError,
    getOptions,
    getDefaultCorpus,
    uploadCorpus,
    tokenizeText,
    compareMBI,
    getTokenizerInfo,
} from "../../api/client";

function renderCompare() {
    return render(
        <AppStateProvider>
            <Compare />
        </AppStateProvider>
    );
}

function corpusLabel() {
    return document.querySelector(".compare-corpus-label")?.textContent;
}

function makeMbiSide(overrides = {}) {
    return {
        metrics: {
            precision: 0.5,
            recall: 0.5,
            f1: 0.5,
            aligned_boundaries: 5,
            total_gold_boundaries: 10,
        },
        words_evaluated: 10,
        ...overrides,
    };
}

function makeCorpusResult(tokenizer) {
    return {
        tokenized_text: `tokens from ${tokenizer}`,
        metrics: {
            token_count: 10,
            fertility: 1.1,
            compression: 0.5,
            token_premium: 1.2,
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    getOptions.mockResolvedValue({
        languages: ["isiZulu", "English"],
        limits: { max_text_chars: 5000, max_upload_mb: 5 },
        defaults: { language: "isiZulu" },
    });

    getDefaultCorpus.mockImplementation(async (language, tokenizer) =>
        makeCorpusResult(tokenizer)
    );

    uploadCorpus.mockImplementation(async (file, tokenizer) =>
        makeCorpusResult(tokenizer)
    );

    tokenizeText.mockImplementation(async (text, language, tokenizer) =>
        makeCorpusResult(tokenizer)
    );

    getTokenizerInfo.mockResolvedValue({});

    compareMBI.mockResolvedValue({
        tokenizer_a: makeMbiSide(),
        tokenizer_b: makeMbiSide(),
    });
});

describe("Compare - initial load", () => {

    it("loads the backend options and the default corpus for both tokenizers", async () => {

        renderCompare();

        /*
            corpusLabel is derived straight from the selection state
            (language + both tokenizer ids), which the OPTIONS effect sets
            as soon as getOptions resolves - before the separate corpus-
            loading effect has actually run and called getDefaultCorpus.
            Under load, React can commit that state (and paint the full
            label) a tick before it flushes the later effect, so waiting
            on the label was waiting on the wrong thing - it occasionally
            resolved while getDefaultCorpus still had zero calls. Wait on
            the calls themselves; the label is a consequence of them
            having gone out, not the other way around.
        */
        await vi.waitFor(() => {
            expect(getDefaultCorpus).toHaveBeenCalledWith("isiZulu", "gpt2");
            expect(getDefaultCorpus).toHaveBeenCalledWith(
                "isiZulu",
                "google/gemma-4-12B-it"
            );
        });

        expect(corpusLabel()).toMatch(
            /Built-in corpus.*isiZulu.*gpt2 vs google\/gemma-4-12B-it/
        );

        const isiZuluPill = screen.getByRole("button", { name: "isiZulu" });
        expect(isiZuluPill.className).toMatch(/is-selected/);

        expect(
            screen.getByRole("button", { name: "English" })
        ).toBeInTheDocument();
    });

    it("shows a failed options load as an error, without crashing the page", async () => {

        getOptions.mockRejectedValue(new Error("Failed to fetch"));

        renderCompare();

        const alert = await screen.findByRole("alert");

        expect(alert).toHaveTextContent(/cannot reach the backend/i);
    });

});

describe("Compare - typing while a tokenizer loads", () => {

    it("locks the Type Anything box until both tokenizers have loaded", async () => {

        let finish;
        const waiting = new Promise((resolve) => {
            finish = resolve;
        });

        getDefaultCorpus.mockImplementation(async (language, tokenizer) => {
            await waiting;
            return makeCorpusResult(tokenizer);
        });

        renderCompare();

        /* Both tokenizers are now on their way. */
        await vi.waitFor(() => {
            expect(getDefaultCorpus).toHaveBeenCalledTimes(2);
        });

        const box = screen.getByPlaceholderText(/tokenizer is still loading/i);
        expect(box).toBeDisabled();

        finish();

        expect(
            await screen.findByPlaceholderText("Type or paste your text here...")
        ).toBeEnabled();
    });
});

describe("Compare - loading order", () => {

    it("asks for morphology only after the tokenizer boxes have loaded", async () => {

        let finish;
        const waiting = new Promise((resolve) => {
            finish = resolve;
        });

        getDefaultCorpus.mockImplementation(async (language, tokenizer) => {
            await waiting;
            return makeCorpusResult(tokenizer);
        });

        renderCompare();

        await vi.waitFor(() => {
            expect(getDefaultCorpus).toHaveBeenCalledTimes(2);
        });

        /* FLORES first: no morphology while the boxes are loading. */
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(compareMBI).not.toHaveBeenCalled();

        finish();

        /* Then NCHLT. */
        await vi.waitFor(() => {
            expect(compareMBI).toHaveBeenCalled();
        });
    });

    it("shows each box all at once: the numbers wait for the morphology", async () => {

        let finish;
        compareMBI.mockImplementation(() => new Promise((resolve) => {
            finish = () => resolve({
                tokenizer_a: makeMbiSide(),
                tokenizer_b: makeMbiSide(),
            });
        }));

        renderCompare();

        /* FLORES is in, morphology is not: both boxes still loading. */
        await vi.waitFor(() => {
            expect(compareMBI).toHaveBeenCalled();
        });
        expect(screen.getAllByText("Measuring morphology...")).toHaveLength(2);
        expect(document.querySelectorAll(".tokenization-display-block.is-busy")).toHaveLength(2);

        finish();

        /* Now the whole box, morphology included, in one go. */
        await vi.waitFor(() => {
            expect(document.querySelectorAll(".tokenization-display-block.is-busy")).toHaveLength(0);
        });
        expect(screen.queryByText("Measuring morphology...")).not.toBeInTheDocument();
        expect(screen.getAllByText("0.50").length).toBeGreaterThan(0);
    });

    it("does not leave the boxes loading when the morphology fails", async () => {

        compareMBI.mockRejectedValue(new Error("Failed to fetch"));

        renderCompare();

        await vi.waitFor(() => {
            expect(compareMBI).toHaveBeenCalled();
        });
        await vi.waitFor(() => {
            expect(document.querySelectorAll(".tokenization-display-block.is-busy")).toHaveLength(0);
        });
    });
});

describe("Compare - changing the corpus language", () => {

    it("reloads the corpus for both tokenizers when a new language is picked", async () => {

        renderCompare();

        await vi.waitFor(() => {
            expect(corpusLabel()).toMatch(
                /Built-in corpus.*isiZulu.*gpt2 vs google\/gemma-4-12B-it/
            );
        });

        getDefaultCorpus.mockClear();

        const user = userEvent.setup();

        await user.click(screen.getByRole("button", { name: "English" }));

        await vi.waitFor(() => {
            expect(corpusLabel()).toMatch(
                /Built-in corpus.*English.*gpt2 vs google\/gemma-4-12B-it/
            );
        });

        expect(getDefaultCorpus).toHaveBeenCalledWith("English", "gpt2");

        expect(
            await screen.findByText("English ready.")
        ).toBeInTheDocument();
    });

    it("reports a side that fails on the new language once, and clears its old tokens", async () => {

        renderCompare();

        await vi.waitFor(() => {
            expect(corpusLabel()).toMatch(
                /Built-in corpus.*isiZulu.*gpt2 vs google\/gemma-4-12B-it/
            );
        });

        await vi.waitFor(() => {
            expect(
                document.querySelectorAll(".tokenization-text")[1].textContent
            ).toMatch(/tokensfromgoogle\/gemma-4-12B-it/);
        });

        /* gpt2 still loads on English; gemma does not. */
        getDefaultCorpus.mockImplementation(async (language, tokenizer) => {
            if (tokenizer === "google/gemma-4-12B-it") {
                throw new ApiError(
                    "Hugging Face had a server problem while loading google/gemma-4-12B-it.",
                    400,
                    null
                );
            }
            return makeCorpusResult(tokenizer);
        });

        const user = userEvent.setup();

        await user.click(screen.getByRole("button", { name: "English" }));

        await screen.findByText(/server problem while loading google\/gemma-4-12B-it/);

        /* Once - it used to be reported by loadDefaultCorpus AND by the
           language-change handler, so the same sentence showed twice. */
        expect(
            screen.getAllByText(/server problem while loading google\/gemma-4-12B-it/)
        ).toHaveLength(1);

        /* The failed side is cleared: it used to keep showing its isiZulu
           tokens under a label that now says English. */
        expect(
            document.querySelectorAll(".tokenization-text")[1].textContent
        ).not.toMatch(/tokensfrom/);

        /* ...while the side that worked shows its English result. */
        expect(
            document.querySelectorAll(".tokenization-text")[0].textContent
        ).toMatch(/tokensfromgpt2/);
    });

});

describe("Compare - MBI comparison", () => {

    it("flags a language the NCHLT corpus does not cover, instead of a raw error", async () => {

        compareMBI.mockRejectedValue(
            new ApiError("Unsupported language: isiZulu", 400, null)
        );

        renderCompare();

        const alert = await screen.findByRole("alert");

        expect(alert).toHaveTextContent("isiZulu does not have MBI metrics.");
    });

    it("does not raise an error just because English has no morphology data", async () => {

        /* English is the baseline - the cards already hide its MBI rows,
           so the backend's "unsupported" answer is expected, not news. */
        compareMBI.mockImplementation(async (one, two, language) => {
            if (language === "English") {
                throw new ApiError("Unsupported language: English", 400, null);
            }
            return { tokenizer_a: makeMbiSide(), tokenizer_b: makeMbiSide() };
        });

        renderCompare();

        await vi.waitFor(() => {
            expect(corpusLabel()).toMatch(
                /Built-in corpus.*isiZulu.*gpt2 vs google\/gemma-4-12B-it/
            );
        });

        const user = userEvent.setup();

        await user.click(screen.getByRole("button", { name: "English" }));

        expect(await screen.findByText("English ready.")).toBeInTheDocument();

        await vi.waitFor(() => {
            expect(compareMBI).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                "English"
            );
        });

        /* Let the rejected MBI request finish landing. */
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(
            screen.queryByText(/does not have MBI metrics/)
        ).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("reports any other MBI failure through the same error line", async () => {

        compareMBI.mockRejectedValue(new Error("Failed to fetch"));

        renderCompare();

        const alert = await screen.findByRole("alert");

        expect(alert.textContent).toMatch(
            /morphology metrics could not be loaded/i
        );
        expect(alert.textContent).toMatch(/cannot reach the backend/i);
    });

});

describe("Compare - swapping a tokenizer", () => {

    it("loads a newly typed tokenizer into slot one against the current language", async () => {

        renderCompare();

        await vi.waitFor(() => {
            expect(corpusLabel()).toMatch(/gpt2 vs/);
        });

        getDefaultCorpus.mockClear();

        const user = userEvent.setup();

        const input = screen.getByLabelText(/tokenizer 1/i, { selector: "input" })
            ?? document.getElementById("compare-tokenizer-one");

        await user.clear(input);
        await user.type(input, "facebook/new-one{Enter}");

        expect(
            await screen.findByText("facebook/new-one ready.")
        ).toBeInTheDocument();

        expect(getTokenizerInfo).toHaveBeenCalledWith("facebook/new-one");
        expect(getDefaultCorpus).toHaveBeenCalledWith(
            "isiZulu",
            "facebook/new-one"
        );

        await vi.waitFor(() => {
            expect(corpusLabel()).toMatch(/facebook\/new-one vs/);
        });
    });

});
