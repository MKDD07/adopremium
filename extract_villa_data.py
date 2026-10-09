#!/usr/bin/env python3
"""
Elivaas Villa Scraper & Parser
------------------------------
Extracts structured villa data and all image URLs from Elivaas pages into clean JSON.

Features:
1. Strips all inline SVGs and decorative SVG assets as requested.
2. Extracts complete property details:
   - title / name
   - location / address
   - rating & review count
   - specs: guests, bedrooms, bathrooms
   - amenities / tags
   - highlights / features
   - all high-resolution image URLs (excluding .svg)
3. Supports parsing:
   - Saved HTML files (e.g. from your browser or curl with session)
   - Direct URLs via HTTP / curl
   - Batch list of URLs from north_goa_links.json
4. Outputs structured JSON matching the project schema.
"""

import os
import sys
import json
import re
import html
import subprocess
from urllib.parse import urlparse

def clean_html(raw_html: str) -> str:
    """Removes all <svg>...</svg> blocks and comments."""
    cleaned = re.sub(r'<svg[\s\S]*?</svg>', '', raw_html, flags=re.IGNORECASE)
    cleaned = re.sub(r'<!--[\s\S]*?-->', '', cleaned)
    return cleaned

def extract_images(raw_html: str) -> list:
    """
    Extracts all photo/image URLs (excluding SVGs).
    Finds srcset URLs, src URLs, and CDN image paths.
    """
    # Regex to find image URLs
    pattern = r'https?://[^\s"\'<>]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^\s"\'<>]*)?'
    found_urls = re.findall(pattern, raw_html, re.IGNORECASE)

    # Also extract from srcset attributes
    srcset_matches = re.findall(r'srcset=["\']([^"\']+)["\']', raw_html, re.IGNORECASE)
    for src_group in srcset_matches:
        for part in src_group.split(','):
            url_match = re.search(r'(https?://\S+)', part.strip())
            if url_match:
                url = url_match.group(1).split()[0]
                if not url.lower().endswith('.svg') and '.svg?' not in url.lower():
                    found_urls.append(url)

    # Normalize URLs and deduplicate preserving order
    unique_images = []
    seen = set()
    for u in found_urls:
        u_clean = u.split('?')[0]  # base clean url
        if u_clean not in seen and not u_clean.lower().endswith('.svg'):
            seen.add(u_clean)
            unique_images.append(u)

    return unique_images

def extract_villa_data(raw_html: str, source_url: str = "") -> dict:
    """
    Extracts all available villa details from raw page HTML.
    """
    # Strip SVGs first
    no_svg_html = clean_html(raw_html)

    # Derive slug
    slug = ""
    if source_url:
        slug = [p for p in urlparse(source_url).path.split('/') if p][-1]
    
    # 1. Title / Villa Name
    title = ""
    title_match = re.search(r'<h1[^>]*>([\s\S]*?)</h1>', no_svg_html, re.IGNORECASE)
    if title_match:
        title = html.unescape(re.sub(r'<[^>]+>', '', title_match.group(1))).strip()
    if not title:
        meta_title = re.search(r'<title[^>]*>([\s\S]*?)</title>', no_svg_html, re.IGNORECASE)
        if meta_title:
            title = html.unescape(meta_title.group(1)).strip()

    # 2. Location
    location = ""
    loc_match = re.search(r'<h2[^>]*class="[^"]*(?:color-foreground|location|text-foreground)[^"]*"[^>]*>([\s\S]*?)</h2>', no_svg_html, re.IGNORECASE)
    if not loc_match:
        loc_match = re.search(r'<h2[^>]*>([\s\S]*?)</h2>', no_svg_html, re.IGNORECASE)
    if loc_match:
        location = html.unescape(re.sub(r'<[^>]+>', '', loc_match.group(1))).strip()
        location = re.sub(r'\s+', ' ', location)

    # 3. Rating & Reviews
    rating = ""
    rating_match = re.search(r'([45]\.\d+)\s*(?:<!--|\s|<|/div>|\s*Reviews)', raw_html)
    if rating_match:
        rating = rating_match.group(1)

    reviews_count = ""
    reviews_match = re.search(r'(\d+)\s*Reviews', no_svg_html, re.IGNORECASE)
    if reviews_match:
        reviews_count = reviews_match.group(1)

    # 4. Capacity / Specifications (guests, bedrooms, bathrooms)
    guests = ""
    g_match = re.search(r'(\d+)\s*guests?', no_svg_html, re.IGNORECASE)
    if g_match:
        guests = g_match.group(1)

    bedrooms = ""
    b_match = re.search(r'(\d+)\s*(?:bedrooms?|bhk)', no_svg_html, re.IGNORECASE)
    if b_match:
        bedrooms = b_match.group(1)

    bathrooms = ""
    bath_match = re.search(r'(\d+)\s*bathrooms?', no_svg_html, re.IGNORECASE)
    if bath_match:
        bathrooms = bath_match.group(1)

    # 5. Features & Amenities
    amenities = []
    # Match bullet tags, chips, or badge texts
    badge_matches = re.findall(r'<div[^>]*class="[^"]*font-semibold[^"]*"[^>]*>([^<]+)</div>', no_svg_html)
    for b in badge_matches:
        text = b.strip()
        if text and len(text) < 40 and text not in amenities:
            amenities.append(text)

    # 6. Extract all images (no svg)
    images = extract_images(raw_html)

    return {
        "slug": slug,
        "url": source_url,
        "name": title,
        "location": location,
        "rating": rating,
        "reviews": reviews_count,
        "capacity": {
            "guests": guests,
            "bedrooms": bedrooms,
            "bathrooms": bathrooms
        },
        "tags_and_amenities": amenities,
        "total_images": len(images),
        "images": images
    }

