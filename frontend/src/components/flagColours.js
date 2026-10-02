/*
    flagColours.js
    Author: Mukovhe Ranwashe (RNWMUK001)
    Date: 2 October 2026

    Split out of SouthAfricaMap.jsx, which used to export this constant
    alongside its default component export. A file Vite treats as a
    component module (it exports a component) has to export ONLY
    components, or Fast Refresh cannot tell what changed and reloads
    the whole page instead of just the edited component - flagged by
    react-refresh/only-export-components. FLAG has no component in it,
    so it gets its own file.
*/

/* Pantone-matched values used by Brand South Africa. */
export const FLAG = {
    green: "#007749",
    gold: "#FFB81C",
    red: "#E03C31",
    blue: "#001489",
    black: "#000000",
    white: "#FFFFFF"
};
