"""Finding the call that belongs to a species.

The original version kept a hand-written map from species name to file name.
The classifier emits names with spaces ("Cattle Egret") while the map was keyed
with underscores ("Cattle_Egret"), so 23 of the 25 birds reported "No Audio
Available" even though every mp3 was sitting in assets/sounds. Deriving the
file name from the species name removes the chance of that drifting again.
"""

from pathlib import Path

ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets" / "sounds"


def _candidates(species_name: str):
    """File names this species might be stored under."""
    underscored = "_".join(species_name.split())
    yield f"{underscored}.mp3"
    # a couple of files were saved with different capitalisation
    yield f"{underscored.lower()}.mp3"
    yield f"{underscored.title()}.mp3"


class AudioManager:
    def __init__(self, assets_dir: Path | str = ASSETS_DIR):
        self.assets_dir = Path(assets_dir)

    def get_audio_path(self, species_name: str) -> str | None:
        """Absolute path to this species' call, or None if we don't have one."""
        if not species_name:
            return None

        for name in _candidates(species_name):
            path = self.assets_dir / name
            if path.exists():
                return str(path)

        # last resort: case-insensitive match against whatever is on disk
        wanted = "".join(species_name.lower().split())
        for path in self.assets_dir.glob("*.mp3"):
            if "".join(path.stem.lower().split("_")) == wanted:
                return str(path)
        return None

    def missing_species(self, species_names) -> list[str]:
        """Which species have no sound file - handy for a startup check."""
        return [name for name in species_names if self.get_audio_path(name) is None]
