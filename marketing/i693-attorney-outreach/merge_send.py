#!/usr/bin/env python3
"""Mail-merge for the I-693 attorney outreach campaign.

Usage:
  python3 merge_send.py --csv recipients.csv --email 1 --dry-run
  python3 merge_send.py --csv recipients.csv --email 1 --send --subject-variant 1

Dry-run writes one .txt (and .html for email 1) per recipient into ./out/.
--send delivers via SMTP using environment variables:
  SMTP_HOST (default smtp.office365.com), SMTP_PORT (587), SMTP_USER, SMTP_PASS,
  FROM_EMAIL (default docs@lansdownedoctor.com), FROM_NAME.
Throttled to one message every RATE_SECONDS (default 75s = 48/hour).

Only standard library is used.
"""
import argparse
import csv
import os
import re
import smtplib
import sys
import time
from email.message import EmailMessage
from pathlib import Path

HERE = Path(__file__).resolve().parent

DEFAULTS = {
    "I693_FEE": "$250 per applicant, all-inclusive",
    "TURNAROUND": "2-3 business days",
    "APPT_LEAD": "same or next business day",
    "RESTON_ADDRESS": "Reston, VA (address on request)",
    "BOOKING_URL": "https://lansdownedoctor.com",
}

TEMPLATES = {
    "1": ("email-1-intro.md", "email-1-intro.html"),
    "2": ("email-2-followup.md", None),
    "3": ("email-3-final.md", None),
}


def extract_block(md_text):
    """Return the first fenced code block from a markdown file."""
    m = re.search(r"```\n(.*?)\n```", md_text, re.S)
    if not m:
        sys.exit("No fenced body found in template")
    return m.group(1)


def extract_subjects(md_text):
    return re.findall(r"^\d+\. `(.+?)`$", md_text, re.M)


def render(text, ctx):
    def sub(m):
        key = m.group(1)
        if key not in ctx:
            sys.exit(f"Missing merge variable: {key}")
        return ctx[key]
    return re.sub(r"\{\{(\w+)\}\}", sub, text)


def build_context(row, args):
    ctx = dict(DEFAULTS)
    for k in DEFAULTS:
        if os.environ.get(k):
            ctx[k] = os.environ[k]
    ctx["FIRST_NAME"] = (row.get("first_name") or "").strip() or "Counsel"
    ctx["FIRM"] = (row.get("firm") or "").strip() or "your firm"
    ctx["ORIGINAL_SUBJECT"] = args.original_subject or ""
    return ctx


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--csv", required=True)
    p.add_argument("--email", choices=TEMPLATES.keys(), default="1")
    p.add_argument("--subject-variant", type=int, default=1)
    p.add_argument("--original-subject", help="For emails 2/3: the rendered subject of email 1")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--send", action="store_true")
    p.add_argument("--limit", type=int, default=0)
    args = p.parse_args()

    if not (args.dry_run or args.send):
        sys.exit("Pass --dry-run or --send")

    md_name, html_name = TEMPLATES[args.email]
    md = (HERE / md_name).read_text(encoding="utf-8")
    body_tpl = extract_block(md)
    html_tpl = (HERE / html_name).read_text(encoding="utf-8") if html_name else None

    if args.email == "1":
        subjects = extract_subjects(md)
        subject_tpl = subjects[args.subject_variant - 1]
    else:
        if not args.original_subject:
            sys.exit("--original-subject is required for follow-ups")
        subject_tpl = "Re: {{ORIGINAL_SUBJECT}}"

    rows = list(csv.DictReader(open(args.csv, newline="", encoding="utf-8")))
    rows = [r for r in rows if (r.get("email") or "").strip()]
    rows = [r for r in rows if "unsubscribe" not in (r.get("notes") or "").lower()]
    if args.limit:
        rows = rows[: args.limit]

    out_dir = HERE / "out"
    out_dir.mkdir(exist_ok=True)

    smtp = None
    if args.send:
        host = os.environ.get("SMTP_HOST", "smtp.office365.com")
        port = int(os.environ.get("SMTP_PORT", "587"))
        user, pw = os.environ.get("SMTP_USER"), os.environ.get("SMTP_PASS")
        if not (user and pw):
            sys.exit("SMTP_USER and SMTP_PASS are required for --send")
        smtp = smtplib.SMTP(host, port)
        smtp.starttls()
        smtp.login(user, pw)

    from_email = os.environ.get("FROM_EMAIL", "docs@lansdownedoctor.com")
    from_name = os.environ.get("FROM_NAME", "Dr. Rajiv Aggarwal")
    rate = float(os.environ.get("RATE_SECONDS", "75"))

    for i, row in enumerate(rows, 1):
        ctx = build_context(row, args)
        subject = render(subject_tpl, ctx)
        body = render(body_tpl, ctx)
        html = render(html_tpl, ctx) if html_tpl else None
        to = row["email"].strip()
        stem = re.sub(r"[^a-z0-9]+", "-", to.lower()).strip("-")

        (out_dir / f"{stem}.email{args.email}.txt").write_text(
            f"To: {to}\nSubject: {subject}\n\n{body}", encoding="utf-8")
        if html:
            (out_dir / f"{stem}.email{args.email}.html").write_text(html, encoding="utf-8")

        if smtp:
            msg = EmailMessage()
            msg["From"] = f"{from_name} <{from_email}>"
            msg["To"] = to
            msg["Reply-To"] = from_email
            msg["Subject"] = subject
            msg.set_content(body)
            if html:
                msg.add_alternative(html, subtype="html")
            smtp.send_message(msg)
            print(f"[{i}/{len(rows)}] sent -> {to}")
            if i < len(rows):
                time.sleep(rate)
        else:
            print(f"[{i}/{len(rows)}] rendered -> {to}")

    if smtp:
        smtp.quit()
    print(f"Done. Output in {out_dir}")


if __name__ == "__main__":
    main()
