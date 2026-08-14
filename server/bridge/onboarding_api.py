"""Onboarding status — terms + training (mirrors layouts/onboarding.py)."""

from __future__ import annotations

from typing import Any


def _terms_version() -> str:
  try:
    from openpilot.common.version import terms_version
    return terms_version
  except Exception:
    return "2"


def _training_version() -> str:
  try:
    from openpilot.common.version import training_version
    return training_version
  except Exception:
    return "0.2.0"


def _params():
  from openpilot.common.params import Params
  return Params()


def onboarding_status() -> dict[str, Any]:
  try:
    p = _params()
    terms_version = _terms_version()
    training_version = _training_version()
    terms_ok = p.get("HasAcceptedTerms") == terms_version
    training_ok = p.get("CompletedTrainingVersion") == training_version
    completed = terms_ok and training_ok
    phase = "terms"
    if terms_ok and not training_ok:
      phase = "training"
    elif completed:
      phase = "done"
    return {
      "ok": True,
      "completed": completed,
      "terms_accepted": terms_ok,
      "training_completed": training_ok,
      "phase": phase,
      "terms_version": terms_version,
      "training_version": training_version,
    }
  except Exception as exc:
    return {"ok": False, "error": str(exc), "completed": True}


def accept_terms() -> dict[str, Any]:
  try:
    p = _params()
    p.put("HasAcceptedTerms", _terms_version())
    return onboarding_status()
  except Exception as exc:
    return {"ok": False, "error": str(exc)}


def complete_training() -> dict[str, Any]:
  try:
    p = _params()
    p.put("CompletedTrainingVersion", _training_version())
    return onboarding_status()
  except Exception as exc:
    return {"ok": False, "error": str(exc)}
