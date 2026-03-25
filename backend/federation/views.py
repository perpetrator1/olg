"""
federation/views.py

The Grid — Django-powered federation aggregator.

Flow:
  1. Call the local Supabase PostgREST API to fetch all "active"
     rows from the `federated_instances` table.
  2. For each peer, call *that* peer's Supabase REST API (using
     its own supabase_url + anon_key) to query approved materials.
  3. Tag every material with the peer's name ("instance badge").
  4. Return the merged list sorted by creation date, plus metadata
     (total peers, error count, per-peer status).

Endpoints:
  GET /api/federation/grid/      → aggregated materials feed
  GET /api/federation/instances/ → active peer nodes list
"""

import concurrent.futures
import logging
from datetime import datetime

import requests
from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response

logger = logging.getLogger(__name__)

# ── Supabase helpers ──────────────────────────────────────────────────────

def _supabase_headers(key: str) -> dict:
    """Build headers for a Supabase PostgREST request."""
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _local_supabase_get(table: str, params: dict = None) -> list:
    """
    Query a table on the LOCAL Supabase instance.
    Uses the service-role key if available (bypasses RLS),
    otherwise falls back to the anon key.
    """
    key = settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_ANON_KEY
    base_url = settings.SUPABASE_URL.rstrip("/")
    url = f"{base_url}/rest/v1/{table}"

    response = requests.get(
        url,
        headers=_supabase_headers(key),
        params=params or {},
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def _fetch_peer_materials(instance: dict) -> dict:
    """
    Fetch approved materials from a single peer Supabase instance.

    Returns a dict:
      {
        "instance": { id, name, supabase_url },
        "materials": [...],   # list of material objects
        "error": None | str,
      }
    """
    result = {
        "instance": {
            "id": instance["id"],
            "name": instance["name"],
            "supabase_url": instance["supabase_url"],
        },
        "materials": [],
        "error": None,
    }

    try:
        peer_url = instance["supabase_url"].rstrip("/")
        peer_key = instance["anon_key"]
        url = f"{peer_url}/rest/v1/materials"

        # Select the fields we need, join profiles via embedded resource
        params = {
            "select": "id,title,description,type,file_url,created_at,profiles(full_name,username)",
            "status": "eq.approved",
            "order": "created_at.desc",
            "limit": "30",
        }

        response = requests.get(
            url,
            headers=_supabase_headers(peer_key),
            params=params,
            timeout=8,
        )
        response.raise_for_status()
        raw = response.json()

        # Tag every material with the instance badge
        tagged = []
        for m in raw:
            m["instance_id"] = instance["id"]
            m["instance_name"] = instance["name"]
            m["instance_url"] = instance["supabase_url"]
            tagged.append(m)

        result["materials"] = tagged

    except requests.exceptions.Timeout:
        result["error"] = "Peer timed out"
        logger.warning("Timeout fetching from peer %s", instance.get("name"))
    except requests.exceptions.ConnectionError as e:
        result["error"] = f"Connection refused: {e}"
        logger.warning("Connection error for peer %s: %s", instance.get("name"), e)
    except requests.exceptions.HTTPError as e:
        result["error"] = f"HTTP {e.response.status_code}"
        logger.warning("HTTP error from peer %s: %s", instance.get("name"), e)
    except Exception as e:
        result["error"] = str(e)
        logger.error("Unexpected error from peer %s: %s", instance.get("name"), e)

    return result


# ── Views ─────────────────────────────────────────────────────────────────

@api_view(["GET"])
def grid(request):
    """
    GET /api/federation/grid/

    Aggregates approved materials from all active peer nodes and returns
    a unified feed with per-peer status metadata.

    Response shape:
    {
      "total_peers": 3,
      "successful_peers": 2,
      "failed_peers": 1,
      "errors": [{ "instance_name": "...", "error": "..." }],
      "materials": [
        {
          "id": "...",
          "title": "...",
          "description": "...",
          "type": "notes" | ...,
          "file_url": "...",
          "created_at": "...",
          "profiles": { "full_name": "...", "username": "..." },
          "instance_id": "...",
          "instance_name": "State College",
          "instance_url": "https://..."
        },
        ...
      ]
    }
    """
    # 1. Load active peer instances from local Supabase
    try:
        instances = _local_supabase_get(
            "federated_instances",
            params={"status": "eq.active", "select": "id,name,supabase_url,anon_key"},
        )
    except Exception as e:
        logger.error("Failed to load federated instances: %s", e)
        return Response(
            {"error": "Could not load peer nodes from local database.", "detail": str(e)},
            status=503,
        )

    if not instances:
        return Response({
            "total_peers": 0,
            "successful_peers": 0,
            "failed_peers": 0,
            "errors": [],
            "materials": [],
        })

    # 2. Fan out — fetch from all peers concurrently
    all_materials = []
    errors = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_instance = {
            executor.submit(_fetch_peer_materials, inst): inst
            for inst in instances
        }
        for future in concurrent.futures.as_completed(future_to_instance):
            peer_result = future.result()
            if peer_result["error"]:
                errors.append({
                    "instance_name": peer_result["instance"]["name"],
                    "error": peer_result["error"],
                })
            else:
                all_materials.extend(peer_result["materials"])

    # 3. Sort all materials by created_at descending
    def _parse_dt(m):
        try:
            return datetime.fromisoformat(m.get("created_at", "") or "")
        except ValueError:
            return datetime.min

    all_materials.sort(key=_parse_dt, reverse=True)

    return Response({
        "total_peers": len(instances),
        "successful_peers": len(instances) - len(errors),
        "failed_peers": len(errors),
        "errors": errors,
        "materials": all_materials,
    })


@api_view(["GET"])
def instances(request):
    """
    GET /api/federation/instances/

    Returns the list of active federated peer nodes (without the anon_key
    for security — that stays server-side).
    """
    try:
        data = _local_supabase_get(
            "federated_instances",
            params={
                "status": "eq.active",
                "select": "id,name,supabase_url,status,created_at",
                "order": "created_at.asc",
            },
        )
        return Response(data)
    except Exception as e:
        logger.error("Failed to load instances: %s", e)
        return Response(
            {"error": "Could not load peer nodes.", "detail": str(e)},
            status=503,
        )
