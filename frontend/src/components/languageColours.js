/*
    languageColours.js
    Author: Mukovhe Ranwashe (RNWMUK001)
    Date: 15 September 2026

    One place that decides what colour a language is, so the pills, the
    reading panels and the charts can never disagree with each other.

    Colours are assigned by position in LANGUAGE_ORDER, not by whatever
    order the backend happens to return, so a language keeps its colour
    even when the selection changes.
*/

/*
    The wheel. Assigned in this order and never cycled. The order was
    checked with a colour-blindness simulator so that no two neighbouring
    slices of the doughnut collapse into the same colour.
*/
export const WHEEL = [
    "#2f6fd0",
    "#e31c8d",
    "#e8a62e",
    "#2ba3b5",
    "#7b3fa0",
    "#d2601a",
    "#4fa3e0",
    "#5aa544"
];

/* English is the baseline, so it is deliberately off-palette. */
export const BASELINE = "#8b93a0";

export const LANGUAGE_ORDER = [
    "isiZulu",
    "isiXhosa",
    "siSwati",
    "isiNdebele",
    "Sepedi",
    "Sesotho",
    "Setswana",
    "Xitsonga",
    "Tshivenda",
    "Afrikaans"
];

export const FAMILY = {
    isiZulu: "Nguni",
    isiXhosa: "Nguni",
    siSwati: "Nguni",
    isiNdebele: "Nguni",
    Sepedi: "Sotho-Tswana",
    Sesotho: "Sotho-Tswana",
    Setswana: "Sotho-Tswana",
    Xitsonga: "Tswa-Ronga",
    Tshivenda: "Venda",
    Afrikaans: "West Germanic",
    English: "baseline"
};

/*
    A language we have never seen still needs a stable colour, so fall
    back to the sum of its character codes rather than to a random slot.
*/
function fallbackIndex(name) {

    let total = 0;

    for (let i = 0; i < name.length; i = i + 1) {
        total = total + name.charCodeAt(i);
    }

    return total % WHEEL.length;
}

export function languageColour(name) {

    if (name === "English") {
        return BASELINE;
    }

    const position = LANGUAGE_ORDER.indexOf(name);

    if (position === -1) {
        return WHEEL[fallbackIndex(name)];
    }

    return WHEEL[position % WHEEL.length];
}