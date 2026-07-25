"""Extraction pipeline tests over hand-crafted fixture pages (offline)."""

from pathlib import Path

import pytest

from app.importer.pipeline import (
    WARNING_NO_COMPANY,
    WARNING_NO_TITLE,
    WARNING_SHORT_DESCRIPTION,
    run_pipeline,
)
from app.importer.platforms import platform_for_host

FIXTURES = Path(__file__).parent / "fixtures" / "import"


def load(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


@pytest.mark.parametrize(
    ("host", "slug"),
    [
        ("www.jobindex.dk", "jobindex"),
        ("thehub.io", "thehub"),
        ("jobs.dou.ua", "dou"),
        ("djinni.co", "djinni"),
        ("m.linkedin.com", "linkedin"),
        ("dk.indeed.com", "indeed"),
        ("www.glassdoor.dk", "glassdoor"),
        ("hh.kz", "hh"),
        ("careers.example.com", "example.com"),
    ],
)
def test_platform_for_host(host, slug):
    assert platform_for_host(host) == slug


def test_jsonld_generic():
    result = run_pipeline(load("jsonld_generic.html"), "https://careers.example.com/jobs/123")
    fields = result.fields
    assert result.platform == "example.com"
    assert result.extraction_method == "json_ld"
    # JSON-LD wins over the conflicting og:title / <title>
    assert fields.title == "Senior Python Developer"
    assert fields.company_name == "Acme GmbH"
    assert fields.location == "Copenhagen, DK"
    assert fields.salary == "60000–80000 DKK"
    assert fields.job_type == "full_time"  # FULL_TIME mapped
    assert fields.work_format == "remote"  # TELECOMMUTE mapped
    assert "<p>" not in fields.description and "<li>" not in fields.description
    assert "FastAPI services" in fields.description
    assert result.warnings == []


def test_og_only():
    result = run_pipeline(load("og_only.html"), "https://jobs.nordic-cloud.example/positions/42")
    fields = result.fields
    assert result.extraction_method == "open_graph"
    assert fields.title == "Senior Backend Engineer"
    assert fields.company_name == "Nordic Cloud"
    assert fields.description and len(fields.description) > 120


def test_garbage_page_yields_warnings():
    result = run_pipeline(load("garbage.html"), "https://example.org/whatever")
    assert result.extraction_method == "none"
    assert result.fields.title is None
    assert WARNING_NO_TITLE in result.warnings
    assert WARNING_NO_COMPANY in result.warnings
    assert WARNING_SHORT_DESCRIPTION in result.warnings


def test_jobindex():
    result = run_pipeline(load("jobindex.html"), "https://www.jobindex.dk/vis-job/r123")
    fields = result.fields
    assert result.platform == "jobindex"
    assert result.extraction_method == "json_ld"
    assert fields.title == "Backend Udvikler"
    assert fields.company_name == "Danske Data ApS"
    assert fields.job_type == "full_time"


def test_dou_adapter_only():
    result = run_pipeline(
        load("dou.html"), "https://jobs.dou.ua/companies/petcare/vacancies/1/"
    )
    fields = result.fields
    assert result.platform == "dou"
    assert result.extraction_method == "adapter"
    assert fields.title == "Python Developer"
    assert fields.company_name == "PetCare Solutions"
    assert fields.salary == "$3000–4500"
    assert fields.location == "Київ, віддалено"
    assert "FastAPI" in fields.description


def test_djinni():
    result = run_pipeline(
        load("djinni.html"), "https://djinni.co/jobs/12345-senior-python-engineer/"
    )
    fields = result.fields
    assert result.platform == "djinni"
    # title comes from the <title> tag ("Job at Company" split)
    assert result.extraction_method == "open_graph"
    assert fields.title == "Senior Python Engineer"
    assert fields.company_name == "Coolify"
    assert fields.salary == "$4000-5500"  # adapter fills what og cannot


def test_thehub():
    result = run_pipeline(load("thehub.html"), "https://thehub.io/jobs/abc123")
    fields = result.fields
    assert result.platform == "thehub"
    assert result.extraction_method == "json_ld"
    assert fields.title == "Product Engineer"
    assert fields.company_name == "Copenhagen Startup ApS"
    assert fields.job_type == "full_time"
    # location is absent from the JSON-LD — the adapter patches it
    assert fields.location == "Copenhagen, Denmark"


def test_linkedin():
    result = run_pipeline(load("linkedin.html"), "https://www.linkedin.com/jobs/view/9876")
    fields = result.fields
    assert result.platform == "linkedin"
    assert result.extraction_method == "json_ld"
    assert fields.title == "Staff Engineer"
    assert fields.company_name == "Wolt"
    assert fields.job_type == "full_time"  # list employmentType, first mappable
    # adapter fills location and description missing from the minimal JSON-LD
    assert fields.location == "Helsinki, Uusimaa, Finland"
    assert "Staff Engineer" in fields.description


def test_indeed_adapter_only():
    result = run_pipeline(load("indeed.html"), "https://dk.indeed.com/viewjob?jk=abc")
    fields = result.fields
    assert result.platform == "indeed"
    assert result.extraction_method == "adapter"
    assert fields.title == "Data Engineer"
    assert fields.company_name == "Globex Denmark"
    assert fields.location == "København"
    assert fields.salary == "55.000 kr. om måneden"


def test_glassdoor():
    result = run_pipeline(load("glassdoor.html"), "https://www.glassdoor.com/job-listing/xyz")
    fields = result.fields
    assert result.platform == "glassdoor"
    assert result.extraction_method == "json_ld"
    assert fields.title == "Site Reliability Engineer"
    assert fields.company_name == "Initech"
    assert fields.salary == "€70K–€85K"  # only the adapter sees the salary badge


def test_hh():
    result = run_pipeline(load("hh.html"), "https://hh.ru/vacancy/111")
    fields = result.fields
    assert result.platform == "hh"
    assert result.extraction_method == "json_ld"
    assert fields.title == "Python-разработчик"
    assert fields.company_name == "Рога и Копыта"
    # salary and location come from the HH-Lux-InitialState template JSON
    assert fields.salary == "250000–320000 RUR"
    assert fields.location == "Москва"
