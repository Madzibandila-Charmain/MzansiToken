/*
    Home.test.jsx
    Author: Mukovhe Ranwashe

    The front page describes what the other pages actually do. Its counts
    and the research-paper measures are read from lib/measures.js, so these
    check them against that list rather than against typed-in numbers.
*/

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect } from "vitest";

vi.mock("../../api/client", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getBackendStatus: vi.fn().mockResolvedValue({
            languages: 8,
            sentences: 997,
            suggested_tokenizers: 11,
        }),
    };
});

import Home from "../Home";
import {
    COMPARE_MEASURES,
    RATIO_MEASURES,
    RESEARCH_MEASURES,
} from "../../lib/measures";

function renderHome() {
    return render(
        <MemoryRouter>
            <Home />
        </MemoryRouter>
    );
}

describe("Home", () => {

    it("names every research-paper measure and where it comes from", async () => {

        renderHome();

        const tile = (await screen.findByText("From the research papers"))
            .closest(".home-feature");

        expect(RESEARCH_MEASURES.length).toBe(4);

        for (const measure of RESEARCH_MEASURES) {
            expect(tile.textContent.toLowerCase()).toContain(measure.name.toLowerCase());
            expect(tile.textContent).toContain(measure.source);
        }

        /* Each paper once, even when it gave two measures. */
        expect(tile.textContent.match(/Gutierrez-Vasques et al\. 2023/g)).toHaveLength(1);

        expect(tile.textContent).toMatch(/never folded into it/);
    });

    it("counts the measures each page really has", async () => {

        renderHome();

        const inspect = (await screen.findByRole("heading", { name: "Inspect" })).closest("a");
        const compare = screen.getByRole("heading", { name: "Compare" }).closest("a");
        const rank = screen.getByRole("heading", { name: "Rank" }).closest("a");

        expect(inspect.textContent).toContain(`on ${RATIO_MEASURES.length} measures`);
        expect(compare.textContent).toContain(`One chart, ${COMPARE_MEASURES.length} measures`);
        expect(rank.textContent).toMatch(/Choose which columns/);
    });
});
