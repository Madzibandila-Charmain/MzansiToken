/*
    appStateContext.js
    Author: Mukovhe Ranwashe (RNWMUK001)
    Date: 2 October 2026

    Just the context object, shared between AppStateContext.jsx (the
    AppStateProvider component) and useAppState.js (the hook). Neither
    of those two can hold it themselves and also export the other
    thing they export - react-refresh/only-export-components wants
    each file to export only components, or only non-components.
*/

import { createContext } from "react";

export const AppStateContext = createContext(null);
