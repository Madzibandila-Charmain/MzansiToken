
function LeaderboardTable(){
    const headers = [
        {
            id: 1,
            KEY: "tokenizer",
            LABEL: "Tokenizer",
        },
        {
            id: 2,
            KEY: "tokenCount",
            LABEL: "Token count",
        },
        {
            id: 3,
            KEY: "fertility",
            LABEL: "Fertitlity",
        },
        {
            id: 4,
            KEY: "compression",
            LABEL: "Compression",
        },
        {
            id: 5,
            KEY: "tokenPremium",
            LABEL: "Token Premium",
        },
        {
            id: 6,
            KEY: "f1",
            LABEL: "f1",
        },
        {
            id: 7,
            KEY: "precision",
            LABEL: "Precision",
        },
        {
            id: 8,
            KEY: "recall",
            LABEL: "Recall",
        },
    ]
    

    const data = [
    {
        id: 1,
        tokenizer: "BPE-32k",
        tokenCount: 128432,
        fertility: 1.32,
        compression: 4.21,
        tokenPremium: 0.08,
        f1: 0.912,
        precision: 0.905,
        recall: 0.919,
    },
    {
        id: 2,
        tokenizer: "WordPiece-30k",
        tokenCount: 135210,
        fertility: 1.41,
        compression: 3.98,
        tokenPremium: 0.15,
        f1: 0.887,
        precision: 0.879,
        recall: 0.896,
    },
    {
        id: 3,
        tokenizer: "Unigram-64k",
        tokenCount: 119873,
        fertility: 1.19,
        compression: 4.55,
        tokenPremium: -0.03,
        f1: 0.931,
        precision: 0.928,
        recall: 0.934,
    },
    ];


    return (
        <table>
            <thead>
                <tr>
                    {headers.map((header, index) => (
                        <th key={index}>
                            <span>{header.LABEL}</span>
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                    {data.map((row, index) => (
                        <tr key={index}>
                            {headers.map((header, index) => {
                                return (
                                    <td key={index}>
                                        {row[header.KEY]}
                                    </td>
                                )
                            })}
                        </tr>
                    ))}
            </tbody>
        </table>
    );
}

export default LeaderboardTable;