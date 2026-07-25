"""Map job-board hostnames to platform slugs."""

# Registrable domains (matched exactly or as a suffix, so country/mobile
# subdomains like dk.indeed.com, jobs.dou.ua, m.linkedin.com all match).
_DOMAIN_SLUGS = {
    "jobindex.dk": "jobindex",
    "thehub.io": "thehub",
    "dou.ua": "dou",
    "djinni.co": "djinni",
    "linkedin.com": "linkedin",
    "indeed.com": "indeed",
}
# Brands that operate under many country TLDs (glassdoor.com/.dk/..., hh.ru/.kz/...).
_MULTI_TLD_BRANDS = {"glassdoor", "hh"}


def platform_for_host(host: str) -> str:
    """Return a platform slug for a hostname, e.g. "jobs.dou.ua" -> "dou".

    Unknown hosts fall back to the registrable domain ("jobs.example.com" ->
    "example.com"; no public-suffix list, so "foo.co.uk" yields "co.uk").
    """
    host = host.lower().strip(".").split(":")[0]
    for prefix in ("www.", "m."):
        host = host.removeprefix(prefix)

    for domain, slug in _DOMAIN_SLUGS.items():
        if host == domain or host.endswith("." + domain):
            return slug

    labels = host.split(".")
    if len(labels) >= 2 and labels[-2] in _MULTI_TLD_BRANDS:
        return labels[-2]

    return ".".join(labels[-2:]) if len(labels) >= 2 else host
