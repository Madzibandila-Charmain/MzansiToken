/*
    Header
    Author: Madzibandila Charmain

    Amended by Mukovhe Ranwashe (RNWMUK001), 17 September 2026: the white
    bar is gone, so the background shows through it instead of being cut
    off by a band across the top. The mark is the flag rather than a black
    circle with an M in it, and it is a link home, which the old one was
    not - the wordmark is the usual way back to the landing page and it
    was doing nothing.
*/

import { NavLink } from "react-router-dom";

import BrandMark from "./BrandMark";

function Header() {
    return (
        <header className="site-header">

            <NavLink to="/" className="logo" aria-label="MzansiToken, home">

                <BrandMark size={38} />

                <div className="brand-text">
                    <div className="logo-name">MzansiToken</div>
                </div>

            </NavLink>

            <nav className="main-nav">

                <NavLink to="/">
                    Home
                </NavLink>

                <NavLink to="/inspect">
                    Inspect
                </NavLink>

                <NavLink to="/compare">
                    Compare
                </NavLink>

                <NavLink to="/rank">
                    Rank
                </NavLink>

            </nav>

        </header>
    );
}

export default Header;