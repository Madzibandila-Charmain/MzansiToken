

def tokenize_NCHLT(tokenizer, nchlt_data, delimeter="_") -> list[tuple[str, str]]:
    """
        Run tokenizer through the NCHLT dataset to get its predicted segmentations for analysis

        Args: 
            tokenizer: loaded tokenizer from huggingface
            nchlt_data: list of tuples for a specific language that have the word before segmentation and after

        Returns:
            A list of words from the data, before tokenization and after tokenization
    """

    results = []

    # Iterate through the data to tokenize
    for surf, gold in nchlt_data:
        tokens = tokenizer.tokenize(surf) #tokenize

        # convert list of tokens to tokenized string
        cleaned = []
        for token in tokens:
            token = token.replace("##", "")   # WordPiece (BERT)
            token = token.replace("▁", "")    # SentencePiece (T5, Llama)
            token = token.replace("Ġ", "")    # BPE byte-level (GPT-2)
            if token:
                cleaned.append(token)
        tokenized_str = delimeter.join(cleaned)

        results.append((surf, tokenized_str))

    return results