"""
federation/views.py

The Grid — Django-powered federation aggregator.

Flow:
  1. BFS-traverse the network up to MAX_DEPTH hops via Supabase REST to discover
     the full "Circle" of instances, starting from the local node.
  2. Concurrently fetch approved materials from every discovered node (including local).
  3. Tag every material with the node's name ("instance badge").
  4. Return the merged list sorted by creation date, plus metadata.

Endpoints:
  GET /api/federation/grid/      → all-circle aggregated materials feed
                                   ?search=<text>   substring filter on title
                                   ?types=<t1,t2>   comma-separated type filter
  GET /api/federation/instances/ → active direct peer nodes list
"""

import concurrent.futures
import logging
from datetime import datetime

import requests
from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response

logger = logging.getLogger(__name__)

MAX_DEPTH = 3  # BFS hop limit to prevent runaway traversal


# ── Supabase helpers ──────────────────────────────────────────────────────

def _supabase_headers(key: str) -> dict:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _local_supabase_get(table: str, params: dict = None) -> list:
    """Query a table on the LOCAL Supabase instance using service/anon key."""
    key = getattr(settings, "SUPABASE_SERVICE_KEY", None) or settings.SUPABASE_ANON_KEY
    url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/{table}"
    resp = requests.get(url, headers=_supabase_headers(key), params=params or {}, timeout=10)
    resp.raise_for_status()
    return resp.json()


# ── Circle Discovery ──────────────────────────────────────────────────────

def _discover_circle_instances() -> list:
    """
    BFS over the instance graph starting from the local node.
    Returns a flat list of all discovered instance dicts
    (each has: id, name, supabase_url, anon_key).
    The local node is always the first entry.
    """
    local_url = settings.SUPABASE_URL.rstrip("/")
    local_name = getattr(settings, "INSTANCE_NAME", "Local Node")
    local_key = getattr(settings, "SUPABASE_SERVICE_KEY", None) or settings.SUPABASE_ANON_KEY

    local_node = {
        "id": "local",
        "name": local_name,
        "supabase_url": local_url,
        "anon_key": local_key,
    }

    visited = {local_url: local_node}  # url -> node
    queue = [local_node]

    for _depth in range(MAX_DEPTH):
        if not queue:
            break
        next_queue = []
        for node in queue:
            try:
                resp = requests.get(
                    f"{node['supabase_url']}/rest/v1/federated_instances",
                    params={"status": "eq.active", "select": "id,name,supabase_url,anon_key"},
                    headers=_supabase_headers(node["anon_key"]),
                    timeout=5,
                )
                if resp.status_code == 200:
                    for peer in resp.json():
                        p_url = (peer.get("supabase_url") or "").rstrip("/")
                        if p_url and p_url not in visited:
                            visited[p_url] = peer
                            next_queue.append(peer)
            except Exception as exc:
                logger.warning("Circle BFS: failed to fetch peers from %s — %s", node.get("name"), exc)
        queue = next_queue

    return list(visited.values())


# ── Material fetcher ──────────────────────────────────────────────────────

def _fetch_peer_materials(instance: dict, search_query: str = "", selected_types: list = None) -> dict:
    """
    Fetch approved materials from a single instance's Supabase REST API.
    Applies optional search and type filters.
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
        url = f"{instance['supabase_url'].rstrip('/')}/rest/v1/materials"
        params = {
            "select": (
                "id,title,description,type,file_type,file_url,"
                "download_count,upvotes,created_at,"
                "profiles!uploaded_by(full_name,username)"
            ),
            "status": "eq.approved",
            "order": "created_at.desc",
            "limit": "50",
        }

        if search_query:
            params["title"] = f"ilike.*{search_query}*"
        if selected_types:
            params["type"] = f"in.({','.join(selected_types)})"

        resp = requests.get(
            url,
            headers=_supabase_headers(instance["anon_key"]),
            params=params,
            timeout=8,
        )
        resp.raise_for_status()

        data = resp.json()
        if not isinstance(data, list):
            raise ValueError(f"Expected a list from peer, got {type(data).__name__}: {data}")

        tagged = []
        for m in data:
            if not isinstance(m, dict):
                continue
            m["instance_id"] = instance["id"]
            m["instance_name"] = instance["name"]
            m["instance_url"] = instance["supabase_url"]
            m["is_local"] = (instance["id"] == "local")
            tagged.append(m)

        result["materials"] = tagged

    except requests.exceptions.Timeout:
        result["error"] = "Peer timed out"
        logger.warning("Timeout fetching from %s", instance.get("name"))
    except requests.exceptions.ConnectionError as exc:
        result["error"] = f"Connection refused: {exc}"
        logger.warning("Connection error for %s: %s", instance.get("name"), exc)
    except requests.exceptions.HTTPError as exc:
        result["error"] = f"HTTP {exc.response.status_code}"
        logger.warning("HTTP error from %s: %s", instance.get("name"), exc)
    except Exception as exc:
        result["error"] = str(exc)
        logger.error("Unexpected error from %s: %s", instance.get("name"), exc)

    return result


# ── Views ─────────────────────────────────────────────────────────────────

@api_view(["GET"])
def grid(request):
    """
    GET /api/federation/grid/

    Aggregates approved materials from every node in the local Circle
    (local + all transitively connected peers).

    Query params:
      search=<text>       — substring match on title
      types=<t1,t2,...>   — comma-separated type filter

    Response:
    {
      "total_peers":      <int>,
      "successful_peers": <int>,
      "failed_peers":     <int>,
      "errors":           [{"instance_name": "...", "error": "..."}],
      "materials":        [{ ...material fields..., instance_name, instance_id, is_local }]
    }
    """
    search_query = request.GET.get("search", "").strip()
    types_str = request.GET.get("types", "").strip()
    selected_types = [t.strip() for t in types_str.split(",") if t.strip()] if types_str else []

    try:
        circle = _discover_circle_instances()
    except Exception as exc:
        logger.error("Failed to discover circle: %s", exc)
        return Response({"error": "Could not discover circle nodes.", "detail": str(exc)}, status=503)

    all_materials = []
    errors = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        futures = {
            pool.submit(_fetch_peer_materials, inst, search_query, selected_types): inst
            for inst in circle
        }
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res["error"]:
                errors.append({"instance_name": res["instance"]["name"], "error": res["error"]})
            else:
                all_materials.extend(res["materials"])

    def _parse_dt(m):
        try:
            return datetime.fromisoformat(m.get("created_at") or "")
        except ValueError:
            return datetime.min

    all_materials.sort(key=_parse_dt, reverse=True)

    return Response({
        "total_peers": len(circle),
        "successful_peers": len(circle) - len(errors),
        "failed_peers": len(errors),
        "errors": errors,
        "materials": all_materials,
    })


@api_view(["GET"])
def instances(request):
    """
    GET /api/federation/instances/

    Directly connected (1-hop) peer nodes, without sensitive anon_key.
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
    except Exception as exc:
        logger.error("Failed to load instances: %s", exc)
        return Response({"error": "Could not load peer nodes.", "detail": str(exc)}, status=503)
