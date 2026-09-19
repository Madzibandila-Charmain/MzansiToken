import sqlite3

conn = sqlite3.connect("data/leaderboard.db")

rows = conn.execute(
    """
    SELECT
        t.name,
        m.token_count,
        m.fertility,
        m.compression,
        m.token_premium,
        m.f1,
        m.precision_score,
        m.recall,
        m.overall_score
    FROM tokenizers t
    LEFT JOIN metrics m
        ON t.id = m.tokenizer_id
    WHERE t.name IN (
        'gpt2',
        'bert-base-uncased',
        'xlm-roberta-base'
    )
    ORDER BY t.name
    """
).fetchall()

for row in rows:
    print(row)

conn.close()