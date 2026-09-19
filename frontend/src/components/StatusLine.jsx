/*
    StatusLine.jsx
    Author: Mukovhe Ranwashe (RNWMUK001)

    The dot-and-sentence status line. Inspect and Compare both built this
    by hand, three times between them, each with its own ternary. Same
    markup, same four states - so it lives here once.

    States:  ready (green) · loading (grey) · warning (amber) · error (red)
*/

import StatusMessage from "./StatusMessage";

function StatusLine({ state = "ready", text, modelName = "" }) {

    if (!text) {
        return null;
    }

    return (
        <div
            className={`selection-status is-${state}`}
            role={state === "error" ? "alert" : "status"}
            aria-live="polite"
        >
            <span className="status-dot"></span>

            <StatusMessage
                text={text}
                failed={state === "error"}
                modelName={modelName}
            />
        </div>
    );
}

export default StatusLine;
