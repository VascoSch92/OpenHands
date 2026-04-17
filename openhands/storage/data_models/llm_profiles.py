from __future__ import annotations

from typing import Any, Final

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    SerializationInfo,
    ValidationError,
    field_serializer,
    field_validator,
    model_validator,
)

from openhands.core.logger import openhands_logger as logger
from openhands.sdk.llm import LLM

# Soft cap — keeps Settings payload bounded and blocks per-user storage
# blow-ups. Tune if product requirements change.
MAX_PROFILES_PER_USER: Final[int] = 10


class ProfileNotFoundError(LookupError):
    """Raised when a profile lookup or activation references an unknown name."""

    def __init__(self, name: str) -> None:
        self.name = name
        super().__init__(f"Profile '{name}' not found")


class ProfileLimitExceededError(ValueError):
    """Raised when saving a new profile would exceed :data:`MAX_PROFILES_PER_USER`."""

    def __init__(self, limit: int) -> None:
        self.limit = limit
        super().__init__(
            f'Profile limit reached ({limit}). Delete a profile before saving a new one.'
        )


class StrictLLM(LLM):
    """LLM variant that rejects unknown fields.

    The base ``LLM`` model has ``extra='ignore'``, so typos and renamed keys
    silently disappear. For API input we want to fail loud, otherwise users
    can POST ``{"llm": {"custom_header": "x"}}`` and get a 201 with the
    field quietly dropped.
    """

    model_config = ConfigDict(extra='forbid')


class LLMProfiles(BaseModel):
    """Container for saved LLM configurations.

    Stores a named collection of ``LLM`` configurations plus the name of the
    currently active one (if any). All profile-management logic lives here;
    ``Settings`` holds a single ``LLMProfiles`` instance and delegates to it.

    Invariants (enforced on validate + assignment):
    - ``active`` is either ``None`` or a key of ``profiles``.
    - Individual profiles that fail to parse (schema drift) are dropped with
      a warning rather than failing the whole ``Settings`` load.
    """

    model_config = ConfigDict(validate_assignment=True)

    profiles: dict[str, LLM] = Field(default_factory=dict)
    active: str | None = None

    # ── Validation ─────────────────────────────────────────────────

    @field_validator('profiles', mode='before')
    @classmethod
    def _skip_invalid_profiles(cls, value: Any) -> Any:
        """Best-effort per-profile load: skip entries that fail to validate.

        Guards against schema drift — if a single stored profile becomes
        invalid after an LLM-model upgrade, the user's other profiles and
        the rest of their settings still load.
        """
        if not isinstance(value, dict):
            return value
        valid: dict[str, Any] = {}
        for name, raw in value.items():
            if isinstance(raw, LLM):
                valid[name] = raw
                continue
            try:
                valid[name] = LLM.model_validate(raw)
            except ValidationError as exc:
                logger.warning('Skipping invalid LLM profile %r: %s', name, exc)
        return valid

    @model_validator(mode='after')
    def _reconcile_active(self) -> LLMProfiles:
        if self.active is not None and self.active not in self.profiles:
            # Bypass validate_assignment to avoid re-entering this validator.
            object.__setattr__(self, 'active', None)
        return self

    # ── Queries ────────────────────────────────────────────────────

    def get(self, name: str) -> LLM | None:
        """Return the profile's LLM or ``None`` if it doesn't exist."""
        return self.profiles.get(name)

    def require(self, name: str) -> LLM:
        """Return the profile's LLM or raise :class:`ProfileNotFoundError`."""
        llm = self.profiles.get(name)
        if llm is None:
            raise ProfileNotFoundError(name)
        return llm

    def has(self, name: str) -> bool:
        return name in self.profiles

    def summaries(self) -> list[dict[str, Any]]:
        """Return a ``{name, model, base_url, api_key_set}`` dict per profile.

        ``api_key_set`` mirrors the ``llm_api_key_set`` convention the main
        settings endpoint already uses, so the frontend can render
        "key stored" vs. "needs key" without fetching each profile.
        """
        return [
            {
                'name': name,
                'model': llm.model,
                'base_url': llm.base_url,
                'api_key_set': llm.api_key is not None,
            }
            for name, llm in self.profiles.items()
        ]

    # ── Mutations ──────────────────────────────────────────────────

    def save(self, name: str, llm: LLM, include_secrets: bool = True) -> None:
        """Save ``llm`` under ``name``. Overwrites if the name exists.

        Always stores a copy so later caller-side mutations do not bleed into
        the stored profile. Raises :class:`ProfileLimitExceededError` if
        saving a *new* profile would push the count past
        :data:`MAX_PROFILES_PER_USER`.
        """
        if name not in self.profiles and len(self.profiles) >= MAX_PROFILES_PER_USER:
            raise ProfileLimitExceededError(MAX_PROFILES_PER_USER)

        update = {} if include_secrets else {'api_key': None}
        self.profiles[name] = llm.model_copy(update=update)

    def delete(self, name: str) -> bool:
        """Delete a profile. Returns True if the profile existed.

        Clears ``active`` if the deleted profile was active.
        """
        if name not in self.profiles:
            return False
        del self.profiles[name]
        if self.active == name:
            # Bypass validate_assignment since we already know the invariant holds.
            object.__setattr__(self, 'active', None)
        return True

    # ── Serialization ──────────────────────────────────────────────

    @field_serializer('profiles')
    def _profiles_serializer(
        self,
        profiles: dict[str, LLM],
        info: SerializationInfo,
    ) -> dict[str, Any]:
        return {
            name: llm.model_dump(mode='json', context=info.context)
            for name, llm in profiles.items()
        }
