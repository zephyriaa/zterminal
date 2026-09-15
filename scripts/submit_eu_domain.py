import urllib.request
import urllib.parse
import http.cookiejar
import re
import sys
import json

def submit_domain(name_server_1, name_server_2, fqdn="zterminal.eu.org", level="2"):
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    opener.addheaders = [
        ('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'),
        ('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'),
        ('Accept-Language', 'en-US,en;q=0.5'),
    ]

    # Step 1: Login
    login_url = 'https://nic.eu.org/arf/en/'
    req = urllib.request.Request(login_url)
    resp = opener.open(req)
    content = resp.read().decode('utf-8', errors='ignore')

    csrf_match = re.search(r'name=["\']csrfmiddlewaretoken["\'] value=["\']([^"\']+)["\']', content)
    if not csrf_match:
        return {"error": "Failed to get login CSRF token"}
    csrf = csrf_match.group(1)

    data = urllib.parse.urlencode({
        'csrfmiddlewaretoken': csrf,
        'handle': 'AK5350-FREE',
        'password': 'Ayxan20202020!',
        'next': '/arf/en/',
        'login': 'Login'
    }).encode('utf-8')

    post_url = resp.geturl()
    post_req = urllib.request.Request(post_url, data=data, headers={
        'Referer': post_url,
        'Origin': 'https://nic.eu.org',
        'Content-Type': 'application/x-www-form-urlencoded'
    })
    opener.open(post_req)

    # Step 2: Fetch New Domain Form
    nd_url = 'https://nic.eu.org/arf/en/domain/new/'
    nd_req = urllib.request.Request(nd_url, headers={'Referer': 'https://nic.eu.org/arf/en/'})
    nd_resp = opener.open(nd_req)
    nd_content = nd_resp.read().decode('utf-8', errors='ignore')

    nd_csrf_match = re.search(r'name=["\']csrfmiddlewaretoken["\'] value=["\']([^"\']+)["\']', nd_content)
    if not nd_csrf_match:
        return {"error": "Failed to get domain form CSRF token"}
    nd_csrf = nd_csrf_match.group(1)

    # Step 3: Prepare Payload
    payload = {
        'csrfmiddlewaretoken': nd_csrf,
        'fqdn': fqdn,
        'pn1': 'Aykhan K',
        'ad1': '20 yanvar st',
        'ad2': 'aghstafa',
        'ad3': '',
        'ad4': '',
        'ad5': '',
        'ad6': 'AZ',
        'ph1': '705036521',
        'fx1': '0900',
        'private': 'on',
        'th': 'AK5350-FREE',
        'level': str(level),
        'f1': name_server_1,
        'i1': '',
        'f2': name_server_2,
        'i2': '',
        'f3': '',
        'i3': '',
        'f4': '',
        'i4': '',
        'f5': '',
        'i5': '',
        'f6': '',
        'i6': '',
        'f7': '',
        'i7': '',
        'f8': '',
        'i8': '',
        'f9': '',
        'i9': '',
    }

    form_data = urllib.parse.urlencode(payload).encode('utf-8')
    sub_req = urllib.request.Request(nd_url, data=form_data, headers={
        'Referer': nd_url,
        'Origin': 'https://nic.eu.org',
        'Content-Type': 'application/x-www-form-urlencoded'
    })

    sub_resp = opener.open(sub_req)
    sub_content = sub_resp.read().decode('utf-8', errors='ignore')
    
    with open('scripts/submission_result.html', 'w', encoding='utf-8') as f:
        f.write(sub_content)

    return {
        "status_code": sub_resp.status,
        "url": sub_resp.geturl(),
        "length": len(sub_content),
        "snippet": sub_content[:1500]
    }

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python submit_eu_domain.py <ns1> <ns2> [fqdn] [level]")
        sys.exit(1)
    ns1 = sys.argv[1]
    ns2 = sys.argv[2]
    fqdn = sys.argv[3] if len(sys.argv) > 3 else "zterminal.eu.org"
    level = sys.argv[4] if len(sys.argv) > 4 else "2"
    result = submit_domain(ns1, ns2, fqdn, level)
    print(json.dumps(result, indent=2))
