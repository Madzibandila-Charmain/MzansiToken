/*
    VocabularySummary.test.jsx
    Author: Mukovhe Ranwashe

    The note under the Inspect charts for the research-paper measures, and
    the wheel's tabs that bring it up.
*/

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../../api/client", async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, getMetrics: vi.fn(), getVocabulary: vi.fn() };
});

import { getMetrics, getVocabulary } from "../../api/client";
import { forgetVocabulary } from "../../lib/useVocabulary";
import VocabularySummary from "../VocabularySummary";
import MetricsChart from "../MetricsChart";

const LANGS = {
    English: { renyi_efficiency: 0.73, productivity: 92.1, idiosyncrasy: 2.1, byte_premium: 1 },
    Sepedi: { renyi_efficiency: 0.71, productivity: 65.5, idiosyncrasy: 2.1, byte_premium: 1.18 },
    isiXhosa: { renyi_efficiency: 0.80, productivity: 123.8, idiosyncrasy: 1.3, byte_premium: 1.07 },
    Setswana: { renyi_efficiency: 0.72, productivity: 70.7, idiosyncrasy: 2.2, byte_premium: 1.26 },
};

function metrics() {
    const out = {};
    for (const [language, v] of Object.entries(LANGS)) {
        out[language] = {
            token_count: 1000, fertility: 2, compression: 3,
            token_premium: language === "English" ? 1 : 1.2,
            renyi_efficiency: v.renyi_efficiency,
            byte_premium: v.byte_premium,
        };
    }
    return out;
}

beforeEach(() => {
    vi.clearAllMocks();
    forgetVocabulary();
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("VocabularySummary - the note", () => {

    it.each([
        ["renyi_efficiency", ["isiXhosa has the longest petal", "(Rényi 0.80)", "Sepedi the shortest (0.71)", "neither end is a win"]],
        ["productivity", ["isiXhosa’s subwords are the most reused", "123.8 different words", "Sepedi’s the least (65.5)"]],
        ["idiosyncrasy", ["Setswana’s subwords sit in the most common words (2.2", "isiXhosa’s in the rarest (1.3)"]],
        ["byte_premium", ["Setswana’s sentences take the most bytes (1.26× English)", "isiXhosa’s the fewest (1.07×)", "same whichever one you pick"]],
    ])("describes %s from the numbers, English left out", (measure, parts) => {

        const { container } = render(<VocabularySummary measure={measure} data={LANGS} />);

        for (const part of parts) {
            expect(container.textContent).toContain(part);
        }
        expect(container.querySelector("p")).toHaveClass("chart-note");
    });

    it("says nothing for the other measures", () => {
        const { container } = render(<VocabularySummary measure="fertility" data={LANGS} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("says nothing when there is too little to compare", () => {
        const { container } = render(
            <VocabularySummary measure="productivity" data={{ English: LANGS.English, Sepedi: LANGS.Sepedi }} />
        );
        expect(container).toBeEmptyDOMElement();
    });
});

describe("MetricsChart - the wheel's research-paper tabs", () => {

    it("offers bytes, Rényi, productivity and idiosyncrasy beside the old three", async () => {

        getMetrics.mockResolvedValue(metrics());
        getVocabulary.mockResolvedValue(LANGS);

        render(<MetricsChart tokenizer="gpt2" />);

        for (const label of ["Per word", "Bytes / token", "Cost vs English", "Bytes vs English", "Rényi", "Productivity", "Idiosyncrasy"]) {
            expect(await screen.findByRole("button", { name: label })).toBeInTheDocument();
        }

        /* The usual per-word note until a new tab is picked. */
        expect(screen.getByText(/On the wheel/).textContent).toMatch(/shortest petal/);
    });

    it("swaps the note and the petals when a new tab is picked", async () => {

        const user = userEvent.setup();

        getMetrics.mockResolvedValue(metrics());
        getVocabulary.mockResolvedValue(LANGS);

        render(<MetricsChart tokenizer="gpt2" />);

        await user.click(await screen.findByRole("button", { name: "Productivity" }));

        expect(await screen.findByText(/subwords are the most reused/)).toBeInTheDocument();
        expect(screen.queryByText(/shortest petal/)).not.toBeInTheDocument();

        /* Petal labels are the productivity numbers. */
        expect(screen.getByText("123.8")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Bytes vs English" }));

        expect(await screen.findByText(/sentences take the most bytes/)).toBeInTheDocument();
        expect(screen.getByText("1.26×")).toBeInTheDocument();
    });

    it("gets every tab ready before its spinner goes", async () => {

        let finish;
        getMetrics.mockResolvedValue(metrics());
        getVocabulary.mockImplementation(() => new Promise((resolve) => {
            finish = () => resolve(LANGS);
        }));

        render(<MetricsChart tokenizer="gpt2" />);

        /* Asked for straight away, not when a tab is opened. */
        await screen.findByRole("button", { name: "Productivity" });
        expect(getVocabulary).toHaveBeenCalledTimes(1);
        expect(document.querySelector(".charts-box.is-busy")).not.toBeNull();
        expect(screen.getByText(/Measuring all eight languages/)).toBeInTheDocument();

        finish();

        await vi.waitFor(() => {
            expect(document.querySelector(".charts-box.is-busy")).toBeNull();
        });
    });

    it("keeps its spinner while the page's boxes are still loading", async () => {

        getMetrics.mockResolvedValue(metrics());
        getVocabulary.mockResolvedValue(LANGS);

        const { rerender } = render(<MetricsChart tokenizer="gpt2" waiting />);

        await screen.findByRole("button", { name: "Productivity" });
        await vi.waitFor(() => expect(getVocabulary).toHaveBeenCalled());
        expect(document.querySelector(".charts-box.is-busy")).not.toBeNull();

        /* The boxes are in: chart and boxes appear together. */
        rerender(<MetricsChart tokenizer="gpt2" />);

        await vi.waitFor(() => {
            expect(document.querySelector(".charts-box.is-busy")).toBeNull();
        });
    });

    it("leaves productivity and idiosyncrasy out if they cannot be had", async () => {

        getMetrics.mockResolvedValue(metrics());
        getVocabulary.mockRejectedValue(new Error("Failed to load the vocabulary summary."));

        render(<MetricsChart tokenizer="gpt2" />);

        await screen.findByRole("button", { name: "Per word" });

        await vi.waitFor(() => {
            expect(screen.queryByRole("button", { name: "Productivity" })).not.toBeInTheDocument();
        });
        expect(screen.queryByRole("button", { name: "Idiosyncrasy" })).not.toBeInTheDocument();
    });
});
