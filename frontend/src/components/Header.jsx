import { NavLink } from "react-router-dom"

function Header() {
    return (
        <header className="site-header">

            <div className="logo">
                <div className="brand-mark">M</div>

                <div className="brand-text">
                    <div className="logo-name">MzansiToken</div>
                </div>
            </div>

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