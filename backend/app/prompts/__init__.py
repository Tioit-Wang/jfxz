from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent


def _load_prompt(filename: str) -> str:
    return (_PROMPTS_DIR / filename).read_text(encoding="utf-8").strip()


CHARACTER_PROMPT = _load_prompt("round_1_character.md")
LOGIC_PROMPT = _load_prompt("round_2_logic.md")
STYLE_PROMPT = _load_prompt("round_3_style.md")
SYSTEM_PROMPT = _load_prompt("system_prompt.md")
