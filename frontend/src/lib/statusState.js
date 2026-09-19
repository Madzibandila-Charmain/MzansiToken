/*
    statusState.js
    Author: Mukovhe Ranwashe (RNWMUK001)

    Works out which of the four status colours a thing should show.
    Kept out of StatusLine.jsx because a file that exports both a component
    and plain functions breaks React fast refresh.
*/

/* A loading/failed pair -> one state. */
export function statusState({ failed, loading }) {

    if (failed) {
        return "error";
    }

    return loading ? "loading" : "ready";
}

/* How full a capped input is. Amber before the wall, red at it. */
export function capState(used, cap) {

    if (!cap) {
        return "ready";
    }

    if (used >= cap) {
        return "error";
    }

    return used >= cap * 0.9 ? "warning" : "ready";
}
