#!/usr/bin/env python3
"""
Organize locations.json data state-wise into clean folders:
data/
  states.json
  goa/
    north-goa.json
    south-goa.json
  maharashtra/
    alibaug.json
    ...
  rajasthan/
    ...
"""

import os
import json
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOCATIONS_FILE = os.path.join(BASE_DIR, "assets", "locations.json")
DATA_DIR = os.path.join(BASE_DIR, "data")
ASSETS_DATA_DIR = os.path.join(BASE_DIR, "assets", "data")

STATE_MAP = {
    "north-goa": ("Goa", "goa", "tropical beaches palms private pool villa goa"),
    "south-goa": ("Goa", "goa", "south goa luxury beach serene villa"),
    "alibaug": ("Maharashtra", "maharashtra", "alibaug beach luxury private pool villa"),
    "karjat": ("Maharashtra", "maharashtra", "karjat mountain nature private villa"),
    "kolad": ("Maharashtra", "maharashtra", "kolad riverside nature adventure villa"),
    "lonavala": ("Maharashtra", "maharashtra", "lonavala misty hills luxury villa pool"),
    "igatpuri": ("Maharashtra", "maharashtra", "igatpuri hills nature estate villa"),
    "nashik": ("Maharashtra", "maharashtra", "nashik vineyard estate luxury villa"),
    "jaipur": ("Rajasthan", "rajasthan", "jaipur royal heritage palace luxury resort"),
    "udaipur": ("Rajasthan", "rajasthan", "udaipur lake pichola luxury palace resort"),
    "pushkar": ("Rajasthan", "rajasthan", "pushkar desert luxury camp resort"),
    "ranthambore": ("Rajasthan", "rajasthan", "ranthambore wildlife luxury jungle lodge"),
    "alwar": ("Rajasthan", "rajasthan", "alwar heritage luxury fort palace"),
    "neemrana": ("Rajasthan", "rajasthan", "neemrana heritage fort luxury estate"),
    "bhimtal": ("Uttarakhand", "uttarakhand", "bhimtal lake view mountain villa"),
    "dehradun": ("Uttarakhand", "uttarakhand", "dehradun hills doon valley luxury villa"),
    "jim-corbett": ("Uttarakhand", "uttarakhand", "jim corbett forest wilderness luxury resort"),
    "mukteshwar": ("Uttarakhand", "uttarakhand", "mukteshwar snow himalayan peaks villa"),
    "mussoorie": ("Uttarakhand", "uttarakhand", "mussoorie hills queen misty luxury estate"),
    "nainital": ("Uttarakhand", "uttarakhand", "nainital lake hill station luxury retreat"),
    "ranikhet": ("Uttarakhand", "uttarakhand", "ranikhet pine forests pine view villa"),
    "rishikesh": ("Uttarakhand", "uttarakhand", "rishikesh ganges river luxury wellness retreat"),
    "kasauli": ("Himachal Pradesh", "himachal-pradesh", "kasauli pine forest mountain luxury cottage"),
    "shimla": ("Himachal Pradesh", "himachal-pradesh", "shimla snow peaks heritage luxury resort"),
    "dharamshala": ("Himachal Pradesh", "himachal-pradesh", "dharamshala dhauladhar mountain villa"),
    "delhi-ncr": ("Delhi NCR", "delhi-ncr", "delhi ncr gurgaon farmhouse luxury pool estate"),
    "bengaluru": ("Karnataka", "karnataka", "bengaluru garden luxury retreat villa pool"),
    "coorg": ("Karnataka", "karnataka", "coorg coffee plantation luxury estate resort"),
    "alappuzha": ("Kerala", "kerala", "alappuzha kerala backwaters luxury houseboat villa"),
    "kochi": ("Kerala", "kerala", "kochi fort kerala heritage luxury seaside villa"),
    "munnar": ("Kerala", "kerala", "munnar tea gardens misty hills luxury retreat"),
    "varkala": ("Kerala", "kerala", "varkala cliff beach arabian sea luxury villa"),
    "chennai": ("Tamil Nadu", "tamil-nadu", "chennai coastal luxury beach house resort"),
    "ooty": ("Tamil Nadu", "tamil-nadu", "ooty nilgiri hills colonial luxury estate"),
    "dubai": ("Dubai (UAE)", "dubai", "dubai luxury villa palm jumeirah private pool skyline")
}

