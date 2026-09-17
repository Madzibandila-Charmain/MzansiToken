/*
    ErrorBoundary.jsx
    Author: Mukovhe Ranwashe (RNWMUK001)
    Date: 17 September 2026

    A render error anywhere below this component unmounts the whole React
    tree by default, so the user is left staring at a white page with no
    idea what happened. This catches it, keeps the header and the nav on
    screen, and shows what went wrong plus a way back.

    The fallback is styled inline on purpose: if the crash happened because
    a stylesheet or a theme value was missing, a class-based fallback would
    be invisible too.
*/

import { Component } from "react";

class ErrorBoundary extends Component {

    constructor(props) {
        super(props);

        this.state = {
            error: null
        };

        this.handleRetry = this.handleRetry.bind(this);
    }

    /*
        React calls this on the way down, before the tree is thrown away,
        so returning new state here is what swaps the page for the fallback.
    */
    static getDerivedStateFromError(error) {
        return {
            error: error
        };
    }

    /*
        Kept separate from the state update because this is the side effect:
        the console is where the stack trace is actually readable, and the
        component stack tells us which of our components threw.
    */
    componentDidCatch(error, info) {

        console.error(
            "[MzansiToken] a page crashed while rendering:",
            error,
            info?.componentStack
        );
    }

    /*
        Navigating to another page should not leave the old crash on screen,
        so the boundary clears itself whenever resetKey changes.
    */
    componentDidUpdate(previousProps) {

        if (
            this.state.error &&
            previousProps.resetKey !== this.props.resetKey
        ) {
            this.setState({
                error: null
            });
        }
    }

    handleRetry() {

        this.setState({
            error: null
        });
    }

    render() {

        if (!this.state.error) {
            return this.props.children;
        }

        const message =
            this.state.error?.message ||
            String(this.state.error);

        return (
            <div
                role="alert"
                style={{
                    margin: "40px auto",
                    maxWidth: "620px",
                    padding: "26px 28px",

                    background: "#ffffff",

                    border: "1px solid #e6c9c0",
                    borderLeft: "4px solid #d2601a",
                    borderRadius: "14px",

                    boxShadow: "0 8px 24px rgba(20, 30, 50, 0.08)",

                    fontFamily: "inherit",
                    color: "#1d2433"
                }}
            >

                <h2
                    style={{
                        margin: "0 0 10px",
                        fontSize: "18px",
                        fontWeight: 700
                    }}
                >
                    This page ran into a problem
                </h2>

                <p
                    style={{
                        margin: "0 0 14px",
                        fontSize: "14px",
                        lineHeight: 1.55,
                        color: "#4a5263"
                    }}
                >
                    The rest of MzansiToken is still working - you can move to
                    another page using the menu above, or try this one again.
                </p>

                <pre
                    style={{
                        margin: "0 0 18px",
                        padding: "10px 12px",

                        background: "#f6f7f9",
                        border: "1px solid #e4e7ec",
                        borderRadius: "8px",

                        fontFamily: "ui-monospace, monospace",
                        fontSize: "12px",
                        lineHeight: 1.5,
                        color: "#8a3a12",

                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word"
                    }}
                >
                    {message}
                </pre>

                <button
                    type="button"
                    onClick={this.handleRetry}
                    style={{
                        padding: "9px 18px",

                        background: "#1d2433",

                        border: "none",
                        borderRadius: "999px",

                        color: "#ffffff",
                        font: "inherit",
                        fontSize: "13px",
                        fontWeight: 600,

                        cursor: "pointer"
                    }}
                >
                    Try again
                </button>

            </div>
        );
    }
}

export default ErrorBoundary;