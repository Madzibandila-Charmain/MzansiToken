/*
    Inspect Page
    Author: Madzibandila Charmain
    Date: 21 August 2026
*/

function Inspect() {
    return (
        <>
            <section className="inspect-intro">

                {/* Description of what the Inspect page does */}
                <p className="inspect-label">
                    INSPECT 
                </p>

                <h1>
                    From isiXhosa to Setswana, See the Language Beneath.
                </h1>

                <p className="inspect-description">
                    Pick a tokenizer, choose a language and explore how your 
                    text is broken down into subword tokens the model can understand.
                </p>

            </section>

            {/* Tokenizer and Language selection box */}
            <section className="inspect-controls">

                {/* Left side containing the 2 dropdowns */}
                <div className="inspect-filters">

                    {/* Tokenizer Dropdown */}
                    <div className="filter-group">
                        <label htmlFor="tokenizer">
                            Tokenizer
                        </label>

                        <select id="tokenizer">
                            <option value="">Select tokenizer</option>
                            <option value="tokenizer1">Tokenizer 1</option>
                            <option value="tokenizer2">Tokenizer 2</option>
                            <option value="tokenizer3">Tokenizer 3</option>
                            <option value="tokenizer4">Tokenizer 4</option>
                        </select>
                    </div>
                    
                    {/* Language dropdown */}
                    <div className="filter-group">
                        <label htmlFor="language">
                            Language
                        </label>

                        <select id="language">
                            <option value="">Select language</option>
                            <option value="english">English</option>
                            <option value="isiZulu">isiZulu</option>
                            <option value="isiXhosa">isiXhosa</option>
                            <option value="ndebele">Ndebele</option>
                            <option value="sestwana">Setswana</option>
                            <option value="sepedi">Sepedi</option>
                            <option value="xitsonga">Xitsonga</option>
                            <option value="sesotho">Sesotho</option>
                        </select>
                    </div>

                </div>

            </section>
        </>
        
    );
}

export default Inspect;