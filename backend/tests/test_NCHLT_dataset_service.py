import pytest

from app.services.NCHLT_dataset_service import load_nchlt_data


# function should read a file and convert it to a list properly
def test_load_nchlt_data_reads_zulu_file(tmp_path):
    data_dir = tmp_path / "NCHLT"
    data_dir.mkdir()

    (data_dir / "zul.txt").write_text(
        "Abafundi\tA_ba_fundi\n"
        "Abahlali\tA_ba_hlal_i\n",
        encoding="utf-8",
    )

    result = load_nchlt_data(str(data_dir))

    assert "isiZulu" in result
    assert result["isiZulu"] == [
        ("Abafundi", "A_ba_fundi"),
        ("Abahlali", "A_ba_hlal_i"),
    ]


# function should make data in lowercase when requested
def test_load_nchlt_data_lowercases_when_requested(tmp_path):
    data_dir = tmp_path / "NCHLT"
    data_dir.mkdir()

    (data_dir / "zul.txt").write_text("Abafundi\tA_ba_fundi\n", encoding="utf-8")

    result = load_nchlt_data(str(data_dir), lowercase=True)

    assert result["isiZulu"] == [("abafundi", "a_ba_fundi")]


# function should raise exception when directory is missing
def test_load_nchlt_data_dir_not_found(tmp_path):
    missing_dir = tmp_path / "NCHLT_missing" 

    with pytest.raises(FileNotFoundError):
        load_nchlt_data(str(missing_dir))


# function should return and an empty dict when there are not supported files
def test_load_nchlt_data_returns_empty_dict_when_no_supported_files(tmp_path):
    data_dir = tmp_path / "NCHLT"
    data_dir.mkdir()

    result = load_nchlt_data(str(data_dir))

    assert result == {}

# function should skip missing files 
def test_load_nchlt_data_skips_missing_language_files(tmp_path):
    data_dir = tmp_path / "NCHLT"
    data_dir.mkdir()

    (data_dir / "nso.txt").write_text("Lefoko\tLe_fo_ko\n", encoding="utf-8")

    result = load_nchlt_data(str(data_dir))

    assert set(result.keys()) == {"Sepedi"}
    assert result["Sepedi"] == [("Lefoko", "Le_fo_ko")]

# functions should ignore blank and whitspace lines
def test_load_nchlt_data_ignores_blank_and_whitespace_lines(tmp_path):
    data_dir = tmp_path / "NCHLT"
    data_dir.mkdir()

    (data_dir / "zul.txt").write_text(
        "\n"
        "   \n"
        "Abafundi\tA_ba_fundi\n",
        encoding="utf-8",
    )

    result = load_nchlt_data(str(data_dir))

    assert result["isiZulu"] == [("Abafundi", "A_ba_fundi")]

# function should ignore lines without a tab separator
def test_load_nchlt_data_ignores_malformed_lines_without_tab(tmp_path):
    data_dir = tmp_path / "NCHLT"
    data_dir.mkdir()

    (data_dir / "zul.txt").write_text(
        "This line has no separator\n"
        "Abafundi\tA_ba_fundi\n",
        encoding="utf-8",
    )

    result = load_nchlt_data(str(data_dir))

    assert result["isiZulu"] == [("Abafundi", "A_ba_fundi")]

# Test if badly segmented words are skipped
def test_load_nchlt_data_skips_badly_segmented_words(tmp_path):
    data_dir = tmp_path / "NCHLT"
    data_dir.mkdir()

    (data_dir / "zul.txt").write_text(
        "Abafundi\t_Abafundi\n"
        "Abafundi\tAbafundi_\n"
        "Abafundi\tAba__fundi\n"
        "Abafundi\tA_ba_fundi\n",
        encoding="utf-8",
    )

    result = load_nchlt_data(str(data_dir))

    assert result["isiZulu"] == [("Abafundi", "A_ba_fundi")]

# Test if surface word have delimiter
def test_load_nchlt_data_skips_surface_segmentations(tmp_path):
    data_dir = tmp_path / "NCHLT"
    data_dir.mkdir()

    (data_dir / "zul.txt").write_text(
            "Ab_afundi\tAba_fundi\n"
            "Abafundi\tA_ba_fundi\n",
            encoding="utf-8",
        )

    result = load_nchlt_data(str(data_dir))

    assert result["isiZulu"] == [("Abafundi", "A_ba_fundi")]

# Test custom delimiters
def test_load_nchlt_data_custom_delimeter(tmp_path):
    data_dir = tmp_path / "NCHLT"
    data_dir.mkdir()

    (data_dir / "zul.txt").write_text(
            "Abafundi\tA-ba-fundi\n",
            encoding="utf-8",
        )

    result = load_nchlt_data(str(data_dir), False, "-")

    assert result["isiZulu"] == [("Abafundi", "A-ba-fundi")]

# function should strip whitespace properly
def test_load_nchlt_data_strips_surface_and_gold_whitespace(tmp_path):
    data_dir = tmp_path / "NCHLT"
    data_dir.mkdir()

    (data_dir / "zul.txt").write_text("  Abafundi  \t  A_ba_fundi  \n", encoding="utf-8")

    result = load_nchlt_data(str(data_dir))

    assert result["isiZulu"] == [("Abafundi", "A_ba_fundi")]

# function should be able to collect data from multiple languages
def test_load_nchlt_data_collects_multiple_languages(tmp_path):
    data_dir = tmp_path / "NCHLT"
    data_dir.mkdir()

    (data_dir / "zul.txt").write_text("Abafundi\tA_ba_fundi\n", encoding="utf-8")
    (data_dir / "xho.txt").write_text("Abantu\tA_ba_ntu\n", encoding="utf-8")

    result = load_nchlt_data(str(data_dir))

    assert result["isiZulu"] == [("Abafundi", "A_ba_fundi")]
    assert result["isiXhosa"] == [("Abantu", "A_ba_ntu")]


    





