/*
    ColumnPicker.jsx
    Author: Mukovhe Ranwashe (RNWMUK001)

    The "Columns" button above the leaderboard and the panel it opens: one
    switch per metric column. Hiding a column only changes what is shown -
    the saved measurements and the score are exactly the same either way.
*/

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/* The gap kept between the panel and the edge of the screen. */
const SCREEN_MARGIN = 12;

function ColumnPicker({ columns, hidden, onChange, onReset }) {

    const [open, setOpen] = useState(false);

    const wrapperRef = useRef(null);
    const buttonRef = useRef(null);
    const panelRef = useRef(null);

    const panelId = useId();

    /*
        The panel opens under the button, lined up with its right edge.
        On a narrow phone screen the button can sit anywhere along the row,
        so that alone can push the panel off one side. Measured after it
        opens (before the browser paints, so it never visibly jumps) and
        nudged back inside, with a small margin. The nudge is written
        straight onto the element - React never sets this element's style,
        so the two cannot disagree.
    */
    useLayoutEffect(() => {

        if (!open || !panelRef.current) {
            return undefined;
        }

        function keepOnScreen() {

            const panel = panelRef.current;

            if (!panel) {
                return;
            }

            /* Measure where it sits with no nudge applied. */
            panel.style.transform = "none";

            const box = panel.getBoundingClientRect();
            const screenWidth = document.documentElement.clientWidth;

            let next = 0;

            if (box.right > screenWidth - SCREEN_MARGIN) {
                next = screenWidth - SCREEN_MARGIN - box.right;
            }

            if (box.left + next < SCREEN_MARGIN) {
                next = SCREEN_MARGIN - box.left;
            }

            panel.style.transform = next ? `translateX(${next}px)` : "";
        }

        keepOnScreen();

        window.addEventListener("resize", keepOnScreen);

        return () => window.removeEventListener("resize", keepOnScreen);

    }, [open]);

    const shownCount = columns.filter(
        (column) => !hidden.includes(column.key)
    ).length;

    /* Click anywhere else, or Escape, closes it - the way a menu behaves.
       Escape hands focus back to the button so a keyboard user is not left
       stranded on a control that just disappeared. */
    useEffect(() => {

        if (!open) {
            return undefined;
        }

        function handlePointer(event) {
            if (!wrapperRef.current?.contains(event.target)) {
                setOpen(false);
            }
        }

        function handleKey(event) {
            if (event.key === "Escape") {
                setOpen(false);
                buttonRef.current?.focus();
            }
        }

        document.addEventListener("mousedown", handlePointer);
        document.addEventListener("keydown", handleKey);

        return () => {
            document.removeEventListener("mousedown", handlePointer);
            document.removeEventListener("keydown", handleKey);
        };

    }, [open]);

    function toggle(key) {

        onChange(
            hidden.includes(key)
                ? hidden.filter((item) => item !== key)
                : [...hidden, key]
        );
    }

    return (
        <div className="rank-columns" ref={wrapperRef}>

            <button
                ref={buttonRef}
                type="button"
                className="rank-metrics-toggle"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen((current) => !current)}
            >
                Columns{" "}
                <span className="rank-columns-count">
                    {shownCount}/{columns.length}
                </span>
            </button>

            {open && (

                <div
                    ref={panelRef}
                    id={panelId}
                    className="rank-columns-panel"
                    role="group"
                    aria-label="Columns shown on the leaderboard"
                >

                    <p className="rank-columns-title">
                        Show on the board
                    </p>

                    <ul className="rank-columns-list">

                        {columns.map((column) => (

                            <li key={column.key}>

                                <label
                                    className="rank-columns-option"
                                    title={column.title}
                                >
                                    <input
                                        type="checkbox"
                                        checked={!hidden.includes(column.key)}
                                        onChange={() => toggle(column.key)}
                                    />

                                    <span>{column.label}</span>

                                    {column.scored === false && (
                                        <span className="rank-columns-tag">
                                            not scored
                                        </span>
                                    )}
                                </label>

                            </li>

                        ))}

                    </ul>

                    <div className="rank-columns-foot">

                        <span>
                            Tokenizer and Score always show. Hiding a
                            column never changes a score.
                        </span>

                        <button
                            type="button"
                            className="rank-columns-reset"
                            onClick={onReset}
                        >
                            Reset
                        </button>

                    </div>

                </div>

            )}

        </div>
    );
}

export default ColumnPicker;