STATE_INFO = {
    "goa": {
        "title": "Goa Luxury Coastal Sanctuaries",
        "tagline": "Sun-kissed beaches, heritage Portuguese architecture, and private pool estates.",
        "hero": "goa luxury private pool villa tropical palms sunset"
    },
    "maharashtra": {
        "title": "Maharashtra Getaways & Mountain Escapes",
        "tagline": "Scenic Western Ghats, coastal beach villas, and lush vineyard sanctuaries.",
        "hero": "lonavala alibaug luxury villa pool nature western ghats"
    },
    "rajasthan": {
        "title": "Rajasthan Royal Palaces & Desert Estates",
        "tagline": "Regal Rajput architecture, tranquil palace lakes, and opulent heritage stays.",
        "hero": "udaipur jaipur luxury heritage palace pool rajasthan"
    },
    "uttarakhand": {
        "title": "Uttarakhand Himalayan Mountain Retreats",
        "tagline": "Misty pine forests, sacred riverbanks, and panoramic snow-capped vistas.",
        "hero": "mussoorie nainital himalayan luxury mountain villa resort"
    },
    "himachal-pradesh": {
        "title": "Himachal Pradesh Hill Stations & Pine Valleys",
        "tagline": "Crisp mountain air, colonial heritage cottages, and peaceful highland valleys.",
        "hero": "kasauli shimla luxury mountain cottage pine forest"
    },
    "delhi-ncr": {
        "title": "Delhi NCR Farmhouses & Private Enclaves",
        "tagline": "Sprawling private acres, pool farmhouses, and weekend luxury sanctuaries.",
        "hero": "delhi ncr gurgaon luxury farmhouse pool night garden"
    },
    "karnataka": {
        "title": "Karnataka Plantation Estates & Garden Retreats",
        "tagline": "Aromatic coffee estates in Coorg and boutique modern villas in Bengaluru.",
        "hero": "coorg plantation luxury estate swimming pool nature"
    },
    "kerala": {
        "title": "Kerala Backwater Sanctuaries & Coastal Havens",
        "tagline": "Serene backwaters, swaying palm groves, and tranquil tropical waterfronts.",
        "hero": "kerala backwaters luxury resort pool palm trees"
    },
    "tamil-nadu": {
        "title": "Tamil Nadu Coastal Estates & Highland Sanctuaries",
        "tagline": "Colonial hill mansions in Ooty and breezy coastal retreats in Chennai.",
        "hero": "ooty nilgiri mountains luxury colonial estate cottage"
    },
    "dubai": {
        "title": "Dubai Ultra-Luxury Residences & Palm Villas",
        "tagline": "World-class skyline architecture, private beachfronts, and iconic luxury.",
        "hero": "dubai palm jumeirah luxury villa private pool skyline"
    }
}

def run():
    with open(LOCATIONS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    locations = data.get("locations", [])
    print(f"Loaded {len(locations)} locations from locations.json")

    # Group locations by state
    states = {}
    for loc in locations:
        loc_slug = loc["slug"]
        if loc_slug not in STATE_MAP:
            print(f"Warning: unknown location {loc_slug}")
            continue
        state_name, state_slug, hero = STATE_MAP[loc_slug]
        
        if state_slug not in states:
            states[state_slug] = {
                "id": state_slug,
                "slug": state_slug,
                "name": state_name,
                "title": STATE_INFO.get(state_slug, {}).get("title", f"{state_name} Luxury Villas"),
                "tagline": STATE_INFO.get(state_slug, {}).get("tagline", "Curated luxury villa collection."),
                "hero": STATE_INFO.get(state_slug, {}).get("hero", f"{state_name.lower()} luxury resort landscape"),
                "total_locations": 0,
                "total_villas": 0,
                "locations": []
            }
        
        states[state_slug]["total_locations"] += 1
        states[state_slug]["total_villas"] += loc["villa_count"]
        states[state_slug]["locations"].append({
            "id": loc["id"],
            "slug": loc["slug"],
            "name": loc["name"],
            "villa_count": loc["villa_count"],
            "hero": hero,
            "file": f"data/{state_slug}/{loc['slug']}.json"
        })

    # Ensure target dirs
    for d in [DATA_DIR, ASSETS_DATA_DIR]:
        os.makedirs(d, exist_ok=True)
        for st_slug in states.keys():
            os.makedirs(os.path.join(d, st_slug), exist_ok=True)

    # Write each location file into data/<state>/<location>.json
    for loc in locations:
        loc_slug = loc["slug"]
        state_name, state_slug, hero = STATE_MAP[loc_slug]
        
        # Enrich location object with state info
        loc_copy = dict(loc)
        loc_copy["state_name"] = state_name
        loc_copy["state_slug"] = state_slug
        loc_copy["hero"] = hero

        for target_root in [DATA_DIR, ASSETS_DATA_DIR]:
            file_path = os.path.join(target_root, state_slug, f"{loc_slug}.json")
            with open(file_path, "w", encoding="utf-8") as lf:
                json.dump(loc_copy, lf, indent=2)

    # Sort states by total villas descending for a great initial display
    states_list = sorted(list(states.values()), key=lambda s: s["total_villas"], reverse=True)

    states_index = {
        "source": "elivaas.com",
        "total_states": len(states_list),
        "total_locations": len(locations),
        "total_villas": sum(s["total_villas"] for s in states_list),
        "states": states_list
    }

    for target_root in [DATA_DIR, ASSETS_DATA_DIR]:
        states_index_path = os.path.join(target_root, "states.json")
        with open(states_index_path, "w", encoding="utf-8") as sf:
            json.dump(states_index, sf, indent=2)
        print(f"Saved states index to {states_index_path}")

    print("\nSummary of State Folders:")
    for s in states_list:
        print(f" - {s['name']} ({s['slug']}): {s['total_locations']} locations, {s['total_villas']} villas")

if __name__ == "__main__":
    run()
