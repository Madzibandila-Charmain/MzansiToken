/*
    MetricCards.test.jsx
    Author: Mukovhe Ranwashe

    The cards inside each tokenizer box: the four efficiency cards, the
    vocabulary row under them (same cards, byte premium as the fourth).
    No hover information on these - the explanations live on Rank.
*/

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import MetricCards from "../MetricCards";

function builtIn(overrides = {}) {
    return {
        tokens: 41234,
        fertility: 2.41,
        compression: 3.02,
        token_premium: 1.87,
        token_premium_basis: "parallel_corpus",
        renyi_efficiency: 0.6123,
        productivity: 4.26,
        idiosyncrasy: 12.26,
        byte_premium: 1.124,
        ...overrides,
    };
}

function card(name) {
    return screen.getByText(name).closest(".metric-card");
}

function value(name) {
    return card(name).querySelector(".metric-value").textContent;
}

describe("MetricCards", () => {

    it("puts the vocabulary row under the efficiency row, the same shape", () => {

        render(<MetricCards metrics={builtIn()} />);

        expect(value("Tokens")).toMatch(/41\D?234/);
        expect(value("Rényi Efficiency")).toBe("0.61");
        expect(value("Productivity")).toBe("4.3");
        expect(value("Idiosyncrasy")).toBe("12.3");
        expect(value("Byte Premium")).toBe("1.12×");

        const rows = document.querySelectorAll(".metric-row");
        expect(rows).toHaveLength(2);
        expect(rows[0].querySelectorAll(".metric-card")).toHaveLength(4);
        expect(rows[1].querySelectorAll(".metric-card")).toHaveLength(4);
        expect(rows[1].lastElementChild).toBe(card("Byte Premium"));

        /* Same cards as the row above: same class, nothing extra. */
        expect(card("Productivity").className).toBe(card("Fertility").className);
    });

    it("has no hover information on any card - that is Rank's job", () => {

        render(<MetricCards metrics={builtIn()} />);

        for (const name of ["Tokens", "Fertility", "Compression", "Token Premium",
            "Rényi Efficiency", "Productivity", "Idiosyncrasy", "Byte Premium"]) {

            expect(card(name).title, name).toBe("");
            expect(card(name).dataset.hint, name).toBeUndefined();
            expect(card(name).hasAttribute("tabindex"), name).toBe(false);
        }

        expect(document.querySelector(".metric-note")).toBeNull();
    });

    it("fills both rows from the one answer, with nothing left waiting", () => {

        render(<MetricCards metrics={builtIn()} />);

        expect(value("Fertility")).toBe("2.41");
        expect(value("Rényi Efficiency")).toBe("0.61");
        expect(value("Productivity")).toBe("4.3");
        expect(value("Idiosyncrasy")).toBe("12.3");
        expect(screen.queryByText("…")).not.toBeInTheDocument();
    });

    it("shows a dash when the word measures could not be had", () => {

        render(
            <MetricCards
                metrics={builtIn({ productivity: null, idiosyncrasy: undefined })}
            />
        );

        expect(value("Productivity")).toBe("—");
        expect(value("Idiosyncrasy")).toBe("—");
    });

    it("shows English at 1.00×", () => {

        render(<MetricCards metrics={builtIn({ byte_premium: 1 })} />);

        expect(value("Byte Premium")).toBe("1.00×");
    });

    it("measures an uploaded file on itself: no premiums, its own vocabulary", () => {

        render(
            <MetricCards
                metrics={builtIn({
                    token_premium: null,
                    token_premium_basis: "standalone",
                    byte_premium: null,
                    productivity: 2.6,
                    idiosyncrasy: 1.04,
                })}
            />
        );

        expect(screen.queryByText("Token Premium")).not.toBeInTheDocument();
        expect(screen.queryByText("Byte Premium")).not.toBeInTheDocument();
        expect(screen.getByText("Measured on this file alone.")).toBeInTheDocument();

        /* The file's own vocabulary. */
        expect(value("Productivity")).toBe("2.6");
        expect(value("Idiosyncrasy")).toBe("1.0");

        const rows = document.querySelectorAll(".metric-row");
        expect(rows[0].querySelectorAll(".metric-card")).toHaveLength(3);
        expect(rows[1].querySelectorAll(".metric-card")).toHaveLength(3);
    });

    it("leaves the row out when the backend never sent it", () => {

        render(
            <MetricCards metrics={{ tokens: 10, fertility: 1, compression: 2, token_premium: 1 }} />
        );

        expect(screen.queryByText("Rényi Efficiency")).not.toBeInTheDocument();
        expect(document.querySelectorAll(".metric-row")).toHaveLength(1);
    });

    it("shows a dash, not a zero, when there was nothing to measure", () => {

        render(<MetricCards metrics={builtIn({ renyi_efficiency: null })} />);

        expect(value("Rényi Efficiency")).toBe("—");
    });

    it("shows dashes, not zeros, when morphology could not load", () => {

        render(
            <MetricCards
                metrics={builtIn()}
               
                showMbi
                mbiFailed
                mbi={null}
                alignmentLabel="MBI"
                alignmentAsPercentage
            />
        );

        expect(value("F1")).toBe("—");
        expect(card("F1").title).toMatch(/could not load/i);
    });
});