def fetch_with_curl(url: str, cookie: str = "") -> str:
    """Fetches a URL using curl, optionally with session cookies."""
    cmd = [
        "curl", "-sL",
        "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "-H", "Accept-Language: en-US,en;q=0.9",
        url
    ]
    if cookie:
        cmd.extend(["-H", f"Cookie: {cookie}"])

    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, errors="ignore")
    return res.stdout

def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  1. Parse HTML file:   python3 extract_villa_data.py <file.html> [source_url]")
        print("  2. Parse URL directly: python3 extract_villa_data.py <https://url...> [--cookie 'cookie_val']")
        print("  3. Batch from links:  python3 extract_villa_data.py --batch assets/north_goa_links.json")
        sys.exit(1)

    target = sys.argv[1]

    if target == "--batch":
        batch_file = sys.argv[2] if len(sys.argv) > 2 else "assets/north_goa_links.json"
        with open(batch_file, "r") as f:
            urls = json.load(f)
        print(f"Loaded {len(urls)} URLs from {batch_file}")

        results = {}
        for idx, u in enumerate(urls, start=1):
            print(f"[{idx}/{len(urls)}] Fetching: {u}")
            html_content = fetch_with_curl(u)
            data = extract_villa_data(html_content, u)
            slug = data["slug"] or f"villa_{idx}"
            results[slug] = data

        output_path = "assets/scraped_villas.json"
        with open(output_path, "w", encoding="utf-8") as out:
            json.dump(results, out, indent=2, ensure_ascii=False)
        print(f"Saved all scraped data to {output_path}")

    elif os.path.isfile(target):
        # File parsing
        source_url = sys.argv[2] if len(sys.argv) > 2 else ""
        print(f"Parsing HTML file: {target} (URL: {source_url})")
        with open(target, "r", encoding="utf-8", errors="ignore") as f:
            raw = f.read()
        data = extract_villa_data(raw, source_url)
        
        output_file = f"assets/{data['slug'] or 'extracted_villa'}.json"
        with open(output_file, "w", encoding="utf-8") as out:
            json.dump(data, out, indent=2, ensure_ascii=False)
        
        print("\n--- Extracted Summary ---")
        print(f"Name: {data['name']}")
        print(f"Location: {data['location']}")
        print(f"Guests: {data['capacity']['guests']}, Bedrooms: {data['capacity']['bedrooms']}, Bathrooms: {data['capacity']['bathrooms']}")
        print(f"Found {data['total_images']} images (0 SVGs).")
        print(f"Full JSON saved to: {output_file}")

    else:
        # Single URL
        cookie = sys.argv[3] if len(sys.argv) > 3 and sys.argv[2] == "--cookie" else ""
        print(f"Fetching URL: {target}")
        html_content = fetch_with_curl(target, cookie)
        data = extract_villa_data(html_content, target)
        
        output_file = f"assets/{data['slug'] or 'extracted_villa'}.json"
        with open(output_file, "w", encoding="utf-8") as out:
            json.dump(data, out, indent=2, ensure_ascii=False)

        print(f"Saved extracted data to: {output_file}")
        print(json.dumps(data, indent=2))

if __name__ == "__main__":
    main()
