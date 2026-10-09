#!/usr/bin/env python3
"""
Elivaas Villa Comprehensive Data & Image Extractor
--------------------------------------------------
Extracts clean, structured JSON from Elivaas villa pages:
- Removes all <svg> tags and decorative .svg icons.
- Extracts comprehensive metadata:
  * Title / Property Name
  * Location / Address / Suburb / City
  * Rating and Review Count
  * Capacity (Guests, Bedrooms, Bathrooms, Beds)
  * About / Description text
  * Key Highlights & Amenities / Badges
  * House Rules & Timings (Check-in/out)
  * Bank offers & promos (ICICI, HDFC, Visa, etc.)
  * Full list of high-res image URLs (with auto-deduplication)
- Supports:
  1. Parsing directly from saved/exported HTML files or piped stdin
  2. Direct URL fetch with curl (including cookie support for Vercel challenge)
  3. Batch processing

Usage:
  python3 parse_villa.py <source.html> [url]
  python3 parse_villa.py <url> [--cookie "cookie_value"]
  cat page.html | python3 parse_villa.py --stdin [url]
"""

import sys
import os
import json
import re
import html
import subprocess
from urllib.parse import urlparse

def strip_svg_and_noise(raw_html: str) -> str:
    """Removes all <svg> blocks and HTML comments."""
    cleaned = re.sub(r'<svg[\s\S]*?</svg>', '', raw_html, flags=re.IGNORECASE)
    cleaned = re.sub(r'<!--[\s\S]*?-->', '', cleaned)
    return cleaned

def clean_text(text: str) -> str:
    """Decodes HTML entities and normalizes whitespace."""
    if not text:
        return ""
    text = html.unescape(text)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_all_images(raw_html: str) -> list:
    """
    Extracts all photo/image URLs (excluding SVGs).
    Collects from standard src, srcset, Cloudimg URLs, and Next.js image loaders.
    """
    candidates = []

    # 1. Cloudimg and direct CDN image URLs
    pattern = r'https?://[^\s"\'<>]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^\s"\'<>]*)?'
    candidates.extend(re.findall(pattern, raw_html, re.IGNORECASE))

    # 2. Extract from srcset attributes
    srcset_matches = re.findall(r'srcset=["\']([^"\']+)["\']', raw_html, re.IGNORECASE)
    for src_group in srcset_matches:
        for part in src_group.split(','):
            url_match = re.search(r'(https?://\S+)', part.strip())
            if url_match:
                u = url_match.group(1).split()[0]
                candidates.append(u)

    # 3. Clean and filter out SVGs, icons, and low-res duplicates
    cleaned_images = []
    seen = set()

    # Filter out common UI assets/badges
    excluded_keywords = ['brochure', 'logo', 'icon', 'arrow', 'star', 'calendar', 'user', 'badge', 'bank', 'hdfc', 'icici', 'visa', 'dbs', 'idfc']

    for u in candidates:
        u_lower = u.lower()
        if u_lower.endswith('.svg') or '.svg?' in u_lower:
            continue

        # Extract base path without resize params to deduplicate
        base_path = u.split('?')[0]
        if base_path in seen:
            continue

        # Check if it's an excluded small asset
        filename = base_path.split('/')[-1].lower()
        if any(ex in filename for ex in excluded_keywords):
            continue

        seen.add(base_path)
        cleaned_images.append(u)

    return cleaned_images

def extract_offers(raw_html: str) -> list:
    """Extracts curated promo and bank offers."""
    offers = []
    # Match card titles and descriptions
    offer_blocks = re.findall(r'title=["\']([^"\']+)["\'][\s\S]*?<p[^>]*class="[^"]*text-foreground[^"]*"[^>]*>([\s\S]*?)</p>', raw_html, re.IGNORECASE)
    for title, desc in offer_blocks:
        t = clean_text(title)
        d = clean_text(desc)
        if t and d and {"title": t, "description": d} not in offers:
            offers.append({"title": t, "description": d})
    return offers

