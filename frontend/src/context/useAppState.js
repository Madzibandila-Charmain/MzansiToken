/*
    useAppState.js
    Author: Mukovhe Ranwashe (RNWMUK001)
    Date: 2 October 2026

    Split out of AppStateContext.jsx, which used to export this hook
    alongside the AppStateProvider component - see appStateContext.js
    for why that was a problem.
*/

import { useContext } from "react";

import { AppStateContext } from "./appStateContext.js";

export function useAppState() {

    const context = useContext(AppStateContext);

    if (!context) {

        throw new Error(
            "useAppState must be used inside AppStateProvider"
        );

    }

    return context;

}
