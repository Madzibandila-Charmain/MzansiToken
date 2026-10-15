/*
    CompareCharts.test.jsx
    Author: Mukovhe Ranwashe

    The chart under Compare. Opening a productivity or idiosyncrasy tab
    before those numbers have arrived used to divide by a zero scale and
    draw every dot and line at "NaN".
*/

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

import CompareCharts from "../CompareCharts";
import { AppStateProvider } from "../../context/AppStateContext";

vi.mock("../../api/client", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getMetrics: vi.fn(),
        getVocabulary: vi.fn(),
    };
});

import { getMetrics, getVocabulary } from "../../api/client";

const LANGUAGES = ["English", "isiZulu", "isiXhosa"];

function perLanguage(fertility) {
    return Object.fromEntries(LANGUAGES.map((name, i) => [name, {
        token_count: 100 + i,
        fertility: fertility + i,
        compression: 2,
        token_premium: 1 + i / 10,
        renyi_efficiency: 0.7,
    }]));
}

function drawnNaN() {
    return [...document.querySelectorAll(".compare-charts svg *")].some((el) =>
        [...el.attributes].some((a) => a.value.includes("NaN"))
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getMetrics.mockImplementation(async (name) => perLanguage(name === "a" ? 2 : 3));
});

describe("CompareCharts", () => {

    it("draws nothing at NaN while a vocabulary tab is still measuring", async () => {

        /* The vocabulary never arrives in this test. */
        getVocabulary.mockImplementation(() => new Promise(() => {}));

        const user = userEvent.setup();

        render(
            <AppStateProvider>
                <CompareCharts tokenizerA="a" tokenizerB="b" />
            </AppStateProvider>
        );

        await screen.findByRole("button", { name: "Productivity" });
        expect(drawnNaN()).toBe(false);

        await user.click(screen.getByRole("button", { name: "Productivity" }));

        expect(getVocabulary).toHaveBeenCalled();
        expect(document.querySelector(".compare-body.is-loading")).not.toBeNull();
        expect(drawnNaN()).toBe(false);
    });
});
