/*
    TypeAnything.test.jsx
    Author: Mukovhe Ranwashe

    The Type Anything box is locked while a tokenizer is loading, on every
    page that uses it, and works normally otherwise.
*/

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect } from "vitest";

import TypeAnything from "../TypeAnything";

function renderBox(props = {}) {
    const onInputChange = vi.fn();

    render(
        <TypeAnything
            inputText=""
            onInputChange={onInputChange}
            results={[{ tokens: [], metrics: {} }]}
            {...props}
        />
    );

    return { onInputChange, box: screen.getByRole("textbox") };
}

describe("TypeAnything", () => {

    it("takes typing when nothing is loading", async () => {

        const user = userEvent.setup();
        const { box, onInputChange } = renderBox();

        expect(box).toBeEnabled();
        expect(box).toHaveAttribute("placeholder", "Type or paste your text here...");

        await user.type(box, "S");
        expect(onInputChange).toHaveBeenCalledWith("S");
    });

    it("is locked, and says why, while the tokenizer loads", async () => {

        const user = userEvent.setup();
        const { box, onInputChange } = renderBox({ busy: true });

        expect(box).toBeDisabled();
        expect(box).toHaveAttribute("aria-busy", "true");
        expect(box.placeholder).toMatch(/tokenizer is still loading/i);

        await user.type(box, "Sawubona");
        expect(onInputChange).not.toHaveBeenCalled();
    });

    it("keeps what was already typed while it is locked", () => {

        const { box } = renderBox({ busy: true, inputText: "Sawubona" });

        expect(box).toHaveValue("Sawubona");
    });
});
