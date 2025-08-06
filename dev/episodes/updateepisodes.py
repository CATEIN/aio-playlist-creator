#!/usr/bin/python3
import requests
import sys
import os
import time

BASE62_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
OUTPUT_FILE = "episode_names.txt"
VIEWER_ID = "a3J4W000002wGlvUAE"  # this is one of my viewer IDs. The club might not fetch all the episodes if you use mine, so you might want to replace it

def base62(n):
    if n < 0 or n >= 62 * 62:
        raise ValueError("Base62 ID out of range (must be 0–3843)")
    return BASE62_CHARS[n // 62] + BASE62_CHARS[n % 62]

def parse_token_arg():
    if len(sys.argv) < 2:
        print("Usage: python namefetcher.py <Bearer token>")
        sys.exit(1)
    token = sys.argv[1]
    if not token.startswith("Bearer "):
        token = "Bearer " + token
    return token

def fetch_content_groups(session, headers, content_type):
    episodes = {}
    page = 1
    page_size = 500 if content_type == "Episode Home" else 2000

    while True:
        print(f"Fetching {content_type} (page {page})...")
        res = session.post(
            "https://fotf.my.site.com/aio/services/apexrest/v1/contentgrouping/search",
            json={
                "type": content_type,
                "community": "Adventures in Odyssey",
                "pageNumber": page,
                "pageSize": page_size
            },
            headers=headers
        )
        time.sleep(0.5)

        if res.status_code != 200:
            print(f"Failed to fetch {content_type}. Status: {res.status_code}")
            break

        data = res.json()
        groups = data.get("contentGroupings", [])
        if not groups:
            break

        for group in groups:
            for item in group.get("contentList", []):
                eid = item.get("id")
                name = item.get("short_name", "").strip()
                if eid:
                    episodes[eid] = name or eid

        page += 1

    print(f"Found {len(episodes)} from {content_type}")
    return episodes

def load_existing_map(path=OUTPUT_FILE):
    episode_map = {}  # episode_id -> (base62_id, name)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split("\t")
                if len(parts) == 3:
                    base62_id, episode_id, name = parts
                    episode_map[episode_id] = (base62_id, name)
    return episode_map

def extract_episode_number(name):
    import re
    m = re.match(r"#(\d+)([a-z]?)", name)
    if m:
        number = int(m.group(1))
        suffix = m.group(2)
        return (number, ord(suffix) if suffix else 0)
    return (99999, 0)

def save_episode_map(fetched_episodes, existing_map, path=OUTPUT_FILE):
    merged = existing_map.copy()
    new_ids_needed = []

    for eid, name in fetched_episodes.items():
        if eid in merged:
            merged[eid] = (merged[eid][0], name)
        else:
            new_ids_needed.append((eid, name))

    # Assign new base62 IDs
    assigned_ids = {v[0] for v in merged.values()}
    next_id = 0
    for eid, name in sorted(new_ids_needed, key=lambda x: extract_episode_number(x[1])):
        while True:
            base_id = base62(next_id)
            next_id += 1
            if base_id not in assigned_ids:
                break
        merged[eid] = (base_id, name)
        print(f"Added: {base_id}\t{eid}\t{name}")

    # Write file
    with open(path, "w", encoding="utf-8") as f:
        for eid, (base_id, name) in sorted(merged.items(), key=lambda x: extract_episode_number(x[1][1])):
            f.write(f"{base_id}\t{eid}\t{name}\n")

    print(f"Saved {len(merged)} episodes to {path}.")

def main():
    token = parse_token_arg()
    session = requests.Session()
    headers = {
        'x-experience-name': 'Adventures In Odyssey',
        'x-viewer-id': VIEWER_ID,
        'Authorization': token
    }

    episodes = fetch_content_groups(session, headers, "Episode Home")
    if not episodes:
        print("Failed to fetch regular episodes. Aborting.")
        return

    album_episodes = fetch_content_groups(session, headers, "Album")
    if not album_episodes:
        print("Failed to fetch album episodes. Aborting.")
        return

    combined = {**episodes, **album_episodes}
    print(f"Total unique episodes (combined): {len(combined)}")

    existing = load_existing_map()
    save_episode_map(combined, existing)

if __name__ == "__main__":
    main()
