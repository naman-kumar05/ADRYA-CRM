from urllib.parse import quote


def phone_digits(mobile):
    digits = "".join(ch for ch in mobile if ch.isdigit())
    if len(digits) == 10:
        return f"91{digits}"
    if digits.startswith("0") and len(digits) == 11:
        return f"91{digits[1:]}"
    return digits


def tel_href(mobile):
    return f"tel:+{phone_digits(mobile)}"


def whatsapp_href(mobile, text):
    return f"https://wa.me/{phone_digits(mobile)}?text={quote(text)}"


def fill_template(template, values):
    missing = values.get("missing") or "the pending papers"
    return (
        template.replace("{name}", values.get("name", ""))
        .replace("{product}", values.get("product", ""))
        .replace("{code}", values.get("code", ""))
        .replace("{stage}", values.get("stage", ""))
        .replace("{missing}", missing)
    )
