/*
    Stores shared application state so user selections and data remain unchanged when navigating between different pages.
    Author: Madzibandila Charmain
    Date: 21 August 2026
*/

import { createContext, useContext, useState } from "react";

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
    
    return;
}

export function useAppState() {
    const context = useContext(AppStateContext);

    if (!context) {
        throw new Error(
            "useAppState must be used inside AppStateProvider"
        );
    }

    return context;
}