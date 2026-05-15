from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent


def _load_prompt(filename: str) -> str:
    return (_PROMPTS_DIR / filename).read_text(encoding="utf-8").strip()


ROUND_1_PROMPT = _load_prompt("round_1_character.md")
ROUND_2_PROMPT = _load_prompt("round_2_logic.md")
ROUND_3_PROMPT = _load_prompt("round_3_style.md")