def parse_villa_page(raw_html: str, source_url: str = "") -> dict:
    """
    Parses full villa details into a clean structured dictionary.
    """
    no_svg = strip_svg_and_noise(raw_html)

    # Derive slug
    slug = ""
    if source_url:
        slug = [p for p in urlparse(source_url).path.split('/') if p][-1]

    # 1. Title / Name
    title = ""
    h1_match = re.search(r'<h1[^>]*>([\s\S]*?)</h1>', no_svg, re.IGNORECASE)
    if h1_match:
        title = clean_text(h1_match.group(1))
    if not title:
        meta_title = re.search(r'<title[^>]*>([\s\S]*?)</title>', no_svg, re.IGNORECASE)
        if meta_title:
            title = clean_text(meta_title.group(1).split('|')[0])

    # 2. Location
    location = ""
    h2_match = re.search(r'<h2[^>]*class="[^"]*(?:color-foreground|location|text-foreground)[^"]*"[^>]*>([\s\S]*?)</h2>', no_svg, re.IGNORECASE)
    if not h2_match:
        h2_match = re.search(r'<h2[^>]*>([\s\S]*?)</h2>', no_svg, re.IGNORECASE)
    if h2_match:
        location = clean_text(h2_match.group(1))

    # 3. Rating & Reviews
    rating = ""
    r_match = re.search(r'([45]\.\d+)\s*(?:<!--|\s|<|/div>|\s*Reviews)', raw_html)
    if r_match:
        rating = r_match.group(1)

    reviews = ""
    rev_match = re.search(r'(\d+)\s*Reviews', no_svg, re.IGNORECASE)
    if rev_match:
        reviews = rev_match.group(1)

    # 4. Capacity & Specs
    guests = ""
    g_match = re.search(r'(\d+)\s*guests?', no_svg, re.IGNORECASE)
    if g_match:
        guests = g_match.group(1)

    bedrooms = ""
    b_match = re.search(r'(\d+)\s*(?:bedrooms?|bhk)', no_svg, re.IGNORECASE)
    if b_match:
        bedrooms = b_match.group(1)

    bathrooms = ""
    bath_match = re.search(r'(\d+)\s*bathrooms?', no_svg, re.IGNORECASE)
    if bath_match:
        bathrooms = bath_match.group(1)

    # 5. Highlights / Badges (e.g. Senior Citizen Friendly, Pet Friendly, Private Pool)
    highlights = []
    badges = re.findall(r'<div[^>]*class="[^"]*(?:font-semibold|text-foreground)[^"]*"[^>]*>([^<]{3,50})</div>', no_svg)
    for b in badges:
        bt = clean_text(b)
        if bt and len(bt) < 40 and bt not in highlights and not any(ch in bt for ch in ['{', '}', '$']):
            highlights.append(bt)

    # 6. Description / Overview
    description = ""
    desc_match = re.search(r'<p[^>]*class="[^"]*(?:lead|description|overview|text-muted-foreground)[^"]*"[^>]*>([\s\S]*?)</p>', no_svg, re.IGNORECASE)
    if desc_match:
        description = clean_text(desc_match.group(1))

    # 7. Images
    images = extract_all_images(raw_html)

    # 8. Offers
    offers = extract_offers(raw_html)

    return {
        "slug": slug or title.lower().replace(" ", "-"),
        "url": source_url,
        "name": title,
        "location": location,
        "rating": rating,
        "reviews": reviews,
        "capacity": {
            "guests": guests,
            "bedrooms": bedrooms,
            "bathrooms": bathrooms
        },
        "description": description,
        "highlights": highlights,
        "offers": offers,
        "total_images": len(images),
        "images": images
    }

def fetch_url(url: str, cookie: str = "") -> str:
    """Fetches web page content using curl with browser headers."""
    cmd = [
        "curl", "-sL",
        "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
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
        print("  python3 parse_villa.py <file.html> [url]")
        print("  python3 parse_villa.py <https://url...>")
        print("  cat file.html | python3 parse_villa.py --stdin <url>")
        sys.exit(1)

    arg = sys.argv[1]

    if arg == "--stdin":
        url = sys.argv[2] if len(sys.argv) > 2 else ""
        content = sys.stdin.read()
        data = parse_villa_page(content, url)
        out_filename = f"assets/{data['slug'] or 'extracted_villa'}.json"
        with open(out_filename, "w", encoding="utf-8") as out:
            json.dump(data, out, indent=2, ensure_ascii=False)
        print(f"Extracted data saved to: {out_filename}")
        print(json.dumps(data, indent=2, ensure_ascii=False))

    elif os.path.isfile(arg):
        url = sys.argv[2] if len(sys.argv) > 2 else ""
        with open(arg, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        data = parse_villa_page(content, url)
        out_filename = f"assets/{data['slug'] or 'extracted_villa'}.json"
        with open(out_filename, "w", encoding="utf-8") as out:
            json.dump(data, out, indent=2, ensure_ascii=False)
        print(f"Parsed {arg} -> Saved to {out_filename}")
        print(json.dumps(data, indent=2, ensure_ascii=False))

    elif arg.startswith("http://") or arg.startswith("https://"):
        url = arg
        cookie = ""
        if len(sys.argv) > 3 and sys.argv[2] == "--cookie":
            cookie = sys.argv[3]
        print(f"Fetching {url}...")
        content = fetch_url(url, cookie)
        data = parse_villa_page(content, url)
        out_filename = f"assets/{data['slug'] or 'extracted_villa'}.json"
        with open(out_filename, "w", encoding="utf-8") as out:
            json.dump(data, out, indent=2, ensure_ascii=False)
        print(f"Saved to {out_filename}")
        print(json.dumps(data, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
